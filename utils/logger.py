"""
utils/logger.py
───────────────
Centralised logging setup: rotating file handler + coloured console output.
Import `logger` in any module instead of calling logging.getLogger directly.
"""
import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

from utils.config import get_settings

_settings = get_settings()

# ─── Formatter ────────────────────────────────────────────────────────────────
_FMT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
_DATE_FMT = "%Y-%m-%d %H:%M:%S"


def _build_logger(name: str = "doc_intelligence") -> logging.Logger:
    """
    Build and return a logger with:
    - StreamHandler (stdout) for live console feedback.
    - RotatingFileHandler writing to logs/app.log (5 MB × 3 backups).
    """
    log = logging.getLogger(name)

    # Avoid adding handlers multiple times (e.g. on Streamlit hot-reloads)
    if log.handlers:
        return log

    log.setLevel(getattr(logging, _settings.log_level.upper(), logging.INFO))

    formatter = logging.Formatter(_FMT, datefmt=_DATE_FMT)

    # Console handler
    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(formatter)
    log.addHandler(console)

    # Rotating file handler
    Path("logs").mkdir(parents=True, exist_ok=True)
    file_handler = RotatingFileHandler(
        "logs/app.log",
        maxBytes=5 * 1024 * 1024,  # 5 MB
        backupCount=3,
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)
    log.addHandler(file_handler)

    log.propagate = False
    return log


# Module-level singleton
logger = _build_logger()
