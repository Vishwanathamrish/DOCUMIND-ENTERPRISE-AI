"""
app/database.py
────────────────
Lightweight SQLite persistence layer using the stdlib `sqlite3` module.

Tables:
  documents   — metadata for every processed document
  analytics   — per-event processing stats
  users       — user accounts (for JWT auth)

The DB file is created automatically on first connect.
"""
from __future__ import annotations

import json
import sqlite3
import time
import datetime
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Generator

from utils.config import get_settings
from utils.logger import logger

_settings = get_settings()
DB_PATH = Path(_settings.upload_dir).parent / "data" / "intelligence.db"


@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    """Yield a database connection and commit/rollback on exit with better concurrency."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    # Connect with timeout settings for better concurrency
    conn = sqlite3.connect(
        str(DB_PATH),
        timeout=30.0,
        isolation_level=None  # Autocommit mode
    )
    conn.row_factory = sqlite3.Row
    
    # Set PRAGMA for better concurrency
    conn.execute("PRAGMA busy_timeout = 30000")  # 30 second timeout
    conn.execute("PRAGMA journal_mode = WAL")  # Write-Ahead Logging
    
    try:
        yield conn
        conn.commit()
    except Exception as e:
        if "database is locked" not in str(e):
            conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    """Create tables if they don't exist."""
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS documents (
                document_id         TEXT PRIMARY KEY,
                filename            TEXT NOT NULL,
                doc_type            TEXT NOT NULL DEFAULT 'unknown',
                language            TEXT NOT NULL DEFAULT 'unknown',
                page_count          INTEGER DEFAULT 1,
                character_count     INTEGER DEFAULT 0,
                ocr_confidence      REAL DEFAULT 0.0,
                classification_conf REAL DEFAULT 0.0,
                extraction_conf     REAL DEFAULT 0.0,
                validation_passed   INTEGER DEFAULT 0,
                validation_score    REAL DEFAULT 0.0,
                workflow_count      INTEGER DEFAULT 0,
                vendor_name         TEXT,
                total_amount        TEXT,
                raw_text_preview    TEXT,
                fields_json         TEXT,
                validation_json     TEXT,
                layout_json         TEXT,
                pipeline_elapsed_ms REAL DEFAULT 0.0,
                status              TEXT DEFAULT 'pending',
                created_at          REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS analytics (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type      TEXT NOT NULL,
                document_id     TEXT,
                doc_type        TEXT,
                processing_ms   REAL DEFAULT 0.0,
                confidence      REAL DEFAULT 0.0,
                user_id         TEXT,
                created_at      REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS users (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                username        TEXT UNIQUE NOT NULL,
                password_hash   TEXT NOT NULL,
                role            TEXT NOT NULL DEFAULT 'analyst',
                email           TEXT UNIQUE NOT NULL,
                created_at      REAL NOT NULL
            );

        """)
    logger.info("Database initialised at %s", DB_PATH)


# ─── Documents ────────────────────────────────────────────────────────────────

def save_document(ctx: dict[str, Any], user_id: str | None = None) -> None:
    """Persist pipeline context as a document row."""
    fields = ctx.get("extracted_fields")
    fields_dict: dict = {}
    if fields is not None:
        fields_dict = (
            fields.model_dump() if hasattr(fields, "model_dump") else dict(fields)
        )

    val_report = ctx.get("validation_report") or {}
    try:
        with get_db() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO documents (
                    document_id, filename, doc_type, language, page_count,
                    character_count, ocr_confidence, classification_conf,
                    extraction_conf, validation_passed, validation_score,
                    workflow_count, vendor_name, total_amount,
                    raw_text_preview, fields_json, validation_json,
                    layout_json, pipeline_elapsed_ms, created_at, user_id
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    ctx.get("document_id"),
                    ctx.get("filename"),
                    str(ctx.get("doc_type", "unknown")),
                    str(ctx.get("language", "unknown")),
                    ctx.get("page_count", 1),
                    len(ctx.get("clean_text", "")),
                    ctx.get("ocr_confidence", 0.0),
                    ctx.get("classification_confidence", 0.0),
                    ctx.get("extraction_confidence", 0.0),
                    int(val_report.get("passed", False)),
                    val_report.get("score", 0.0),
                    ctx.get("workflow_count", 0),
                    fields_dict.get("vendor_name") or fields_dict.get("store_name") or fields_dict.get("company_name"),
                    fields_dict.get("total_amount") or fields_dict.get("contract_value"),
                    ctx.get("clean_text", "")[:500],
                    json.dumps(fields_dict),
                    json.dumps(val_report),
                    json.dumps(ctx.get("layout_info", {})),
                    ctx.get("pipeline_elapsed_ms", 0.0),
                    time.time(),
                    user_id,  # Add user_id to the tuple
                ),
            )
    except Exception as e:
        logger.error("Failed to save document %s: %s", ctx.get("document_id"), e, exc_info=True)
        raise


def list_documents(limit: int = 50, offset: int = 0, user_id: str | None = None, user_role: str | None = None) -> list[dict]:
    """List documents with role-based filtering.
    
    If user_role is 'admin', returns ALL documents (no filtering).
    If user_id is provided and not admin, filters by that user.
    Otherwise returns all documents (legacy behavior).
    """
    with get_db() as conn:
        if user_id and user_role != 'admin':
            # Regular user: filter by user_id
            rows = conn.execute(
                "SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (user_id, limit, offset),
            ).fetchall()
        else:
            # Admin or no user_id: return all documents
            rows = conn.execute(
                "SELECT * FROM documents ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (limit, offset),
            ).fetchall()
        return [dict(r) for r in rows]


def get_document(document_id: str) -> dict | None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM documents WHERE document_id = ?", (document_id,)
        ).fetchone()
        return dict(row) if row else None


def delete_document(document_id: str) -> bool:
    """Delete a document from the database by ID.
    
    Args:
        document_id: The ID of the document to delete
        
    Returns:
        True if deleted, False if not found
    """
    with get_db() as conn:
        cursor = conn.execute(
            "DELETE FROM documents WHERE document_id = ?", (document_id,)
        )
        return cursor.rowcount > 0


def update_document_status(document_id: str, status: str) -> None:
    """Update the status field for a document."""
    with get_db() as conn:
        conn.execute(
            "UPDATE documents SET status = ? WHERE document_id = ?",
            (status, document_id),
        )


def search_documents(
    query: str = "",
    doc_type: str | None = None,
    min_amount: float | None = None,
    max_amount: float | None = None,
    limit: int = 20,
) -> list[dict]:
    """Keyword + filter search against the documents table."""
    clauses = []
    params: list[Any] = []

    if query:
        clauses.append(
            "(filename LIKE ? OR vendor_name LIKE ? OR raw_text_preview LIKE ?)"
        )
        like = f"%{query}%"
        params += [like, like, like]

    if doc_type:
        clauses.append("doc_type = ?")
        params.append(doc_type)

    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    sql = f"SELECT * FROM documents {where} ORDER BY created_at DESC LIMIT ?"
    params.append(limit)

    with get_db() as conn:
        rows = conn.execute(sql, params).fetchall()
        return [dict(r) for r in rows]


# ─── Analytics ────────────────────────────────────────────────────────────────

def record_event(event_type: str, document_id: str | None = None,
                 doc_type: str | None = None, processing_ms: float = 0.0,
                 confidence: float = 0.0, user_id: str | None = None) -> None:
    with get_db() as conn:
        conn.execute(
            "INSERT INTO analytics (event_type, document_id, doc_type, processing_ms, confidence, user_id, created_at) "
            "VALUES (?,?,?,?,?,?,?)",
            (event_type, document_id, doc_type, processing_ms, confidence, user_id, time.time()),
        )


def get_dashboard_stats(user_id: str | None = None, user_role: str | None = None) -> dict[str, Any]:
    """Retrieve full aggregate metrics and recent events for the dashboard.
    
    If user_role is 'admin', returns global stats (all documents).
    If user_id is provided and not admin, filters by that user.
    Otherwise returns global stats (no filtering).
    """
    with get_db() as conn:
        # Build WHERE clause based on user_id and role
        if user_id and user_role != 'admin':
            # Regular user: filter by user_id
            where_clause = "WHERE user_id = ?"
            where_params = (user_id,)
        else:
            # Admin or no user_id: no filtering
            where_clause = ""
            where_params = ()
        
        # Total counts
        if user_id and user_role != 'admin':
            total = conn.execute(f"SELECT COUNT(*) as c FROM documents {where_clause}", where_params).fetchone()["c"]
        else:
            total = conn.execute("SELECT COUNT(*) as c FROM documents").fetchone()["c"]
        
        # Breakdown by type
        if user_id and user_role != 'admin':
            by_type_rows = conn.execute(
                f"SELECT doc_type, COUNT(*) as count FROM documents {where_clause} GROUP BY doc_type", 
                where_params
            ).fetchall()
        else:
            by_type_rows = conn.execute(
                "SELECT doc_type, COUNT(*) as count FROM documents GROUP BY doc_type"
            ).fetchall()
        by_type = {"invoice": 0, "receipt": 0, "contract": 0, "unknown": 0}
        for r in by_type_rows:
            raw_t = str(r["doc_type"]).lower()
            # Clean up enum strings like 'DocumentType.invoice'
            t = raw_t.split(".")[-1] if "." in raw_t else raw_t
            if t in by_type:
                by_type[t] = r["count"]
            else:
                by_type["unknown"] += r["count"]

        # Confidence and processing time
        if user_id and user_role != 'admin':
            avg_rows = conn.execute(
                f"SELECT AVG(classification_conf) as avg_c, AVG(extraction_conf) as avg_e, "
                f"AVG(pipeline_elapsed_ms) as avg_ms FROM documents {where_clause}",
                where_params
            ).fetchone()
        else:
            avg_rows = conn.execute(
                "SELECT AVG(classification_conf) as avg_c, AVG(extraction_conf) as avg_e, "
                "AVG(pipeline_elapsed_ms) as avg_ms FROM documents"
            ).fetchone()
        
        # Recent events for trend charts
        if user_id and user_role != 'admin':
            event_rows = conn.execute(
                f"SELECT document_id, filename, doc_type, classification_conf, pipeline_elapsed_ms, created_at "
                f"FROM documents {where_clause} ORDER BY created_at ASC",
                where_params
            ).fetchall()
        else:
            event_rows = conn.execute(
                "SELECT document_id, filename, doc_type, classification_conf, pipeline_elapsed_ms, created_at "
                "FROM documents ORDER BY created_at ASC" # ASC to build a timeline
            ).fetchall()
        
        events = []
        for r in event_rows:
            raw_t = str(r["doc_type"]).lower()
            t = raw_t.split(".")[-1] if "." in raw_t else raw_t
            
            # Format timestamp as ISO-8601 for frontend
            dt_str = datetime.datetime.fromtimestamp(r["created_at"]).isoformat()
            
            events.append({
                "document_id": r["document_id"],
                "filename": r["filename"],
                "doc_type": t,
                "confidence": r["classification_conf"] or 0.0,
                "elapsed_ms": int(r["pipeline_elapsed_ms"] or 0),
                "created_at": dt_str
            })
        
        # Calculate trends
        today_count = _get_documents_today(conn)
        yesterday_count = _get_documents_yesterday(conn)
        last_week_count = _get_documents_last_7_days(conn, offset=7)
        this_week_count = _get_documents_last_7_days(conn, offset=0)
        
        # Success rate (documents with high confidence > 0.8)
        current_success_rate = _get_success_rate(conn, days=1)
        previous_success_rate = _get_success_rate(conn, days=1, offset=1)
        
        # Average processing time comparison
        current_avg_time = _get_avg_processing_time(conn, days=1)
        previous_avg_time = _get_avg_processing_time(conn, days=1, offset=1)

        return {
            "total_documents": total,
            "total_events": len(events),
            "by_type": by_type,
            "avg_confidence": round(avg_rows["avg_c"] or 0.0, 3),
            "avg_extraction_confidence": round(avg_rows["avg_e"] or 0.0, 3),
            "avg_processing_ms": int(avg_rows["avg_ms"] or 0),
            "recent_events": events,
            # Trend data
            "today_count": today_count,
            "yesterday_count": yesterday_count,
            "this_week_count": this_week_count,
            "last_week_count": last_week_count,
            "current_success_rate": current_success_rate,
            "previous_success_rate": previous_success_rate,
            "current_avg_processing_ms": current_avg_time,
            "previous_avg_processing_ms": previous_avg_time,
        }


def _get_documents_today(conn) -> int:
    """Get count of documents processed today."""
    today_start = int(datetime.datetime.now().replace(hour=0, minute=0, second=0, microsecond=0).timestamp())
    result = conn.execute(
        "SELECT COUNT(*) as c FROM documents WHERE created_at >= ?", (today_start,)
    ).fetchone()
    return result["c"] if result else 0


def _get_documents_yesterday(conn) -> int:
    """Get count of documents processed yesterday."""
    today_start = int(datetime.datetime.now().replace(hour=0, minute=0, second=0, microsecond=0).timestamp())
    yesterday_start = today_start - 86400  # 24 hours in seconds
    result = conn.execute(
        "SELECT COUNT(*) as c FROM documents WHERE created_at >= ? AND created_at < ?", 
        (yesterday_start, today_start)
    ).fetchone()
    return result["c"] if result else 0


def _get_documents_last_7_days(conn, offset: int = 0) -> int:
    """Get count of documents in the last 7 days, with optional offset.
    
    Args:
        conn: Database connection
        offset: Days to offset (0 = last 7 days including today, 7 = 7 days before that)
    """
    now = datetime.datetime.now()
    end_timestamp = int(now.replace(hour=0, minute=0, second=0, microsecond=0).timestamp()) - (offset * 86400)
    start_timestamp = end_timestamp - (7 * 86400)
    
    result = conn.execute(
        "SELECT COUNT(*) as c FROM documents WHERE created_at >= ? AND created_at < ?",
        (start_timestamp, end_timestamp)
    ).fetchone()
    return result["c"] if result else 0


def _get_success_rate(conn, days: int = 1, offset: int = 0) -> float:
    """Get success rate (confidence > 0.8) for a given period.
    
    Args:
        conn: Database connection
        days: Number of days to look back
        offset: Days to offset (0 = current period, 1 = previous period)
    """
    now = datetime.datetime.now()
    end_timestamp = int(now.replace(hour=0, minute=0, second=0, microsecond=0).timestamp()) - (offset * 86400)
    start_timestamp = end_timestamp - (days * 86400)
    
    result = conn.execute(
        """SELECT COUNT(*) as total, 
           SUM(CASE WHEN classification_conf >= 0.8 THEN 1 ELSE 0 END) as successful
           FROM documents 
           WHERE created_at >= ? AND created_at < ?""",
        (start_timestamp, end_timestamp)
    ).fetchone()
    
    if not result or result["total"] == 0:
        return 0.0
    
    return round(result["successful"] / result["total"], 3)


def _get_avg_processing_time(conn, days: int = 1, offset: int = 0) -> int:
    """Get average processing time in milliseconds for a given period.
    
    Args:
        conn: Database connection
        days: Number of days to look back
        offset: Days to offset (0 = current period, 1 = previous period)
    """
    now = datetime.datetime.now()
    end_timestamp = int(now.replace(hour=0, minute=0, second=0, microsecond=0).timestamp()) - (offset * 86400)
    start_timestamp = end_timestamp - (days * 86400)
    
    result = conn.execute(
        "SELECT AVG(pipeline_elapsed_ms) as avg_ms FROM documents WHERE created_at >= ? AND created_at < ?",
        (start_timestamp, end_timestamp)
    ).fetchone()
    
    return int(result["avg_ms"] or 0)


# ─── Users ────────────────────────────────────────────────────────────────────

def create_user(username: str, password_hash: str, role: str = "analyst", email: str | None = None) -> bool:
    try:
        with get_db() as conn:
            conn.execute(
                "INSERT INTO users (username, password_hash, role, email, created_at) VALUES (?,?,?,?,?)",
                (username, password_hash, role, email, time.time()),
            )
        return True
    except sqlite3.IntegrityError:
        return False  # duplicate username or email


def get_user(username: str) -> dict | None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE username = ?", (username,)
        ).fetchone()
        return dict(row) if row else None


def get_user_by_email(email: str) -> dict | None:
    """Get user by email address"""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE email = ?", (email,)
        ).fetchone()
        return dict(row) if row else None
