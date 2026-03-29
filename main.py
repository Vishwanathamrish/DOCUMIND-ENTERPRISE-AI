"""
main.py
───────
Root-level convenience launcher for the AI Document Intelligence System.

Usage:
    python main.py

This is equivalent to running:
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
"""
import uvicorn
from utils.config import get_settings

if __name__ == "__main__":
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.debug,
        log_level=settings.log_level.lower(),
    )
