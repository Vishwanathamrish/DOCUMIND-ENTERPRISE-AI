// lib/docTypes.ts
// Document-type metadata, field definitions, and quick questions
// Mirrors the Streamlit FIELD_DEFS and QUICK_QUESTIONS dictionaries exactly.

export type DocType = "invoice" | "receipt" | "contract" | "unknown";

// ─── Document type metadata ────────────────────────────────────────────────────
export const DOC_META: Record<DocType, { emoji: string; label: string; color: string }> = {
  invoice:  { emoji: "📋", label: "Invoice",  color: "#6366f1" },
  receipt:  { emoji: "🧾", label: "Receipt",  color: "#10b981" },
  contract: { emoji: "📑", label: "Contract", color: "#f59e0b" },
  unknown:  { emoji: "❓", label: "Unknown",  color: "#6b7280" },
};

// ─── Per-type field definitions ────────────────────────────────────────────────
// [emoji, human label, JSON key from backend fields object]
type FieldDef = [string, string, string];

export const FIELD_DEFS: Record<DocType, FieldDef[]> = {
  invoice: [
    ["🏢", "vendorName",    "vendor_name"],
    ["🔢", "invoiceNumber", "invoice_number"],
    ["📅", "invoiceDate",   "invoice_date"],
    ["⏳", "dueDate",       "due_date"],
    ["👤", "buyerName",     "buyer_name"],
    ["💰", "totalAmount",   "total_amount"],
    ["🧾", "taxAmount",     "tax_amount"],
    ["💱", "currency",       "currency"],
    ["📦", "lineItems",     "line_items"],
  ],
  receipt: [
    ["🏪", "storeName",     "store_name"],
    ["🔢", "receiptNumber", "receipt_number"],
    ["📅", "date",           "date"],
    ["🛍️",  "items",          "items"],
    ["💵", "subtotal",       "subtotal"],
    ["🧾", "tax",            "tax"],
    ["💰", "totalAmount",   "total_amount"],
    ["💳", "paymentMethod", "payment_method"],
  ],
  contract: [
    ["📝", "contractTitle", "contract_title"],
    ["🏢", "companyName",   "company_name"],
    ["👤", "clientName",    "client_name"],
    ["🗓️",  "startDate",     "start_date"],
    ["🗓️",  "endDate",       "end_date"],
    ["💰", "contractValue", "contract_value"],
    ["📋", "scopeOfWork",  "scope_of_work"],
    ["✍️",  "signatories",    "signatories"],
  ],
  unknown: [
    ["🏢", "vendorName",      "vendor_name"],
    ["🔢", "referenceNumber", "invoice_number"],
    ["📅", "date",             "invoice_date"],
    ["💰", "amount",           "total_amount"],
  ],
};

// ─── Per-type quick questions (chat suggested questions) ───────────────────────
export const QUICK_QUESTIONS: Record<DocType, { icon: string; text: string; textKey: string }[]> = {
  invoice: [
    { icon: "💰", text: "What is the total invoice amount?", textKey: "qTotal" },
    { icon: "🏢", text: "Who is the vendor?", textKey: "qVendor" },
    { icon: "🔢", text: "What is the invoice number?", textKey: "qInvoiceNum" },
    { icon: "⏳", text: "When is payment due?", textKey: "qDueDate" },
    { icon: "📦", text: "What items are listed on the invoice?", textKey: "qItems" },
    { icon: "🧾", text: "What is the tax amount?", textKey: "qTax" },
  ],
  receipt: [
    { icon: "💰", text: "What is the total amount paid?", textKey: "qTotalPaid" },
    { icon: "🏪", text: "What store is this receipt from?", textKey: "qStore" },
    { icon: "💳", text: "What payment method was used?", textKey: "qPayment" },
    { icon: "🧾", text: "What is the tax amount?", textKey: "qTax" },
    { icon: "🛍️", text: "What items were purchased?", textKey: "qItemsPurchased" },
    { icon: "📅", text: "What is the date of purchase?", textKey: "qDate" },
  ],
  contract: [
    { icon: "👥", text: "Who are the parties in this contract?", textKey: "qParties" },
    { icon: "🗓️", text: "When does the contract start and end?", textKey: "qStartEnd" },
    { icon: "💰", text: "What is the contract value?", textKey: "qValue" },
    { icon: "✍️", text: "Who are the signatories?", textKey: "qSignatories" },
    { icon: "📋", text: "What is the scope of work?", textKey: "qScope" },
    { icon: "📝", text: "What are the key obligations?", textKey: "qObligations" },
  ],
  unknown: [
    { icon: "❓", text: "What is this document about?", textKey: "qAbout" },
    { icon: "📅", text: "What are the key dates mentioned?", textKey: "qDates" },
    { icon: "💰", text: "What monetary amounts are mentioned?", textKey: "qMoney" },
    { icon: "👥", text: "Who are the parties involved?", textKey: "qPartiesInv" },
    { icon: "📋", text: "Summarize this document", textKey: "qSummarize" },
    { icon: "🔍", text: "What are the key terms and conditions?", textKey: "qTerms" },
  ],
};

// Helper to get doc type safely
export function getDocType(raw?: string | null): DocType {
  if (raw === "invoice" || raw === "receipt" || raw === "contract") return raw;
  return "unknown";
}

// ─── Line item type ────────────────────────────────────────────────────────────
export interface LineItem {
  description?: string;
  qty?: string | number;
  quantity?: string | number;
  unit_price?: string | number;
  price?: string | number;
  total?: string | number;
  amount?: string | number;
  [key: string]: unknown;
}

// Detect if a value is an array of line-item objects
export function isLineItemArray(val: unknown): val is LineItem[] {
  if (!Array.isArray(val) || val.length === 0) return false;
  const first = val[0];
  if (typeof first !== "object" || first === null) return false;
  return (
    "description" in first ||
    "qty" in first ||
    "quantity" in first ||
    "unit_price" in first ||
    "total" in first ||
    "amount" in first
  );
}

// Format a single line item into a readable one-liner
export function formatLineItem(item: LineItem): string {
  const desc = item.description ?? item.name ?? "Item";
  const qty = item.qty ?? item.quantity ?? "";
  const price = item.unit_price ?? item.price ?? "";
  const total = item.total ?? item.amount ?? "";
  let parts: string[] = [String(desc)];
  if (qty) parts.push(`Qty: ${qty}`);
  if (price) parts.push(`@ ${price}`);
  if (total) parts.push(`= ${total}`);
  return parts.join("  ·  ");
}

// Format any field value (null → "Not found", arrays → joined)
export function formatFieldValue(val: unknown): { display: string; isNull: boolean } {
  if (val === null || val === undefined || val === "" || val === "null") {
    return { display: "Not found", isNull: true };
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return { display: "Not found", isNull: true };
    if (isLineItemArray(val)) {
      // Format each line item as a readable string
      return {
        display: val.map(item => formatLineItem(item as LineItem)).join("\n"),
        isNull: false,
      };
    }
    // Simple string/number arrays
    return {
      display: val.map(item => String(item)).join("\n"),
      isNull: false,
    };
  }
  if (typeof val === "object") {
    // Single object — show key: value pairs
    const entries = Object.entries(val as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`);
    if (entries.length === 0) return { display: "Not found", isNull: true };
    return { display: entries.join("\n"), isNull: false };
  }
  return { display: String(val), isNull: false };
}
