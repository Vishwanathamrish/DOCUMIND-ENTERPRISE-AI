"""
agents/orchestrator.py
───────────────────────
AgentOrchestrator — chains all document-processing agents into
a single linear pipeline and maintains a shared context dict.

Pipeline order (upload path):
  1. DocumentIntakeAgent
  2. OCRProcessingAgent
  3. ClassificationAgent
  4. FieldExtractionAgent
  5. ValidationAgent
  6. KnowledgeAgent
  7. WorkflowAutomationAgent

Q&A path (separate, triggered per question):
  1. RAGAgent
"""
from __future__ import annotations

import time
from typing import Any

from agents.base_agent import AgentResult
from agents.classification_agent import ClassificationAgent
from agents.extraction_agent import FieldExtractionAgent
from agents.intake_agent import DocumentIntakeAgent
from agents.knowledge_agent import KnowledgeAgent
from agents.ocr_agent import OCRProcessingAgent
from agents.rag_agent import RAGAgent
from agents.validation_agent import ValidationAgent
from agents.workflow_agent import WorkflowAutomationAgent
from utils.logger import logger


class AgentOrchestrator:
    """
    Runs the full multi-agent pipeline for document processing.

    Each agent receives the accumulated context dict and merges its
    output back into it. On failure at any critical stage the pipeline
    raises immediately; non-critical agents (Workflow) log warnings.
    """

    def __init__(self) -> None:
        self._intake        = DocumentIntakeAgent()
        self._ocr           = OCRProcessingAgent()
        self._classifier    = ClassificationAgent()
        self._extractor     = FieldExtractionAgent()
        self._validator     = ValidationAgent()
        self._knowledge     = KnowledgeAgent()
        self._workflow      = WorkflowAutomationAgent()
        self._rag           = RAGAgent()

    # ── Public API ────────────────────────────────────────────────────────────

    def process_document(self, filename: str, content: bytes) -> dict[str, Any]:
        """
        Run the full upload pipeline.

        Returns:
            Merged context dict containing all agent outputs.
        """
        t_start = time.perf_counter()
        ctx: dict[str, Any] = {"filename": filename, "content": content}

        # Critical pipeline stages — raise on failure
        for agent in [
            self._intake,
            self._ocr,
            self._classifier,
        ]:
            result = agent.run(ctx)
            result.raise_if_failed()
            ctx.update(result.payload)

        # Field extraction — attempt, fall back to empty on failure
        ext_result = self._extractor.run(ctx)
        if ext_result.success:
            ctx.update(ext_result.payload)
        else:
            logger.warning("[Orchestrator] FieldExtractionAgent failed: %s", ext_result.error)
            ctx["extracted_fields"] = None
            ctx["extraction_confidence"] = 0.0

        # Validation — non-critical, always runs
        val_result = self._validator.run(ctx)
        ctx.update(val_result.payload if val_result.success else {
            "validation_report": {"passed": False, "score": 0.0, "issues": []}
        })

        # Knowledge indexing — critical (needed for Q&A)
        know_result = self._knowledge.run(ctx)
        know_result.raise_if_failed()
        ctx.update(know_result.payload)

        # Workflow — non-critical
        wf_result = self._workflow.run(ctx)
        ctx.update(wf_result.payload if wf_result.success else {
            "workflow_actions": [], "workflow_count": 0
        })

        # Remove raw content bytes from context (not serialisable)
        ctx.pop("content", None)
        ctx.pop("chunks", None)  # large list not needed in response

        elapsed = (time.perf_counter() - t_start) * 1000
        ctx["pipeline_elapsed_ms"] = round(elapsed, 1)
        logger.info("[Orchestrator] Pipeline completed in %.0f ms.", elapsed)

        return ctx

    def answer_question(self, document_id: str, question: str) -> dict[str, Any]:
        """Run RAG Q&A pipeline for a processed document."""
        ctx = {"document_id": document_id, "question": question}
        result = self._rag.run(ctx)
        result.raise_if_failed()
        return result.payload

    def reextract(self, document_id: str, clean_text: str, doc_type: Any) -> dict[str, Any]:
        """Re-run extraction and validation agents for an existing document."""
        ctx = {"document_id": document_id, "clean_text": clean_text, "doc_type": doc_type}
        
        # 1. Extraction
        ext_result = self._extractor.run(ctx)
        if ext_result.success:
            ctx.update(ext_result.payload)
        else:
            ctx["extracted_fields"] = None
            ctx["extraction_confidence"] = 0.0

        # 2. Validation
        val_result = self._validator.run(ctx)
        ctx.update(val_result.payload if val_result.success else {
            "validation_report": {"passed": False, "score": 0.0, "issues": []}
        })
        
        # 3. Knowledge / RAG indexing
        knw_result = self._knowledge.run(ctx)
        if knw_result.success:
            ctx.update(knw_result.payload)
        
        return ctx

    def get_pipeline_status(self) -> dict[str, str]:
        """Return a status dict naming all registered agents."""
        agents = [
            self._intake, self._ocr, self._classifier,
            self._extractor, self._validator, self._knowledge,
            self._workflow, self._rag,
        ]
        return {a.name: "registered" for a in agents}
