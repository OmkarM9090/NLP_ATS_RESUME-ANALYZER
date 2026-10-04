"""Structured logging utilities.

Provides a single :func:`get_logger` entry point used across the codebase.
Output is either human readable (development) or single-line JSON
(production / log aggregation), controlled by ``settings.log_json``.

Every log record can carry a ``request_id`` so that all lines produced while
servicing one analysis can be correlated.
"""

from __future__ import annotations

import contextvars
import json
import logging
import sys
import time
from typing import Any, Mapping, Optional

from config import settings

# --------------------------------------------------------------------------- #
# Request-scoped context
# --------------------------------------------------------------------------- #
_request_id_ctx: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "request_id", default=None
)


def set_request_id(request_id: str | None) -> contextvars.Token:
    """Bind a request id to the current async/thread context.

    Returns the :class:`contextvars.Token` so callers can restore the previous
    value with :func:`reset_request_id` (important in middleware, where the same
    worker thread/task services many requests).
    """
    return _request_id_ctx.set(request_id)


def reset_request_id(token: Optional[contextvars.Token]) -> None:
    """Restore the request id captured by :func:`set_request_id`."""
    if token is None:
        return
    try:
        _request_id_ctx.reset(token)
    except (ValueError, LookupError):  # pragma: no cover - token from another ctx
        _request_id_ctx.set(None)


def get_request_id() -> str | None:
    """Return the request id bound to the current context (if any)."""
    return _request_id_ctx.get()


class _ContextFilter(logging.Filter):
    """Injects the current request id and a millisecond timestamp."""

    def filter(self, record: logging.LogRecord) -> bool:  # noqa: D102
        record.request_id = get_request_id() or "-"
        record.created_ms = int(record.created * 1000)
        return True


class SafeLogger(logging.Logger):
    """Logger that tolerates reserved attribute names in ``extra``.

    ``logging`` raises ``KeyError: "Attempt to overwrite 'filename' in
    LogRecord"`` when a caller passes a key that already exists on ``LogRecord``
    (``filename``, ``module``, ``name``, ``message``, ...). Structured logging
    makes that easy to hit by accident, and it would turn a harmless log line
    into a 500. Instead of failing, such keys are prefixed with ``x_``.
    """

    _RESERVED_KEYS = frozenset(
        logging.LogRecord("", 0, "", 0, "", (), None).__dict__
    ) | {"message", "asctime"}

    def makeRecord(  # noqa: D102 - signature fixed by the stdlib
        self,
        name: str,
        level: int,
        fn: str,
        lno: int,
        msg: Any,
        args: Any,
        exc_info: Any,
        func: Optional[str] = None,
        extra: Optional[Mapping[str, Any]] = None,
        sinfo: Optional[str] = None,
    ) -> logging.LogRecord:
        if extra:
            sanitized: dict[str, Any] = {}
            for key, value in dict(extra).items():
                if key in self._RESERVED_KEYS or key in ("request_id", "created_ms"):
                    sanitized[f"x_{key}"] = value
                else:
                    sanitized[key] = value
            extra = sanitized
        return super().makeRecord(
            name, level, fn, lno, msg, args, exc_info, func, extra, sinfo
        )


# Every logger created from here on is a SafeLogger. This runs as soon as
# ``utils.logger`` is imported, which happens before any application module
# calls ``get_logger(__name__)``.
logging.setLoggerClass(SafeLogger)


class JsonFormatter(logging.Formatter):
    """Single-line JSON log formatter."""

    _RESERVED = set(logging.LogRecord("", 0, "", 0, "", (), None).__dict__) | {
        "message",
        "asctime",
        "request_id",
        "created_ms",
    }

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(record.created))
            + f".{int(record.msecs):03d}Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", "-"),
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        for key, value in record.__dict__.items():
            if key not in self._RESERVED and not key.startswith("_"):
                try:
                    json.dumps(value)
                    payload[key] = value
                except (TypeError, ValueError):
                    payload[key] = str(value)
        return json.dumps(payload, separators=(",", ":"))


class ConsoleFormatter(logging.Formatter):
    """Colourised, human-friendly formatter for local development."""

    COLORS = {
        "DEBUG": "\033[36m",
        "INFO": "\033[32m",
        "WARNING": "\033[33m",
        "ERROR": "\033[31m",
        "CRITICAL": "\033[1;41m",
    }
    RESET = "\033[0m"
    DIM = "\033[2m"

    def format(self, record: logging.LogRecord) -> str:
        colour = self.COLORS.get(record.levelname, "")
        request_id = getattr(record, "request_id", "-")
        head = (
            f"{self.DIM}{time.strftime('%H:%M:%S', time.localtime(record.created))}{self.RESET} "
            f"{colour}{record.levelname:<7}{self.RESET} "
            f"{self.DIM}[{request_id[:8]}]{self.RESET} "
            f"{record.name.split('.')[-1]}: "
        )
        message = record.getMessage()
        if record.exc_info:
            message = f"{message}\n{self.formatException(record.exc_info)}"
        return f"{head}{message}"


_CONFIGURED: set[str] = set()


def get_logger(name: str, **initial_extra: Any) -> logging.Logger:
    """Return a configured logger.

    ``initial_extra`` is ignored at runtime but documents the structured
    fields a caller typically attaches via ``logger.info(..., extra={...})``.
    """
    logger = logging.getLogger(name)
    if name in _CONFIGURED:
        return logger

    level = _LEVEL_OVERRIDE if _LEVEL_OVERRIDE is not None else _resolve_level(settings.log_level)
    use_json = _JSON_OVERRIDE if _JSON_OVERRIDE is not None else settings.log_json

    logger.setLevel(level)
    logger.propagate = False

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter() if use_json else ConsoleFormatter())
    handler.addFilter(_ContextFilter())
    logger.addHandler(handler)

    _CONFIGURED.add(name)
    return logger


def bind_extra(**fields: Any) -> Mapping[str, Any]:
    """Helper to build an ``extra`` mapping for structured log calls."""
    return dict(fields)


# --------------------------------------------------------------------------- #
# Global configuration
# --------------------------------------------------------------------------- #
_LEVEL_OVERRIDE: Optional[int] = None
_JSON_OVERRIDE: Optional[bool] = None

#: Third-party loggers that are far too chatty for an analysis service.
_NOISY_LOGGERS = {
    "httpx": logging.WARNING,
    "httpcore": logging.WARNING,
    "urllib3": logging.WARNING,
    "filelock": logging.WARNING,
    "transformers": logging.ERROR,
    "sentence_transformers": logging.ERROR,
    "huggingface_hub": logging.ERROR,
    "pdfminer": logging.ERROR,
    "PIL": logging.WARNING,
    "asyncio": logging.WARNING,
    "sqlalchemy.engine": logging.WARNING,
    "multipart": logging.WARNING,
}


def _resolve_level(level: Any) -> int:
    if isinstance(level, int):
        return level
    return getattr(logging, str(level or settings.log_level).upper(), logging.INFO)


def configure_logging(
    level: Any = None,
    json_logs: Optional[bool] = None,
    *,
    quiet_noisy: bool = True,
) -> None:
    """(Re)configure every logger this app owns.

    Safe to call more than once (e.g. on reload or in tests): already-created
    loggers have their level and formatter updated in place.

    Parameters
    ----------
    level:
        Log level name or int. Defaults to ``settings.log_level``.
    json_logs:
        Force structured JSON output on/off. Defaults to ``settings.log_json``.
    quiet_noisy:
        Raise the level of chatty third-party loggers (httpx, transformers, ...).
    """
    global _LEVEL_OVERRIDE, _JSON_OVERRIDE

    _LEVEL_OVERRIDE = _resolve_level(level)
    _JSON_OVERRIDE = None if json_logs is None else bool(json_logs)

    formatter: logging.Formatter = (
        JsonFormatter() if (_JSON_OVERRIDE if _JSON_OVERRIDE is not None else settings.log_json)
        else ConsoleFormatter()
    )

    for name in list(_CONFIGURED):
        existing = logging.getLogger(name)
        existing.setLevel(_LEVEL_OVERRIDE)
        for handler in existing.handlers:
            handler.setFormatter(formatter)
            handler.setLevel(_LEVEL_OVERRIDE)

    if quiet_noisy:
        for name, noisy_level in _NOISY_LOGGERS.items():
            logging.getLogger(name).setLevel(max(noisy_level, logging.WARNING))
        # Keep uvicorn's own loggers on our handler so request lines match.
        for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
            uvicorn_logger = logging.getLogger(name)
            uvicorn_logger.handlers.clear()
            uvicorn_logger.propagate = False
            handler = logging.StreamHandler(sys.stdout)
            handler.setFormatter(formatter)
            handler.addFilter(_ContextFilter())
            uvicorn_logger.addHandler(handler)
            uvicorn_logger.setLevel(
                logging.WARNING if name != "uvicorn.error" else _LEVEL_OVERRIDE
            )

    logging.getLogger(__name__).debug(
        "logging_configured", extra={"level": logging.getLevelName(_LEVEL_OVERRIDE)}
    )


def log_stage(logger: logging.Logger, stage: str, **fields: Any) -> None:
    """Emit a consistent 'pipeline stage' log line.

    Example::

        log_stage(logger, "pdf_extraction", method="pdfplumber", chars=5321)
    """
    logger.info(f"[pipeline] {stage}", extra={"stage": stage, **fields})
