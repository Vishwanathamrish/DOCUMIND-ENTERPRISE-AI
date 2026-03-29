"use client";
import { useEffect, useState, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { documentsApi, exportApi } from "@/lib/api";
import { useTranslation } from "@/lib/i18n";
import { Document } from "@/types/api";
import { DocTypeBadge } from "@/components/shared/ConfidenceBadge";
import ConfidenceBadge from "@/components/shared/ConfidenceBadge";
import { formatMs, formatDate } from "@/lib/utils";
import {
  Search, FileText, Download, Eye, Filter, RefreshCw, MoreVertical, FileDown, Trash2, Zap, Loader2
} from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { convertToCSV, convertToExcel, downloadFile, formatExportFilename } from "@/lib/exportUtils";

export default function DocumentsPage() {
  return (
    <Suspense fallback={<div className="p-8"><div className="shimmer h-64 rounded-xl" /></div>}>
      <DocumentsContent />
    </Suspense>
  );
}

function DocumentsContent() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [filtered, setFiltered] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const q = searchParams.get("q");

  useEffect(() => {
    if (q) setSearch(q);
  }, [q]);

  const fetchDocs = () => {
    setLoading(true);
    documentsApi.list(100)
      .then((r) => {
        setDocs(r.data.documents || []);
        setFiltered(r.data.documents || []);
      })
      .catch(() => toast.error(t("failedFetchRepo")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let result = docs;
    if (typeFilter !== "all") result = result.filter((d) => d.document_type === typeFilter);
    if (search) result = result.filter((d) =>
      d.filename.toLowerCase().includes(search.toLowerCase()) ||
      d.document_id.toLowerCase().includes(search.toLowerCase())
    );
    setFiltered(result);
  }, [search, typeFilter, docs]);

  const handleExport = async (id: string, fmt: "json" | "csv" | "excel") => {
    console.log('=== EXPORT STARTED ===');
    console.log('Document ID:', id);
    console.log('Format:', fmt);
    
    if (exportingId) {
      console.log('Already exporting, returning early');
      return;
    }
    
    setExportingId(id);
    const loadingToast = toast.loading(`${t("compilingArchive")} (${fmt.toUpperCase()})...`);
    
    try {
      // Fetch document details for CSV/Excel conversion
      const docResponse = await documentsApi.list(100);
      const docs = docResponse.data.documents || [];
      console.log('Total documents fetched:', docs.length);
      
      const doc = docs.find((d: Document) => d.document_id === id);
      console.log('Document found:', !!doc);
      console.log('Document data:', doc);
      
      if (!doc) {
        throw new Error(`Document '${id}' not found in database`);
      }

      let content: Blob | string;
      let mimeType: string;
      let extension: string;

      switch (fmt) {
        case 'json':
          console.log('Exporting as JSON...');
          try {
            const res = await exportApi.export(id, fmt);
            content = res.data;
            mimeType = 'application/json';
            extension = 'json';
          } catch (apiError: any) {
            console.error('Export API error:', apiError);
            throw new Error(`Export API failed: ${apiError.message || 'Unknown error'}`);
          }
          break;
        
        case 'csv':
          console.log('Exporting as CSV...');
          console.log('Document type:', doc.document_type);
          content = convertToCSV(doc);
          mimeType = 'text/csv;charset=utf-8;';
          extension = 'csv';
          break;
        
        case 'excel':
          console.log('Exporting as Excel...');
          console.log('Document type:', doc.document_type);
          const excelData = convertToExcel(doc);
          content = new Blob([JSON.stringify(excelData, null, 2)], { type: 'application/json' });
          mimeType = 'application/json';
          extension = 'xlsx';
          break;
        
        default:
          throw new Error(`Unsupported format: ${fmt}`);
      }

      const filename = formatExportFilename(doc.filename, extension);
      console.log('Downloading file:', filename);
      downloadFile(content, filename, mimeType);
      toast.success(`${filename} exported successfully!`, { id: loadingToast });
    } catch (error: any) {
      console.error("Export failed:", error);
      toast.error(error.message || t("exportFailedDetailed"), { id: loadingToast });
    } finally {
      setExportingId(null);
      console.log('=== EXPORT COMPLETE ===');
    }
  };

  const handleDelete = async (id: string) => {
    console.log('=== DELETE REQUESTED ===');
    console.log('Document ID:', id);
    
    // Confirm deletion
    const confirmed = window.confirm(
      `Are you sure you want to delete this document?\n\nID: ${id.slice(0, 12)}...\n\nThis action cannot be undone.`
    );
    
    if (!confirmed) {
      console.log('Delete cancelled');
      return;
    }
    
    console.log('Deleting document...');
    const loadingToast = toast.loading('Deleting document...');
    
    try {
      // Try to call delete API
      await documentsApi.delete(id);
      
      // Remove from local state
      setDocs(prev => prev.filter(d => d.document_id !== id));
      
      toast.success('Document deleted successfully', { id: loadingToast });
      console.log('=== DELETE COMPLETE ===');
    } catch (error: any) {
      console.error('Delete failed:', error);
      
      // If 405 or backend not available, show warning but still remove from UI
      if (error.response?.status === 405 || error.code === 'ERR_NETWORK') {
        toast(
          '⚠️ Backend delete endpoint not available. Document removed from view only.',
          { 
            id: loadingToast,
            duration: 5000,
            icon: '⚠️'
          }
        );
        // Still remove from UI for better UX
        setDocs(prev => prev.filter(d => d.document_id !== id));
      } else {
        toast.error('Failed to delete document', { id: loadingToast });
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-navy">
      {/* Page Wrapper - Proper flex column */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header Section - Fixed height, no scroll */}
        <div className="flex-shrink-0 px-8 sm:px-12 lg:px-16 py-8 border-b border-border bg-surface/50 backdrop-blur-xl mb-4" style={{ paddingLeft: '40px', paddingRight: '40px' }}>
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-4">
              <div className="space-y-2">
                <h1 className="text-2xl font-extrabold tracking-tight text-primary mb-2">{t("docRepository")}</h1>
                <div className="flex items-center gap-4">
                  <p className="text-accent text-xs font-black uppercase tracking-[0.3em]">
                    {filtered.length} {t("indexedAssets")}
                  </p>
                  <div className="w-1 h-1 rounded-full bg-secondary opacity-30" />
                  <p className="text-secondary text-xs font-black uppercase tracking-[0.3em]">
                    {t("realTimeSync")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={fetchDocs}
                  className="btn-secondary !p-3 shadow-xl border-border bg-card"
                  title={t("refreshRepo")}
                >
                  <RefreshCw className={cn("w-5 h-5 text-accent", loading && "animate-spin")} />
                </button>
                <Link href="/upload" className="btn-primary group h-[52px]">
                  <Zap className="w-5 h-5 mr-2 group-hover:animate-pulse" />
                  {t("indexNewDoc")}
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Bar - Fixed position, no scroll interference */}
        <div className="flex-shrink-0 px-8 sm:px-12 lg:px-16 py-6 border-b border-border bg-surface/30 backdrop-blur-xl sticky top-0 z-30 mt-3 mb-3" style={{ paddingTop: '10px', paddingBottom: '10px', paddingLeft: '40px', paddingRight: '40px' }}>
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col gap-4 md:gap-6" style={{ marginTop: '16px', marginBottom: '16px' }}>
              <div className="flex flex-row items-center justify-between gap-4 md:gap-6">
                <div className="relative flex-1 group mr-6 md:mr-8">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary group-focus-within:text-accent transition-colors z-10" />
                  <input
                    className="w-full bg-navy/20 border border-border rounded-2xl !ps-14 !pe-6 py-4 text-[15px] text-primary focus:outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all placeholder:text-muted/40 font-medium"
                    placeholder={t("searchRepoPlaceholder")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="relative min-w-[260px]">
                  <Filter className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary z-10" />
                  <select
                    className="w-full bg-navy/10 border border-border rounded-2xl !ps-14 !pe-12 py-4 text-[13px] text-primary font-black uppercase tracking-widest appearance-none focus:outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all cursor-pointer style-none"
                    style={{ colorScheme: 'inherit' }}
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                  >
                    <option value="all">{t("globalAllTypes")}</option>
                    <option value="invoice">{t("invoices")}</option>
                    <option value="contract">{t("contractsDoc")}</option>
                    <option value="receipt">{t("receiptsDoc")}</option>
                    <option value="unknown">{t("unclassified")}</option>
                  </select>
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                    <MoreVertical className="w-4 h-4 text-muted opacity-40" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

  {/* Table Scroll Container */}
  <div className="flex-1 overflow-y-auto relative">
    <div className="max-w-7xl mx-auto px-8 sm:px-12 lg:px-16 py-8 pb-32" style={{ paddingLeft: '40px', paddingRight: '40px' }}>
      {/* Table Wrapper */}
      <div className="bg-surface/20 border border-border rounded-3xl shadow-2xl relative overflow-visible">
        {loading ? (
            <div className="p-32 flex flex-col items-center justify-center gap-8">
              <div className="w-16 h-16 border-[6px] border-[#C9A74E] border-t-transparent rounded-full animate-spin" />
              <p className="text-[11px] uppercase font-black text-accent tracking-[0.5em] animate-pulse">{t("syncRegistry")}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-40 text-center">
              <div className="w-24 h-24 bg-surface border border-border rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-inner">
                <FileText className="w-12 h-12 text-muted" />
              </div>
              <h3 className="text-3xl font-black text-primary uppercase tracking-tighter mb-4">{t("noRecordsDetected")}</h3>
              <p className="text-secondary text-[15px] max-w-md mx-auto font-medium opacity-60">
                {search ? t("adjustSearch") : t("emptyRepo")}
              </p>
              {search && (
                <button
                  onClick={() => { setSearch(""); setTypeFilter("all"); }}
                  className="mt-12 btn-secondary border-border hover:border-border/50"
                >
                  {t("clearFilters")}
                </button>
              )}
            </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-auto border-separate border-spacing-y-3" style={{ borderCollapse: 'separate', borderSpacing: '0 10px' }}>
              <thead className="bg-surface/50 border-b border-border sticky top-0 z-20 rounded-t-2xl">
                <tr>
                  <th className="text-left pl-8 pr-6 py-4 text-sm font-semibold text-gray-400 tracking-wide whitespace-nowrap rounded-tl-2xl" style={{ paddingLeft: '32px', paddingRight: '24px', whiteSpace: 'nowrap' }}>{t("securityAsset")}</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400 tracking-wide whitespace-nowrap pr-8" style={{ paddingRight: '32px', whiteSpace: 'nowrap' }}>{t("classification")}</th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-gray-400 tracking-wide whitespace-nowrap pr-8" style={{ paddingRight: '32px', whiteSpace: 'nowrap' }}>{t("extractionConfidence")}</th>
                  <th className="hidden lg:table-cell text-right px-6 py-4 text-sm font-semibold text-gray-400 tracking-wide whitespace-nowrap min-w-[160px] pr-8" style={{ paddingRight: '32px', whiteSpace: 'nowrap' }}>{t("processingLatency")}</th>
                  <th className="hidden lg:table-cell text-left px-6 py-4 text-sm font-semibold text-gray-400 tracking-wide whitespace-nowrap min-w-[200px] pr-8" style={{ paddingRight: '32px', whiteSpace: 'nowrap' }}>{t("creationDate")}</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-400 tracking-wide whitespace-nowrap min-w-[200px] pr-8" style={{ paddingRight: '32px', whiteSpace: 'nowrap' }}>{t("actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                      {filtered.map((doc, i) => (
                        <tr key={doc.document_id} className="group hover:bg-hover/50 transition-all duration-200 animate-fade-in bg-surface/20" style={{ animationDelay: `${i * 30}ms`, marginBottom: '12px' }}>
                          <td className="!pl-8 py-6 rounded-l-2xl">
                            <div className="flex items-center gap-5 pointer-events-none">
                              <div className="w-14 h-14 rounded-2xl bg-surface border border-border flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:border-accent/40 group-hover:bg-accent/10 transition-all duration-300 shadow-xl pointer-events-auto">
                                <FileText className="w-7 h-7 text-accent" />
                              </div>
                              <div className="min-w-0 flex-1 pointer-events-auto">
                                <p className="font-extrabold text-primary text-sm truncate max-w-[320px] tracking-tight group-hover:text-accent transition-colors">
                                  {doc.filename}
                                </p>
                                <p className="text-xs text-secondary font-black mt-1 uppercase tracking-widest opacity-40 group-hover:opacity-100 transition-opacity">
                                  ID: {doc.document_id.slice(0, 12)}…
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-6 pointer-events-none">
                            <div className="pointer-events-auto">
                              <DocTypeBadge type={doc.document_type} />
                            </div>
                          </td>
                          <td className="py-6 pointer-events-none">
                            <div className="flex items-center justify-center pointer-events-auto">
                              <div className="inline-flex items-center px-4 py-2 rounded-full bg-surface border border-border shadow-inner">
                                <ConfidenceBadge value={doc.extraction_confidence ?? 0} />
                              </div>
                            </div>
                          </td>
                          <td className="hidden lg:table-cell td-number !pr-12 py-6 pointer-events-none">
                            <span className="pointer-events-auto">{Math.round(doc.pipeline_elapsed_ms ?? 0)}ms</span>
                          </td>
                          <td className="hidden lg:table-cell whitespace-nowrap py-6 pointer-events-none">
                            <span className="text-xs font-black text-secondary uppercase tracking-widest opacity-60 pointer-events-auto">
                              {formatDate(doc.created_at)}
                            </span>
                          </td>
                          <td className="!pr-8 py-6 rounded-r-2xl">
                            {/* Action Buttons */}
                            <div className="flex items-center justify-end gap-3 relative">
                              <Link
                                href={`/dashboard/documents/${doc.document_id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="p-3 rounded-xl bg-surface border border-border text-primary hover:border-accent hover:text-accent hover:scale-110 transition-all duration-200 shadow-lg"
                                title={t("openViewer")}
                              >
                                <Eye className="w-5 h-5" />
                              </Link>
                              
                              {/* Export Dropdown */}
                              <div className="relative inline-block" ref={dropdownRef} style={{ zIndex: 999 }}>
                                <button
                                  disabled={exportingId === doc.document_id}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log('Export button clicked for:', doc.document_id);
                                    setOpenDropdown(openDropdown === doc.document_id ? null : doc.document_id);
                                  }}
                                  className="p-3 rounded-xl bg-surface border border-border text-primary hover:border-emerald-500 hover:text-emerald-400 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                  title={t("exportData")}
                                  type="button"
                                >
                                  {exportingId === doc.document_id ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                  ) : (
                                    <FileDown className="w-5 h-5" />
                                  )}
                                </button>
                                
                                {/* Dropdown Menu */}
                                {openDropdown === doc.document_id && (
                                  <div 
                                    className="absolute right-0 top-full mt-2 w-48 bg-surface border border-border rounded-2xl shadow-2xl backdrop-blur-2xl overflow-hidden"
                                    style={{ 
                                      pointerEvents: 'auto',
                                      zIndex: 9999,
                                      position: 'absolute'
                                    }}
                                  >
                                    <div className="p-3 border-b border-border bg-surface/50">
                                      <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] text-center">{t("selectFormat")}</p>
                                    </div>
                                    {(["json", "csv", "excel"] as const).map((fmt) => (
                                      <button
                                        key={fmt}
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          console.log('=== FORMAT BUTTON MOUSEDOWN ===');
                                          console.log('Format:', fmt);
                                          console.log('Document ID:', doc.document_id);
                                          handleExport(doc.document_id, fmt);
                                          setOpenDropdown(null);
                                        }}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          console.log('=== FORMAT BUTTON CLICK ===');
                                        }}
                                        disabled={exportingId === doc.document_id}
                                        className="w-full text-left px-4 py-3 text-xs font-bold text-primary hover:bg-accent hover:text-[#0F0F10] transition-all uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer first:rounded-t-xl last:rounded-b-xl"
                                        type="button"
                                        style={{ pointerEvents: 'auto' }}
                                      >
                                        {fmt.toUpperCase()} {t("fmtExport")}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                              
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  console.log('DELETE BUTTON CLICKED');
                                  handleDelete(doc.document_id);
                                }}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  console.log('DELETE BUTTON MOUSEDOWN');
                                }}
                                className="p-3 rounded-xl bg-surface border border-border text-primary hover:border-red-500 hover:text-red-400 hover:scale-110 transition-all duration-200 shadow-lg relative z-[100] cursor-pointer"
                                style={{ pointerEvents: 'auto', zIndex: 10000 }}
                                title={t("deleteAction")}
                                type="button"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
