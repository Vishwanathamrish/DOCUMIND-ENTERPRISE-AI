"use client";
import { useEffect, useState } from "react";
import { documentsApi, qaApi } from "@/lib/api";
import { Document } from "@/types/api";
import { formatMs, formatDate } from "@/lib/utils";
import {
  FileText, MessageSquare, ChevronLeft, Save, Zap,
  CheckCircle2, AlertCircle, Info, Calendar, User, Hash, Tag, DollarSign, X,
  Loader2
} from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTranslation, TranslationKey } from "@/lib/i18n";
import { FIELD_DEFS, DocType } from "@/lib/docTypes";

// --- Components ---

function PDFViewer({ url }: { url?: string }) {
  const { t } = useTranslation();
  if (!url) return (
    <div className="flex flex-col items-center justify-center h-full text-muted space-y-4">
      <FileText className="w-12 h-12 opacity-10" />
      <p className="text-sm font-medium">{t("noPreview")}</p>
    </div>
  );

  return (
    <iframe
      src={`${url}#toolbar=0`}
      className="w-full h-full border-none"
      title={t("docPreview")}
    />
  );
}

function getFieldIcon(key: string) {
  const iconCn = "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-accent transition-colors";
  if (key.includes("date")) return <Calendar className={iconCn} />;
  if (key.includes("total") || key.includes("amount") || key.includes("tax")) return <DollarSign className={iconCn} />;
  if (key.includes("vendor") || key.includes("company") || key.includes("customer")) return <User className={iconCn} />;
  if (key.includes("number") || key.includes("id")) return <Hash className={iconCn} />;
  return <Tag className={iconCn} />;
}

export default function AdvancedDocumentViewer() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();

  const [doc, setDoc] = useState<Document & { status?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"extraction" | "assistant">("extraction");
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "ai"; content: string }[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    documentsApi.get(id)
      .then((r) => {
        const data = r.data;
        if (!data.file_url) {
          data.file_url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v2/documents/${id}/preview`;
        }
        setDoc(data);
      })
      .catch(() => setError(t("docNotFound")))
      .finally(() => setLoading(false));
  }, [id, t]);

  const handleSave = async () => {
    setIsSaving(true);
    setTimeout(() => {
      toast.success(t("extractionUpdated"));
      setIsSaving(false);
    }, 800);
  };

  const handleApprove = async () => {
    if (doc?.status === "approved" || isApproving) return;
    setIsApproving(true);
    try {
      await documentsApi.setStatus(id, "approved");
      setDoc(prev => prev ? { ...prev, status: "approved" } : null);
      toast.success(t("docApproved"));
    } catch (err) {
      toast.error(t("updateFailed") || "Failed to update status");
    } finally {
      setIsApproving(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isTyping) return;
    const userMsg = chatInput.trim();
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setChatInput("");
    setIsTyping(true);

    try {
      const res = await qaApi.ask(id, userMsg);
      setMessages(prev => [...prev, { role: "ai", content: res.data.answer }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "ai", content: t("chatError") }]);
    } finally {
      setIsTyping(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-muted text-sm font-medium uppercase tracking-widest">{t("loadingRepo")}</p>
      </div>
    </div>
  );

  if (error || !doc) return (
    <div className="flex flex-col items-center justify-center py-20 gap-6 h-[calc(100vh-10rem)]">
      <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
        <AlertCircle className="w-8 h-8 text-red-500" />
      </div>
      <div className="text-center">
        <h3 className="text-xl font-bold text-primary">{t("resourceNotFound")}</h3>
        <p className="text-muted text-sm mt-1">{error || t("docNotLocated")}</p>
      </div>
      <Link href="/dashboard/documents" className="btn-secondary px-6">{t("returnToDocs")}</Link>
    </div>
  );

  const isApproved = doc.status === "approved";

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)] -m-8 overflow-hidden bg-navy animate-fade-in">
      {/* Header */}
      <div className="h-20 border-b border-white/5 bg-surface/30 backdrop-blur-2xl flex-shrink-0 z-20" style={{ width: '100%', padding: '12px 24px', boxSizing: 'border-box' }}>
        {/* ROW 1: filename + badge on left, actions on right */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          {/* Left: Back button + filename + badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => router.back()} className="p-3 rounded-2xl bg-surface border border-border text-secondary hover:text-primary hover:bg-hover transition-all active:scale-90 shadow-lg flex-shrink-0">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 style={{ whiteSpace: 'nowrap', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '500px' }} className="text-xl font-black text-primary tracking-tight">
                {doc.filename}
              </h1>
              <div className="px-2.5 py-0.5 rounded-full bg-accent/20 border border-accent/30 text-accent text-[9px] font-black uppercase tracking-widest animate-pulse flex-shrink-0">
                {t(doc.document_type as TranslationKey)}
              </div>
              {isApproved && (
                <div className="px-2.5 py-0.5 rounded-full bg-success/20 border border-success/30 text-success text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 flex-shrink-0">
                  <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                  {t("approved")}
                </div>
              )}
            </div>
          </div>

          {/* Right: Actions (Extraction, Latency, Buttons) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
            {/* EXTRACTION CONFIDENCE */}
            <span style={{ whiteSpace: 'nowrap', fontWeight: 900, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }} className="text-gray-500 dark:text-gray-400 text-xs tracking-widest">
              {t("extractionConfidence")}
              <span style={{ display: 'inline-block', width: '60px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                <span className={cn((doc.extraction_confidence ?? 0) > 0.8 ? "bg-emerald-500" : "bg-yellow-500")} style={{ display: 'block', width: `${(doc.extraction_confidence ?? 0) * 100}%`, height: '100%', borderRadius: '2px' }} />
              </span>
              <strong className="text-gray-900 dark:text-amber-400 font-bold font-mono">
                {Math.round((doc.extraction_confidence ?? 0) * 100)}%
              </strong>
            </span>

            {/* LATENCY INDEX */}
            <span style={{ whiteSpace: 'nowrap', fontWeight: 900, letterSpacing: '0.05em', textTransform: 'uppercase' }} className="text-gray-500 dark:text-gray-400 text-xs tracking-widest">
              {t("latencyIndex")} <strong className="text-gray-900 dark:text-amber-400 font-bold">{formatMs(doc.pipeline_elapsed_ms ?? 0)}</strong>
            </span>
          </div>
        </div>

        {/* ROW 2: System Index + Uploaded on one line below filename */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '4px', marginLeft: '56px' }}>
          <span style={{ whiteSpace: 'nowrap', fontWeight: 900, letterSpacing: '0.05em', textTransform: 'uppercase' }} className="text-gray-500 dark:text-gray-400 text-xs tracking-widest">
            {t("systemIndex")} <strong className="text-gray-900 dark:text-amber-400 font-semibold">{doc.document_id.slice(0, 8)}</strong>
          </span>
          <span className="text-gray-500 dark:text-gray-400" style={{ opacity: 0.3 }}>•</span>
          <span style={{ whiteSpace: 'nowrap', fontWeight: 900, letterSpacing: '0.05em', textTransform: 'uppercase' }} className="text-gray-500 dark:text-gray-400 text-xs tracking-widest">
            {t("uploaded")} <strong className="text-gray-900 dark:text-amber-400 font-semibold">{formatDate(doc.created_at)}</strong>
          </span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* PDF Viewer Area - 60% */}
        <div className="flex-[0.6] bg-black/40 relative overflow-hidden flex flex-col border-r border-white/5">
          <div className="flex-1 overflow-auto p-12 flex justify-center custom-scrollbar bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.05)_0%,transparent_100%)]">
            <div className="w-full max-w-5xl bg-card shadow-2xl rounded-xl overflow-hidden border border-border min-h-[1200px]">
              <PDFViewer url={doc.file_url} />
            </div>
          </div>
        </div>

        {/* Extraction Panel - 40% */}
        <div className="flex-[0.4] bg-card flex flex-col flex-shrink-0 z-10 shadow-[-10px_0_30px_-10px_rgba(0,0,0,0.5)] border-l border-border">
          {/* Tabs */}
          <div className="flex p-2 gap-2 bg-white/5 border-b border-white/5" style={{ overflowX: 'auto', whiteSpace: 'nowrap', paddingRight: '16px' }}>
            <button
              onClick={() => setActiveTab("extraction")}
              className={cn(
                "flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all",
                activeTab === "extraction" ? "text-accent bg-accent/10 border border-accent/20" : "text-secondary hover:text-primary hover:bg-white/5"
              )}
            >
              {t("extractionDataTab")}
            </button>
            <button
              onClick={() => setActiveTab("assistant")}
              className={cn(
                "flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all",
                activeTab === "assistant" ? "text-accent bg-accent/10 border border-accent/20" : "text-secondary hover:text-primary hover:bg-white/5"
              )}
            >
              {t("aiAssistantTab")}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ padding: '20px 20px 20px 20px', boxSizing: 'border-box', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {activeTab === "extraction" ? (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <section>
                  <div className="flex items-center justify-between mb-6" style={{ paddingLeft: '4px', paddingRight: '4px', marginBottom: '16px' }}>
                    <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-secondary opacity-60">{t("primaryAttributes")}</h3>
                    <button className="text-[10px] font-black text-accent uppercase tracking-widest hover:opacity-80 transition-opacity">{t("syncAll")}</button>
                  </div>
                  <div className="space-y-4">
                    {(() => {
                      const docType = (doc.document_type as DocType) || "invoice";
                      const fieldDefs = FIELD_DEFS[docType] || [];
                      const fields = (doc.fields as Record<string, any>) || {};
                      const LINE_ITEM_KEYS = new Set(["line_items", "items"]);

                      return fieldDefs.filter(([, , key]) => !LINE_ITEM_KEYS.has(key)).map(([, label, key]) => {
                        const isScopeOfWork = key === 'scope_of_work' || key === 'scope';
                        const value = String(fields[key] || "");
                        
                        return (
                        <div key={key} className="group" style={{ marginBottom: '16px' }}>
                          <label className="text-[11px] font-black uppercase tracking-[0.2em] group-focus-within:text-accent transition-colors flex items-center justify-between text-gray-500 dark:text-gray-400" style={{ letterSpacing: '0.1em', marginBottom: '6px' }}>
                            {t(label as TranslationKey)}
                            {fields[key] && <CheckCircle2 className="w-3.5 h-3.5 text-success opacity-80" />}
                          </label>
                          {isScopeOfWork ? (
                            <textarea
                              readOnly
                              rows={3}
                              className="text-gray-900 dark:text-white bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg px-4 py-3 w-full"
                              value={value}
                              style={{ 
                                width: '100%',
                                boxSizing: 'border-box',
                                padding: '12px 16px',
                                paddingRight: '16px',
                                resize: 'none',
                                overflow: 'auto',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                pointerEvents: 'none',
                                cursor: 'default',
                                marginBottom: '4px'
                              }}
                            />
                          ) : (
                            <input
                              readOnly
                              className="text-gray-900 dark:text-white bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg px-4 py-3 w-full"
                              defaultValue={value}
                              style={{ 
                                width: '100%',
                                boxSizing: 'border-box',
                                paddingRight: '16px',
                                pointerEvents: 'none',
                                cursor: 'default',
                                marginBottom: '4px'
                              }}
                            />
                          )}
                        </div>
                      );
                      });
                    })()}
                  </div>
                </section>

                {doc.validation_report?.issues && doc.validation_report.issues.length > 0 && (
                  <section className="animate-slide-up bg-white/5 p-6 rounded-3xl border border-white/5">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-secondary opacity-60 mb-6">{t("validationAudit")}</h3>
                    <div className="space-y-4">
                      {doc.validation_report.issues.map((issue, idx) => (
                        <div key={idx} className={cn(
                          "flex items-start gap-5 p-5 rounded-2xl border",
                          issue.severity === 'error' ? 'bg-red-500/5 border-red-500/20' : 'bg-amber-500/5 border-amber-500/20'
                        )}>
                          <div className={cn(
                            "mt-0.5 p-1.5 rounded-xl",
                            issue.severity === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                          )}>
                            {issue.severity === 'error' ? <X className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-black uppercase text-primary tracking-widest">{t(issue.field as TranslationKey)}</p>
                            <p className="text-sm text-secondary mt-1.5 leading-relaxed font-medium">{issue.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col animate-fade-in relative">
                {/* Chat messages container */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  padding: '16px 20px', 
                  overflowY: 'auto', 
                  flex: 1, 
                  gap: '16px',
                  width: '100%'
                }}>
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center space-y-6 py-20">
                      <div className="w-24 h-24 rounded-[2.5rem] bg-accent/5 border border-accent/10 flex items-center justify-center text-accent shadow-inner">
                        <MessageSquare className="w-10 h-10" />
                      </div>
                      <div className="space-y-3">
                        <h4 className="text-xl font-black text-primary tracking-tight">{t("intelligentAssistant")}</h4>
                        <p className="text-base text-secondary font-medium leading-relaxed opacity-60">
                          {t("aiAssistantDesc")}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
                      {messages.map((m, i) => (
                        <div key={i} style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          alignSelf: m.role === "user" ? 'flex-end' : 'flex-start',
                          marginBottom: '8px'
                        }}>
                          {m.role === "ai" && (
                            <span style={{ 
                              fontSize: '10px', 
                              color: 'var(--muted-foreground, #6b7280)', 
                              letterSpacing: '0.1em', 
                              marginBottom: '4px', 
                              paddingLeft: '4px', 
                              fontWeight: 600,
                              textTransform: 'uppercase'
                            }}>
                              DOCUMIND AI
                            </span>
                          )}
                          {/* Chat bubble */}
                          <div style={{
                            display: 'inline-block',
                            background: m.role === "user" ? '#FFC107' : '#1e2a3a',
                            color: '#ffffff',
                            padding: '12px 18px',
                            borderRadius: m.role === "user" ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                            maxWidth: '75%',
                            minWidth: m.role === "ai" ? '160px' : '120px',
                            width: 'fit-content',
                            fontSize: '14px',
                            lineHeight: '1.6',
                            wordBreak: 'normal',
                            overflowWrap: 'anywhere',
                            whiteSpace: 'normal',
                            boxShadow: m.role === "ai" ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                          }}>
                            <p className="text-sm font-medium leading-relaxed" style={{ 
                              color: '#ffffff', 
                              margin: 0,
                              wordBreak: 'normal',
                              overflowWrap: 'anywhere'
                            }}>{m.content}</p>
                          </div>
                        </div>
                      ))}
                      {isTyping && (
                        <div className="flex items-center gap-3 text-secondary p-4 animate-pulse">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-[10px] font-black uppercase tracking-widest">{t("aiThinking")}...</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ position: 'sticky', bottom: 0, padding: '12px 16px', backgroundColor: 'transparent', borderTop: 'none' }}>
                  <div style={{ backgroundColor: "var(--input-background, #ffffff)", display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '16px', border: '1px solid var(--border, #e5e7eb)', backdropFilter: 'blur(20px)', boxShadow: 'var(--shadow-sm, 0 1px 2px 0 rgba(0,0,0,0.05))' }}>
                    <input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                      disabled={isTyping}
                      style={{ flex: 1, background: 'transparent', border: 'none', fontSize: '14px', color: 'var(--foreground, #1a1a1a)', outline: 'none', fontWeight: 500, padding: '8px 12px' }}
                      placeholder={t("askAiPrompt")}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={isTyping}
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s',
                        flexShrink: 0,
                        background: isTyping ? 'rgba(255,255,255,0.1)' : '#FFC107',
                        color: isTyping ? 'rgba(255,255,255,0.3)' : '#000'
                      }}
                    >
                      {isTyping ? <Loader2 className="w-5 h-5 animate-spin" style={{ width: '20px', height: '20px' }} /> : <Zap className="w-5 h-5" style={{ width: '20px', height: '20px', fill: '#000' }} />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
