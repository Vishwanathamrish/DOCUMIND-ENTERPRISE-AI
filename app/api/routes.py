"""
app/api/routes.py
──────────────────
FastAPI router defining the three core endpoints:
  POST /upload-document  — Upload & OCR a document
  POST /extract-fields   — Extract structured fields via LLM
  POST /ask-question     — RAG-powered question answering
"""
from fastapi import APIRouter, File, HTTPException, UploadFile, status, Depends
from fastapi.responses import JSONResponse, FileResponse
import datetime

from app.models.schemas import (
    AskQuestionRequest,
    AskQuestionResponse,
    ErrorResponse,
    ExtractFieldsRequest,
    ExtractFieldsResponse,
    UploadResponse,
    AnalyticsData,
    AnalyticsEvent,
    SearchResponse,
)
from app.services.document_service import (
    get_answer,
    get_extracted_fields,
    process_upload,
)
from app.database import get_dashboard_stats, list_documents as db_list_documents, search_documents as db_search_documents
from app.auth import get_current_user  # NEW: Import authentication
from utils.logger import logger

router = APIRouter(prefix="/api/v1", tags=["Document Intelligence"])

# ─── Allowed MIME types ───────────────────────────────────────────────────────
_ALLOWED_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/tiff",
    "image/bmp",
    "image/webp",
}
_MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


def _validate_upload(file: UploadFile, content: bytes) -> None:
    """Raise HTTP 400/413 for unsupported or oversized uploads."""
    if len(content) > _MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum allowed size is {_MAX_FILE_SIZE // (1024*1024)} MB.",
        )
    if file.content_type not in _ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"Content type '{file.content_type}' is not supported. "
                f"Accepted types: PDF, JPEG, PNG, TIFF, BMP, WEBP."
            ),
        )


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post(
    "/upload-document",
    summary="Upload a document for OCR processing",
    description=(
        "Accepts a PDF or image file. Runs Tesseract OCR, cleans the text, "
        "classifies the document type and language, builds a FAISS embedding "
        "index, runs the LLM field extraction, and returns the full document data."
    ),
    status_code=status.HTTP_200_OK,
)
async def upload_document(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
) -> dict:
    content = await file.read()
    _validate_upload(file, content)

    logger.info("Received upload: '%s' (%d bytes).", file.filename, len(content))
    try:
        # process_upload runs OCR, classification, and RAG indexing.
        user_id = current_user.get("sub")
        result = process_upload        
        # Now automatically run the extraction phase!
        extraction_res = get_extracted_fields(result.document_id)
        
        # Return a merged dictionary that the Next.js UI expects
        return {
            "document_id": result.document_id,
            "filename": result.filename,
            "document_type": result.document_type,
            "language": result.language,
            "page_count": result.page_count,
            "character_count": result.character_count,
            "raw_text_preview": result.raw_text_preview,
            "ocr_confidence": result.ocr_confidence,
            "classification_confidence": result.classification_confidence,
            "extraction_confidence": extraction_res.extraction_confidence,
            "fields": extraction_res.fields,
            "validation_report": extraction_res.validation_report,
            "layout_info": extraction_res.layout_info,
            "workflow_actions": extraction_res.workflow_actions,
            "pipeline_elapsed_ms": result.pipeline_elapsed_ms + (extraction_res.pipeline_elapsed_ms or 0),
            "message": "Document processed and indexed successfully.",
        }

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected error during upload.")
        raise HTTPException(status_code=500, detail="Internal server error.") from exc


@router.post(
    "/extract-fields",
    response_model=ExtractFieldsResponse,
    summary="Extract structured fields from a processed document",
    description=(
        "Given a document_id from a prior /upload-document call, uses the LLM "
        "to extract vendor name, invoice number, date, total amount, and more. "
        "Results are cached — repeated calls are free."
    ),
    status_code=status.HTTP_200_OK,
)
async def extract_fields_endpoint(body: ExtractFieldsRequest) -> ExtractFieldsResponse:
    try:
        return get_extracted_fields(body.document_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected error during field extraction.")
        raise HTTPException(status_code=500, detail="Internal server error.") from exc


@router.post(
    "/ask-question",
    response_model=AskQuestionResponse,
    summary="Ask a natural-language question about a document",
    description=(
        "Uses retrieval-augmented generation (RAG): retrieves the top-k most "
        "relevant text chunks from the FAISS index and injects them as context "
        "into the LLM to generate a grounded answer."
    ),
    status_code=status.HTTP_200_OK,
)
async def ask_question(body: AskQuestionRequest) -> AskQuestionResponse:
    try:
        return get_answer(body.document_id, body.question)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected error during question answering.")
        raise HTTPException(status_code=500, detail="Internal server error.") from exc


from app.services.document_service import _sessions

# ─── Next.js Enterprise UI Support Routes ───────────────────────────────────────

@router.get(
    "/documents/{document_id}",
    summary="Get single document",
    status_code=status.HTTP_200_OK,
)
async def get_document(document_id: str) -> dict:
    session = _sessions.get(document_id)
    if not session:
        raise HTTPException(status_code=404, detail="Document not found")
        
    return {
        "document_id": session.document_id,
        "filename": session.filename,
        "document_type": session.doc_type,
        "language": session.language,
        "page_count": session.page_count,
        "character_count": len(session.clean_text),
        "ocr_confidence": 1.0, 
        "classification_confidence": session.classification_confidence,
        "extraction_confidence": session.extraction_confidence,
        "validation_passed": session.validation_report.get("passed", False) if session.validation_report else False,
        "validation_report": session.validation_report,
        "fields": session.extracted_fields,
        "created_at": session.created_at,
        "pipeline_elapsed_ms": 1500, 
    }

@router.get(
    "/documents/{document_id}/file",
    summary="Get original uploaded file",
    status_code=status.HTTP_200_OK,
)
async def get_document_file(document_id: str) -> FileResponse:
    session = _sessions.get(document_id)
    if not session:
        raise HTTPException(status_code=404, detail="Document not found")
    
    from pathlib import Path
    from utils.config import get_settings
    _settings = get_settings()
    
    upload_path = Path(_settings.upload_dir) / document_id / session.filename
    if not upload_path.exists():
         raise HTTPException(status_code=404, detail="File not found on disk")
         
    return FileResponse(upload_path)

@router.get("/documents/{document_id}/preview", summary="Get document preview image")
async def get_document_preview(document_id: str) -> FileResponse:
    session = _sessions.get(document_id)
    if not session:
        raise HTTPException(status_code=404, detail="Document not found")
    
    from pathlib import Path
    from utils.config import get_settings
    _settings = get_settings()
    
    doc_dir = Path(_settings.upload_dir) / document_id
    preview_path = doc_dir / "preview.png"
    
    if preview_path.exists():
        return FileResponse(preview_path)
    
    # 2. Check original file and convert if needed
    original_path = doc_dir / session.filename
    if not original_path.exists():
         raise HTTPException(status_code=404, detail="Source file not found")
         
    ext = original_path.suffix.lower()
    
    # Browser-native images can be served directly
    if ext in {".jpg", ".jpeg", ".png", ".webp"}:
        return FileResponse(original_path)
        
    # PDF conversion fallback
    if ext == ".pdf":
         try:
             from ocr.ocr_service import _pdf_to_images
             content = original_path.read_bytes()
             images = _pdf_to_images(content)
             if images:
                 preview_path.parent.mkdir(parents=True, exist_ok=True)
                 images[0].save(preview_path, format="PNG")
                 return FileResponse(preview_path)
         except Exception as exc:
             logger.warning("On-the-fly PDF preview generation failed: %s", exc)

    # TIFF/BMP conversion fallback
    if ext in {".tiff", ".tif", ".bmp"}:
        try:
            from PIL import Image
            with Image.open(original_path) as img:
                img.seek(0)
                preview_path.parent.mkdir(parents=True, exist_ok=True)
                img.save(preview_path, format="PNG")
                return FileResponse(preview_path)
        except Exception as exc:
            logger.warning("On-the-fly image preview generation failed: %s", exc)
             
    raise HTTPException(status_code=404, detail="Preview not available")

@router.get(
    "/documents",
    summary="List all processed documents (user-isolated with admin override)",
    description="Returns a list of documents. Admin users see ALL documents, regular users see only their own.",
    status_code=status.HTTP_200_OK,
)
async def list_documents(
    limit: int = 50, 
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
) -> dict:
    user_id = current_user.get("sub")
    user_role = current_user.get("role", "user")
    
    # Admin users see ALL documents, regular users see only their own
    is_admin = user_role == 'admin'
    
    docs = []
    # Filter sessions by user_id - admin sees all, others see only their own
    sorted_sessions = sorted(_sessions.values(), key=lambda s: s.created_at, reverse=True)
    
    for session in sorted_sessions:
        # Skip documents that don't belong to this user (unless admin)
        if not is_admin and session.user_id and session.user_id != user_id:
            continue
            
        docs.append({
            "document_id": session.document_id,
            "filename": session.filename,
            "document_type": session.doc_type,
            "language": session.language,
            "page_count": session.page_count,
            "character_count": len(session.clean_text),
            "ocr_confidence": 1.0,
            "classification_confidence": session.classification_confidence,
            "extraction_confidence": session.extraction_confidence,
            "fields": session.extracted_fields,
            "created_at": session.created_at,
            "pipeline_elapsed_ms": 1500,
        })
    
    # Also get from database (filtered by user_id for non-admin users)
    db_docs = db_list_documents(limit=100, offset=0, user_id=user_id, user_role=user_role)
    
    # Merge and deduplicate
    db_doc_ids = {doc["document_id"] for doc in db_docs}
    for doc in db_docs:
        docs.append(doc)
    
    # Remove duplicates from memory sessions
    unique_docs = [doc for doc in docs if doc["document_id"] not in db_doc_ids]
    
    paginated = unique_docs[offset : offset + limit]
    return {
        "total": len(unique_docs),
        "documents": paginated
    }

@router.get(
    "/analytics",
    summary="Get role-based analytics",
    description="Returns aggregate processing metrics. Admin sees global stats, regular users see their own.",
    response_model=AnalyticsData,
    status_code=status.HTTP_200_OK,
)
async def get_analytics(current_user: dict = Depends(get_current_user)) -> AnalyticsData:
    user_id = current_user.get("sub")
    user_role = current_user.get("role", "user")
    
    # Admin users see global stats, regular users see only their own
    stats = get_dashboard_stats(user_id=user_id, user_role=user_role)
    
    events = [AnalyticsEvent(**e) for e in stats["recent_events"]]
    
    # Calculate percentage trends
    today_trend = _calculate_percentage_change(stats["today_count"], stats["yesterday_count"])
    weekly_trend = _calculate_percentage_change(stats["this_week_count"], stats["last_week_count"])
    success_rate_trend = _calculate_percentage_change(
        stats["current_success_rate"], 
        stats["previous_success_rate"]
    )
    processing_time_trend = _calculate_percentage_change(
        stats["current_avg_processing_ms"],
        stats["previous_avg_processing_ms"]
    )
    
    return AnalyticsData(
        total_documents=stats["total_documents"],
        total_events=stats["total_events"],
        by_type=stats["by_type"],
        avg_processing_ms=stats["avg_processing_ms"],
        avg_confidence=stats["avg_confidence"],
        recent_events=events,
        today_trend=today_trend,
        weekly_trend=weekly_trend,
        success_rate_trend=success_rate_trend,
        processing_time_trend=processing_time_trend
    )


def _calculate_percentage_change(current: float | int, previous: float | int) -> float | None:
    """Calculate percentage change between two values.
    
    Args:
        current: Current period value
        previous: Previous period value
    
    Returns:
        Percentage change (positive or negative), or None if previous is 0
    """
    if previous == 0:
        return None if current == 0 else 100.0  # If previous was 0 and current > 0, show 100% growth
    return round(((current - previous) / previous) * 100, 1)

@router.get(
    "/search",
    summary="Search documents by filename",
    response_model=SearchResponse,
    status_code=status.HTTP_200_OK,
)
async def search_documents(q: str = "") -> SearchResponse:
    query = q.lower()
    results = []
    
    for session in _sessions.values():
        if query in session.filename.lower():
            # Standardize output using the rich UploadResponse schema
            results.append(UploadResponse(
                document_id=session.document_id,
                filename=session.filename,
                document_type=session.doc_type,
                language=session.language,
                page_count=session.page_count,
                character_count=len(session.clean_text),
                raw_text_preview=session.clean_text[:200],
                ocr_confidence=0.92, 
                classification_confidence=session.classification_confidence,
                extraction_confidence=session.extraction_confidence,
                fields=session.extracted_fields if session.extracted_fields else {},
                layout_info=session.layout_info if session.layout_info else {},
                ocr_data=session.ocr_data if session.ocr_data else [],
                pipeline_elapsed_ms=1500,
                message="Matching document found."
            ))
            
    return SearchResponse(
        query=q,
        total=len(results),
        results=results
    )

# ─── Delete Document ──────────────────────────────────────────────────────────

@router.delete(
    "/documents/{document_id}",
    summary="Delete a document",
    description="Permanently delete a document from the system, including file and database record.",
    status_code=status.HTTP_200_OK,
)
async def delete_document(
    document_id: str,
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    Delete a document permanently from the system.
    
    This will remove:
    - Document metadata from database
    - Associated file from storage
    """
    import os
    from app.database import get_document, delete_document as db_delete_document
    
    logger.info(f"Delete request for document: {document_id}")
    
    try:
        # Find the document
        doc = get_document(document_id)
        
        if not doc:
            logger.warning(f"Document not found: {document_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
        
        # Verify ownership (user isolation)
        user_id = current_user.get("sub")
        user_role = current_user.get("role")
        
        if doc.get("user_id") != user_id and user_role != "admin":
            logger.warning(f"Unauthorized delete attempt by {user_id} on {document_id}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this document"
            )
        
        # Delete physical file if it exists
        if doc.get("file_path") and os.path.exists(doc.get("file_path")):
            os.remove(doc.get("file_path"))
            logger.info(f"Deleted file: {doc.get('file_path')}")
        
        # Delete from database
        deleted = db_delete_document(document_id)
        
        if not deleted:
            logger.warning(f"Document deletion failed: {document_id}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete document from database"
            )
        
        logger.info(f"Document deleted successfully: {document_id}")
        
        return {
            "message": "Document deleted successfully",
            "document_id": document_id
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error deleting document {document_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete document: {str(e)}"
        )

# ─── Health check ─────────────────────────────────────────────────────────────

@router.get("/health", summary="Health check", tags=["System"])
async def health_check() -> dict:
    return {"status": "ok", "service": "AI Document Intelligence API"}
