"use client";
// components/layout/TopBar.tsx

import { Menu, Moon, Sun, Bell, Search, Globe, LogOut, X } from "lucide-react";
import { useAuthStore, useThemeStore } from "@/lib/store/authStore";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation, TranslationKey } from "@/lib/i18n";
import Link from "next/link";

interface TopBarProps {
  onMobileMenuOpen: () => void;
  title: string;
}

export default function TopBar({ onMobileMenuOpen, title }: TopBarProps) {
  const { theme, toggleTheme, lang, setLang } = useThemeStore();
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Map title to translation keys
  const getTranslatedTitle = (title: string) => {
    const map: Record<string, TranslationKey> = {
      "Dashboard": "dashboard",
      "Upload Center": "uploadCenter",
      "Documents": "documents",
      "AI Chat": "chat",
      "Analytics": "analytics",
      "Settings": "settings",
      "Extraction Results": "extractionResults",
    };
    const key = map[title];
    return key ? t(key) : title;
  };

  const handleLanguageToggle = () => {
    setLang(lang === "en" ? "ar" : "en");
  };

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-dropdown-container]')) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && query.trim()) {
      router.push(`/documents?q=${encodeURIComponent(query.trim())}`);
      setSearchOpen(false);
      setQuery("");
    }
  };

  if (!mounted) {
    return <header className="sticky top-0 z-[40] h-[72px] bg-surface/80 border-b border-border" />;
  }

  return (
    <header className="sticky top-0 z-[40] header-container flex items-center h-16 px-3 sm:px-4 lg:px-8 gap-2 sm:gap-3
      bg-surface/80 backdrop-blur-3xl border-b border-border shadow-sm">

      {/* Mobile Menu Button */}
      <button
        onClick={onMobileMenuOpen}
        className="lg:hidden p-2 -ml-2 mr-1 rounded-xl text-secondary hover:text-accent hover:bg-hover transition-all duration-200"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Dynamic Page Title */}
      <div className="flex-[0.5] min-w-0 flex flex-col justify-center" style={{ paddingLeft: '8px', marginLeft: '4px' }}>
        <h2 className="text-xs sm:text-sm font-semibold text-primary tracking-tight truncate">{getTranslatedTitle(title)}</h2>
      </div>

      {/* Mobile Search Overlay */}
      {searchOpen && (
        <div className="md:hidden fixed inset-0 top-0 left-0 z-50 bg-surface/95 backdrop-blur-xl px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSearchOpen(false)}
            className="p-2 -ml-2 rounded-xl text-secondary hover:text-accent hover:bg-hover transition-all"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex-1 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-input-bg border border-border focus-within:border-accent/50 focus-within:ring-4 focus-within:ring-accent/10 transition-all shadow-sm">
            <Search className="w-4 h-4 text-muted text-accent" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleSearch}
              placeholder={t("searchDocuments")}
              className="bg-transparent border-none text-sm text-primary w-full placeholder:text-muted focus:outline-none focus:ring-0 font-medium"
              autoComplete="off"
              spellCheck="false"
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Search Bar - Responsive */}
      <div className="flex-1 max-w-xl hidden md:flex items-center gap-3 px-4 py-2 rounded-xl bg-input-bg border border-border focus-within:border-accent/50 focus-within:ring-4 focus-within:ring-accent/10 transition-all shadow-sm group" style={{ width: '50%', maxWidth: '700px', minWidth: '300px' }}>
        <Search className="w-4 h-4 text-muted group-focus-within:text-accent transition-colors" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleSearch}
          placeholder={t("searchDocuments")}
          className="bg-transparent border-none text-sm text-primary w-full placeholder:text-muted focus:outline-none focus:ring-0 font-medium"
          autoComplete="off"
          spellCheck="false"
          style={{ height: '36px', fontSize: '14px', padding: '0 12px' }}
        />
      </div>

      {/* Mobile Search Icon */}
      <button
        className="md:hidden p-2 rounded-xl text-secondary hover:text-accent hover:bg-hover transition-all duration-200"
        onClick={() => setSearchOpen(!searchOpen)}
      >
        <Search className="w-5 h-5" />
      </button>

      {/* Header Actions - RTL Support */}
      <div className="header-actions flex items-center justify-end gap-1.5 sm:gap-2 flex-[0.5]">
        {/* Language toggle - Compact on mobile */}
        <button
          onClick={handleLanguageToggle}
          className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 rounded-xl text-xs font-black tracking-widest transition-all duration-200
            hover:bg-hover text-secondary hover:text-accent border border-transparent hover:border-accent/20"
          title={lang === "en" ? "التغيير إلى العربية" : "Switch to English"}
        >
          <Globe className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{lang === "en" ? "العربية" : "EN"}</span>
          <span className="sm:hidden">{lang === "en" ? "ع" : "EN"}</span>
        </button>

        {/* Theme toggle */}
        <button className="p-2 rounded-xl text-secondary hover:text-accent hover:bg-hover transition-all duration-200" onClick={toggleTheme}>
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className="h-5 w-px bg-border mx-1 hidden sm:block opacity-50"></div>

        {/* Avatar with Dropdown */}
        {user ? (
          <div style={{ position: 'relative' }} data-dropdown-container>
            <button 
              onClick={toggleDropdown}
              className="flex items-center gap-2 sm:gap-3 cursor-pointer"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-accent flex items-center justify-center text-[#0F0F10] text-xs font-bold transition-all shadow-lg hover:scale-105">
                {user.username?.[0].toUpperCase() || "A"}
              </div>
            </button>
            
            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                minWidth: '200px',
                background: theme === 'light' ? '#ffffff' : '#1a2332',
                border: theme === 'light' ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: '14px',
                padding: '8px',
                boxShadow: theme === 'light' ? '0 16px 48px rgba(0,0,0,0.12)' : '0 16px 48px rgba(0,0,0,0.4)',
                zIndex: 100
              }}>
                {/* User info section */}
                <div style={{
                  padding: '12px 14px',
                  borderBottom: theme === 'light' ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)',
                  marginBottom: '6px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px', height: '36px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #FFC107, #FF8C00)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '14px', fontWeight: '700', color: '#000',
                      flexShrink: 0
                    }}>
                      {user.username?.[0].toUpperCase() || "A"}
                    </div>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: '600', color: theme === 'light' ? '#111827' : '#fff', margin: 0 }}>{user.username || "Admin"}</p>
                    </div>
                  </div>
                </div>

                {/* Logout button */}
                <button
                  onClick={() => {
                    useAuthStore.getState().clearAuth();
                    window.location.href = "/";
                    setDropdownOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: theme === 'light' ? '1px solid rgba(239,68,68,0.15)' : '1px solid rgba(239,68,68,0.2)',
                    background: theme === 'light' ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.08)',
                    color: theme === 'light' ? '#dc2626' : '#f87171',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '500',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = theme === 'light' ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.15)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = theme === 'light' ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.08)'}
                >
                  <LogOut size={14} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </header>
  );
}
