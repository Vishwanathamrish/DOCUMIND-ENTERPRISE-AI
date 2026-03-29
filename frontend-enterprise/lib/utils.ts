// lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatDate(val?: string | number): string {
  if (!val) return "—";
  try {
    let d: Date;
    const num = Number(val);
    if (!isNaN(num)) {
      // If it's a Unix timestamp in seconds (like Python's time.time()), multiply by 1000
      d = new Date(num < 1e12 ? num * 1000 : num);
    } else {
      d = new Date(String(val));
    }
    return new Intl.DateTimeFormat("en-AE", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    }).format(d);
  } catch {
    return String(val);
  }
}

export function truncate(str: string, n = 60): string {
  return str.length > n ? str.slice(0, n) + "…" : str;
}

export function getDocTypeColor(type: string): string {
  const map: Record<string, string> = {
    invoice: "#3b82f6",
    contract: "#8b5cf6",
    receipt: "#10b981",
    unknown: "#64748b",
  };
  return map[type] ?? "#64748b";
}
