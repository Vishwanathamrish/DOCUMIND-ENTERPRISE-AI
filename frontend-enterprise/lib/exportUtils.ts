// lib/exportUtils.ts - Reusable export utilities

import { Document } from "@/types/api";

/**
 * Define field mappings for different document types
 */
const DOCUMENT_TYPE_FIELDS: Record<string, string[]> = {
  invoice: [
    'invoice_number',
    'invoice_date',
    'due_date',
    'vendor_name',
    'vendor_address',
    'customer_name',
    'customer_address',
    'subtotal',
    'tax_amount',
    'tax_rate',
    'total_amount',
    'currency',
    'payment_terms',
    'bank_details',
    'line_items'
  ],
  receipt: [
    'receipt_number',
    'receipt_date',
    'merchant_name',
    'merchant_address',
    'payment_method',
    'card_last_four',
    'transaction_id',
    'subtotal',
    'tax_amount',
    'tip_amount',
    'total_amount',
    'currency',
    'line_items'
  ],
  contract: [
    'contract_number',
    'contract_date',
    'effective_date',
    'expiration_date',
    'party_a_name',
    'party_b_name',
    'contract_value',
    'payment_schedule',
    'terms_and_conditions',
    'renewal_terms',
    'termination_clause'
  ],
  bank_statement: [
    'account_number',
    'account_holder',
    'bank_name',
    'statement_date',
    'opening_balance',
    'closing_balance',
    'total_deposits',
    'total_withdrawals',
    'transactions'
  ]
};

/**
 * Filter fields based on document type
 */
function filterFieldsByType(fields: Record<string, unknown>, docType: string): Record<string, unknown> {
  const allowedFields = DOCUMENT_TYPE_FIELDS[docType.toLowerCase()] || [];
  
  // If no specific fields defined for this type, return all fields
  if (allowedFields.length === 0) {
    return fields;
  }
  
  const filtered: Record<string, unknown> = {};
  
  // Add only allowed fields
  Object.entries(fields).forEach(([key, value]) => {
    const normalizedKey = key.toLowerCase().replace(/[-\s]/g, '_');
    if (allowedFields.some(field => field.toLowerCase() === normalizedKey)) {
      filtered[key] = value;
    }
  });
  
  return filtered;
}

/**
 * Convert document data to CSV format
 */
export function convertToCSV(doc: Document): string {
  // Filter fields based on document type
  const filteredFields = filterFieldsByType(doc.fields as Record<string, unknown>, doc.document_type);
  
  // Extract scalar fields
  const scalarFields: Record<string, unknown> = {};
  Object.entries(filteredFields).forEach(([key, value]) => {
    if (!Array.isArray(value)) {
      scalarFields[key] = value;
    }
  });

  // Create CSV rows
  const headers = Object.keys(scalarFields);
  const values = Object.values(scalarFields);
  
  // Escape CSV values
  const escapeCsvValue = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Build CSV content
  let csv = 'Field,Value\n';
  headers.forEach((header, index) => {
    csv += `${escapeCsvValue(header)},${escapeCsvValue(values[index])}\n`;
  });

  // Add line items if present
  const lineItemsKey = Object.keys(filteredFields).find(k => Array.isArray(filteredFields[k]));
  if (lineItemsKey) {
    const items = filteredFields[lineItemsKey] as any[];
    csv += '\nLine Items\n';
    if (items.length > 0) {
      const itemHeaders = Object.keys(items[0]);
      csv += itemHeaders.join(',') + '\n';
      items.forEach(item => {
        csv += itemHeaders.map(h => escapeCsvValue(item[h])).join(',') + '\n';
      });
    }
  }

  return csv;
}

/**
 * Convert document data to Excel-compatible JSON
 */
export function convertToExcel(doc: Document): any[] {
  // Filter fields based on document type
  const filteredFields = filterFieldsByType(doc.fields as Record<string, unknown>, doc.document_type);
  
  const rows: any[] = [];

  // Add metadata
  rows.push({ Field: 'Filename', Value: doc.filename });
  rows.push({ Field: 'Document Type', Value: doc.document_type });
  rows.push({ Field: 'Confidence', Value: `${Math.round((doc.extraction_confidence ?? 0) * 100)}%` });
  rows.push({ Field: 'Created At', Value: new Date(doc.created_at || Date.now()).toLocaleString() });
  rows.push({}); // Empty row

  // Add filtered scalar fields
  Object.entries(filteredFields).forEach(([key, value]) => {
    if (!Array.isArray(value)) {
      rows.push({ Field: key, Value: value });
    }
  });

  // Add line items
  const lineItemsKey = Object.keys(filteredFields).find(k => Array.isArray(filteredFields[k]));
  if (lineItemsKey) {
    rows.push({}); // Empty row
    rows.push({ Field: `--- ${lineItemsKey.replace('_', ' ').toUpperCase()} ---`, Value: '' });
    const items = filteredFields[lineItemsKey] as any[];
    items.forEach((item, idx) => {
      Object.entries(item).forEach(([fieldKey, fieldValue]) => {
        rows.push({ Field: `${lineItemsKey}[${idx}].${fieldKey}`, Value: fieldValue });
      });
    });
  }

  return rows;
}

/**
 * Download file with proper MIME type
 */
export function downloadFile(
  content: string | Blob,
  filename: string,
  mimeType: string = 'text/plain'
): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format filename with timestamp
 */
export function formatExportFilename(originalName: string, extension: string): string {
  const sanitizedName = originalName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\s+/g, '_');
  
  const timestamp = new Date().toISOString().split('T')[0];
  const baseName = sanitizedName.replace(/\.[^/.]+$/, ''); // Remove existing extension
  
  return `${baseName}_${timestamp}.${extension}`;
}
