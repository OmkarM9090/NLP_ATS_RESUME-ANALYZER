# ATS Resume Matcher

NLP-powered **Applicant Tracking System (ATS) resume analyzer**. Upload a resume and a
job description, get back a weighted match score, matched/missing skills, keyword and
entity analysis, per-section scores, an ATS-formatting audit and prioritised,
actionable recommendations.

```
overall_score 80.3  grade B  "Strong match — the resume covers most requirements with a few gaps."

keyword_match         67.2  (w 0.25)   TF-IDF cosine + top-keyword coverage
semantic_similarity   81.6  (w 0.30)   sentence-transformers / TF-IDF+LSA fallback
skill_match           81.0  (w 0.25)   taxonomy canonicalisation + fuzzy + semantic
experience_relevance  87.9  (w 0.10)   years vs. requirement, title overlap, impact signals
education_match      100.0  (w 0.10)   degree rank + field-of-study agreement
```

---

## Status

| Layer | State |
| --- | --- |
| Backend NLP pipeline (14 stages) | ✅ complete, verified end to end |
| Backend REST API + persistence | ✅ complete, verified end to end |
| Test fixtures & sample documents | ✅ `backend/tests/fixtures.py` |
| Next.js frontend (landing / analyze / results / history) | ✅ complete, wired to the API |
| Pytest suite | 🚧 in progress |
| Dockerfile / docker-compose | 🚧 in progress |

Both halves run together: the Next.js dev server proxies every `/api/*` request to
the FastAPI backend (`next.config.ts` rewrites → `http://127.0.0.1:8000`), so the
browser only ever talks to the frontend origin. `POST /api/analyze` returns the
complete result payload, `POST /api/sample` analyses the bundled demo documents,
and `/docs` gives an interactive OpenAPI UI.

---

## Architecture

```
backend/
├── main.py                     FastAPI app factory, lifespan (DB init, model warm-up)
├── config.py                   pydantic-settings: every tunable, env-overridable
├── api/
│   ├── router.py               mounts everything under /api
│   ├── middleware/             request-id + timing, CORS/GZip, error mapping, rate limit
│   └── endpoints/              analyze.py, health.py, history.py
├── core/                       the NLP engine (one module per pipeline stage)
│   ├── pdf_extractor.py        1  PDF/DOCX/TXT extraction (+ OCR fallback)
│   ├── text_cleaner.py         2  unicode/whitespace normalisation, contact harvesting
│   ├── tokenizer.py            3  tokenization with ~140 protected technical terms
│   ├── nlp_pipeline.py         4-6 stop-word removal, lemmatisation, POS tagging
│   ├── heuristic_nlp.py        offline spaCy components (lexicon POS, rules, gazetteer NER)
│   ├── entity_extractor.py     7  skills, dates, degrees, orgs, titles, locations
│   ├── section_parser.py       8  12 canonical resume sections, ~120 aliases
│   ├── keyword_extractor.py    9  TF-IDF + native RAKE + TextRank, comparison, density
│   ├── semantic_analyzer.py   11  sentence-transformers, TF-IDF+LSA fallback
│   ├── skill_matcher.py       10  taxonomy canonicalisation → exact → fuzzy → semantic
│   ├── similarity_engine.py   12  the five weighted dimensions + per-section scores
│   ├── gap_analyzer.py        13  missing skills/keywords, weak sections, experience gaps
│   └── report_generator.py    14  13 ATS formatting checks + prioritised recommendations
├── services/
│   ├── cache_service.py        model registry: load chain, warm-up, degradation status
│   └── analysis_service.py     orchestrates all 14 stages, returns AnalysisResponse
├── models/
│   ├── schemas.py              the full Pydantic v2 API contract
│   └── database.py             SQLAlchemy async engine, AnalysisRecord, repository
├── data/                       198 KB of curated JSON knowledge
│   ├── skill_taxonomy.json     ~700 skills in 10 categories with aliases
│   ├── industry_keywords.json  role families, seniority, education levels
│   ├── gazetteers.json         degrees, certifications, orgs, locations, titles
│   ├── stop_words_extended.json resume/JD boilerplate, filler verbs, weak modifiers
│   └── pos_lexicon.json        lexicon for the offline POS tagger
├── utils/                      logger (JSON + request-id), text utils, typed errors,
│                               upload validator
└── tests/fixtures.py           realistic sample resume/JD + ReportLab PDF builders
```

### Graceful degradation by design

The pipeline prefers the best available model and *always* produces a result:

```
spaCy:        en_core_web_lg → en_core_web_sm/md → offline heuristic pipeline
              (blank model + sentencizer + lexicon POS tagger + rule lemmatiser
               + shallow parser + gazetteer EntityRuler)
embeddings:   all-MiniLM-L6-v2 → TF-IDF + TruncatedSVD (LSA) over sentence chunks
OCR:          pytesseract + pdf2image → disabled with a warning (never an error)
```

Every fallback is observable, never silent:

* `nlp_metadata.degraded_mode` — `true` when a fallback is active
* `nlp_metadata.models_used` — exactly which components produced the result
* `nlp_metadata.warnings` — human-readable notes (OCR unavailable, short document…)
* `GET /api/health` and `GET /api/models` — per-model load state, variant and error

---

## API

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/analyze` | Multipart `resume` + `job_description` → full analysis |
| `POST` | `/api/sample` | Analyse the bundled sample resume × job description |
| `GET` | `/api/health` | Service, model, OCR and database health |
| `GET` | `/api/stats` | Aggregate statistics over stored analyses |
| `GET` | `/api/models` | Detailed NLP model registry state + score weights |
| `GET` | `/api/history` | Paginated history (`?page=1&page_size=20`) |
| `GET` | `/api/history/{id}` | One stored analysis (full payload) |
| `DELETE` | `/api/history/{id}` | Delete one analysis |
| `DELETE` | `/api/history` | Clear all history |
| `POST` | `/api/history/purge` | Apply the retention window now |

`POST /api/analyze` accepts optional form fields: `weights` (JSON object),
`top_keywords` (5–60), `include_section_text`, `persist`.

### Error contract

Every failure returns the same envelope — never a traceback:

```json
{
  "error": "The resume file type '.exe' is not supported. Allowed types: .pdf, .txt, .docx.",
  "detail": null,
  "code": "unsupported_file_type",
  "request_id": "85c0190a030b4df3",
  "timestamp": "2026-10-04T12:59:25.344+00:00"
}
```

| Situation | HTTP | `code` |
| --- | --- | --- |
| Unsupported extension | 415 | `unsupported_file_type` |
| File too large | 413 | `file_too_large` |
| Empty upload | 422 | `empty_file` |
| Corrupted / unreadable PDF | 422 | `corrupted_file` |
| Password-protected PDF | 422 | `encrypted_file` |
| Too little extractable text | 422 | `insufficient_text` |
| No text at all (scan, no OCR) | 422 | `pdf_extraction_error` |
| Missing form field | 422 | `validation_error` |
| Analysis over the time budget | 408 | `analysis_timeout` |
| More than 10 analyses/min/IP | 429 | `rate_limit_exceeded` |
| Unknown history id | 404 | `analysis_not_found` |
| Pipeline failure | 500 | `nlp_processing_error` |

Responses carry `X-Request-ID` (echoed from the request when supplied) and
`X-Process-Time-Ms`; rate-limited routes also return `X-RateLimit-*`.

### Example

```bash
curl -s http://localhost:8000/api/analyze \
  -F "resume=@resume.pdf" \
  -F "job_description=@job_description.pdf" \
  -F 'weights={"keyword_match":0.3,"semantic_similarity":0.3,"skill_match":0.25,"experience_relevance":0.075,"education_match":0.075}' \
  | jq '{overall_score, grade, verdict, matched: .skills_analysis.matched, missing: .skills_analysis.missing}'
```

---

## Running it

### One command

```bash
./run.sh            # installs deps on first run, starts backend :8000 + frontend :3000
./run.sh --backend  # API only
./run.sh --frontend # UI only
```

### Manual

**Backend** (FastAPI on :8000):

```bash
cd backend
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Optional but strongly recommended for full accuracy:
python -m spacy download en_core_web_lg
# sentence-transformers downloads all-MiniLM-L6-v2 on first use (~90 MB).

cp .env.example .env          # adjust if needed
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend** (Next.js on :3000, proxies `/api/*` to the backend):

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

Open <http://localhost:3000> for the UI, or <http://localhost:8000/docs> for the
interactive API. The backend host the frontend proxies to can be overridden with
`BACKEND_URL` (rewrites) / `API_BASE_URL` (server-side history fetch).

Without the model downloads the service still works — it runs the offline
heuristic pipeline plus the TF-IDF/LSA semantic encoder and reports
`degraded_mode: true`.

### Notes

* CPU-bound NLP runs in a thread pool (`run_in_threadpool`) so the event loop
  stays responsive; `/api/analyze` is bounded by `ANALYSIS_TIMEOUT_SECONDS`.
* History lives in SQLite (`backend/var/ats_history.db`, created on first run,
  git-ignored). Records older than `HISTORY_RETENTION_DAYS` are purged at startup.

---

## Design decisions worth knowing

* **Both TF-IDF *and* embeddings are computed and weighted.** The keyword
  dimension blends TF-IDF cosine (45%) with coverage of the top-25 JD keywords
  (55%); the semantic dimension uses the transformer when available, LSA otherwise.
* **Raw cosines are calibrated, not reported.** A resume/JD TF-IDF cosine of 0.15
  is already a strong match, so scores pass through `1 - exp(-x / τ)` with
  separate τ for keywords (0.20) and semantics (0.25 transformer / 0.15 LSA).
  This keeps 0–100 numbers human-meaningful across encoders.
* **LSA is fitted over sentence-level chunks of both documents**, then mean-pooled.
  Fitting on just two documents makes every cosine ≈ 1.0 — a degenerate result.
* **Skill matching is layered**: taxonomy canonicalisation → exact → rapidfuzz
  (`token_set_ratio`/`partial_ratio` ≥ 85) → embedding cosine ≥ 0.72. Partial
  matches earn half credit and are reported separately as "near-miss terminology".
* **Ambiguous aliases are guarded.** Bare "next" would match "building the *next*
  generation" and report Next.js as a requirement, so ambiguous single-word
  aliases are either dropped or matched only with the technology's own
  capitalisation (`Go`, `Rust`, `Spark`).
* **Education dates never inflate experience.** "2012 – 2016" under EDUCATION is
  excluded by both section spans and a degree-context window, so the sample resume
  reports 8.3 years, not 14.4.
* **Compound technical tokens survive cleaning.** `C++`, `Node.js`, `CI/CD`,
  `M.S.` are protected span-wise (no placeholder sentinels, which get eaten by
  the special-character pass).
* **Recommendations are deduplicated across categories** and capped at 14, sorted
  by priority then impact, so the UI never shows the same advice twice.
* **Only actionable sections generate "improve this" advice.** Awards/languages/
  volunteering legitimately score low against a JD; they are reported, not nagged.

---

## Verification

`backend/tests/fixtures.py` provides a realistic multi-section ML resume and a
matching job description (plus an unrelated nursing pair and corrupted/oversized
payloads) rendered to real PDFs with ReportLab — no binary fixtures in git.

Measured on a 2-vCPU / 3 GB sandbox in **offline degraded mode** (heuristic spaCy
pipeline + LSA encoder):

| Case | Result |
| --- | --- |
| ML resume ↔ ML job description (PDF) | **80.3 / B**, 810 ms, 17 skills matched, 4 missing |
| Same pair as plain text, custom weights | 74.1, weights applied verbatim |
| `.exe` upload | 415 `unsupported_file_type` |
| Corrupted PDF | 422 `corrupted_file` |
| Empty file | 422 `empty_file` |
| Missing form field | 422 `validation_error` |
| Unknown history id | 404 `analysis_not_found` |
| Delete → history | record removed, count updated |

---

## License

MIT
