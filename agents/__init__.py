"""
agents/
───────
Multi-agent architecture for the AI Document Intelligence Platform.

Agents:
  DocumentIntakeAgent      – validate, register, persist
  OCRProcessingAgent       – text extraction + confidence
  ClassificationAgent      – doc type + language via Groq
  FieldExtractionAgent     – structured field extraction via Groq
  ValidationAgent          – rule-based validation of extracted data
  KnowledgeAgent           – FAISS vector index management
  RAGAgent                 – retrieval-augmented question answering
  WorkflowAutomationAgent  – rule-based business workflow routing

AgentOrchestrator chains all agents into a single pipeline.
"""
from agents.base_agent import AgentResult, BaseAgent
from agents.orchestrator import AgentOrchestrator

__all__ = ["BaseAgent", "AgentResult", "AgentOrchestrator"]
