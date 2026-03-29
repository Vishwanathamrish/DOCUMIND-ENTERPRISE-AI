"""
app/main.py
────────────
FastAPI application entry point.

Start the server:
    uvicorn app.main:app --reload --port 8000
"""
import sys
from pathlib import Path

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse

from app.api.routes import router as v1_router
from app.api.agent_routes import router as v2_router
from app.api.auth_routes import router as auth_router
from app.database import init_db
from utils.config import get_settings
from utils.logger import logger

# ─── Settings ─────────────────────────────────────────────────────────────────
_settings = get_settings()

# ─── App factory ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="AI Document Intelligence Agent Platform",
    description=(
        "Enterprise-grade multi-agent document intelligence platform. "
        "Upload PDFs and images (invoices, contracts, receipts) through the "
        "full agent pipeline: OCR → Classification → Extraction → Validation → "
        "Knowledge Indexing → Workflow Automation. "
        "Provides RAG-powered Q&A, semantic search, analytics, and export.\n\n"
        "**API v1** (`/api/v1`): Legacy endpoints (backward compatible).\n"
        "**API v2** (`/api/v2`): Full multi-agent pipeline with validation, "
        "workflow, search, analytics, auth, and export."
    ),
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error("Validation error at %s: %s", request.url, exc.errors())
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors(), "body": exc.body},
    )


# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(v1_router)   # legacy: /api/v1/upload-document, /extract-fields, /ask-question
app.include_router(v2_router)   # new:    /api/v2/upload, /ask, /documents, /search, /analytics, /export
app.include_router(auth_router) # auth:   /api/v2/auth/register, /login, /me


# ─── Startup / shutdown hooks ─────────────────────────────────────────────────
@app.on_event("startup")
async def on_startup() -> None:
    logger.info("=" * 60)
    logger.info("AI Document Intelligence Agent Platform v2.0 starting…")
    logger.info("Groq model   : %s", _settings.groq_model)
    logger.info("Embedding    : %s", _settings.embedding_model)
    logger.info("Upload dir   : %s", _settings.upload_dir)
    logger.info("FAISS dir    : %s", _settings.faiss_index_dir)
    # Initialise SQLite database
    try:
        init_db()
        logger.info("Database     : SQLite initialised ✓")
    except Exception as exc:
        logger.warning("Database init failed (non-fatal): %s", exc)
    logger.info("=" * 60)


@app.on_event("shutdown")
async def on_shutdown() -> None:
    logger.info("AI Document Intelligence Agent Platform shutting down.")


# ─── Root redirect ────────────────────────────────────────────────────────────
@app.get("/", include_in_schema=False)
async def root() -> RedirectResponse:
    return RedirectResponse(url="/docs")


# ─── Run directly ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=_settings.app_host,
        port=_settings.app_port,
        reload=_settings.debug,
        log_level=_settings.log_level.lower(),
    )
