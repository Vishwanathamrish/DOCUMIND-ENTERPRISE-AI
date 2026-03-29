"use client";
// components/shared/ThemeInitializer.tsx
// Applies persisted theme/lang to <html> on mount

import { useEffect } from "react";
import { useThemeStore } from "@/lib/store/authStore";

export default function ThemeInitializer() {
  const { theme, lang } = useThemeStore();

  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle("dark", theme === "dark");
    el.classList.toggle("light", theme === "light");
    el.dir = lang === "ar" ? "rtl" : "ltr";
    el.lang = lang;
  }, [theme, lang]);

  return null;
}
