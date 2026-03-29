"use client";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip
} from "recharts";
import { analyticsApi } from "@/lib/api";
import { AnalyticsData } from "@/types/api";
import { BarChart3, TrendingUp, Activity, Clock, FileText, AlertCircle, Calendar, ShieldCheck } from "lucide-react";
import { formatMs, formatDate } from "@/lib/utils";
import toast from "react-hot-toast";
import { useTranslation, TranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const PIE_COLORS = ["#2563EB", "#7C3AED", "#10B981", "#F59E0B"];

const CHART_TOOLTIP_STYLE = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "0.75rem",
  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
  fontSize: "10px",
  color: "var(--text-primary)",
  fontWeight: "bold",
  textTransform: "uppercase" as const,
};

function AnalyticsKPI({ icon: Icon, label, value, sub, color = "accent" }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="card p-6 flex items-start gap-4">
      <div className={cn(
        "w-12 h-12 rounded-xl border flex items-center justify-center flex-shrink-0 animate-fade-in",
        color === "accent" ? "bg-accent/10 border-accent/20 text-accent" :
          color === "emerald" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
            color === "amber" ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
              "bg-surface border-border text-muted"
      )}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-[10px] uppercase font-bold text-muted tracking-widest">{t(label as TranslationKey)}</p>
        <p className="text-2xl font-bold text-primary mt-1">{value}</p>
        {sub && <p className="text-[10px] text-muted mt-1 uppercase font-medium">{t(sub as TranslationKey)}</p>}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsApi.get()
      .then((r) => setData(r.data))
      .catch(() => toast.error(t("exportFailed")))
      .finally(() => setLoading(false));
  }, []);

  const exportCSV = () => {
    const rows = [['EVENT', 'DOCUMENT NAME', 'TYPE', 'LATENCY', 'CONFIDENCE'],
      ...(data?.recent_events || []).map(r => [r.event_type, r.filename || r.document_id || '', r.doc_type, `${Math.round(r.elapsed_ms)}ms`, `${Math.round(r.confidence * 100)}%`])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'activity_logs.csv'; a.click();
  };

  if (loading) return (
    <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-muted text-sm font-medium uppercase tracking-widest leading-loose">{t("analyzingMetrics")}</p>
      </div>
    </div>
  );

  if (!data) return (
    <div className="flex flex-col items-center justify-center py-24 gap-6">
      <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
        <AlertCircle className="w-8 h-8 text-amber-500" />
      </div>
      <div className="text-center">
        <h3 className="text-xl font-bold text-primary uppercase tracking-wider">{t("noAnalyticsSignal")}</h3>
        <p className="text-muted text-sm mt-1">{t("insufficientData")}</p>
      </div>
    </div>
  );

  const byTypeData = Object.entries(data.by_type || {}).map(([name, value]) => ({ name, value }));
  const recentEvents = data.recent_events || [];

  // Daily Activity
  const byDay: Record<string, number> = {};
  recentEvents.forEach((e) => {
    const day = e.created_at?.split("T")[0] || "today";
    byDay[day] = (byDay[day] || 0) + 1;
  });
  const dailyData = Object.entries(byDay).slice(-14).map(([date, count]) => ({ date, docs: count }));

  // Accuracy breakdown
  const confByType: Record<string, { total: number; count: number }> = {};
  recentEvents.forEach((e) => {
    if (!confByType[e.doc_type]) confByType[e.doc_type] = { total: 0, count: 0 };
    confByType[e.doc_type].total += e.confidence;
    confByType[e.doc_type].count += 1;
  });
  const confData = Object.entries(confByType).map(([type, { total, count }]) => ({
    type, accuracy: Math.round((total / count) * 100)
  }));

  return (
    <div className="space-y-8 pb-12 px-6 sm:px-12 lg:px-16" style={{ paddingLeft: '40px', paddingRight: '40px' }}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-primary tracking-tight">{t("analytics")}</h2>
          <p className="text-muted text-sm mt-1 uppercase tracking-widest font-medium text-[10px]">{t("pipelineEfficiency")}</p>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 bg-surface rounded-xl border border-border">
          <Calendar className="w-4 h-4 text-muted" />
          <span className="text-xs font-bold text-primary uppercase tracking-widest">{t("last30Days")}</span>
        </div>
      </div>

      <div className="dashboard-container dashboard-grid w-full">
        <AnalyticsKPI icon={FileText} label="totalDocuments" value={data.total_documents} sub="allTime" color="slate" />
        <AnalyticsKPI icon={Activity} label="totalEvents" value={data.total_events} sub="apiCalls" color="accent" />
        <AnalyticsKPI icon={Clock} label="avgProcessing" value={formatMs(data.avg_processing_ms)} sub="latency" color="amber" />
        <AnalyticsKPI icon={ShieldCheck} label="avgAccuracy" value={`${Math.round(data.avg_confidence * 100)}%`} sub="extractionConfidence" color="emerald" />
      </div>

      <div className="dashboard-container dashboard-grid w-full mt-8">
        <div className="card p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="gap-2 flex items-center">
              <div className="w-2 h-2 rounded-full bg-accent" />
              <h3 className="font-bold text-primary uppercase tracking-widest text-[10px]">{t("dailyProcessingVolume")}</h3>
            </div>
          </div>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--text-muted)", fontWeight: "bold" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)", fontWeight: "bold" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: 'rgba(37, 99, 235, 0.05)' }} />
                <Bar dataKey="docs" fill="var(--color-accent)" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="gap-2 flex items-center">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <h3 className="font-bold text-primary uppercase tracking-widest text-[10px]">{t("accuracyByDocType")}</h3>
            </div>
          </div>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={confData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9, fill: "var(--text-muted)", fontWeight: "bold" }} axisLine={false} tickLine={false} unit="%" />
                <YAxis dataKey="type" type="category" tick={{ fontSize: 9, fill: "var(--text-primary)", fontWeight: "bold" }} axisLine={false} tickLine={false} width={80} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: 'rgba(16, 185, 129, 0.05)' }} />
                <Bar dataKey="accuracy" fill="#10B981" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {recentEvents.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-8 py-6 border-b border-border flex items-center justify-between bg-surface/30">
            <h3 className="font-bold text-primary uppercase tracking-widest text-[10px]">{t("recentActivity")}</h3>
            <button onClick={exportCSV} className="text-[10px] font-bold text-accent uppercase tracking-widest hover:opacity-80 cursor-pointer">{t("exportLogs")}</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-bg-primary/50 text-muted uppercase tracking-widest text-[10px] font-black border-b border-border">
                  <th className="px-10 py-5">{t("event")}</th>
                  <th className="px-10 py-5">DOCUMENT NAME</th>
                  <th className="px-10 py-5">{t("type")}</th>
                  <th className="px-10 py-5">{t("latency")}</th>
                  <th className="px-10 py-5 font-right">{t("confidence")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentEvents.slice(0, 10).map((e, i) => {
                  console.log('event:', e);
                  return (
                    <tr key={i} className="hover:bg-surface/50 transition-colors group">
                      <td className="px-8 py-4 text-xs font-bold text-primary uppercase tracking-wider">{e.event_type}</td>
                      <td className="px-8 py-4 text-xs font-mono text-muted group-hover:text-accent transition-colors truncate max-w-[200px]" title={e.filename || e.document_id}>{e.filename || e.document_id}</td>
                      <td className="px-8 py-4">
                        <span className="text-[10px] uppercase font-bold text-secondary bg-surface px-2.5 py-1 rounded-md border border-border">
                          {e.doc_type}
                        </span>
                      </td>
                      <td className="px-8 py-4 text-xs font-bold text-primary">{Math.round(e.elapsed_ms)}ms</td>
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 max-w-[60px] h-1.5 bg-surface rounded-full overflow-hidden border border-border">
                            <div
                              className={cn(
                                "h-full transition-all duration-1000",
                                e.confidence >= 0.85 ? "bg-emerald-500" : e.confidence >= 0.7 ? "bg-amber-400" : "bg-red-500"
                              )}
                              style={{ width: `${e.confidence * 100}%` }}
                            />
                          </div>
                          <span className={cn(
                            "text-xs font-mono font-bold",
                            e.confidence >= 0.85 ? "text-emerald-400" : e.confidence >= 0.7 ? "text-amber-400" : "text-red-400"
                          )}>
                            {Math.round(e.confidence * 100)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
