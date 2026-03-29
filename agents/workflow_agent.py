"""
agents/workflow_agent.py
─────────────────────────
WorkflowAutomationAgent — routes the processed document to appropriate
business workflows based on document type and validation results.

Workflow rules:
  invoice  → Finance System: flag for payment processing
  contract → Legal Review: extract key clauses, notify legal team
  receipt  → Expense System: categorize and log expense
  unknown  → Manual Review queue
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

from agents.base_agent import BaseAgent
from app.models.schemas import DocumentType
from utils.logger import logger


@dataclass
class WorkflowAction:
    action_id: str
    action_type: str          # "route" | "notify" | "flag" | "log"
    target_system: str
    description: str
    triggered_at: float = field(default_factory=time.time)
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "action_id": self.action_id,
            "action_type": self.action_type,
            "target_system": self.target_system,
            "description": self.description,
            "triggered_at": self.triggered_at,
            "metadata": self.metadata,
        }


# ─── Workflow rule definitions ─────────────────────────────────────────────────

def _invoice_workflow(context: dict) -> list[WorkflowAction]:
    doc_id = context.get("document_id", "unknown")
    fields_dict = _fields_to_dict(context.get("extracted_fields"))
    validation = context.get("validation_report", {})

    actions = [
        WorkflowAction(
            action_id=f"{doc_id}_finance_route",
            action_type="route",
            target_system="Finance System",
            description="Invoice routed to Finance for payment processing.",
            metadata={
                "vendor": fields_dict.get("vendor_name"),
                "total": fields_dict.get("total_amount"),
                "due_date": fields_dict.get("due_date"),
            },
        ),
    ]

    # Flag for manual review if validation failed
    if not validation.get("passed", True):
        actions.append(WorkflowAction(
            action_id=f"{doc_id}_finance_flag",
            action_type="flag",
            target_system="Finance System",
            description="Invoice flagged for manual review due to validation errors.",
            metadata={"validation_issues": validation.get("issues", [])},
        ))

    return actions


def _contract_workflow(context: dict) -> list[WorkflowAction]:
    doc_id = context.get("document_id", "unknown")
    fields_dict = _fields_to_dict(context.get("extracted_fields"))

    return [
        WorkflowAction(
            action_id=f"{doc_id}_legal_review",
            action_type="notify",
            target_system="Legal Department",
            description="Contract sent to Legal for clause review and approval.",
            metadata={
                "parties": [
                    fields_dict.get("company_name"),
                    fields_dict.get("client_name"),
                ],
                "value": fields_dict.get("contract_value"),
                "start": fields_dict.get("start_date"),
                "end": fields_dict.get("end_date"),
            },
        ),
        WorkflowAction(
            action_id=f"{doc_id}_contract_archive",
            action_type="log",
            target_system="Document Archive",
            description="Contract archived in document management system.",
            metadata={"title": fields_dict.get("contract_title")},
        ),
    ]


def _receipt_workflow(context: dict) -> list[WorkflowAction]:
    doc_id = context.get("document_id", "unknown")
    fields_dict = _fields_to_dict(context.get("extracted_fields"))
    total = fields_dict.get("total_amount", "")

    # Auto-categorize by amount
    amount_num = _try_parse_amount(total)
    category = (
        "Large Expense (>1000)"    if amount_num and amount_num > 1000 else
        "Medium Expense (100–1000)" if amount_num and amount_num > 100  else
        "Small Expense (<100)"
    )

    return [
        WorkflowAction(
            action_id=f"{doc_id}_expense_log",
            action_type="log",
            target_system="Expense Management System",
            description=f"Receipt categorized as '{category}' and logged.",
            metadata={
                "merchant": fields_dict.get("store_name"),
                "total": total,
                "category": category,
                "payment_method": fields_dict.get("payment_method"),
            },
        ),
    ]


def _unknown_workflow(context: dict) -> list[WorkflowAction]:
    doc_id = context.get("document_id", "unknown")
    return [
        WorkflowAction(
            action_id=f"{doc_id}_manual_review",
            action_type="flag",
            target_system="Manual Review Queue",
            description="Document type could not be determined. Sent to manual review.",
            metadata={},
        ),
    ]


_WORKFLOW_MAP = {
    DocumentType.invoice:  _invoice_workflow,
    DocumentType.receipt:  _receipt_workflow,
    DocumentType.contract: _contract_workflow,
    DocumentType.unknown:  _unknown_workflow,
}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _fields_to_dict(fields: Any) -> dict:
    if fields is None:
        return {}
    if hasattr(fields, "model_dump"):
        return fields.model_dump()
    if isinstance(fields, dict):
        return fields
    return {}


def _try_parse_amount(value: str | None) -> float | None:
    import re
    if not value:
        return None
    cleaned = re.sub(r"[^\d.,\-]", "", str(value)).replace(",", "")
    try:
        return float(cleaned)
    except (ValueError, TypeError):
        return None


# ─── Agent ────────────────────────────────────────────────────────────────────

class WorkflowAutomationAgent(BaseAgent):
    """
    Routes documents to business systems and produces a workflow action log.
    """

    name = "WorkflowAutomationAgent"

    def _execute(self, payload: dict[str, Any]) -> dict[str, Any]:
        doc_type: DocumentType = payload.get("doc_type", DocumentType.unknown)

        workflow_fn = _WORKFLOW_MAP.get(doc_type, _unknown_workflow)
        actions = workflow_fn(payload)

        logger.info(
            "[%s] Triggered %d workflow action(s) for doc_type=%s",
            self.name, len(actions), doc_type,
        )

        return {
            "workflow_actions": [a.to_dict() for a in actions],
            "workflow_count": len(actions),
        }
