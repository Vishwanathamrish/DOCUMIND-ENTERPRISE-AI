"use client";
// app/(dashboard)/extraction/page.tsx — Document-Type Aware Extraction Results

import { useEffect, useState } from "react";
import { documentsApi } from "@/lib/api";
import { Document } from "@/types/api";
import ConfidenceBadge from "@/components/shared/ConfidenceBadge";
import { formatDate, truncate } from "@/lib/utils";
import {
  Database, Search, ArrowRight, FileText, ChevronDown, ChevronUp,
  Calendar, User, Hash, Tag, DollarSign, Clock, Layers
} from "lucide-react";
import Link from "next/link";
import { useTranslation, TranslationKey } from "@/lib/i18n";
import { FIELD_DEFS, DOC_META, getDocType, formatFieldValue, isLineItemArray, LineItem } from "@/lib/docTypes";

export default function ExtractionResultsPage() {
  const { t } = useTranslation();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    documentsApi.list(100)
      .then(r => setDocs(r.data.documents || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = search
    ? docs.filter(d =>
      d.filename.toLowerCase().includes(search.toLowerCase()) ||
      d.document_type.toLowerCase().includes(search.toLowerCase())
    )
    : docs;

  return (
    <div className="flex flex-col min-h-screen bg-navy px-6 sm:px-12 lg:px-16 py-8" style={{ paddingLeft: '40px', paddingRight: '40px' }}>
      {/* Header Section */}
      <div className="max-w-7xl mx-auto w-full mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary tracking-tight mb-2">{t("structuredDataQueue")}</h1>
            <p className="text-sm text-secondary" style={{ marginTop: '8px', marginBottom: '16px' }}>
              {t("extractionSystemDesc")}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="max-w-7xl mx-auto w-full">
        <div className="card-elevated overflow-visible">
          {/* Search & Filters Bar */}
          <div className="flex items-center gap-4 p-6 border-b border-border bg-surface/30 rounded-t-2xl" style={{ marginTop: '20px', marginBottom: '20px' }}>
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                placeholder={t("filterByFilenameType")}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full !ps-12 pr-4 py-3 bg-surface border border-border rounded-xl text-sm text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all shadow-inner"
              />
            </div>
            <div className="hidden lg:flex items-center gap-3">
              {(["invoice", "receipt", "contract"] as const).map(typeKey => (
                <span key={typeKey} className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-black text-secondary tracking-widest uppercase shadow-sm">
                  {t(typeKey as TranslationKey)}
                </span>
              ))}
            </div>
          </div>

          {/* Content Area - Fixed overflow issues */}
          <div className="min-h-[600px] bg-surface/10 p-8 rounded-b-2xl overflow-visible">
            {loading ? (
              <div className="space-y-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="shimmer h-32 rounded-2xl w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[400px] text-muted space-y-6">
                <Database className="w-16 h-16 opacity-10" />
                <p className="text-sm font-medium">{search ? t("noMatchingRecords") : t("waitingForExtraction")}</p>
              </div>
            ) : (
              <div className="space-y-8">
                {filtered.map(doc => <div key={doc.document_id} style={{ marginBottom: '24px' }}><ExtractionRow doc={doc} /></div>)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ExtractionRow({ doc }: { doc: Document }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const docType = getDocType(doc.document_type);
  const fieldDefs = FIELD_DEFS[docType];
  const rawFields = doc.fields as Record<string, unknown> | null | undefined;

  const LINE_ITEM_KEYS = new Set(["line_items", "items"]);
  const scalarDefs = fieldDefs.filter(([, , key]) => !LINE_ITEM_KEYS.has(key));
  const lineItemDefs = fieldDefs.filter(([, , key]) =>
    LINE_ITEM_KEYS.has(key) && rawFields && isLineItemArray(rawFields[key])
  );

  const previewDefs = scalarDefs.slice(0, 4);
  const expandedDefs = scalarDefs.slice(4);

  return (
    <div className="group bg-card border border-border rounded-2xl shadow-lg hover:shadow-2xl hover:border-accent/30 transition-all duration-300 p-8 relative overflow-visible">
      {/* Accent Line */}
      <div className="absolute top-0 left-0 w-1 h-full bg-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-l-xl" />
      
      {/* Row Header */}
      <div className="flex items-start justify-between gap-6 mb-8" style={{ padding: '12px 16px' }}>
        <div className="flex items-center gap-5 min-w-0 flex-1">
          <div className="w-14 h-14 rounded-xl border border-border bg-surface flex items-center justify-center text-accent shadow-md flex-shrink-0">
            <FileText className="w-7 h-7" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-primary text-sm truncate max-w-[600px] tracking-tight">
              {doc.filename}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs font-black text-accent uppercase tracking-[0.2em]">{t(docType as TranslationKey)}</span>
              <span className="text-xs text-muted font-bold opacity-30">/</span>
              <span className="text-xs text-muted font-black uppercase tracking-widest">{formatDate(doc.created_at)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6 flex-shrink-0">
          <div className="flex items-baseline gap-2 px-6 py-2.5 rounded-lg bg-surface border border-border shadow-inner" style={{ paddingLeft: '24px', paddingRight: '24px', paddingTop: '10px', paddingBottom: '10px' }}>
            <span className="text-xs uppercase font-black text-muted tracking-widest">{t("confidence")}</span>
            <span className="text-sm font-mono font-bold text-primary">{Math.round((doc.extraction_confidence ?? 0) * 100)}%</span>
          </div>
          <Link
            href={`/dashboard/documents/${doc.document_id}`}
            className="btn-primary px-8 py-3 text-xs font-black uppercase tracking-widest shadow-lg"
            style={{ paddingLeft: '32px', paddingRight: '32px', paddingTop: '12px', paddingBottom: '12px' }}
          >
            {t("reviewData")}
          </Link>
        </div>
      </div>

      {/* Scalar Fields Grid — Type-Aware */}
      {rawFields ? (
        <>
          {/* Preview Fields (Always Visible) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4" style={{ padding: '0 16px 12px 16px' }}>
            {previewDefs.map(([emoji, label, key]) => {
              const { display, isNull } = formatFieldValue(rawFields[key]);
              return <FieldCell key={key} emoji={emoji} label={t(label as TranslationKey)} display={display} isNull={isNull} />;
            })}
          </div>

          {/* Expandable Fields */}
          {expandedDefs.length > 0 && (
            <div className="mt-6">
              {expanded && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up">
                  {expandedDefs.map(([emoji, label, key]) => {
                    const { display, isNull } = formatFieldValue(rawFields[key]);
                    return <FieldCell key={key} emoji={emoji} label={t(label as TranslationKey)} display={display} isNull={isNull} />;
                  })}
                </div>
              )}
              <button
                onClick={() => setExpanded(e => !e)}
                className="mt-4 flex items-center gap-2 text-xs font-semibold text-accent hover:text-[#C9A74E] transition-colors duration-200 group"
              >
                {expanded
                  ? <><ChevronUp className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" /> {t("showFewer")}</>
                  : <><ChevronDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" /> {t("showMore")} ({expandedDefs.length})</>
                }
              </button>
            </div>
          )}

          {/* ── Full-Width Line Items Table ─────────────────────────────────── */}
          {lineItemDefs.map(([emoji, label, key]) => {
            const items = (rawFields![key] as LineItem[]);
            return (
              <div key={key} className="mt-8 overflow-visible" style={{ padding: '0 16px' }}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs uppercase font-bold tracking-widest text-muted flex items-center gap-2">
                    <span>{t("listLabel")}: {t(label as TranslationKey)}</span>
                  </p>
                  <span className="text-xs font-black text-accent bg-accent/10 px-3 py-1 rounded-lg border border-accent/20">
                    {items.length} {t("itemsCount")}
                  </span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-inner" style={{ padding: '0 20px', boxSizing: 'border-box', width: '100%' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <thead className="bg-surface/50 border-b border-border">
                      <tr className="text-xs uppercase tracking-widest text-muted">
                        <th 
                          className="text-left font-bold whitespace-nowrap" 
                          style={{ paddingLeft: '20px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px' }}
                        >
                          {t("description")}
                        </th>
                        <th 
                          className="text-center font-bold w-24 whitespace-nowrap" 
                          style={{ padding: '8px 12px', textAlign: 'right' }}
                        >
                          {t("qty")}
                        </th>
                        <th 
                          className="text-right font-bold w-36 whitespace-nowrap" 
                          style={{ padding: '8px 12px', textAlign: 'right' }}
                        >
                          {t("unitPrice")}
                        </th>
                        <th 
                          className="text-right font-bold w-40 whitespace-nowrap" 
                          style={{ paddingRight: '20px', paddingLeft: '12px', paddingTop: '8px', paddingBottom: '8px', textAlign: 'right' }}
                        >
                          {t("total")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {items.map((item, i) => (
                        <tr key={i} className="hover:bg-surface/30 transition-colors duration-200 group/row">
                          <td 
                            className="text-sm text-primary font-medium leading-relaxed break-words" 
                            style={{ paddingLeft: '20px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px' }}
                          >
                            {String(item.description ?? item.name ?? "—")}
                          </td>
                          <td 
                            className="text-center text-sm text-secondary font-mono font-medium whitespace-nowrap" 
                            style={{ padding: '8px 12px', textAlign: 'right' }}
                          >
                            {String(item.qty ?? item.quantity ?? "—")}
                          </td>
                          <td 
                            className="text-right text-sm text-secondary font-mono font-medium whitespace-nowrap" 
                            style={{ padding: '8px 12px', textAlign: 'right' }}
                          >
                            {String(item.unit_price ?? item.price ?? "—")}
                          </td>
                          <td 
                            className="text-right text-sm text-primary font-bold font-mono whitespace-nowrap" 
                            style={{ paddingRight: '20px', paddingLeft: '12px', paddingTop: '8px', paddingBottom: '8px', textAlign: 'right' }}
                          >
                            {String(item.total ?? item.amount ?? "—")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </>
      ) : (
        <p className="text-sm text-muted italic">{t("noExtractionData")} — {t("edit")}.</p>
      )}
    </div>
  );
}

function FieldCell({
  label, display, isNull,
}: { emoji: string; label: string; display: string; isNull: boolean; }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col bg-surface/50 border border-border rounded-xl px-5 py-4 gap-2 min-w-0 hover:border-accent/30 hover:bg-surface/70 transition-all duration-200 group" style={{ padding: '10px 12px' }}>
      <span className="text-xs uppercase font-bold tracking-widest text-muted truncate">
        {label}
      </span>
      {isNull ? (
        <span className="text-xs text-muted italic opacity-50">{t("emptyField")}</span>
      ) : display.includes("\n") ? (
        <div className="space-y-1.5 overflow-visible">
          {display.split("\n").map((line, i) => (
            <span key={i} className="text-sm font-bold text-primary block leading-relaxed break-words">
              • {line}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-sm font-bold text-primary leading-relaxed break-words whitespace-normal">
          {display}
        </span>
      )}
    </div>
  );
}

