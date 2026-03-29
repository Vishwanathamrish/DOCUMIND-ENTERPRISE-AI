// components/shared/ConfidenceBadge.tsx
import { cn } from "@/lib/utils";
import { useTranslation, TranslationKey } from "@/lib/i18n";

interface ConfidenceBadgeProps {
  value: number; // 0-1
  className?: string;
}

export default function ConfidenceBadge({ value, className }: ConfidenceBadgeProps) {
  const { t } = useTranslation();
  const pct = Math.round(value * 100);
  const level = pct >= 85 ? "high" : pct >= 70 ? "medium" : "low";
  
  return (
    <span className={cn(
      "inline-flex items-center gap-2 px-2 py-1 rounded-md text-[10px] font-bold border uppercase tracking-widest transition-all",
      level === "high" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.1)]" :
      level === "medium" ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
      "bg-red-500/10 border-red-500/20 text-red-400",
      className
    )}>
      <span className={cn(
        "w-1.5 h-1.5 rounded-full",
        level === "high" && "bg-emerald-500",
        level === "medium" && "bg-amber-400",
        level === "low" && "bg-red-400",
      )} />
      {pct}% {t("accuracy")}
    </span>
  );
}

export function DocTypeBadge({ type }: { type: string }) {
  const { t } = useTranslation();
  const cleanType = String(type).split(".").pop()?.toLowerCase() || "unknown";

  const styles = {
    invoice: "bg-accent/10 border-accent/20 text-accent",
    contract: "bg-purple-500/10 border-purple-500/20 text-purple-400",
    receipt: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    unknown: "bg-surface border-border text-text-muted"
  };

  const currentStyle = styles[cleanType as keyof typeof styles] || styles.unknown;

  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold border uppercase tracking-widest transition-all",
      currentStyle
    )}>
      {t(cleanType as TranslationKey)}
    </span>
  );
}
