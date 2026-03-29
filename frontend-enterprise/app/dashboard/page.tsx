"use client";
// app/(dashboard)/page.tsx — Premium Enterprise Dashboard

import { useEffect, useState } from "react";
import {
  AreaChart, Area, PieChart, Pie, Cell, Tooltip, Legend,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid
} from "recharts";
import {
  FileText, Clock, CheckCircle2, TrendingUp, ArrowUpRight,
  Layers, Zap, AlertCircle, Receipt, FileSignature, ChevronRight
} from "lucide-react";
import { analyticsApi, documentsApi } from "@/lib/api";
import { AnalyticsData, Document } from "@/types/api";
import { DocTypeBadge } from "@/components/shared/ConfidenceBadge";
import ConfidenceBadge from "@/components/shared/ConfidenceBadge";
import { formatMs, formatDate, truncate, cn } from "@/lib/utils";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

const PIE_COLORS = { invoice: "#C9A74E", contract: "#8B5CF6", receipt: "#10B981", unknown: "#FF6B6B" };

// Helper function to format trend percentage
function formatTrend(value: number | null | undefined, inversePositive: boolean = false): { value: string; positive: boolean } | undefined {
  if (value === null || value === undefined) return undefined;
  
  const formatted = Math.abs(value).toFixed(1);
  const isPositive = inversePositive ? value < 0 : value > 0; // For processing time, negative is good
  
  return {
    value: `${value >= 0 ? '+' : ''}${formatted}%`,
    positive: isPositive
  };
}

// Production-Ready KPI Card with proper spacing, theme support and RTL
function MetricCard({
  icon: Icon, label, value, sub, trend
}: {
  icon: React.ElementType; label: string; value: string | number; sub?: string;
  trend?: { value: string; positive: boolean };
}) {
  return (
    <div className="group relative h-full rounded-2xl border border-border bg-card shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-1 overflow-visible box-border" style={{ minWidth: '0', flexShrink: '0' }}>
      {/* Content Container with proper padding - NO OVERFLOW HIDDEN */}
      <div className="relative h-full flex flex-col justify-between gap-4 box-border p-[20px] sm:p-[24px]" style={{ minWidth: '0', paddingLeft: '20px', paddingRight: '20px', paddingTop: '20px', paddingBottom: '20px' }}>
        {/* Icon + Label Section */}
        <div className="flex items-start gap-3 rtl:flex-row-reverse" style={{ marginBottom: '8px' }}>
          <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-200" style={{ flexShrink: '0', marginBottom: '12px', marginLeft: '12px', marginRight: '12px' }}>
            <Icon className="w-6 h-6 text-accent" />
          </div>
          <div className="flex-1 min-w-0 space-y-1 overflow-visible">
            <p className="text-xs font-semibold text-secondary uppercase tracking-wide leading-none box-border" style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}>
              {label}
            </p>
            <p className="text-2xl font-bold text-primary tracking-tight leading-snug box-border" style={{ wordWrap: 'break-word', overflowWrap: 'break-word', marginTop: '4px' }}>
              {value}
            </p>
          </div>
        </div>

        {/* Bottom Section with Subtitle + Trend */}
        <div className="flex items-center gap-3 pt-4 border-t border-border/50 mt-auto rtl:flex-row-reverse" style={{ paddingTop: '12px', paddingBottom: '4px', paddingLeft: '16px', paddingRight: '16px' }}>
          <p className="text-xs text-muted font-medium flex-1 min-w-0 leading-relaxed box-border" style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}>
            {sub || ''}
          </p>
          {trend && (
            <span className={cn(
              "inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap flex-shrink-0 box-border",
              trend.positive 
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            )} style={{ flexShrink: '0' }}>
              {trend.value}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`shimmer rounded-[24px] ${className}`} />;
}

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [recentDocs, setRecentDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    Promise.all([analyticsApi.get(), documentsApi.list(10)])
      .then(([a, d]) => {
        setAnalytics(a.data);
        setRecentDocs(d.data.documents || []);
      })
      .catch(() => setError("API Connection Failure: Ensure backend service is active."))
      .finally(() => setLoading(false));
  }, []);

  // Build chart data from recent_events
  const chartData = (() => {
    if (!analytics?.recent_events) return [];
    const byDay: Record<string, number> = {};
    analytics.recent_events.forEach((e) => {
      const day = e.created_at?.split("T")[0] || "today";
      byDay[day] = (byDay[day] || 0) + 1;
    });
    return Object.entries(byDay).slice(-7).map(([date, count]) => ({ date, docs: count }));
  })();

  const pieData = analytics
    ? Object.entries(analytics.by_type || {}).map(([name, value]) => ({
      name: String(name).split(".").pop()?.toLowerCase() || name,
      value
    }))
    : [];

  return (
    <div className="min-h-screen bg-surface relative">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAyKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIiAvPjwvc3ZnPg==')] opacity-20 pointer-events-none" />
      
      {/* Main Container with proper padding - RTL aware */}
      <div className="relative w-full max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-12 py-8 sm:py-10 lg:py-12 overflow-x-hidden">
        {/* Header Section */}
        <div className="relative rounded-3xl bg-card/80 backdrop-blur-xl border border-border shadow-lg mb-8 sm:mb-10 ms-0 sm:ms-4 lg:ms-8" style={{ marginInlineStart: 'clamp(0px, 2vw, 32px)', paddingInlineStart: '24px', paddingInlineEnd: '24px' }}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6" style={{ gap: '16px', padding: '20px 24px' }}>
            <div className="flex items-center gap-4 sm:gap-5">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center shadow-lg">
                <Zap className="w-7 h-7 sm:w-8 sm:h-8 text-[#0F0F10]" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary tracking-tight leading-tight">{t("systemOverview")}</h1>
                <p className="text-sm sm:text-base text-secondary mt-1.5 font-medium">{t("realTimeAnalysis")}</p>
              </div>
            </div>
            <Link 
              href="/upload" 
              className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-accent to-accent/90 text-[#0F0F10] font-semibold text-sm shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] border border-accent/20 w-full sm:w-auto justify-center"
              style={{ padding: '12px 24px', gap: '10px', marginInlineEnd: '24px' }}
            >
              <Zap className="w-5 h-5" />
              <span>{t("uploadDocument")}</span>
            </Link>
          </div>
        </div>

        {/* KPI Cards Grid - Dashboard Grid with proper spacing */}
        {loading ? (
          <div className="dashboard-grid w-full">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40 sm:h-44 lg:h-48 rounded-2xl" />)}
          </div>
        ) : (
          <div className="dashboard-container dashboard-grid w-full">
            <MetricCard 
              icon={Layers} 
              label={t("totalDocuments")} 
              value={analytics?.total_documents ?? 0} 
              sub={t("totalDocsSub")} 
              trend={formatTrend(analytics?.today_trend)} 
            />
            <MetricCard 
              icon={Clock} 
              label={t("processedToday")} 
              value={analytics?.recent_events?.filter(e => e.created_at?.includes(new Date().toISOString().split('T')[0])).length ?? 0} 
              sub={t("last24Hours")} 
              trend={formatTrend(analytics?.today_trend)} 
            />
            <MetricCard 
              icon={CheckCircle2} 
              label={t("successRate")} 
              value={`${((analytics?.avg_confidence ?? 0) * 100).toFixed(1)}%`} 
              sub={t("highPrecisionOCR")} 
              trend={formatTrend(analytics?.success_rate_trend)} 
            />
            <MetricCard 
              icon={Zap} 
              label={t("avgProcessingTime")} 
              value={formatMs(analytics?.avg_processing_ms ?? 0)} 
              sub={t("cloudLatency")} 
              trend={formatTrend(analytics?.processing_time_trend, true)} 
            />
          </div>
        )}

        {/* Charts Grid - Dashboard Grid with proper spacing */}
        <div className="dashboard-container dashboard-grid w-full">
          {/* Processing Volume Chart */}
          <div className="group relative rounded-2xl border border-border bg-card shadow-md hover:shadow-lg transition-all duration-200 overflow-visible box-border" style={{ minWidth: '0', flexShrink: '0' }}>
            <div className="p-[20px] sm:p-[24px] box-border" style={{ paddingLeft: '20px', paddingRight: '20px', paddingTop: '20px', paddingBottom: '20px' }}>
              <div className="kpi-header flex items-center justify-between mb-6 rtl:flex-row-reverse">
                <div className="flex items-center gap-3 rtl:flex-row-reverse">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center ml-2 mt-2" style={{ flexShrink: '0', marginLeft: '8px', marginTop: '8px' }}>
                    <TrendingUp className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="rtl:text-right">
                    <h3 className="text-lg sm:text-xl font-bold text-primary">{t("processingAnalytics")}</h3>
                    <p className="text-xs sm:text-sm text-secondary mt-0.5">{t("dailyIntakeVolume")}</p>
                  </div>
                </div>
                <span className="px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-accent text-xs font-bold uppercase tracking-wide" style={{ flexShrink: '0', marginRight: '4px', marginTop: '4px' }}>
                  {t("sevenDays")}
                </span>
              </div>
              {loading ? (
                <Skeleton className="h-[300px] sm:h-[320px]" />
              ) : chartData.length > 0 ? (
                <div className="h-[300px] sm:h-[320px] w-full max-w-full overflow-hidden chart-container" style={{ marginTop: '16px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="brandGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.3} />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 12, fill: "var(--text-secondary)" }} 
                        axisLine={false} 
                        tickLine={false}
                        tickMargin={8}
                      />
                      <YAxis 
                        tick={{ fontSize: 12, fill: "var(--text-secondary)" }} 
                        axisLine={false} 
                        tickLine={false}
                        tickMargin={8}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'var(--card)',
                          border: '1px solid var(--border)',
                          borderRadius: '12px',
                          padding: '12px 16px'
                        }}
                        cursor={{ fill: 'rgba(212, 175, 55, 0.1)' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="docs" 
                        stroke="#D4AF37" 
                        strokeWidth={3}
                        fill="url(#brandGrad)" 
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] sm:h-[320px] flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-xl bg-surface border border-border flex items-center justify-center mb-4">
                    <AreaChart className="w-8 h-8 text-muted" />
                  </div>
                  <p className="text-primary font-semibold">No data available</p>
                  <p className="text-sm text-secondary mt-2">Upload documents to see analytics</p>
                </div>
              )}
            </div>
          </div>

          {/* Document Type Distribution Chart */}
          <div className="group relative rounded-2xl border border-border bg-card shadow-md hover:shadow-lg transition-all duration-200 overflow-visible box-border" style={{ minWidth: '0', flexShrink: '0' }}>
            <div className="p-[20px] sm:p-[24px] box-border">
              <div className="kpi-header flex items-center justify-between mb-6 rtl:flex-row-reverse">
                <div className="flex items-center gap-3 rtl:flex-row-reverse">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center ml-2 mt-2" style={{ flexShrink: '0', marginLeft: '8px', marginTop: '8px' }}>
                    <Layers className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="rtl:text-right">
                    <h3 className="text-lg sm:text-xl font-bold text-primary">{t("analytics")}</h3>
                    <p className="text-xs sm:text-sm text-secondary mt-0.5">{t("documentTypesTitle")}</p>
                  </div>
                </div>
              </div>
              {loading || pieData.length === 0 ? (
                <Skeleton className="h-[300px] sm:h-[320px]" />
              ) : (
                <div className="h-[300px] sm:h-[320px] flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={false}
                        outerRadius={80}
                        innerRadius={40}
                        fill="#8884d8"
                        dataKey="value"
                        strokeWidth={3}
                        stroke="var(--card)"
                      >
                        {pieData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={PIE_COLORS[entry.name as keyof typeof PIE_COLORS] || "#64748B"}
                            className="transition-all duration-300 hover:opacity-80"
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--card)',
                          border: '1px solid var(--border)',
                          borderRadius: '12px',
                          padding: '12px 16px'
                        }}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        height={36}
                        iconType="circle"
                        formatter={(value) => {
                          const item = pieData.find(d => d.name === value);
                          const percentage = item ? Math.round((item.value / pieData.reduce((sum, d) => sum + d.value, 0)) * 100) : 0;
                          return `${value}: ${percentage}%`;
                        }}
                        wrapperStyle={{
                          paddingTop: '16px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity Section */}
        <div className="mt-8 sm:mt-10">
          <div className="flex items-center justify-between mb-6 px-6 sm:px-8 lg:px-12" style={{ paddingLeft: '32px', paddingRight: '32px' }}>
            <h3 className="text-xl sm:text-2xl font-bold text-primary">{t("recentActivity")}</h3>
            <Link 
              href="/documents" 
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent/10 border border-accent/20 text-accent text-sm font-semibold hover:bg-accent/20 transition-all duration-200"
            >
              <span>{t("viewAllQueue")}</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Table Container */}
          <div className="rounded-2xl border border-border bg-card shadow-md overflow-hidden">
            {loading ? (
              <div className="p-12 space-y-4 bg-surface/20">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-[16px]" />)}
              </div>
            ) : recentDocs.length === 0 ? (
              <div className="p-20 text-center text-secondary text-lg italic bg-surface/20">
                {t("noRecentActivity")}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-4 px-4 sm:px-6 text-left text-xs font-semibold text-secondary uppercase tracking-wide whitespace-nowrap" style={{ paddingLeft: '20px' }}>{t("filename")}</th>
                      <th className="py-4 px-4 sm:px-6 text-left text-xs font-semibold text-secondary uppercase tracking-wide whitespace-nowrap">{t("type")}</th>
                      <th className="py-4 px-4 sm:px-6 text-left text-xs font-semibold text-secondary uppercase tracking-wide whitespace-nowrap">{t("extraction")}</th>
                      <th className="hidden lg:table-cell py-4 px-4 sm:px-6 text-right text-xs font-semibold text-secondary uppercase tracking-wide whitespace-nowrap" style={{ minWidth: '120px', paddingRight: '20px' }}>{t("timing")}</th>
                      <th className="hidden lg:table-cell py-4 px-4 sm:px-6 text-left text-xs font-semibold text-secondary uppercase tracking-wide whitespace-nowrap" style={{ minWidth: '180px', paddingLeft: '20px' }}>{t("uploadedAt")}</th>
                      <th className="py-4 px-4 sm:px-6" style={{ paddingRight: '20px', paddingLeft: '12px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentDocs.map((doc, i) => (
                      <tr
                        key={doc.document_id}
                        className="border-b border-border/30 hover:bg-hover/50 transition-all duration-200 last:border-0"
                      >
                        <td className="py-4 px-4 sm:px-6" style={{ paddingLeft: '20px' }}>
                          <div className="flex items-center gap-3 sm:gap-4">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-surface border border-border flex items-center justify-center flex-shrink-0">
                              <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-accent" />
                            </div>
                            <div className="flex flex-col gap-1 min-w-0 flex-1">
                              <span className="text-sm font-semibold text-primary truncate max-w-full">{doc.filename}</span>
                              <span className="text-xs text-muted font-medium">{doc.document_id.split('-')[0]}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6">
                          <DocTypeBadge type={doc.document_type} />
                        </td>
                        <td className="px-4 sm:px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-24 sm:w-32 h-2 bg-surface rounded-full overflow-hidden border border-border flex-shrink-0">
                              <div className={cn(
                                "h-full transition-all duration-500 rounded-full",
                                (doc.extraction_confidence ?? 0) > 0.8 
                                  ? "bg-gradient-to-r from-emerald-500 to-emerald-400" 
                                  : "bg-gradient-to-r from-accent to-accent/80"
                              )} style={{ width: `${(doc.extraction_confidence ?? 0) * 100}%` }} />
                            </div>
                            <span className="text-sm font-bold text-primary flex-shrink-0">
                              {Math.round((doc.extraction_confidence ?? 0) * 100)}%
                            </span>
                          </div>
                        </td>
                        <td className="hidden lg:table-cell py-4 px-4 sm:px-6 text-right text-sm font-semibold text-primary whitespace-nowrap" style={{ minWidth: '120px', paddingRight: '24px' }}>
                          {formatMs(doc.pipeline_elapsed_ms ?? 0)}
                        </td>
                        <td className="hidden lg:table-cell py-4 px-4 sm:px-6 text-sm text-secondary whitespace-nowrap" style={{ minWidth: '180px', paddingLeft: '24px' }}>
                          {formatDate(doc.created_at)}
                        </td>
                        <td className="py-4 px-4 sm:px-6" style={{ paddingRight: '12px', paddingLeft: '12px' }}>
                          <Link
                            href={`/documents/${doc.document_id}`}
                            className="inline-flex items-center px-3 sm:px-4 py-2 rounded-lg bg-accent/10 border border-accent/20 text-accent text-sm font-semibold hover:bg-accent/20 transition-all duration-200"
                            style={{ padding: '8px 16px' }}
                          >
                            {t("details")}
                          </Link>
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
  );
}
