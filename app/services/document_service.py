"""
app/services/document_service.py
──────────────────────────────────
Central orchestration service coordinating OCR, text processing,
field extraction, and FAISS indexing for each uploaded document.

An in-memory session store (dict) holds lightweight document metadata
keyed by document_id during the server lifetime.  For production, swap
this for a Redis cache or a persistent database.
"""
import hashlib
import time
from pathlib import Path
from typing import Optional, List, Dict, Any

from app.models.schemas import (
    DocumentType,
    ExtractedFields,
    SupportedLanguage,
    UploadResponse,
    ExtractFieldsResponse,
    AskQuestionResponse,
)
from app.services.extractor import classify_document, extract_fields
from ocr.ocr_service import extract_text          # returns {raw_text, confidence, pages}
from rag.retriever import answer_question, build_index
from agents.validation_agent import ValidationAgent
from utils.config import get_settings
from utils.logger import logger
from utils.text_processor import chunk_text, clean_text

_settings = get_settings()

# ─── In-memory session store ──────────────────────────────────────────────────
# Structure: {document_id: DocumentSession}
_sessions: dict[str, "DocumentSession"] = {}


class DocumentSession:
    """Lightweight cache of per-document state."""

    def __init__(
        self,
        document_id: str,
        filename: str,
        raw_text: str,
        clean_text_: str,
        doc_type: DocumentType,
        language: SupportedLanguage,
        page_count: int = 1,
    ) -> None:
        self.document_id = document_id
        self.filename = filename
        self.raw_text = raw_text
        self.clean_text = clean_text_
        self.doc_type = doc_type
        self.language = language
        self.page_count = page_count
        self.classification_confidence: float = 0.0
        self.extraction_confidence: float = 0.0
        self.extracted_fields: Optional[ExtractedFields] = None
        self.validation_report: Optional[dict] = None
        self.layout_info: Optional[dict] = None
        self.ocr_data: List[List[Dict[str, Any]]] = []
        self.created_at = time.time()


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _generate_document_id(filename: str, content: bytes) -> str:
    """Generate a deterministic SHA-256 document ID from filename + content hash."""
    raw = filename.encode() + hashlib.sha256(content).digest()
    return hashlib.sha256(raw).hexdigest()[:16]


def _count_pages(raw_text: str) -> int:
    """Estimate page count from page-break markers inserted by the OCR engine."""
    return raw_text.count("--- Page Break ---") + 1


def _save_upload(document_id: str, filename: str, content: bytes) -> None:
    """Optionally persist the original upload to disk for audit purposes."""
    upload_path = Path(_settings.upload_dir) / document_id
    upload_path.mkdir(parents=True, exist_ok=True)
    dest = upload_path / filename
    dest.write_bytes(content)
    logger.debug("Saved upload to '%s'.", dest)


# ─── Public API ───────────────────────────────────────────────────────────────

def process_upload(filename: str, content: bytes) -> UploadResponse:
    """
    Full document-upload pipeline:
    1. OCR text extraction (with confidence scoring and caching).
    2. Text cleaning.
    3. Document classification (type + language).
    4. FAISS index build.
    5. Session registration.

    Returns:
        UploadResponse with document_id and metadata.
    """
    document_id = _generate_document_id(filename, content)
    # ── 1. OCR (returns dict: raw_text, confidence, pages, ocr_data, preview_bytes)
    ocr_result  = extract_text(content, filename)
    raw_text    = ocr_result["raw_text"]
    page_count  = ocr_result["pages"]
    ocr_data    = ocr_result.get("ocr_data", [])
    ocr_confidence = ocr_result.get("confidence", 0.0)

    # ── 2. Layout Detection (OCR-Assisted for "perfect place" snapping) ───────
    from ocr.layout_detector import detect_layout
    layout_info = detect_layout(content, filename, ocr_data[0] if ocr_data else None)

    logger.info(
        "OCR complete: %d chars, %.0f%% confidence, %d page(s).",
        len(raw_text), ocr_confidence * 100, page_count,
    )

    # ── 1.1 Persist Preview Image (for instant UI display) ──────────────────
    if ocr_result.get("preview_img_bytes"):
        preview_dir = Path(_settings.upload_dir) / document_id
        preview_dir.mkdir(parents=True, exist_ok=True)
        preview_path = preview_dir / "preview.png"
        preview_path.write_bytes(ocr_result["preview_img_bytes"])
        logger.debug("Persisted preview to '%s'.", preview_path)

    # ── 2. Clean text ────────────────────────────────────────────────────────
    cleaned = clean_text(raw_text)

    # ── 3. Classify ──────────────────────────────────────────────────────────
    doc_type, language, conf = classify_document(cleaned)

    # ── 4. Build FAISS index ─────────────────────────────────────────────────
    chunks = chunk_text(cleaned, _settings.chunk_size, _settings.chunk_overlap)
    build_index(document_id, chunks)

    # ── 5. Cache session ────────────────────────────────────────────────────
    _sessions[document_id] = DocumentSession(
        document_id=document_id,
        filename=filename,
        raw_text=raw_text,
        clean_text_=cleaned,
        doc_type=doc_type,
        language=language,
        page_count=page_count,
    )
    _sessions[document_id].ocr_data = ocr_result.get("ocr_data", [])
    _sessions[document_id].classification_confidence = conf
    _sessions[document_id].layout_info = layout_info

    # Persist the uploaded file for audit
    try:
        _save_upload(document_id, filename, content)
    except Exception as exc:
        logger.warning("Could not save upload to disk: %s", exc)

    return UploadResponse(
        document_id=document_id,
        filename=filename,
        document_type=doc_type,
        language=language,
        raw_text_preview=cleaned[:500],
        character_count=len(cleaned),
        page_count=page_count,
        ocr_confidence=ocr_confidence,
        classification_confidence=conf,
        ocr_data=_sessions[document_id].ocr_data,
        layout_info=layout_info,
    )


def get_extracted_fields(document_id: str) -> ExtractFieldsResponse:
    """
    Extract structured fields for a processed document.

    Caches the result in the session so repeated calls don't
    invoke the LLM again.

    Returns:
        ExtractFieldsResponse with structured field data.

    Raises:
        KeyError: If document_id is not in the session store.
    """
    session = _sessions.get(document_id)
    if session is None:
        raise KeyError(f"document_id='{document_id}' not found. Upload the document first.")

    if session.extracted_fields is None:
        fields, conf = extract_fields(session.clean_text, session.doc_type)
        session.extracted_fields = fields
        session.extraction_confidence = conf
        
        # ── Run Validation Agent ──
        v_agent = ValidationAgent()
        v_res = v_agent.run({
            "doc_type": session.doc_type,
            "extracted_fields": fields
        })
        session.validation_report = v_res.payload.get("validation_report")


    return ExtractFieldsResponse(
        document_id=document_id,
        document_type=session.doc_type,
        validation_passed=(session.validation_report or {}).get("passed", False),
        extraction_confidence=session.extraction_confidence, # Use actual confidence
        fields=session.extracted_fields or {}, # Use actual extracted fields
        validation_report=session.validation_report or {"passed": False, "score": 0.0, "issues": []}, # Use actual report
        layout_info=session.layout_info or {}, # Use session layout_info
        workflow_actions=[], # This field is new and hardcoded as empty
        pipeline_elapsed_ms=0, # This field is new, hardcoded as 0 as start_time is not available here
        message="Document processed and indexed successfully.", # This field is new
    )




def get_answer(document_id: str, question: str) -> AskQuestionResponse:
    """
    RAG question-answering for a processed document.

    Returns:
        AskQuestionResponse with the generated answer and source chunks.

    Raises:
        KeyError: If document_id is not in the session store.
    """
    if document_id not in _sessions:
        raise KeyError(f"document_id='{document_id}' not found. Upload the document first.")

    answer, source_chunks = answer_question(document_id, question)
    return AskQuestionResponse(
        document_id=document_id,
        question=question,
        answer=answer,
        source_chunks=source_chunks,
    )
