// app/layout.tsx — Root layout with RTL support

import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import ThemeInitializer from "@/components/shared/ThemeInitializer";
import LanguageInitializer from "@/components/shared/LanguageInitializer";

export const metadata: Metadata = {
  title: "DocuMind AI — Enterprise Document Intelligence",
  description: "AI-powered document processing platform for UAE enterprises. OCR, extraction, RAG Q&A.",
  keywords: ["AI", "document intelligence", "OCR", "UAE", "Dubai", "invoice processing"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Tajawal:wght@400;500;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeInitializer />
        <LanguageInitializer />
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "var(--color-card)",
              color: "var(--color-primary)",
              border: "1px solid var(--color-border)",
              borderRadius: "0.75rem",
              fontSize: "0.875rem",
            },
            success: { iconTheme: { primary: "#10b981", secondary: "white" } },
            error: { iconTheme: { primary: "#ef4444", secondary: "white" } },
          }}
        />
      </body>
    </html>
  );
}
