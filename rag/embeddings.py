"""
rag/embeddings.py
──────────────────
Embedding generation using SentenceTransformers.

Wraps the `sentence-transformers` library and exposes a simple
get_embedder() factory that returns a cached model instance.
"""
from functools import lru_cache

import numpy as np
from sentence_transformers import SentenceTransformer

from utils.config import get_settings
from utils.logger import logger

_settings = get_settings()


@lru_cache(maxsize=1)
def get_embedder() -> SentenceTransformer:
    """
    Load (and cache) the SentenceTransformer embedding model.
    The model is downloaded automatically on first use and cached locally
    by the `sentence-transformers` library.
    """
    logger.info("Loading embedding model '%s'…", _settings.embedding_model)
    model = SentenceTransformer(_settings.embedding_model)
    logger.info("Embedding model loaded.")
    return model


def embed_texts(texts: list[str]) -> np.ndarray:
    """
    Generate embeddings for a list of text strings.

    Args:
        texts: List of text chunks to embed.

    Returns:
        NumPy array of shape (len(texts), embedding_dim).
    """
    if not texts:
        return np.empty((0,), dtype=np.float32)

    model = get_embedder()
    logger.debug("Embedding %d text chunk(s)…", len(texts))
    embeddings = model.encode(
        texts,
        convert_to_numpy=True,
        show_progress_bar=False,
        normalize_embeddings=True,   # cosine similarity via dot product
    )
    logger.debug("Embeddings shape: %s", embeddings.shape)
    return embeddings.astype(np.float32)


def embed_query(query: str) -> np.ndarray:
    """
    Embed a single query string.

    Returns:
        1-D NumPy array of shape (embedding_dim,).
    """
    return embed_texts([query])[0]
