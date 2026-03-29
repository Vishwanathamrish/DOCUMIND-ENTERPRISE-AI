// types/api.ts — TypeScript types matching FastAPI Pydantic schemas

export type DocumentType = "invoice" | "contract" | "receipt" | "unknown";
export type SupportedLanguage = "english" | "arabic" | "mixed" | "unknown";
export type ExportFormat = "json" | "csv" | "excel";

export interface ExtractedFields {
  // Invoice
  vendor_name?: string;
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string;
  buyer_name?: string;
  total_amount?: string;
  tax_amount?: string;
  currency?: string;
  line_items?: string[];
  // Receipt
  store_name?: string;
  receipt_number?: string;
  date?: string;
  items?: string[];
  subtotal?: string;
  tax?: string;
  payment_method?: string;
  // Contract
  contract_title?: string;
  company_name?: string;
  client_name?: string;
  start_date?: string;
  end_date?: string;
  contract_value?: string;
  scope_of_work?: string;
  signatories?: string[];
}

export interface ValidationIssue {
  severity: "error" | "warning" | "info";
  field: string;
  message: string;
}

export interface ValidationReport {
  passed: boolean;
  score: number;
  issues: ValidationIssue[];
}


export interface UploadResponse {
  document_id: string;
  filename: string;
  document_type: DocumentType;
  language: SupportedLanguage;
  page_count: number;
  character_count: number;
  raw_text_preview: string;
  ocr_confidence: number;
  classification_confidence: number;
  extraction_confidence: number;
  fields: ExtractedFields;
  validation_report?: ValidationReport;
  layout_info: Record<string, any>;
  ocr_data: any[][];
  workflow_actions: string[];
  pipeline_elapsed_ms: number;
  message: string;
}

export interface Document {
  document_id: string;
  filename: string;
  document_type: DocumentType;
  language: SupportedLanguage;
  page_count: number;
  character_count: number;
  ocr_confidence: number;
  classification_confidence: number;
  extraction_confidence: number;
  fields?: Record<string, unknown>;
  validation_report?: ValidationReport;
  layout_info?: Record<string, any>;
  ocr_data?: any[][];
  workflow_actions?: string[];
  pipeline_elapsed_ms: number;
  created_at?: string;
  file_url?: string;
}

export interface DocumentsListResponse {
  total: number;
  documents: Document[];
}

export interface AskQuestionRequest {
  document_id: string;
  question: string;
}

export interface AskQuestionResponse {
  document_id: string;
  question: string;
  answer: string;
  source_chunks: string[];
  message: string;
}

export interface SearchResponse {
  query: string;
  total: number;
  results: Document[];
}

export interface AnalyticsData {
  total_documents: number;
  total_events: number;
  by_type: Record<DocumentType, number>;
  avg_processing_ms: number;
  avg_confidence: number;
  recent_events: Array<{
    event_type: string;
    document_id: string;
    filename?: string;
    doc_type: string;
    elapsed_ms: number;
    confidence: number;
    created_at: string;
  }>;
  // Trend data - percentage changes
  today_trend?: number | null;  // % change vs yesterday
  weekly_trend?: number | null;  // % change vs last week
  success_rate_trend?: number | null;  // % change in success rate
  processing_time_trend?: number | null;  // % change in processing time (negative is good)
}

export interface AgentStatus {
  agents: Array<{
    name: string;
    status: string;
    last_run?: string;
  }>;
}

export interface ApiError {
  detail: string;
}
