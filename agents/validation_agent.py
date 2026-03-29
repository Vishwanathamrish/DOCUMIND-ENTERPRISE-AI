"""
agents/validation_agent.py
───────────────────────────
ValidationAgent — applies rule-based checks to extracted fields and
returns a structured ValidationReport with issues and overall status.

Rules checked:
  - Required fields present per document type
  - Date fields parseable (ISO 8601 or common formats)
  - Numeric amounts parseable
  - Invoice line item sum approximately matches total_amount
  - Suspicious values (negative amounts, future invoice dates, etc.)
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any

from agents.base_agent import BaseAgent
from app.models.schemas import DocumentType, ExtractedFields
from utils.logger import logger


# ─── Validation models ────────────────────────────────────────────────────────

@dataclass
class ValidationIssue:
    severity: str          # "error" | "warning" | "info"
    field: str
    message: str


@dataclass
class ValidationReport:
    passed: bool
    score: float           # 0.0 – 1.0
    issues: list[ValidationIssue] = field(default_factory=list)


    def to_dict(self) -> dict:
        return {
            "passed": self.passed,
            "score": round(self.score, 3),

            "issues": [
                {"severity": i.severity, "field": i.field, "message": i.message}
                for i in self.issues
            ],
        }


# ─── Required fields per type ─────────────────────────────────────────────────

_REQUIRED: dict[str, list[str]] = {
    DocumentType.invoice:  ["vendor_name", "invoice_number", "invoice_date", "total_amount"],
    DocumentType.receipt:  ["store_name", "date", "total_amount"],
    DocumentType.contract: ["company_name", "client_name", "start_date", "contract_value"],
    DocumentType.unknown:  [],
}

_DATE_FIELDS = {
    "invoice_date", "due_date", "date", "start_date", "end_date",
}

_AMOUNT_FIELDS = {
    "total_amount", "tax_amount", "subtotal", "tax", "contract_value",
}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _parse_amount(value: str | None) -> float | None:
    """Extract a numeric value from strings like 'INR 3,080.00' or '$4500'."""
    if not value:
        return None
    cleaned = re.sub(r"[^\d.,\-]", "", str(value)).replace(",", "")
    try:
        return float(cleaned)
    except (ValueError, TypeError):
        return None


def _parse_date(value: str | None) -> date | None:
    """Try several common date formats."""
    if not value:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%B %d, %Y", "%d %B %Y"):
        try:
            return datetime.strptime(str(value), fmt).date()
        except ValueError:
            continue
    return None


# ─── Agent ────────────────────────────────────────────────────────────────────

class ValidationAgent(BaseAgent):
    """
    Validates extracted fields and produces a ValidationReport.
    The report is stored in the pipeline context as 'validation_report'.
    """

    name = "ValidationAgent"

    def _execute(self, payload: dict[str, Any]) -> dict[str, Any]:
        doc_type: DocumentType = payload.get("doc_type", DocumentType.unknown)
        fields: ExtractedFields | None = payload.get("extracted_fields")

        issues: list[ValidationIssue] = []

        if fields is None:
            issues.append(ValidationIssue(
                severity="error",
                field="extracted_fields",
                message="No extracted fields available to validate.",
            ))
            report = ValidationReport(passed=False, score=0.0, issues=issues)
            return {"validation_report": report.to_dict()}


        fields_dict: dict = (
            fields.model_dump() if hasattr(fields, "model_dump") else dict(fields)
        )

        # ── 1. Required field check ────────────────────────────────────────────
        required = _REQUIRED.get(doc_type, [])
        missing_count = 0
        for req_field in required:
            val = fields_dict.get(req_field)
            if val is None or val == "" or val == []:
                issues.append(ValidationIssue(
                    severity="error",
                    field=req_field,
                    message=f"Required field '{req_field}' is missing.",
                ))
                missing_count += 1

        # ── 2. Date format check ───────────────────────────────────────────────
        today = date.today()
        for date_field in _DATE_FIELDS:
            val = fields_dict.get(date_field)
            if val is None:
                continue
            parsed = _parse_date(val)
            if parsed is None:
                issues.append(ValidationIssue(
                    severity="warning",
                    field=date_field,
                    message=f"'{date_field}' value '{val}' could not be parsed as a date.",
                ))
            else:
                # Suspicious future invoice date
                if date_field == "invoice_date" and parsed > today:
                    issues.append(ValidationIssue(
                        severity="warning",
                        field=date_field,
                        message=f"Invoice date '{val}' is in the future.",
                    ))

        # ── 3. Amount format check ─────────────────────────────────────────────
        for amt_field in _AMOUNT_FIELDS:
            val = fields_dict.get(amt_field)
            if val is None:
                continue
            amount = _parse_amount(val)
            if amount is None:
                issues.append(ValidationIssue(
                    severity="warning",
                    field=amt_field,
                    message=f"'{amt_field}' value '{val}' could not be parsed as a number.",
                ))
            elif amount < 0:
                issues.append(ValidationIssue(
                    severity="warning",
                    field=amt_field,
                    message=f"'{amt_field}' is negative ({val}). Verify this is correct.",
                ))

        # ── 4. Invoice line-item sum vs total_amount ───────────────────────────
        if doc_type == DocumentType.invoice:
            line_items: list[Any] | None = fields_dict.get("line_items")
            total_str = fields_dict.get("total_amount")
            if line_items and total_str:
                item_amounts = []
                for item in line_items:
                    if isinstance(item, dict):
                        # Extract amount from structured line item
                        val = item.get("total") or item.get("amount") or item.get("price") or item.get("unit_price")
                        num = _parse_amount(val)
                    else:
                        num = _parse_amount(item)
                    
                    if num is not None:
                        item_amounts.append(num)


                total_val = _parse_amount(total_str)
                if item_amounts and total_val and total_val > 0:
                    item_sum = sum(item_amounts)
                    # Allow 20% tolerance (tax, rounding, discount)
                    delta_pct = abs(item_sum - total_val) / total_val
                    if delta_pct > 0.20:
                        issues.append(ValidationIssue(
                            severity="warning",
                            field="line_items",
                            message=(
                                f"Sum of line items ({item_sum:.2f}) differs from "
                                f"total_amount ({total_val:.2f}) by {delta_pct * 100:.1f}%."
                            ),
                        ))
                    else:
                        issues.append(ValidationIssue(
                            severity="info",
                            field="line_items",
                            message=f"Line item sum ({item_sum:.2f}) is within 20% of total ({total_val:.2f}). ✓",
                        ))

        # ── 5. Compute validation score ────────────────────────────────────────
        error_count   = sum(1 for i in issues if i.severity == "error")
        warning_count = sum(1 for i in issues if i.severity == "warning")
        total_checks  = max(len(required) + len(_DATE_FIELDS) + len(_AMOUNT_FIELDS), 1)
        penalty       = (error_count * 2 + warning_count) / (total_checks * 2)
        score         = max(0.0, 1.0 - penalty)
        passed        = error_count == 0

        report = ValidationReport(passed=passed, score=score, issues=issues)

        logger.info(
            "[%s] Validation: passed=%s score=%.2f errors=%d warnings=%d",
            self.name, passed, score, error_count, warning_count,
        )

        return {"validation_report": report.to_dict()}
