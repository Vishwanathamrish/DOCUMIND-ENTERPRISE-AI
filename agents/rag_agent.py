"""
agents/rag_agent.py
────────────────────
RAGAgent — retrieval-augmented question answering.
Retrieves top-k relevant chunks from FAISS and calls Groq to generate
a grounded answer with source citations.
"""
from __future__ import annotations

from typing import Any

from agents.base_agent import BaseAgent
from rag.retriever import answer_question
from utils.logger import logger


class RAGAgent(BaseAgent):
    """
    Responsibilities:
    - Accept a natural-language question and document_id.
    - Retrieve relevant chunks from the KnowledgeAgent's FAISS index.
    - Call Groq with context to generate a grounded answer.
    - Return answer + source chunks for citation.
    """

    name = "RAGAgent"

    def _execute(self, payload: dict[str, Any]) -> dict[str, Any]:
        document_id: str = payload["document_id"]
        question: str = payload["question"]

        answer, source_chunks = answer_question(document_id, question)

        logger.info(
            "[%s] Answered question for doc '%s': '%s…'",
            self.name, document_id, str(question)[:60],
        )

        return {
            "answer": answer,
            "source_chunks": source_chunks,
            "source_count": len(source_chunks),
        }
