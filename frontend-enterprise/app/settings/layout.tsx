"use client";
// app/(dashboard)/layout.tsx — Dashboard shell with sidebar + topbar

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import { usePathname } from "next/navigation";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/upload": "Upload Center",
  "/documents": "Documents",
  "/extraction": "Extraction Results",
  "/chat": "AI Chat",
  "/analytics": "Analytics",
  "/settings": "Settings",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const title = PAGE_TITLES[pathname] ||
    (pathname.startsWith("/documents/") ? "Document Detail" : "DocuMind AI");

  return (
    <div className="flex flex-row min-h-screen bg-transparent relative">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0 overflow-x-hidden">
        <TopBar onMobileMenuOpen={() => setMobileOpen(true)} title={title} />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 animate-fade-in relative z-10">
          {children}
        </main>
      </div>

    </div>
  );
}
