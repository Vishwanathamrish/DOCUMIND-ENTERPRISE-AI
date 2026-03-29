"""
utils/config.py
───────────────
Centralised configuration management using Pydantic Settings.
Reads values from environment variables or a .env file.
"""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application-wide settings loaded from environment / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ─── Groq API ─────────────────────────────────────────────────────────────
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    # ─── OpenAI (Deprecated) ──────────────────────────────────────────────────
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    # ─── Tesseract OCR ────────────────────────────────────────────────────────
    tesseract_path: str = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

    # ─── Poppler (required for PDF → image conversion on Windows) ─────────
    # Download from: https://github.com/oschwartz10612/poppler-windows/releases
    # Extract and point this to the "bin" folder inside the extracted directory
    poppler_path: str = r"C:\poppler\Library\bin"

    # ─── Embeddings ───────────────────────────────────────────────────────────
    embedding_model: str = "all-MiniLM-L6-v2"

    # ─── Server ───────────────────────────────────────────────────────────────
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    debug: bool = False

    # ─── Storage paths ────────────────────────────────────────────────────────
    upload_dir: str = "data/uploads"
    faiss_index_dir: str = "data/faiss_index"

    # ─── Logging ──────────────────────────────────────────────────────────────
    log_level: str = "INFO"

    # ─── RAG parameters ───────────────────────────────────────────────────────
    chunk_size: int = 800          # characters per text chunk
    chunk_overlap: int = 100       # overlap between consecutive chunks
    top_k_retrieval: int = 6       # number of chunks to retrieve per query

    def ensure_dirs(self) -> None:
        """Create storage directories if they don't already exist."""
        Path(self.upload_dir).mkdir(parents=True, exist_ok=True)
        Path(self.faiss_index_dir).mkdir(parents=True, exist_ok=True)
        Path("logs").mkdir(parents=True, exist_ok=True)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached singleton Settings instance."""
    settings = Settings()
    settings.ensure_dirs()
    return settings
