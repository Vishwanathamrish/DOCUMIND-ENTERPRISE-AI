"use client";
import { useState, useEffect } from "react";
import { agentsApi } from "@/lib/api";
import { useThemeStore } from "@/lib/store/authStore";
import {
  Settings, Moon, Sun, Zap, Shield, Database, ChevronRight,
  Copy, CheckCheck, Server, ExternalLink, Cpu, Terminal
} from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { useTranslation, TranslationKey } from "@/lib/i18n";

function CopyField({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("Endpoint copied to clipboard.");
  };
  return (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-border last:border-0 group">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase font-bold text-muted tracking-widest">{label}</p>
        <p className="text-xs font-mono text-primary mt-1 truncate">{value}</p>
      </div>
      <button
        onClick={copy}
        className="p-2 rounded-lg text-muted hover:text-accent hover:bg-accent/10 transition-all opacity-40 group-hover:opacity-100"
      >
        {copied ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useThemeStore();
  const [agents, setAgents] = useState<any[]>([]);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    agentsApi.status()
      .then((r) => {
        const data = r.data;
        const agentList = Array.isArray(data?.agents)
          ? data.agents
          : Object.entries(data?.pipeline_status || {}).map(([name, status]) => ({ name, status }));
        setAgents(agentList);
      })
      .catch(() => { });
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-primary tracking-tight">{t("settings")}</h2>
        <p className="text-muted text-sm uppercase tracking-widest font-medium text-[10px]">Global Configuration & System Governance</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left Col: Navigation / Categories */}
        <div className="space-y-2">
          <button className="w-full flex items-center justify-between px-4 py-3 bg-accent/5 border border-accent/20 rounded-xl text-accent text-sm font-bold tracking-tight text-left">
            General Options
            <ChevronRight className="w-4 h-4" />
          </button>
          <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface rounded-xl text-muted text-sm font-medium tracking-tight text-left transition-colors">
            Security & Auth
            <ChevronRight className="w-4 h-4 opacity-0" />
          </button>
          <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface rounded-xl text-muted text-sm font-medium tracking-tight text-left transition-colors">
            Integrations
            <ChevronRight className="w-4 h-4 opacity-0" />
          </button>
          <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface rounded-xl text-muted text-sm font-medium tracking-tight text-left transition-colors">
            Webhooks
            <ChevronRight className="w-4 h-4 opacity-0" />
          </button>
        </div>

        {/* Right Col: Main Content */}
        <div className="lg:col-span-2 space-y-10">
          {/* Appearance */}
          <section className="space-y-6">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted flex items-center gap-2">
              <Settings className="w-3.5 h-3.5" />
              Interface Preferences
            </h3>
            <div className="card p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-primary uppercase tracking-tight">Enterprise Theme</p>
                  <p className="text-xs text-muted mt-1 leading-relaxed">Toggle between immersive dark mode and high-contrast light mode.</p>
                </div>
                <div className="flex items-center bg-navy/20 border border-border rounded-xl p-1 gap-1">
                  {(["dark", "light"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => theme !== t && toggleTheme()}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                        theme === t
                          ? "bg-accent text-black shadow-lg"
                          : "text-muted hover:text-primary"
                      )}
                    >
                      {t === "dark" ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* API Configuration */}
          <section className="space-y-6">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted flex items-center gap-2">
              <Server className="w-3.5 h-3.5" />
              API Connectivity
            </h3>
            <div className="card p-8 space-y-2">
              <CopyField label="Core Gateway URL" value={apiUrl} />
              <CopyField label="Ingestion Endpoint" value={`${apiUrl}/api/v2/upload`} />
              <CopyField label="Cognitive Analysis" value={`${apiUrl}/api/v2/ask`} />
              <div className="pt-6 flex gap-3">
                <a href={`${apiUrl}/docs`} target="_blank" rel="noopener noreferrer"
                  className="btn-secondary px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest">
                  <ExternalLink className="w-3.5 h-3.5 mr-2" />
                  API Blueprint (Swagger)
                </a>
              </div>
            </div>
          </section>

          {/* Agent Status */}
          {agents.length > 0 && (
            <section className="space-y-6">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5" />
                Intelligence Cluster Status
              </h3>
              <div className="card p-8">
                <div className="divide-y divide-border">
                  {agents.map((agent) => (
                    <div key={agent.name} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-sm text-primary font-bold uppercase tracking-tight">{agent.name}</span>
                      </div>
                      <span className={cn(
                        "text-[10px] px-3 py-1 rounded-md border font-bold uppercase tracking-widest",
                        typeof agent.status === "string" && agent.status.toLowerCase() === "ok"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-accent/10 text-accent border-accent/20"
                      )}>
                        {typeof agent.status === "object" ? "active" : String(agent.status)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* System info */}
          <section className="space-y-6">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted flex items-center gap-2">
              <Database className="w-3.5 h-3.5" />
              Infrastructure Stack
            </h3>
            <div className="card p-8 space-y-2 bg-gradient-to-br from-card to-surface/30">
              <CopyField label="Kernel Engine" value="Tesseract 5 Evolution + PyMuPDF" />
              <CopyField label="LLM Orchestration" value="Groq Hyper-inference (Llama-3.3)" />
              <CopyField label="Persistence Layer" value="PostgreSQL (Production) + Redis" />
              <CopyField label="System Build" value="v2.4.0-premium-stable" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
