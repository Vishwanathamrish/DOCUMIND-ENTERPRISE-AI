"""
agents/extraction_agent.py
───────────────────────────
FieldExtractionAgent — uses the existing Groq-powered extractor to
pull structured fields from the cleaned document text.
"""
from __future__ import annotations

from typing import Any

from agents.base_agent import BaseAgent
from app.services.extractor import extract_fields
from utils.logger import logger


class FieldExtractionAgent(BaseAgent):
    """
    Responsibilities:
    - Call Groq with a type-specific prompt to extract structured fields.
    - Return ExtractedFields + extraction confidence.
    """

    name = "FieldExtractionAgent"

    def _execute(self, payload: dict[str, Any]) -> dict[str, Any]:
        clean_text: str = payload["clean_text"]
        doc_type = payload["doc_type"]

        fields, confidence = extract_fields(clean_text, doc_type)

        logger.info(
            "[%s] Extracted fields for %s with confidence=%.2f",
            self.name, doc_type, confidence,
        )

        return {
            "extracted_fields": fields,
            "extraction_confidence": confidence,
        }
