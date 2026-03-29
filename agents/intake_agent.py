"""
agents/intake_agent.py
───────────────────────
DocumentIntakeAgent — validates the incoming file and generates
a stable document UUID before the rest of the pipeline runs.
"""
from __future__ import annotations

import hashlib
import time
from pathlib import Path
from typing import Any

from agents.base_agent import BaseAgent
from utils.config import get_settings
from utils.logger import logger

_settings = get_settings()

ACCEPTED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".tiff", ".tif", ".bmp", ".webp"}
MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB


class DocumentIntakeAgent(BaseAgent):
    """
    Responsibilities:
    - Validate file extension and size.
    - Generate a deterministic SHA-256 document ID.
    - Persist the raw file to the upload directory for audit.
    - Attach upload metadata to the shared pipeline context.
    """

    name = "DocumentIntakeAgent"

    def _execute(self, payload: dict[str, Any]) -> dict[str, Any]:
        filename: str = payload["filename"]
        content: bytes = payload["content"]

        # ── 1. Extension check ─────────────────────────────────────────────────
        ext = Path(filename).suffix.lower()
        if ext not in ACCEPTED_EXTENSIONS:
            raise ValueError(
                f"Unsupported file extension '{ext}'. "
                f"Accepted: {', '.join(sorted(ACCEPTED_EXTENSIONS))}"
            )

        # ── 2. Size check ──────────────────────────────────────────────────────
        if len(content) > MAX_FILE_SIZE_BYTES:
            raise ValueError(
                f"File size {len(content) / 1024 / 1024:.1f} MB exceeds the 20 MB limit."
            )

        # ── 3. Generate document ID ────────────────────────────────────────────
        raw = filename.encode() + hashlib.sha256(content).digest()
        document_id = hashlib.sha256(raw).hexdigest()[:16]

        # ── 4. Persist to disk ─────────────────────────────────────────────────
        try:
            upload_path = Path(_settings.upload_dir) / document_id
            upload_path.mkdir(parents=True, exist_ok=True)
            (upload_path / filename).write_bytes(content)
            logger.debug("[%s] Saved %s → %s", self.name, filename, upload_path)
        except Exception as exc:
            logger.warning("[%s] Could not persist file to disk: %s", self.name, exc)

        return {
            "document_id": document_id,
            "filename": filename,
            "file_extension": ext,
            "file_size_bytes": len(content),
            "intake_timestamp": time.time(),
        }
