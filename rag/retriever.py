"""
rag/retriever.py
─────────────────
FAISS-based vector store for the RAG pipeline.

Responsibilities:
- Build a FAISS index from document text chunks.
- Persist/load the index from disk (keyed by document_id).
- Retrieve the top-k most relevant chunks for a user query.
- Answer the question using the LLM with retrieved context.
"""
import json
import os
from pathlib import Path

import faiss
import numpy as np
from langchain.prompts import ChatPromptTemplate

from rag.embeddings import embed_query, embed_texts
from app.services.llm_service import execute_prompt
from utils.config import get_settings
from utils.logger import logger

_settings = get_settings()


# ─── Prompt for question answering ────────────────────────────────────────────

_QA_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        "You are a helpful document analyst specializing in financial and legal documents. "
        "Using ONLY the context extracted from the document below, "
        "answer the user's question accurately and with extreme conciseness.\n"
        "PROVIDE ONLY THE DIRECT ANSWER. Do not use full sentences or introductory phrases like 'The vendor is...' or 'Based on the context...'.\n\n"
        "Critical Guidelines for Table Data:\n"
        "- IMPORTANT: In this document, table rows are often extracted Right-to-Left (REVERSED).\n"
        "- This means the FIRST number on a line is often the final 'Amount', "
        "and 'Rate' or 'Discount' appear LATER in the same line.\n"
        "- Do not confuse 'Discount Amount' with the final row 'Amount' or 'Total'.\n"
        "- Use the horizontal text alignment/order to map values to headers logically.\n\n"
        "If the answer is not present in the context, say: "
        "'I could not find that information in the document.'\n\n"
        "Context:\n{context}",
    ),
    ("human", "Question: {question}"),
])


# ─── Index storage helpers ─────────────────────────────────────────────────────

def _index_dir(document_id: str) -> Path:
    base = Path(_settings.faiss_index_dir)
    return base / document_id


def _save_index(document_id: str, index: faiss.Index, chunks: list[str]) -> None:
    """Persist FAISS index + metadata (chunks list) to disk."""
    idx_dir = _index_dir(document_id)
    idx_dir.mkdir(parents=True, exist_ok=True)

    faiss.write_index(index, str(idx_dir / "index.faiss"))
    with open(idx_dir / "chunks.json", "w", encoding="utf-8") as f:
        json.dump(chunks, f, ensure_ascii=False)

    logger.info("FAISS index saved to '%s'.", idx_dir)


def _load_index(document_id: str) -> tuple[faiss.Index, list[str]]:
    """Load a persisted FAISS index and its associated chunks."""
    idx_dir = _index_dir(document_id)
    index_path = idx_dir / "index.faiss"
    chunks_path = idx_dir / "chunks.json"

    if not index_path.exists() or not chunks_path.exists():
        raise FileNotFoundError(
            f"No stored index found for document_id='{document_id}'. "
            "Upload and process the document first."
        )

    index = faiss.read_index(str(index_path))
    with open(chunks_path, "r", encoding="utf-8") as f:
        chunks = json.load(f)

    logger.info("Loaded FAISS index for '%s' (%d vectors).", document_id, index.ntotal)
    return index, chunks


# ─── Public API ───────────────────────────────────────────────────────────────

def build_index(document_id: str, chunks: list[str]) -> None:
    """
    Embed text chunks and store them in a FAISS flat L2 index.

    Args:
        document_id: Unique identifier for this document.
        chunks:      List of text chunks to index.
    """
    if not chunks:
        logger.warning("No chunks provided for indexing (document_id=%s).", document_id)
        return

    logger.info("Building FAISS index for %d chunks…", len(chunks))
    embeddings = embed_texts(chunks)                    # shape: (n, dim)
    dim = embeddings.shape[1]

    # IndexFlatIP (inner product) for cosine similarity
    # (embeddings are already L2-normalised in embeddings.py)
    index = faiss.IndexFlatIP(dim)
    index.add(embeddings)

    _save_index(document_id, index, chunks)
    logger.info("FAISS index built — %d vectors, dim=%d.", index.ntotal, dim)


def retrieve_chunks(document_id: str, query: str, top_k: int | None = None) -> list[str]:
    """
    Retrieve the top-k most relevant chunks for a query.

    Args:
        document_id: Identifies the stored FAISS index.
        query:       Natural-language user query.
        top_k:       Override the global top_k setting.

    Returns:
        List of chunk strings, ranked by relevance.
    """
    k = top_k or _settings.top_k_retrieval
    index, chunks = _load_index(document_id)

    query_vec = embed_query(query).reshape(1, -1)
    k_actual = min(k, index.ntotal)

    scores, indices = index.search(query_vec, k_actual)
    retrieved = [chunks[i] for i in indices[0] if i < len(chunks)]

    logger.info(
        "Retrieved %d chunk(s) for query '%s' (document_id=%s).",
        len(retrieved), str(query)[0:60], document_id,
    )
    return retrieved


def answer_question(document_id: str, question: str) -> tuple[str, list[str]]:
    """
    Full RAG pipeline:
    1. Retrieve relevant chunks from FAISS.
    2. Build a context string.
    3. Call the Groq LLM to generate an answer.

    Returns:
        Tuple of (answer_string, list_of_source_chunks).
    """
    source_chunks = retrieve_chunks(document_id, question)
    if not source_chunks:
        return "No relevant information found in the document.", []

    context = "\n\n---\n\n".join(source_chunks)

    try:
        answer = execute_prompt(_QA_PROMPT, {
            "context": context,
            "question": question
        }, temperature=0.1)  # Lower temperature for higher precision on numbers
        logger.info("RAG answer generated via Groq for '%s'.", str(question)[0:60])
        return answer, source_chunks
    except Exception as exc:
        logger.error("Groq-based RAG answer generation failed: %s", exc)
        raise RuntimeError(f"Failed to generate answer: {exc}") from exc
