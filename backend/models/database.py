"""SQLAlchemy models and the analysis history repository.

SQLite (via ``aiosqlite``) stores one row per analysis: identity, score, file
names, timing and the complete result JSON. Keeping the JSON blob means the
schema never has to change when the analysis payload grows.
"""

from __future__ import annotations

import json
import uuid
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any, AsyncIterator, Dict, List, Optional, Tuple

from sqlalchemy import DateTime, Float, Integer, String, Text, delete, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import (
    AsyncAttrs,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from config import VAR_DIR, settings
from models.schemas import AnalysisListItem, AnalysisResponse
from utils.exceptions import DatabaseError, NotFoundError
from utils.logger import get_logger
from utils.text_utils import truncate

logger = get_logger(__name__)


class Base(AsyncAttrs, DeclarativeBase):
    """Declarative base for all ORM models."""


class AnalysisRecord(Base):
    """One completed resume/job-description analysis."""

    __tablename__ = "analyses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    overall_score: Mapped[float] = mapped_column(Float, default=0.0, index=True)
    grade: Mapped[str] = mapped_column(String(2), default="C")
    result_json: Mapped[str] = mapped_column(Text, default="{}")
    resume_filename: Mapped[str] = mapped_column(String(255), default="resume.pdf")
    jd_filename: Mapped[str] = mapped_column(String(255), default="job_description.pdf")
    processing_time_ms: Mapped[float] = mapped_column(Float, default=0.0)
    resume_word_count: Mapped[int] = mapped_column(Integer, default=0)
    jd_word_count: Mapped[int] = mapped_column(Integer, default=0)
    preview: Mapped[str] = mapped_column(String(300), default="")

    def to_response(self) -> AnalysisResponse:
        """Rehydrate the stored analysis into an API response."""
        payload: Dict[str, Any] = {}
        try:
            payload = json.loads(self.result_json or "{}")
        except json.JSONDecodeError:
            logger.warning("corrupt_result_json", extra={"id": self.id})
        payload.setdefault("id", self.id)
        payload.setdefault("timestamp", self.created_at.isoformat())
        payload.setdefault("overall_score", self.overall_score)
        return AnalysisResponse.model_validate(payload)

    def to_list_item(self) -> AnalysisListItem:
        """Compact projection used by the history listing endpoint."""
        try:
            payload = json.loads(self.result_json or "{}")
        except json.JSONDecodeError:
            payload = {}
        skills = payload.get("skills_analysis", {}) or {}
        return AnalysisListItem(
            id=self.id,
            timestamp=self.created_at,
            overall_score=self.overall_score,
            grade=self.grade,
            resume_filename=self.resume_filename,
            jd_filename=self.jd_filename,
            processing_time_ms=self.processing_time_ms,
            preview=self.preview,
            top_matched_skills=list(skills.get("matched", []))[:6],
            top_missing_skills=list(skills.get("missing", []))[:6],
        )


# --------------------------------------------------------------------------- #
# Engine / session management
# --------------------------------------------------------------------------- #
_engine = None
_session_factory: Optional[async_sessionmaker[AsyncSession]] = None


def get_engine():
    """Return (and lazily create) the async engine."""
    global _engine, _session_factory
    if _engine is None:
        # Ensure the directory holding the SQLite file exists.
        VAR_DIR.mkdir(parents=True, exist_ok=True)
        _engine = create_async_engine(
            settings.database_url,
            echo=settings.db_echo,
            future=True,
            connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
        )
        _session_factory = async_sessionmaker(_engine, expire_on_commit=False, class_=AsyncSession)
        logger.info("database_engine_created", extra={"url": _redact(settings.database_url)})
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Return the session factory, creating the engine if needed."""
    get_engine()
    assert _session_factory is not None
    return _session_factory


async def init_db() -> None:
    """Create tables if they do not exist."""
    engine = get_engine()
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("database_initialised", extra={"tables": list(Base.metadata.tables)})
    except SQLAlchemyError as exc:
        logger.error("database_init_failed", extra={"error": str(exc)}, exc_info=True)
        raise DatabaseError("Could not initialise the database.", detail=str(exc)) from exc


async def dispose_db() -> None:
    """Dispose of the engine on shutdown."""
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
        _engine = None
        _session_factory = None
        logger.info("database_disposed")


async def session_scope() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency yielding a session."""
    factory = get_session_factory()
    async with factory() as session:
        yield session


def _redact(url: str) -> str:
    return url.split("@")[-1] if "@" in url else url


# --------------------------------------------------------------------------- #
# Repository
# --------------------------------------------------------------------------- #
class AnalysisRepository:
    """CRUD + aggregate queries over :class:`AnalysisRecord`."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def save(
        self,
        result: AnalysisResponse,
        *,
        resume_filename: str = "resume.pdf",
        jd_filename: str = "job_description.pdf",
        preview: str = "",
    ) -> AnalysisRecord:
        """Persist an analysis result."""
        record = AnalysisRecord(
            id=result.id,
            created_at=result.timestamp,
            overall_score=result.overall_score,
            grade=result.grade,
            result_json=result.model_dump_json(),
            resume_filename=resume_filename or result.resume_filename,
            jd_filename=jd_filename or result.jd_filename,
            processing_time_ms=result.nlp_metadata.processing_time_ms,
            resume_word_count=result.nlp_metadata.resume_word_count,
            jd_word_count=result.nlp_metadata.jd_word_count,
            preview=preview or truncate(result.verdict, 280),
        )
        try:
            self.session.add(record)
            await self.session.commit()
            await self.session.refresh(record)
        except SQLAlchemyError as exc:
            await self.session.rollback()
            logger.error("analysis_save_failed", extra={"error": str(exc)}, exc_info=True)
            raise DatabaseError("Could not save the analysis result.", detail=str(exc)) from exc
        logger.info("analysis_saved", extra={"id": record.id, "score": record.overall_score})
        return record

    async def get(self, analysis_id: str) -> AnalysisResponse:
        """Fetch a full analysis by id."""
        record = await self._get_record(analysis_id)
        return record.to_response()

    async def _get_record(self, analysis_id: str) -> AnalysisRecord:
        try:
            record = await self.session.get(AnalysisRecord, analysis_id)
        except SQLAlchemyError as exc:
            raise DatabaseError("Database query failed.", detail=str(exc)) from exc
        if record is None:
            raise NotFoundError(
                f"No analysis found with id '{analysis_id}'.",
                code="analysis_not_found",
                context={"id": analysis_id},
            )
        return record

    async def list(
        self, page: int = 1, page_size: Optional[int] = None
    ) -> Tuple[List[AnalysisListItem], int]:
        """Paginated history, newest first."""
        page = max(1, page)
        size = min(max(1, page_size or settings.history_page_size), settings.history_max_page_size)
        try:
            total = (await self.session.execute(select(func.count(AnalysisRecord.id)))).scalar_one()
            rows = (
                await self.session.execute(
                    select(AnalysisRecord)
                    .order_by(AnalysisRecord.created_at.desc())
                    .offset((page - 1) * size)
                    .limit(size)
                )
            ).scalars().all()
        except SQLAlchemyError as exc:
            raise DatabaseError("Could not read analysis history.", detail=str(exc)) from exc
        return [row.to_list_item() for row in rows], int(total)

    async def delete(self, analysis_id: str) -> bool:
        """Delete one analysis; raises :class:`NotFoundError` when absent."""
        record = await self._get_record(analysis_id)
        try:
            await self.session.delete(record)
            await self.session.commit()
        except SQLAlchemyError as exc:
            await self.session.rollback()
            raise DatabaseError("Could not delete the analysis.", detail=str(exc)) from exc
        logger.info("analysis_deleted", extra={"id": analysis_id})
        return True

    async def count(self) -> int:
        try:
            return int((await self.session.execute(select(func.count(AnalysisRecord.id)))).scalar_one())
        except SQLAlchemyError:
            return 0

    async def purge_old(self, retention_days: Optional[int] = None) -> int:
        """Delete analyses older than the retention window."""
        days = retention_days if retention_days is not None else settings.history_retention_days
        if days <= 0:
            return 0
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        try:
            result = await self.session.execute(
                delete(AnalysisRecord).where(AnalysisRecord.created_at < cutoff)
            )
            await self.session.commit()
            deleted = int(result.rowcount or 0)
        except SQLAlchemyError as exc:
            await self.session.rollback()
            raise DatabaseError("Retention cleanup failed.", detail=str(exc)) from exc
        if deleted:
            logger.info("history_purged", extra={"deleted": deleted, "cutoff": cutoff.isoformat()})
        return deleted

    async def clear_all(self) -> int:
        """Delete every stored analysis. Returns the number of rows removed."""
        try:
            result = await self.session.execute(delete(AnalysisRecord))
            await self.session.commit()
            deleted = int(result.rowcount or 0)
        except SQLAlchemyError as exc:
            await self.session.rollback()
            raise DatabaseError("Could not clear analysis history.", detail=str(exc)) from exc
        if deleted:
            logger.warning("history_cleared", extra={"deleted": deleted})
        return deleted

    async def most_common_missing_skills(self, limit: int = 8) -> List[Dict[str, Any]]:
        """Tally missing skills across stored results (JSON scan, best effort)."""
        try:
            rows = (
                await self.session.execute(select(AnalysisRecord.result_json))
            ).scalars().all()
        except SQLAlchemyError as exc:
            logger.warning("missing_skills_query_failed", extra={"error": str(exc)})
            return []

        counts: Counter[str] = Counter()
        for payload in rows:
            try:
                data = json.loads(payload) if isinstance(payload, str) else (payload or {})
            except json.JSONDecodeError:
                continue
            for skill in (data.get("skills_analysis") or {}).get("missing", []) or []:
                if isinstance(skill, str) and skill.strip():
                    counts[skill.strip()] += 1

        return [
            {"skill": skill, "count": count}
            for skill, count in counts.most_common(max(1, limit))
        ]

    async def stats(self) -> Dict[str, Any]:
        """Aggregate statistics for dashboards."""
        try:
            row = (
                await self.session.execute(
                    select(
                        func.count(AnalysisRecord.id),
                        func.avg(AnalysisRecord.overall_score),
                        func.max(AnalysisRecord.overall_score),
                        func.min(AnalysisRecord.overall_score),
                    )
                )
            ).one()
            grades = (
                await self.session.execute(
                    select(AnalysisRecord.grade, func.count(AnalysisRecord.id)).group_by(
                        AnalysisRecord.grade
                    )
                )
            ).all()
        except SQLAlchemyError as exc:
            raise DatabaseError("Could not compute statistics.", detail=str(exc)) from exc

        total = int(row[0] or 0)
        return {
            "total_analyses": total,
            "average_score": round(float(row[1] or 0.0), 2),
            "best_score": round(float(row[2] or 0.0), 2),
            "worst_score": round(float(row[3] or 0.0), 2),
            "score_distribution": {str(grade): int(count) for grade, count in grades},
        }


__all__ = [
    "Base",
    "AnalysisRecord",
    "AnalysisRepository",
    "init_db",
    "dispose_db",
    "session_scope",
    "get_engine",
    "get_session_factory",
]
