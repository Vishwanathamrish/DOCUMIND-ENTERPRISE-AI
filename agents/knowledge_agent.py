"""
agents/knowledge_agent.py
──────────────────────────
KnowledgeAgent — manages the FAISS vector store.
Chunks the cleaned text, embeds it, and builds/updates the index
for the current document. Supports semantic retrieval queries.
"""
from __future__ import annotations

from typing import Any

from agents.base_agent import BaseAgent
from rag.retriever import build_index, retrieve_chunks
from utils.config import get_settings
from utils.logger import logger
from utils.text_processor import chunk_text

_settings = get_settings()


class KnowledgeAgent(BaseAgent):
    """
    Responsibilities:
    - Chunk the cleaned document text.
    - Build a FAISS vector index (persisted to disk).
    - Provide semantic retrieval via retrieve_chunks().
    """

    name = "KnowledgeAgent"

    def _execute(self, payload: dict[str, Any]) -> dict[str, Any]:
        document_id: str = payload["document_id"]
        clean_text: str = payload["clean_text"]

        # ── Chunk and index ────────────────────────────────────────────────────
        chunks = chunk_text(clean_text, _settings.chunk_size, _settings.chunk_overlap)
        build_index(document_id, chunks)

        logger.info(
            "[%s] Indexed %d chunks for document '%s'.",
            self.name, len(chunks), document_id,
        )

        return {
            "chunk_count": len(chunks),
            "chunks": chunks,
        }

    @staticmethod
    def retrieve(document_id: str, query: str, top_k: int = 5) -> list[str]:
        """Convenience static method for retrieval without creating an agent result."""
        return retrieve_chunks(document_id, query, top_k=top_k)
