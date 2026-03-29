"""
app/services/extractor.py
──────────────────────────
LLM-based structured field extraction and document classification.

Given cleaned OCR text, calls the configured LLM (via LangChain) to:
1. Classify the document type (invoice / contract / receipt / unknown).
2. Detect the primary language (English / Arabic / mixed).
3. Dynamically extract structured fields using type-specific prompts.

Each document type (invoice, receipt, contract) has its own prompt that
targets the exact set of fields defined in ExtractedFields (schemas.py).
"""
import json
import re
from typing import Tuple

from langchain.prompts import ChatPromptTemplate

from app.models.schemas import (
    DocumentType,
    ExtractedFields,
    SupportedLanguage,
)
from app.services.llm_service import execute_prompt
from utils.config import get_settings
from utils.logger import logger

_settings = get_settings()


# ─── Classification Prompt ────────────────────────────────────────────────────

_CLASSIFICATION_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        "You are an expert document classifier. "
        "Analyse the provided document text and return ONLY a JSON object.\n\n"
        "=== LANGUAGE RULES ===\n"
        "- arabic: Choose 'arabic' if the document is primarily in Arabic script. "
        "Ignore numbers, currency codes (e.g. INR, USD), or small amounts of technical English if the core content is Arabic.\n"
        "- english: Choose 'english' if the document is primarily in Latin script.\n"
        "- mixed: Use 'mixed' ONLY if there are substantial, distinct blocks of both languages (e.g. a bilingual 50/50 contract).\n\n"
        "Categories:\n"
        "- invoice: Request for payment, tax invoices, bills, purchase orders.\n"
        "- receipt: Proof of payment, shop receipts, transaction slips, POS receipts.\n"
        "- contract: Legal agreements, NDAs, employment letters, service agreements.\n"
        "- unknown: Cannot determine type.\n\n"
        "Return a JSON object with these exact keys:\n"
        "  'document_type': one of ['invoice', 'contract', 'receipt', 'unknown']\n"
        "  'language':      one of ['english', 'arabic', 'mixed', 'unknown']\n"
        "  'confidence':    a float between 0.0 and 1.0 representing certainty.\n\n"
        'Example Output: {{"document_type": "invoice", "language": "arabic", "confidence": 0.95}}\n'
        "Return ONLY the JSON object — no explanation, no markdown.",
    ),
    ("human", "Document text:\n\n{text}"),
])


# ─── Type-Specific Extraction Prompts ─────────────────────────────────────────

_INVOICE_EXTRACTION_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        "You are an expert invoice data extractor specialising in financial documents. "
        "Extract the following fields from the invoice text provided. "
        "Look for labels like 'Vendor', 'Seller', 'Supplier', 'Bill To', 'Invoice No', "
        "'Date', 'Due Date', 'Total', 'Tax', 'VAT', 'Currency', 'Taxable Value'.\n\n"

        "=== CRITICAL: TABLE COLUMN ORDER IN DIGITAL PDFs ===\n"
        "When a PDF is digitally extracted (not scanned, but text-selectable), table rows are often dumped "
        "with columns in REVERSED or JUMBLED order — typically RIGHT-TO-LEFT.\n"
        "A typical invoice table has these columns (left to right):\n"
        "  Sl | Description | HSN | Qty | Rate | Disc% | DiscAmt | Amount\n"
        "After digital extraction the SAME row may appear as:\n"
        "  Amount  DiscAmt  Disc%  Rate  Qty  HSN  Description  Sl\n"
        "So the FIRST number you see on a line is often the final 'Amount'.\n\n"

        "=== RULES FOR LINE ITEMS ===\n"
        "- Each line item MUST be a JSON object with these exact keys:\n"
        "  'description': item name or details.\n"
        "  'qty':         quantity (e.g., '1', '2.5', '10 Nos').\n"
        "  'unit_price':  price per unit including currency (e.g., 'INR 1253.61').\n"
        "  'total':       the NET line total AFTER discount, including currency (e.g., 'INR 1253.61').\n"
        "- If any sub-field is missing, use null.\n"
        "- Verify: sum of all line item totals should approximately equal the pre-tax subtotal.\n\n"

        "=== RULES FOR tax_amount ===\n"
        "- 'tax_amount' is the TOTAL TAX charged (GST/VAT/IGST/CGST+SGST combined).\n"
        "- Do NOT confuse tax_amount with 'Subtotal', 'Taxable Value', or 'Total Before Tax'.\n"
        "- If no tax is explicitly listed, use 'INR 0.00' (or appropriate currency).\n"
        "- Look for labels: 'Total Tax', 'IGST', 'CGST + SGST', 'VAT Total', 'Tax Total'.\n"
        "- Do NOT use a single partial tax component (e.g., only CGST without SGST).\n\n"

        "=== GENERAL RULES ===\n"
        "- 'vendor_name' is the company name at the very top of the document.\n"
        "- 'buyer_name' is under 'Bill To', 'Ship To', 'Customer', or 'Sold To'.\n"
        "- 'total_amount' = the FINAL grand total payable (after all taxes and discounts).\n"
        "- Fix common OCR errors (e.g., 'Invoic' → 'Invoice').\n"
        "- Use null for any field not found.\n"
        "- Dates in ISO 8601 format (YYYY-MM-DD) when possible.\n"
        "- Amounts must include the currency symbol or code (e.g., 'INR 3080.00').\n"
        "- 'confidence' MUST be a float 0.0-1.0, e.g. 0.92.\n\n"

        "Return ONLY a valid JSON object with these exact keys:\n"
        "  vendor_name, invoice_number, invoice_date, due_date, buyer_name,\n"
        "  total_amount, tax_amount, currency, line_items, confidence\n\n"
        "Return ONLY the JSON — no explanation, no markdown code fences.",
    ),
    ("human", "Invoice text:\n\n{text}"),
])

_RECEIPT_EXTRACTION_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        "You are an expert receipt data extractor. "
        "Extract the following fields from the receipt text provided. "
        "Look for store name (usually at the top), receipt/transaction number, "
        "date, list of items purchased, subtotal, tax, total, and payment method.\n\n"
        "Rules:\n"
        "- 'store_name' is the merchant or business name, usually at the top.\n"
        "- 'items' = list of objects, each with: description, qty, unit_price, total.\n"
        "  Example: {{'description': 'Coffee', 'qty': '1', 'unit_price': 'USD 4.50', 'total': 'USD 4.50'}}\n"
        "- 'payment_method' = e.g. 'Cash', 'Credit Card', 'Visa', 'Mastercard', 'ApplePay'.\n"
        "- 'subtotal' = pre-tax total amount.\n"
        "- 'tax' = tax amount shown on receipt.\n"
        "- 'total_amount' = final amount paid including tax.\n"
        "- Use null for any field not found.\n"
        "- Dates in ISO 8601 (YYYY-MM-DD) when possible.\n"
        "- Amounts must include currency symbol or code.\n"
        "- 'confidence' MUST be a float 0.0-1.0.\n\n"
        "Return ONLY a valid JSON object with these exact keys:\n"
        "  store_name, receipt_number, date, items, subtotal, tax,\n"
        "  total_amount, payment_method, confidence\n\n"
        "Return ONLY the JSON — no explanation, no markdown code fences.",
    ),
    ("human", "Receipt text:\n\n{text}"),
])

_CONTRACT_EXTRACTION_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        "You are an expert legal contract data extractor. "
        "Extract the following fields from the contract text provided. "
        "Look for contract title, parties (company and client), effective/start dates, "
        "expiry/end dates, contract value, scope of work, and signatories.\n\n"
        "Rules:\n"
        "- 'contract_title' = the title or heading of the agreement (e.g., 'Software Development Agreement').\n"
        "- 'company_name' = the service provider / first party.\n"
        "- 'client_name' = the client / second party / counterparty.\n"
        "- 'start_date' = effective date or commencement date (ISO 8601).\n"
        "- 'end_date' = termination/expiry date (ISO 8601).\n"
        "- 'contract_value' = total monetary value including currency.\n"
        "- 'scope_of_work' = brief 1-2 sentence summary of services/deliverables.\n"
        "- 'signatories' = list of signatory names, e.g. ['John Doe (CEO)', 'Jane Smith (CFO)'].\n"
        "- Use null for any field not found.\n"
        "- 'confidence' MUST be a float 0.0-1.0.\n\n"
        "Return ONLY a valid JSON object with these exact keys:\n"
        "  contract_title, company_name, client_name, start_date, end_date,\n"
        "  contract_value, scope_of_work, signatories, confidence\n\n"
        "Return ONLY the JSON — no explanation, no markdown code fences.",
    ),
    ("human", "Contract text:\n\n{text}"),
])

_UNKNOWN_EXTRACTION_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        "You are an expert document data extractor. "
        "The document type could not be determined. "
        "Extract any identifiable key information from the text including: "
        "dates, names, monetary amounts, reference numbers, and parties involved.\n\n"
        "Rules:\n"
        "- Fill in whichever fields you can identify from the text.\n"
        "- Use null for any field not found.\n"
        "- 'confidence' MUST be a float 0.0-1.0 (likely low for unknown docs).\n\n"
        "Return ONLY a valid JSON object with these exact keys (fill what you can):\n"
        "  vendor_name, invoice_number, invoice_date, total_amount, confidence\n\n"
        "Return ONLY the JSON — no explanation, no markdown code fences.",
    ),
    ("human", "Document text:\n\n{text}"),
])

# Map of doc type → (prompt, field_keys_to_extract)
_PROMPT_MAP = {
    DocumentType.invoice:  _INVOICE_EXTRACTION_PROMPT,
    DocumentType.receipt:  _RECEIPT_EXTRACTION_PROMPT,
    DocumentType.contract: _CONTRACT_EXTRACTION_PROMPT,
    DocumentType.unknown:  _UNKNOWN_EXTRACTION_PROMPT,
}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _parse_json_response(content: str) -> dict:
    """Robustly parse JSON from LLM response, handling markdown fences."""
    # Strip markdown fences if present
    content = str(content).replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        # Fallback: try to extract JSON object via regex
        match = re.search(r"\{.*\}", content, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        logger.warning("JSON parse failed, returning empty dict. Raw content: %s", content[:200])
        return {}


def _truncate(text: str, max_chars: int = 12000) -> str:
    """Truncate text to fit within LLM context limits."""
    t_text = str(text)
    if len(t_text) <= max_chars:
        return t_text
    return t_text[:max_chars]


# ─── Public API ───────────────────────────────────────────────────────────────

def classify_document(text: str) -> Tuple[DocumentType, SupportedLanguage, float]:
    """
    Use the Groq LLM to detect document type and language.

    Args:
        text: Cleaned OCR text of the document.

    Returns:
        Tuple of (DocumentType, SupportedLanguage, confidence)
    """
    logger.info("Classifying document via Groq…")
    try:
        content = execute_prompt(_CLASSIFICATION_PROMPT, {"text": _truncate(text, 3000)})
        data = _parse_json_response(content)

        # Safely coerce enum values with fallback
        raw_type = data.get("document_type", "unknown")
        raw_lang = data.get("language", "unknown")
        try:
            doc_type = DocumentType(raw_type)
        except ValueError:
            doc_type = DocumentType.unknown

        try:
            language = SupportedLanguage(raw_lang)
        except ValueError:
            language = SupportedLanguage.unknown

        confidence = float(data.get("confidence", 0.0))
        confidence = max(0.0, min(1.0, confidence))  # clamp to [0, 1]

        logger.info(
            "Classified as: type=%s, language=%s (conf=%.2f)",
            doc_type, language, confidence
        )
        return doc_type, language, confidence

    except Exception as exc:
        logger.error("Classification failed: %s", exc)
        return DocumentType.unknown, SupportedLanguage.unknown, 0.0


def extract_fields(
    text: str,
    doc_type: DocumentType = DocumentType.unknown,
) -> Tuple[ExtractedFields, float]:
    """
    Use the Groq LLM to extract structured fields from the document text.
    Dispatches to a type-specific prompt for maximum accuracy.

    Args:
        text:     Cleaned OCR text.
        doc_type: Previously classified document type.

    Returns:
        Tuple of (ExtractedFields, confidence_score).
    """
    logger.info("Extracting structured fields via Groq (doc_type=%s)…", doc_type)

    prompt = _PROMPT_MAP.get(doc_type, _UNKNOWN_EXTRACTION_PROMPT)

    try:
        content = execute_prompt(prompt, {"text": _truncate(text)})
        data = _parse_json_response(content)
        confidence = float(data.pop("confidence", 0.0))
        confidence = max(0.0, min(1.0, confidence))  # clamp to [0, 1]

        # Build unified ExtractedFields:
        # - Only include keys that exist in the schema
        # - Skip None and empty-string values
        # - Coerce all scalar (non-list) values to str to satisfy Optional[str] fields
        #   (LLMs sometimes return numeric types like 3080.0 or True)
        clean: dict = {}
        for k, v in data.items():
            if k not in ExtractedFields.model_fields:
                continue
            if v is None or v == "":
                continue

            if isinstance(v, list):
                # Handle list of strings (e.g., signatories) or list of objects (line_items)
                processed_list = []
                for item in v:
                    if item is None:
                        continue
                    if isinstance(item, dict):
                        # Ensure all values in the dict are strings/null
                        processed_list.append({sk: (str(sv) if sv is not None else None) for sk, sv in item.items()})
                    else:
                        processed_list.append(str(item))
                clean[k] = processed_list
            else:
                clean[k] = str(v)

        fields = ExtractedFields(**clean)

        logger.info("Fields extracted with confidence %.2f for doc_type=%s", confidence, doc_type)
        return fields, confidence

    except Exception as exc:
        logger.error("Field extraction failed: %s", exc)
        return ExtractedFields(), 0.0
