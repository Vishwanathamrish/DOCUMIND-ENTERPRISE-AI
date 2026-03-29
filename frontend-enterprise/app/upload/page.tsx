"use client";
// app/(dashboard)/upload/page.tsx — Upload Center

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload, FileText, CheckCircle2, XCircle, Loader2,
  ChevronDown, ChevronUp, Download, Eye
} from "lucide-react";
import { documentsApi, exportApi } from "@/lib/api";
import { UploadResponse } from "@/types/api";
import { DocTypeBadge } from "@/components/shared/ConfidenceBadge";
import ConfidenceBadge from "@/components/shared/ConfidenceBadge";
import { formatMs, cn } from "@/lib/utils";
import toast from "react-hot-toast";
import Link from "next/link";
import { useTranslation, TranslationKey } from "@/lib/i18n";
import { isLineItemArray, FIELD_DEFS, getDocType } from "@/lib/docTypes";

type UploadStatus = "idle" | "uploading" | "done" | "error";

interface FileUpload {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  result?: UploadResponse;
  error?: string;
  expanded: boolean;
}

const ACCEPTED = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/tiff": [".tiff", ".tif"],
  "image/bmp": [".bmp"],
  "image/webp": [".webp"],
}; function FileCard({ upload, onToggle }: { upload: FileUpload; onToggle: () => void }) {
  const { t } = useTranslation();
  const r = upload.result;

  const handleExport = async (fmt: "json" | "csv" | "excel") => {
    if (!r) return;
    try {
      const res = await exportApi.export(r.document_id, fmt);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${r.document_id}.${fmt === "excel" ? "xlsx" : fmt}`;
      a.click();
      toast.success(`${t("exportedAs")} ${fmt.toUpperCase()}`);
    } catch {
      toast.error(t("exportFailed"));
    }
  };

  return (
    <div className={cn(
      "relative group bg-surface border border-border rounded-3xl overflow-visible transition-all duration-300 hover:bg-hover hover:border-border/50 shadow-lg",
      upload.status === "done" && "border-emerald-500/20 bg-emerald-500/5",
      upload.status === "error" && "border-red-500/20 bg-red-500/5",
    )}>
      {/* Header row */}
      <div className="flex items-center gap-6 px-6 py-5 flex-wrap">
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border transition-all shadow-inner",
          upload.status === "uploading" && "bg-[#C9A74E]/10 border-[#C9A74E]/20 animate-pulse",
          upload.status === "done" && "bg-emerald-500/10 border-emerald-500/20",
          upload.status === "error" && "bg-red-500/10 border-red-500/20",
          upload.status === "idle" && "bg-surface border-border",
        )}>
          {upload.status === "uploading" && <Loader2 className="w-6 h-6 text-accent animate-spin" />}
          {upload.status === "done" && <CheckCircle2 className="w-6 h-6 text-emerald-400" />}
          {upload.status === "error" && <XCircle className="w-6 h-6 text-red-400" />}
          {upload.status === "idle" && <FileText className="w-6 h-6 text-secondary" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-[15px] font-extrabold text-primary truncate max-w-[300px] sm:max-w-[400px] tracking-tight">{upload.file.name}</p>
            <span className="text-[11px] text-secondary font-black bg-surface border border-border px-2 py-0.5 rounded-md whitespace-nowrap">{(upload.file.size / 1024).toFixed(0)} KB</span>
          </div>
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            {r && (
              <>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-accent whitespace-nowrap">{r.document_type}</span>
                <div className="w-1.5 h-1.5 rounded-full bg-border flex-shrink-0" />
                <span className="text-[11px] font-black text-secondary uppercase tracking-[0.1em] opacity-60 whitespace-nowrap">
                  {t("extractionConfidence")}: <span className={cn((r.extraction_confidence > 0.8) ? "text-emerald-400" : "text-amber-400")}>
                    {Math.round(((r.extraction_confidence > 0) ? r.extraction_confidence : r.ocr_confidence) * 100)}%
                  </span>
                </span>
              </>
            )}
            {upload.status === "uploading" && (
              <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden mt-4 border border-border relative">
                <div className="bg-accent h-full transition-all duration-300" style={{ width: `${upload.progress}%` }} />
              </div>
            )}
            {upload.error && <span className="text-[11px] font-black text-red-400 uppercase tracking-widest">{upload.error}</span>}
          </div>
        </div>

        {/* Actions - Improved responsive behavior */}
        <div className="flex items-center gap-3 flex-shrink-0 flex-wrap sm:flex-nowrap opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0 ml-auto">
          {upload.status === "done" && r && (
            <>
              <Link href={`/dashboard/documents/${r.document_id}`} className="btn-secondary !px-5 !py-2.5 text-[11px] font-black uppercase tracking-widest shadow-xl">
                <Eye className="w-4 h-4 mr-2" />
                {t("view")}
              </Link>
              
              {/* Export Dropdown - Fixed positioning */}
              <div className="relative group/export">
                <button 
                  className="btn-secondary !p-2 border-border shadow-xl hover:border-emerald-500 hover:text-emerald-400 transition-all"
                  type="button"
                >
                  <Download className="w-4 h-4" />
                </button>
                
                {/* Dropdown Menu - Always visible on hover, properly positioned */}
                <div className="absolute right-0 top-full mt-2 hidden group-hover/export:block z-[999] w-40 bg-surface border border-border rounded-2xl shadow-2xl py-2 overflow-visible animate-slide-up backdrop-blur-3xl">
                  {(["json", "csv", "excel"] as const).map((fmt) => (
                    <button 
                      key={fmt} 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExport(fmt);
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      className="w-full text-left px-5 py-2.5 text-[10px] font-black text-primary hover:bg-accent hover:text-[#0F0F10] transition-all uppercase tracking-[0.1em] cursor-pointer"
                      type="button"
                    >
                      {fmt.toUpperCase()} {t("fmtExport")}
                    </button>
                  ))}
                </div>
              </div>
              
              <button onClick={onToggle} className="p-2.5 rounded-xl bg-surface border border-border text-secondary hover:text-primary hover:bg-hover transition-all active:scale-95 shadow-lg">
                {upload.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded result */}
      {upload.expanded && r && (
        <div className="border-t border-[var(--surface-border)] px-4 py-4 space-y-3 bg-[var(--bg-primary)]/50">
          {/* Scalar fields in 3-col grid */}
          {(() => {
            const docType = getDocType(r.document_type);
            const fieldDefs = FIELD_DEFS[docType];
            const rawFields = r.fields as Record<string, unknown> | null | undefined;
            const LINE_ITEM_KEYS = new Set(["line_items", "items"]);

            const scalarDefs = fieldDefs.filter(([, , key]) => !LINE_ITEM_KEYS.has(key));
            const lineItemDefs = fieldDefs.filter(([, , key]) =>
              LINE_ITEM_KEYS.has(key) && rawFields && isLineItemArray(rawFields[key])
            );

            return (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {scalarDefs.map(([emoji, label, key]) => {
                    if (!rawFields) return null;
                    const val = rawFields[key];
                    if (val === null || val === undefined || val === "" || val === "null") return null;
                    return (
                      <div key={key} className="space-y-0.5">
                        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide font-semibold">
                          {emoji} {t(label as TranslationKey)}
                        </p>
                        <p className="text-sm font-medium text-[var(--text-primary)] break-words">
                          {String(val)}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Line items table */}
                {lineItemDefs.map(([emoji, label, key]) => {
                  const items = (rawFields![key] as any[]);
                  return (
                    <div key={key}>
                      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide font-semibold mb-2">
                        {emoji} {t(label as TranslationKey)} ({items.length})
                      </p>
                      <div className="border border-[var(--surface-border)] rounded-xl overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-[var(--bg-primary)] border-b border-[var(--surface-border)]">
                            <tr className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                              <th className="text-left px-3 py-2 font-semibold">{t("description")}</th>
                              <th className="text-center px-2 py-2 font-semibold w-14">{t("qty")}</th>
                              <th className="text-right px-2 py-2 font-semibold w-24">{t("unitPrice")}</th>
                              <th className="text-right px-3 py-2 font-semibold w-24">{t("total")}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--surface-border)]">
                            {items.map((item: any, i: number) => (
                              <tr key={i} className="hover:bg-[var(--surface-border)]/20">
                                <td className="px-3 py-2 text-[var(--text-primary)] font-medium break-words">{String(item.description ?? item.name ?? "—")}</td>
                                <td className="px-2 py-2 text-center text-[var(--text-secondary)] font-mono">{String(item.qty ?? item.quantity ?? "—")}</td>
                                <td className="px-2 py-2 text-right text-[var(--text-secondary)] font-mono">{String(item.unit_price ?? item.price ?? "—")}</td>
                                <td className="px-3 py-2 text-right text-[var(--text-primary)] font-bold font-mono">{String(item.total ?? item.amount ?? "—")}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </>
            );
          })()}
          {r.raw_text_preview && (
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-1">{t("textPreview")}</p>
              <p className="text-xs text-[var(--text-secondary)] bg-[var(--surface-border)]/50 rounded-lg p-3 font-mono leading-relaxed line-clamp-4">
                {r.raw_text_preview}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function UploadPage() {
  const { t } = useTranslation();
  const [uploads, setUploads] = useState<FileUpload[]>([]);

  const processFile = useCallback(async (fileUpload: FileUpload) => {
    const update = (patch: Partial<FileUpload>) =>
      setUploads((prev) => prev.map((u) => u.id === fileUpload.id ? { ...u, ...patch } : u));

    update({ status: "uploading" });
    try {
      const res = await documentsApi.upload(fileUpload.file, (pct) => update({ progress: pct }));
      update({ status: "done", result: res.data, progress: 100 });
      toast.success(`✓ ${fileUpload.file.name} ${t("processed")}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || t("exportFailed");
      update({ status: "error", error: msg });
      toast.error(msg);
    }
  }, []);

  const onDrop = useCallback(async (accepted: File[]) => {
    const newUploads: FileUpload[] = accepted.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file, status: "idle", progress: 0, expanded: false,
    }));
    setUploads((prev) => [...prev, ...newUploads]);
    for (const u of newUploads) {
      await processFile(u);
    }
  }, [processFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: ACCEPTED, maxFiles: 10, maxSize: 20 * 1024 * 1024,
    onDropRejected: (files) => {
      files.forEach(({ errors }) => toast.error(errors[0]?.message || t("fileRejected")));
    },
  });

  const toggleExpand = (id: string) =>
    setUploads((prev) => prev.map((u) => u.id === id ? { ...u, expanded: !u.expanded } : u));

  const clear = () => setUploads([]);

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center py-8 animate-fade-in">
      <div className="w-full max-w-4xl space-y-12">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-primary mb-2">{t("uploadCenter")}</h1>
          <div className="flex items-center justify-center gap-4">
            <p className="text-accent text-[10px] font-black uppercase tracking-[0.3em]">
              {t("enterprisePlatform")}
            </p>
            <div className="w-1 h-1 rounded-full bg-secondary opacity-30" />
            <p className="text-secondary text-[10px] font-black uppercase tracking-[0.3em]">
              {t("highPriorityQueue")}
            </p>
          </div>
        </div>

        {/* Drop zone */}
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-[2.5rem] py-32 px-12 flex flex-col items-center justify-center text-center cursor-pointer overflow-hidden transition-all duration-500",
            isDragActive ? "border-accent bg-accent/5 scale-[1.02]" : "border-border bg-surface hover:bg-hover hover:border-accent/40 shadow-2xl"
          )}
        >
          <input {...getInputProps()} />
          <div className={cn(
            "relative z-10 w-24 h-24 rounded-3xl bg-surface border border-border flex items-center justify-center mb-10 transition-all duration-500 group-hover:scale-110 group-hover:bg-accent/10 group-hover:border-accent/30 shadow-inner",
            isDragActive && "scale-110 animate-pulse border-accent"
          )}>
            <Upload className={cn("w-10 h-10 text-secondary group-hover:text-accent transition-colors", isDragActive && "text-accent")} />
          </div>
          <div className="space-y-4">
            <p className="relative z-10 text-3xl text-primary font-black tracking-tight">
              {isDragActive ? t("dropDocumentsHere") : t("uploadDocuments")}
            </p>
            <p className="relative z-10 text-secondary text-lg font-medium opacity-60">
              {t("dragAndDropHere")} <span className="text-accent hover:underline underline-offset-8 font-black">{t("browseWorkstation")}</span>
            </p>
          </div>

          <div className="relative z-10 flex items-center justify-center gap-4 mt-12">
            {["PDF", "JPEG", "PNG", "TIFF", "WEBP"].map(ext => (
              <span key={ext} className="px-4 py-1.5 rounded-xl border border-border bg-card text-[10px] font-black text-secondary tracking-[0.2em] shadow-lg">
                {ext}
              </span>
            ))}
          </div>
          <p className="relative z-10 text-[10px] text-muted font-black uppercase tracking-widest mt-8 opacity-40">
            {t("maxLengthDesc")}
          </p>
        </div>

        {/* Upload list */}
        {uploads.length > 0 && (
          <div className="space-y-6 pb-24 animate-slide-up">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h3 className="text-sm font-black text-primary uppercase tracking-widest">
                {uploads.length} {t("indexedAssets")}
              </h3>
              <button onClick={clear} className="text-[10px] font-black text-secondary hover:text-red-400 transition-colors uppercase tracking-[0.2em]">
                {t("clearAllQueue")}
              </button>
            </div>
            <div className="space-y-4">
              {uploads.map((u) => (
                <FileCard key={u.id} upload={u} onToggle={() => toggleExpand(u.id)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
