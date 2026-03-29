"""
app/models/schemas.py
─────────────────────
Pydantic models used as request/response bodies across all API endpoints.

Supports three document types:
  - Invoice:  vendor details, invoice number, amounts, line items
  - Receipt:  store name, items purchased, payment method
  - Contract: parties, dates, value, signatories
"""
from __future__ import annotations

from enum import Enum
from typing import List, Optional, Dict, Any

from pydantic import BaseModel, Field


# ─── Enums ────────────────────────────────────────────────────────────────────

class DocumentType(str, Enum):
    """Detected document type returned by the classifier."""
    invoice = "invoice"
    contract = "contract"
    receipt = "receipt"
    unknown = "unknown"


class SupportedLanguage(str, Enum):
    """Languages detectable in a document."""
    english = "english"
    arabic = "arabic"
    mixed = "mixed"
    unknown = "unknown"


# ─── Shared sub-models ────────────────────────────────────────────────────────

class LineItem(BaseModel):
    """Structured representation of a single line item in an invoice or receipt."""
    description: Optional[str] = Field(None, description="Item description or name")
    qty: Optional[str] = Field(None, description="Quantity (as string to preserve formatting)")
    unit_price: Optional[str] = Field(None, description="Unit price including currency")
    total: Optional[str] = Field(None, description="Line total including currency")


class ValidationIssue(BaseModel):
    """Specific error or warning found during data validation."""
    severity: str = Field(..., description="error | warning | info")
    field: str = Field(..., description="Name of the field with the issue")
    message: str = Field(..., description="Human-readable issue description")


class ValidationReport(BaseModel):
    """The result of the ValidationAgent run."""
    passed: bool = Field(True, description="True if no errors were found")
    score: float = Field(1.0, description="Quality score (0–1)")
    issues: List[ValidationIssue] = Field(default_factory=list)



class ExtractedFields(BaseModel):
    """
    Unified structured fields schema covering Invoice, Receipt, and Contract.
    All fields are Optional — only the relevant subset will be populated
    depending on the detected document type.
    """

    # ── Invoice Fields ────────────────────────────────────────────────────────
    vendor_name: Optional[str] = Field(
        None, description="[Invoice] Name of the issuing vendor or company"
    )
    invoice_number: Optional[str] = Field(
        None, description="[Invoice] Unique invoice reference number"
    )
    invoice_date: Optional[str] = Field(
        None, description="[Invoice] Date the invoice was issued (ISO 8601)"
    )
    due_date: Optional[str] = Field(
        None, description="[Invoice] Payment due date"
    )
    buyer_name: Optional[str] = Field(
        None, description="[Invoice] Name of the buyer or client"
    )
    total_amount: Optional[str] = Field(
        None, description="[Invoice/Receipt] Grand total including taxes and currency"
    )
    tax_amount: Optional[str] = Field(
        None, description="[Invoice/Receipt] VAT / tax amount including currency"
    )
    currency: Optional[str] = Field(
        None, description="[Invoice] Currency code (e.g. USD, AED, EUR)"
    )
    line_items: Optional[List[LineItem]] = Field(
        None, description="[Invoice] List of structured line items"
    )

    # ── Receipt Fields ────────────────────────────────────────────────────────
    store_name: Optional[str] = Field(
        None, description="[Receipt] Name of the store or merchant"
    )
    receipt_number: Optional[str] = Field(
        None, description="[Receipt] Receipt or transaction reference number"
    )
    date: Optional[str] = Field(
        None, description="[Receipt/Contract] Transaction or document date"
    )
    items: Optional[List[LineItem]] = Field(
        None, description="[Receipt] List of structured line items"
    )
    subtotal: Optional[str] = Field(
        None, description="[Receipt] Pre-tax subtotal amount"
    )
    tax: Optional[str] = Field(
        None, description="[Receipt] Tax amount on receipt"
    )
    payment_method: Optional[str] = Field(
        None, description="[Receipt] Payment method (Cash, Card, etc.)"
    )

    # ── Contract Fields ───────────────────────────────────────────────────────
    contract_title: Optional[str] = Field(
        None, description="[Contract] Title or name of the contract/agreement"
    )
    company_name: Optional[str] = Field(
        None, description="[Contract] Name of the company issuing the contract"
    )
    client_name: Optional[str] = Field(
        None, description="[Contract] Name of the client or counterparty"
    )
    start_date: Optional[str] = Field(
        None, description="[Contract] Contract start date (ISO 8601)"
    )
    end_date: Optional[str] = Field(
        None, description="[Contract] Contract end date or expiry (ISO 8601)"
    )
    contract_value: Optional[str] = Field(
        None, description="[Contract] Total value of the contract including currency"
    )
    scope_of_work: Optional[str] = Field(
        None, description="[Contract] Brief summary of scope of work / services"
    )
    signatories: Optional[List[str]] = Field(
        None, description="[Contract] List of signatory names / parties"
    )


# ─── Upload endpoint ──────────────────────────────────────────────────────────

class UploadResponse(BaseModel):
    """Full-featured response returned after document upload and OCR."""
    document_id: str = Field(..., description="Unique identifier for this document session")
    filename: str
    document_type: DocumentType
    language: SupportedLanguage
    raw_text_preview: str = Field(..., description="First 500 chars of extracted text")
    character_count: int
    page_count: int = Field(1, description="Number of pages")
    ocr_confidence: float = Field(0.0, ge=0.0, le=1.0)
    classification_confidence: float = Field(0.0, ge=0.0, le=1.0)
    extraction_confidence: float = Field(0.0, ge=0.0, le=1.0)
    fields: Dict[str, Any] = Field(default_factory=dict)
    validation_report: Optional[ValidationReport] = None
    layout_info: dict = Field(default_factory=dict)
    ocr_data: List[List[Dict[str, Any]]] = Field(default_factory=list)
    workflow_actions: List[str] = Field(default_factory=list)
    pipeline_elapsed_ms: int = 0
    message: str = "Document processed successfully."



# ─── Field extraction endpoint ────────────────────────────────────────────────

class ExtractFieldsRequest(BaseModel):
    """Request body for /extract-fields — may reuse an already-uploaded doc."""
    document_id: str = Field(..., description="document_id from a prior /upload-document call")


class ExtractFieldsResponse(BaseModel):
    """Full-featured response returned after LLM-based field extraction."""
    document_id: str
    document_type: DocumentType
    fields: ExtractedFields
    extraction_confidence: float = Field(0.0, ge=0.0, le=1.0)
    validation_passed: bool = True
    validation_report: Optional[ValidationReport] = None
    layout_info: dict = Field(default_factory=dict)
    workflow_actions: List[str] = Field(default_factory=list)
    pipeline_elapsed_ms: int = 0
    message: str = "Fields extracted successfully."



# ─── RAG question-answering endpoint ──────────────────────────────────────────

class AskQuestionRequest(BaseModel):
    """Request body for /ask-question."""
    document_id: str = Field(..., description="document_id from a prior /upload-document call")
    question: str = Field(..., min_length=3, max_length=1000, description="Natural-language question about the document")


class AskQuestionResponse(BaseModel):
    """Response returned after RAG-based question answering."""
    document_id: str
    question: str
    answer: str
    source_chunks: list[str] = Field(
        default_factory=list,
        description="The text chunks used as context for the answer"
    )
    message: str = "Question answered successfully."

# ─── Analytics and Search ──────────────────────────────────────────────────

class AnalyticsEvent(BaseModel):
    """A single data point for the Dashboard timeline."""
    event_type: str = "processed"
    document_id: str
    filename: Optional[str] = None
    doc_type: str
    elapsed_ms: int
    confidence: float
    created_at: str

class AnalyticsData(BaseModel):
    """Aggregate processing metrics for the Next.js Dashboard."""
    total_documents: int
    total_events: int
    by_type: dict[str, int]
    avg_processing_ms: int
    avg_confidence: float
    recent_events: list[AnalyticsEvent] = Field(default_factory=list)
    # Trend data - percentage changes (positive or negative)
    today_trend: Optional[float] = None  # % change vs yesterday
    weekly_trend: Optional[float] = None  # % change vs last week
    success_rate_trend: Optional[float] = None  # % change in success rate
    processing_time_trend: Optional[float] = None  # % change in processing time (negative is good)

class SearchResponse(BaseModel):
    """Results from a keyword search across documents."""
    query: str
    total: int
    results: list[UploadResponse]

# ─── Generic error response ───────────────────────────────────────────────────

class ErrorResponse(BaseModel):
    """Standard error envelope returned on API errors."""
    error: str
    detail: Optional[str] = None
    document_id: Optional[str] = None
