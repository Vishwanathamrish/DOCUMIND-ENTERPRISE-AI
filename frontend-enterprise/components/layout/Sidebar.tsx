"use client";
// components/layout/Sidebar.tsx

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, UploadCloud, FileText, MessageSquare,
  BarChart3, Settings, Zap, ChevronLeft, ChevronRight, X, TableProperties
} from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslation, TranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/lib/store/authStore";

const NAV_ITEMS: { href: string; icon: any; key: TranslationKey }[] = [
  { href: "/dashboard", icon: LayoutDashboard, key: "dashboard" },
  { href: "/upload", icon: UploadCloud, key: "uploadCenter" },
  { href: "/documents", icon: FileText, key: "documents" },
  { href: "/extraction", icon: TableProperties, key: "extractionResults" },
  { href: "/chat", icon: MessageSquare, key: "chat" },
  { href: "/analytics", icon: BarChart3, key: "analytics" },
  { href: "/settings", icon: Settings, key: "settings" },
];

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { lang, t } = useTranslation();
  const { theme } = useThemeStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // RTL support
  const isRTL = lang === 'ar';

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="hidden lg:block flex-shrink-0 w-[260px]" />;

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={onMobileClose}
          style={{ animation: 'fadeIn 0.2s ease-out' }}
        />
      )}

      {/* Sidebar */}
      <aside
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          width: '240px'
        }}
        className={`
          fixed inset-y-0 z-50
          transition-transform duration-300 ease-in-out shadow-2xl
          ${theme === 'light' ? 'bg-gray-100 border-r border-gray-200' : 'bg-[#0f1623] border-r border-white/[0.06]'}
          ${collapsed ? "w-[72px]" : "w-[240px]"}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          ${isRTL ? 'right-0' : 'left-0'} top-0
        `}
      >
        {/* Toggle button - Centered vertically - Hidden on mobile */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`absolute z-20 w-8 h-8 rounded-full text-black border-4 flex items-center justify-center hover:scale-110 transition-transform active:scale-90 shadow-xl hidden lg:flex
            ${theme === 'light' 
              ? 'bg-white border-gray-200' 
              : 'bg-accent border-[#0f1623]'}
            ${isRTL ? '-left-3' : '-right-3'} top-1/2 -translate-y-1/2`}
        >
          {isRTL 
            ? (collapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)
            : (collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />)
          }
        </button>

        {/* Mobile close button */}
        <button
          onClick={onMobileClose}
          className={`absolute top-4 w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 text-accent flex items-center justify-center hover:bg-accent/20 transition-all lg:hidden z-20
            ${isRTL ? 'right-4' : 'left-4'}`}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div 
          className={`border-b ${theme === 'light' ? 'border-gray-200' : 'border-white/[0.06]'}`}
          style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}
        >
          {/* Logo icon */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
            style={{ 
              background: '#FFC107', 
              flexShrink: 0,
              [isRTL ? 'marginRight' : 'marginLeft']: '4px'
            }}
          >
            <LayoutDashboard className="w-5 h-5" style={{ color: '#0F0F10' }} />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0 animate-fade-in" dir={isRTL ? 'rtl' : 'ltr'}>
              <p className="font-bold text-sm tracking-tight leading-none uppercase"
                 style={{ color: theme === 'light' ? '#111827' : '#ffffff' }}>
                {lang === 'ar' ? 'دوكومايند' : 'DocuMind'}
              </p>
              <p className="text-[10px] font-bold mt-1 uppercase tracking-widest opacity-80"
                 style={{ color: '#FFC107' }}>
                {lang === 'ar' ? 'الذكاء الاصطناعي للمؤسسات' : 'Enterprise AI'}
              </p>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {NAV_ITEMS.map(({ href, icon: Icon, key }) => {
            const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <button
                key={href}
                onClick={() => {
                  window.location.href = href;
                  onMobileClose();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: isActive ? 'rgba(255,193,7,0.12)' : 'transparent',
                  color: isActive ? '#FFC107' : undefined,
                  cursor: 'pointer',
                  fontWeight: isActive ? '600' : '400',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                  fontSize: '14px'
                }}
                className={cn(
                  "hover:bg-black/[0.05] dark:hover:bg-white/[0.05]",
                  theme === 'light' 
                    ? (!isActive ? "text-gray-700" : "")
                    : (!isActive ? "text-white/70" : "")
                )}
                title={collapsed ? t(key) : undefined}
              >
                <Icon className={cn(
                  "transition-all duration-300 flex-shrink-0",
                  collapsed ? "w-6 h-6" : "w-5 h-5",
                  isActive && "text-accent stroke-[2px]",
                  theme === 'light' && !isActive && "text-gray-700"
                )} />
                {!collapsed && (
                  <span className={cn("truncate", isActive && "tracking-wide")}>{t(key)}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className={`border-t ${theme === 'light' ? 'border-gray-200' : 'border-white/[0.06]'}`} style={{ padding: '12px' }} />
      </aside>

      {/* Spacer for desktop */}
      <div className={`hidden lg:block flex-shrink-0 transition-all duration-300 ${collapsed ? "w-[72px]" : "w-[260px]"}`} />
    </>
  );
}
