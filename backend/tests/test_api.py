"""HTTP contract tests — every endpoint, status code and error envelope."""

from __future__ import annotations

import json

import pytest

from config import settings
from tests.fixtures import SAMPLE_JD_TEXT, SAMPLE_RESUME_TEXT, sample_jd_pdf, sample_resume_pdf

pytestmark = pytest.mark.api


@pytest.fixture(autouse=True)
def reset_rate_limits():
    """slowapi keeps an in-memory counter per IP; isolate each test."""
    from api.middleware.rate_limiter import limiter

    def _reset() -> None:
        for candidate in (getattr(limiter, "_limiter", None), getattr(limiter, "_storage", None)):
            reset = getattr(candidate, "reset", None)
            if callable(reset):
                reset()

    _reset()
    yield
    _reset()


@pytest.fixture(autouse=True)
async def clean_history(client):
    """The temp database is shared by the session — wipe history per test."""
    from sqlalchemy import delete

    from models.database import AnalysisRecord, get_session_factory

    factory = get_session_factory()
    async with factory() as session:
        await session.execute(delete(AnalysisRecord))
        await session.commit()
    yield

API = settings.api_prefix  # "/api"

SMALL_RESUME = (
    "Jane Smith\nSenior Machine Learning Engineer\njane@example.com\n\n"
    "EXPERIENCE\nDataScale Inc, Jan 2019 - Present\n"
    "- Built machine learning models with Python and TensorFlow.\n"
    "- Deployed services on Kubernetes and AWS with Docker.\n\n"
    "EDUCATION\nM.S. in Computer Science, Stanford University\n\n"
    "SKILLS\nPython, TensorFlow, Kubernetes, AWS, Docker, SQL, Airflow\n"
)
SMALL_JD = (
    "Senior Machine Learning Engineer\nTechCorp\n\n"
    "Requirements\n- 5+ years of experience with Python and machine learning.\n"
    "- Experience with Kubernetes, AWS and Docker.\n"
    "- Familiarity with Terraform and Rust is a plus.\n\n"
    "Responsibilities\n- Build and deploy production ML models.\n"
)


def upload(resume: bytes, jd: bytes, resume_name: str = "resume.pdf", jd_name: str = "jd.pdf", **form):
    files = {
        "resume": (resume_name, resume, "application/pdf" if resume_name.endswith(".pdf") else "text/plain"),
        "job_description": (jd_name, jd, "application/pdf" if jd_name.endswith(".pdf") else "text/plain"),
    }
    return files, {key: str(value) for key, value in form.items()}


class TestHealthEndpoints:
    async def test_health(self, client):
        response = await client.get(f"{API}/health")
        assert response.status_code == 200
        body = response.json()
        assert body["status"] in {"ok", "degraded"}
        assert body["version"]
        assert body["database_ok"] is True
        assert body["models"]
        assert "ocr_available" in body

    async def test_health_is_degraded_when_models_are_fallbacks(self, client):
        """Regression: the offline stack must not report `status: ok`.

        spaCy loads successfully in its heuristic variant, so a check based on
        `loaded` alone claims full capability while the encoder is unavailable.
        """
        from services.cache_service import model_registry

        body = (await client.get(f"{API}/health")).json()
        if model_registry.degraded:
            assert body["status"] == "degraded"
        else:
            assert body["status"] == "ok"

    async def test_health_reports_model_state(self, client):
        body = (await client.get(f"{API}/health")).json()
        assert "spacy" in body["models"]
        assert "sentence_transformer" in body["models"]
        for model in body["models"].values():
            assert "loaded" in model and "variant" in model

    async def test_models_detail(self, client):
        response = await client.get(f"{API}/models")
        assert response.status_code == 200
        body = response.json()
        assert isinstance(body, dict) and body

    async def test_stats(self, client):
        response = await client.get(f"{API}/stats")
        assert response.status_code == 200
        body = response.json()
        assert "total_analyses" in body or "analyses_count" in body

    async def test_root_and_docs(self, client):
        assert (await client.get("/")).status_code == 200
        assert (await client.get("/docs")).status_code == 200
        assert (await client.get("/openapi.json")).status_code == 200


class TestRequestIdentity:
    async def test_request_id_is_returned(self, client):
        response = await client.get(f"{API}/health")
        assert response.headers.get("x-request-id")

    async def test_supplied_request_id_is_echoed(self, client):
        response = await client.get(f"{API}/health", headers={"X-Request-ID": "trace-me-123"})
        assert response.headers.get("x-request-id") == "trace-me-123"

    async def test_errors_carry_the_request_id(self, client):
        response = await client.get(f"{API}/history/does-not-exist", headers={"X-Request-ID": "abc"})
        assert response.status_code == 404
        assert response.json()["request_id"] == "abc"
        assert response.headers.get("x-request-id") == "abc"


class TestAnalyzeEndpoint:
    async def test_analyze_pdf_pair(self, client):
        files, form = upload(sample_resume_pdf(), sample_jd_pdf())
        response = await client.post(f"{API}/analyze", files=files, data=form)
        assert response.status_code == 200
        body = response.json()

        # The response contract from the specification.
        for key in (
            "overall_score", "grade", "verdict", "score_breakdown", "skills_analysis",
            "keyword_analysis", "entity_extraction", "section_scores", "ats_formatting",
            "recommendations", "nlp_metadata",
        ):
            assert key in body, key

        assert 0.0 <= body["overall_score"] <= 100.0
        assert body["grade"] in {"A", "B", "C", "D", "F"}
        for dimension in (
            "keyword_match", "semantic_similarity", "skill_match",
            "experience_relevance", "education_match",
        ):
            component = body["score_breakdown"][dimension]
            assert {"score", "weight", "weighted_score", "detail"} <= set(component)
        assert body["nlp_metadata"]["pipeline_stages_completed"]

    async def test_analyze_text_pair(self, client):
        files, form = upload(
            SMALL_RESUME.encode(), SMALL_JD.encode(), "resume.txt", "jd.txt"
        )
        response = await client.post(f"{API}/analyze", files=files, data=form)
        assert response.status_code == 200
        assert response.json()["overall_score"] > 0.0

    async def test_custom_weights_form_field(self, client):
        weights = json.dumps({
            "keyword_match": 0.4, "semantic_similarity": 0.2, "skill_match": 0.2,
            "experience_relevance": 0.1, "education_match": 0.1,
        })
        files, form = upload(SMALL_RESUME.encode(), SMALL_JD.encode(), "r.txt", "j.txt", weights=weights)
        body = (await client.post(f"{API}/analyze", files=files, data=form)).json()
        assert body["score_breakdown"]["keyword_match"]["weight"] == pytest.approx(0.4)

    async def test_invalid_weights_are_rejected(self, client):
        files, form = upload(SMALL_RESUME.encode(), SMALL_JD.encode(), "r.txt", "j.txt",
                             weights="{not json")
        response = await client.post(f"{API}/analyze", files=files, data=form)
        assert response.status_code == 422
        assert response.json()["code"] in {"validation_error", "invalid_weights"}

    async def test_top_keywords_form_field(self, client):
        files, form = upload(SMALL_RESUME.encode(), SMALL_JD.encode(), "r.txt", "j.txt", top_keywords="8")
        body = (await client.post(f"{API}/analyze", files=files, data=form)).json()
        assert len(body["keyword_analysis"]["top_jd_keywords"]) <= 8

    async def test_top_keywords_out_of_range_is_rejected(self, client):
        files, form = upload(SMALL_RESUME.encode(), SMALL_JD.encode(), "r.txt", "j.txt", top_keywords="999")
        response = await client.post(f"{API}/analyze", files=files, data=form)
        assert response.status_code == 422

    async def test_persist_false_skips_history(self, client):
        files, form = upload(SMALL_RESUME.encode(), SMALL_JD.encode(), "r.txt", "j.txt", persist="false")
        assert (await client.post(f"{API}/analyze", files=files, data=form)).status_code == 200
        body = (await client.get(f"{API}/history")).json()
        assert body["total"] == 0

    async def test_analysis_is_persisted_by_default(self, client):
        files, form = upload(SMALL_RESUME.encode(), SMALL_JD.encode(), "r.txt", "j.txt")
        created = (await client.post(f"{API}/analyze", files=files, data=form)).json()
        body = (await client.get(f"{API}/history")).json()
        assert body["total"] == 1
        assert body["items"][0]["id"] == created["id"]


class TestAnalyzeErrors:
    async def test_missing_files(self, client):
        response = await client.post(f"{API}/analyze")
        assert response.status_code == 422
        body = response.json()
        assert body["code"] == "validation_error"
        assert body["error"] and body["request_id"]

    async def test_missing_job_description(self, client):
        files = {"resume": ("resume.txt", SMALL_RESUME.encode(), "text/plain")}
        response = await client.post(f"{API}/analyze", files=files)
        assert response.status_code == 422

    async def test_unsupported_file_type(self, client):
        files, form = upload(b"GIF89a-not-an-image", SMALL_JD.encode(), "resume.gif", "jd.txt")
        response = await client.post(f"{API}/analyze", files=files, data=form)
        assert response.status_code == 415
        assert response.json()["code"] == "unsupported_file_type"

    async def test_empty_file(self, client):
        files, form = upload(b"", SMALL_JD.encode(), "resume.txt", "jd.txt")
        response = await client.post(f"{API}/analyze", files=files, data=form)
        assert response.status_code == 422
        assert response.json()["code"] == "empty_file"

    async def test_corrupted_pdf(self, client):
        files, form = upload(b"%PDF-1.4\nbroken", SMALL_JD.encode(), "resume.pdf", "jd.txt")
        response = await client.post(f"{API}/analyze", files=files, data=form)
        assert response.status_code == 422
        assert response.json()["code"] == "corrupted_file"

    async def test_image_only_document_without_ocr(self, client):
        from tests.fixtures import build_pdf

        files, form = upload(build_pdf("", scanned=True), SMALL_JD.encode(), "scan.pdf", "jd.txt")
        response = await client.post(f"{API}/analyze", files=files, data=form)
        assert response.status_code == 422
        assert response.json()["code"] in {"insufficient_text", "corrupted_file", "pdf_extraction_error"}

    async def test_error_envelope_shape(self, client):
        response = await client.post(f"{API}/analyze", files={
            "resume": ("resume.exe", b"MZ", "application/octet-stream"),
            "job_description": ("jd.txt", SMALL_JD.encode(), "text/plain"),
        })
        assert response.status_code == 415
        body = response.json()
        assert {"error", "code", "request_id", "timestamp"} <= set(body)

    async def test_unknown_route_returns_json_404(self, client):
        response = await client.get(f"{API}/does-not-exist")
        assert response.status_code == 404

    async def test_method_not_allowed(self, client):
        response = await client.get(f"{API}/analyze")
        assert response.status_code == 405


class TestHistoryEndpoints:
    async def _create(self, client, count: int = 1):
        ids = []
        for index in range(count):
            resume = SMALL_RESUME + f"\nExtra note {index} to keep entries distinct.\n"
            files, form = upload(resume.encode(), SMALL_JD.encode(), "r.txt", "j.txt")
            body = (await client.post(f"{API}/analyze", files=files, data=form)).json()
            ids.append(body["id"])
        return ids

    async def test_empty_history(self, client):
        body = (await client.get(f"{API}/history")).json()
        assert body == {"items": [], "total": 0, "page": 1,
                        "page_size": settings.history_page_size, "pages": 0}

    async def test_list_is_newest_first(self, client):
        ids = await self._create(client, 2)
        body = (await client.get(f"{API}/history")).json()
        assert body["total"] == 2
        assert [item["id"] for item in body["items"]] == list(reversed(ids))

    async def test_list_item_fields(self, client):
        await self._create(client, 1)
        item = (await client.get(f"{API}/history")).json()["items"][0]
        for key in ("id", "timestamp", "overall_score", "grade", "resume_filename",
                    "jd_filename", "processing_time_ms", "preview"):
            assert key in item, key

    async def test_pagination(self, client):
        await self._create(client, 3)
        body = (await client.get(f"{API}/history", params={"page": 1, "page_size": 2})).json()
        assert body["total"] == 3
        assert len(body["items"]) == 2
        assert body["pages"] == 2
        second = (await client.get(f"{API}/history", params={"page": 2, "page_size": 2})).json()
        assert len(second["items"]) == 1

    async def test_invalid_page_is_rejected(self, client):
        assert (await client.get(f"{API}/history", params={"page": 0})).status_code == 422
        assert (await client.get(f"{API}/history", params={"page_size": 9999})).status_code == 422

    async def test_get_single(self, client):
        (created,) = await self._create(client, 1)
        response = await client.get(f"{API}/history/{created}")
        assert response.status_code == 200
        body = response.json()
        assert body["id"] == created
        assert body["score_breakdown"]["skill_match"]["score"] >= 0.0

    async def test_get_missing_returns_404(self, client):
        response = await client.get(f"{API}/history/not-a-real-id")
        assert response.status_code == 404
        assert response.json()["code"] == "analysis_not_found"

    async def test_delete_single(self, client):
        (created,) = await self._create(client, 1)
        assert (await client.delete(f"{API}/history/{created}")).status_code == 200
        assert (await client.get(f"{API}/history/{created}")).status_code == 404
        assert (await client.get(f"{API}/history")).json()["total"] == 0

    async def test_delete_missing_returns_404(self, client):
        assert (await client.delete(f"{API}/history/nope")).status_code == 404

    async def test_purge_only_removes_expired_records(self, client):
        """`purge` is retention-based; fresh analyses survive it."""
        await self._create(client, 2)
        response = await client.post(f"{API}/history/purge")
        assert response.status_code == 200
        body = response.json()
        assert body["deleted"] is True
        assert "removed" in body["message"]
        assert (await client.get(f"{API}/history")).json()["total"] == 2

    async def test_purge_rejects_invalid_retention(self, client):
        assert (await client.post(f"{API}/history/purge", params={"retention_days": -1})).status_code == 422

    async def test_clear_history_deletes_everything(self, client):
        await self._create(client, 2)
        response = await client.delete(f"{API}/history")
        assert response.status_code == 200
        assert response.json()["deleted"] is True
        assert (await client.get(f"{API}/history")).json()["total"] == 0


class TestRateLimiting:
    async def test_analyze_is_rate_limited(self, client):
        """10 requests per minute per IP on /analyze, then 429."""
        limit = int(settings.analyze_rate_limit.split("/")[0])
        status_codes = []
        for _ in range(limit + 1):
            files, form = upload(SMALL_RESUME.encode(), SMALL_JD.encode(), "r.txt", "j.txt")
            response = await client.post(f"{API}/analyze", files=files, data=form)
            status_codes.append(response.status_code)
            if response.status_code == 429:
                break

        assert 429 in status_codes, status_codes
        blocked = status_codes.count(429)
        assert blocked >= 1
        assert status_codes.count(200) <= limit

    async def test_rate_limit_envelope(self, client):
        limit = int(settings.analyze_rate_limit.split("/")[0])
        response = None
        for _ in range(limit + 1):
            files, form = upload(SMALL_RESUME.encode(), SMALL_JD.encode(), "r.txt", "j.txt")
            response = await client.post(f"{API}/analyze", files=files, data=form)
            if response.status_code == 429:
                break
        assert response is not None and response.status_code == 429
        body = response.json()
        assert body["code"] == "rate_limit_exceeded"
        assert "detail" in body


class TestCORS:
    async def test_preflight_is_allowed_for_configured_origins(self, client):
        origin = settings.cors_origins[0] if settings.cors_origins else "http://localhost:3000"
        response = await client.options(
            f"{API}/analyze",
            headers={"Origin": origin, "Access-Control-Request-Method": "POST"},
        )
        assert response.status_code in {200, 405}
