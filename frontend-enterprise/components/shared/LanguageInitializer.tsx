"use client";
// components/shared/LanguageInitializer.tsx
// Sets the HTML dir and lang attributes based on user's language preference

import { useEffect } from "react";
import { useThemeStore } from "@/lib/store/authStore";

export default function LanguageInitializer() {
  const { lang } = useThemeStore();

  useEffect(() => {
    // Set direction and language on HTML element
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    
    // Also set on body for good measure
    document.body.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  return null;
}
