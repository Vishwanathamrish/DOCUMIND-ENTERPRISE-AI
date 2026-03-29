"use client";
import { useState, useRef, useEffect, Suspense, useCallback } from "react";
import { documentsApi, qaApi } from "@/lib/api";
import { Document, AskQuestionResponse } from "@/types/api";
import {
  Send, Bot, User, ChevronDown,
  Loader2, Sparkles, AlertCircle, Copy, Check,
  Trash2, MessageSquare
} from "lucide-react";
import { truncate, cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { useSearchParams } from "next/navigation";
import { useTranslation, TranslationKey } from "@/lib/i18n";
import { QUICK_QUESTIONS, DOC_META, getDocType } from "@/lib/docTypes";

interface Message {
  id: string;
  role: "user" | "bot";
  content: string;
  sources?: string[];
  loading?: boolean;
}

// --- Copy Button ---
function CopyButton({ text }: { text: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard"
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-muted hover:text-primary hover:bg-white/5 flex items-center gap-1"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      <span className="text-[10px] font-medium">{copied ? t("copied") : t("copy")}</span>
    </button>
  );
}

// --- Bot Message ---
function BotMessage({ content }: { content: string }) {
  const formatAnswer = (text: string) => {
    const num = parseFloat(text);
    if (!isNaN(num) && String(num) === text.trim()) {
      return num.toLocaleString();
    }
    return text;
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] font-black uppercase tracking-widest text-muted opacity-60 ml-2">
        DocuMind AI
      </span>
      <div className="flex items-start gap-3 max-w-[75%]">
        <div style={{
          background: '#1e2a3a',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '16px',
          borderTopLeftRadius: '4px',
          padding: '12px 18px',
          fontSize: '14px',
          color: '#ffffff',
          lineHeight: '1.6',
          minWidth: '60px'
        }}>
          {formatAnswer(content)}
        </div>
      </div>
    </div>
  );
}

function ChatContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const initialDoc = searchParams.get("doc");

  const [docs, setDocs] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<string>(initialDoc || "");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [docsLoading, setDocsLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    documentsApi.list(100)
      .then((r) => setDocs(r.data.documents || []))
      .catch(() => toast.error(t("unknown")))
      .finally(() => setDocsLoading(false));
  }, [t]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  const sendMessage = useCallback(async (question: string) => {
    if (!question.trim() || !selectedDoc || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: question };
    const botMsg: Message = { id: (Date.now() + 1).toString(), role: "bot", content: "", loading: true };
    setMessages((prev) => [...prev, userMsg, botMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await qaApi.ask(selectedDoc, question);
      const data: AskQuestionResponse = res.data;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsg.id
            ? { ...m, content: data.answer, sources: data.source_chunks, loading: false }
            : m
        )
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsg.id
            ? { ...m, content: t("chatError"), loading: false }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  }, [selectedDoc, loading, t]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const selectedDocObj = docs.find((d) => d.document_id === selectedDoc);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-start bg-navy/5" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center' }}>
      <div className="max-w-5xl mx-auto px-6 w-full py-12 flex flex-col gap-8 items-center animate-fade-in">
        {/* Header Area - Perfectly Centered */}
        <div className="flex flex-col items-center text-center gap-4 w-full">
          <h2 className="text-4xl font-black text-primary tracking-tight leading-tight">{t("aiAssistant")}</h2>
          <p className="text-secondary text-base font-black uppercase tracking-[0.3em] opacity-60">{t("queryKnowledgeBase")}</p>
        </div>

        {/* Dropdown Section - Center Axis */}
        <div className="w-full flex justify-center">
          <div className="w-full max-w-2xl flex flex-col items-center gap-6">
            <div className="relative flex-1 w-full sm:min-w-[450px]">
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none z-10" />
              <select
                className="input-field pr-12 appearance-none bg-surface border-border font-black text-base h-16 w-full shadow-2xl hover:border-accent/60 transition-all text-primary text-center"
                value={selectedDoc}
                onChange={(e) => { setSelectedDoc(e.target.value); setMessages([]); }}
              >
                <option value="">{t("selectDocument")}…</option>
                {docsLoading ? (
                  <option disabled>{t("loadingLibrary")}</option>
                ) : (
                  docs.map((d) => (
                    <option key={d.document_id} value={d.document_id}>
                      {truncate(d.filename, 50)}
                    </option>
                  ))
                )}
              </select>
            </div>

            {messages.length > 0 && (
              <div className="animate-fade-in group">
                <button
                  onClick={() => setMessages([])}
                  className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-secondary hover:text-red-400 transition-all px-8 py-4 rounded-xl hover:bg-red-500/5 border border-border active:scale-95"
                >
                  <Trash2 className="w-4 h-4" />
                  {t("clearChat")}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Main Chat Shell - Constrained & Centered */}
        <div className="w-full max-w-4xl mx-auto" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
          <div className="card flex flex-col h-[650px] overflow-hidden border-border shadow-lg relative !p-0 bg-surface w-full" style={{ height: '650px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, height: '100%' }}>
            <div className="flex-1 overflow-y-auto flex flex-col custom-scrollbar bg-navy/10 scroll-smooth relative" style={{ height: '100%' }}>
              {messages.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-14 animate-fade-in max-w-3xl mx-auto px-12 min-h-full w-full" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '400px', textAlign: 'center', gap: '20px' }}>
                  {selectedDoc && selectedDocObj ? (() => {
                    const docType = getDocType(selectedDocObj.document_type || "unknown");
                    const meta = DOC_META[docType];
                    const questions = QUICK_QUESTIONS[docType] || [];
                    return (
                      <>
                        <div
                          className="w-24 h-24 rounded-[2.5rem] flex items-center justify-center shadow-2xl text-4xl animate-bounce-slow"
                          style={{ background: `${meta.color}25`, border: `2px solid ${meta.color}44` }}
                        >
                          {meta.emoji}
                        </div>
                        <div>
                          <div
                            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-6 py-2 rounded-full mb-6 border-2"
                            style={{ background: `${meta.color}20`, color: meta.color, borderColor: `${meta.color}44` }}
                          >
                            <Sparkles className="w-3.5 h-3.5 animate-pulse" /> {t(docType as TranslationKey)} {t("detected")}
                          </div>
                          <h3 className="text-4xl font-black text-primary tracking-tight mb-4">
                            {t("readyToAnalyze")}
                          </h3>
                          <p className="text-secondary text-lg font-medium leading-relaxed opacity-80">
                            &ldquo;{truncate(selectedDocObj.filename, 70)}&rdquo; — {t("askAnythingPrompt")} {t(docType as TranslationKey)}.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full mt-12 max-w-2xl mx-auto">
                          {questions.map((q) => (
                            <button
                              key={q.text}
                              onClick={() => sendMessage(q.text)}
                              className="flex flex-col items-center justify-center text-center p-8 rounded-[2.5rem] border border-white/5 bg-white/3 text-secondary
                              hover:text-primary active:scale-95 transition-all shadow-xl group gap-3 hover:bg-surface/50 border-b-4 hover:border-b-accent/50"
                              style={{ borderBottomColor: "rgba(255,255,255,0.05)" }}
                            >
                              <span className="text-4xl leading-none flex-shrink-0 transition-transform group-hover:scale-125 duration-500 drop-shadow-2xl">{q.icon}</span>
                              <span className="text-[10px] font-black uppercase tracking-[0.25em] leading-snug opacity-70 group-hover:opacity-100 transition-opacity">{t(q.textKey as TranslationKey)}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    );
                  })() : (
                    <>
                      <div className="w-24 h-24 rounded-xl bg-surface border border-border flex items-center justify-center text-accent">
                        <MessageSquare className="w-10 h-10" />
                      </div>
                      <div className="space-y-6">
                        <h3 className="text-5xl font-black text-primary tracking-tight">{t("welcomeChat")}</h3>
                        <p className="text-secondary text-xl font-medium leading-relaxed opacity-70 max-w-xl mx-auto">
                          {t("chatPrompt")}
                        </p>
                      </div>

                      <div className="animate-bounce-slow mt-8">
                        <div className="bg-accent/10 p-2 rounded-[2rem] border-2 border-accent/20">
                          <span className="bg-surface/80 px-10 py-5 rounded-[1.5rem] border-2 border-accent text-sm font-black uppercase tracking-[0.25em] text-accent flex items-center gap-4 shadow-2xl">
                            <AlertCircle className="w-6 h-6" /> {t("selectDocumentRequired")}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Chat Messages */}
              <div className={cn("w-full space-y-12", messages.length === 0 && "hidden")}>
                {messages.map((msg) => (
                  <div key={msg.id} className={cn(
                    "flex gap-8 animate-slide-up group",
                    msg.role === "user" ? "flex-row-reverse" : ""
                  )}>
                    {/* Avatar */}
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-2xl border-2 mt-1 transition-transform group-hover:scale-110",
                      msg.role === "user"
                        ? "bg-accent border-accent/30 text-white shadow-accent/40"
                        : "bg-surface border-border text-accent shadow-black/40"
                    )}>
                      {msg.role === "user" ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                    </div>

                    <div className={cn(
                      "flex-1 min-w-0 flex flex-col",
                      msg.role === "user" ? "items-end" : "items-start"
                    )}>
                      {msg.loading ? (
                        <div className="bg-surface/90 border-2 border-border rounded-3xl rounded-tl-sm px-8 py-6 w-24 shadow-2xl">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: "0ms" }} />
                            <div className="w-2.5 h-2.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: "150ms" }} />
                            <div className="w-2.5 h-2.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                        </div>
                      ) : (
                        <div className={cn(
                          "relative group w-full",
                          msg.role === "user" ? "flex flex-col items-end" : ""
                        )}>
                          <div className={cn(
                            "shadow-sm",
                            msg.role === "user" ? "chat-bubble-user max-w-[85%] text-left" : "chat-bubble-bot w-full text-left"
                          )}>
                            {msg.role === "bot" ? (
                              <BotMessage content={msg.content} />
                            ) : (
                              <span className="whitespace-pre-wrap">{msg.content}</span>
                            )}
                          </div>
                          {/* Utils */}
                          {msg.role === "bot" && msg.content && (
                            <div className="mt-4 ml-6 opacity-0 group-hover:opacity-100 transition-opacity">
                              <CopyButton text={msg.content} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} className="h-16" />
              </div>
            </div>

            {/* Dynamic Input Shelf - Perfectly Centered in the Card */}
            <div className="border-t border-border p-8 bg-surface/95 backdrop-blur-3xl relative z-40 w-full" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div className="w-full max-w-3xl mx-auto">
                <div className="relative flex items-center justify-center bg-navy/60 border-2 border-border hover:border-accent focus-within:border-accent focus-within:ring-12 focus-within:ring-accent/10 rounded-[2.5rem] transition-all shadow-2xl group">
                  {/* Mirror spacer for absolute symmetry */}
                  <div className="w-20 flex-shrink-0" aria-hidden="true" />

                  <textarea
                    ref={textareaRef}
                    rows={1}
                    className="flex-1 bg-transparent border-none py-5 text-base font-black text-primary transition-all outline-none resize-none leading-relaxed custom-scrollbar placeholder:text-muted placeholder:opacity-50 text-center"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t("askAiPrompt")}
                    disabled={!selectedDoc || loading}
                    style={{ minHeight: "68px", maxHeight: "200px" }}
                  />

                  <div className="w-20 flex-shrink-0 relative h-full flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => sendMessage(input)}
                      disabled={!input.trim() || !selectedDoc || loading}
                      className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center transition-all flex-shrink-0",
                        !input.trim() || !selectedDoc || loading
                          ? "bg-white/5 text-muted opacity-20 cursor-not-allowed"
                          : "bg-[#C9A74E] text-black hover:opacity-90 cursor-pointer"
                      )}
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className={cn("w-5 h-5", input.trim() && "animate-pulse")} />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center gap-10 mt-12 pb-4" style={{ textAlign: 'center', alignItems: 'center' }}>
                <span className="text-[10px] text-muted font-black uppercase tracking-[0.4em] opacity-30 hover:opacity-100 transition-opacity">
                  {t("processingVia")} <span className="text-accent underline font-black">Groq Llama 3B Ultra</span>
                </span>

                <div className="flex flex-col items-center gap-6 border-t border-white/5 pt-10 w-full">
                  <p className="text-[10px] text-muted font-black uppercase tracking-[0.25em] opacity-30 flex items-center justify-center">
                    <span className="bg-white/5 px-4 py-2 rounded-lg border border-white/5 mr-4 font-black italic shadow-inner">SHIFT + ENTER</span> {t("shiftEnter")}
                  </p>
                  <p className="text-[10px] text-muted font-black uppercase tracking-[0.25em] opacity-30 flex items-center justify-center">
                    <span className="bg-accent/10 px-4 py-2 rounded-lg border border-accent/10 text-accent mr-4 font-black italic shadow-inner shadow-accent/20">ENTER</span> {t("toSubmit")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
        <Loader2 className="w-12 h-12 animate-spin text-accent opacity-20" />
      </div>
    }>
      <ChatContent />
    </Suspense>
  );
}
