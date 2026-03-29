// lib/store/authStore.ts — Zustand store for auth state and role management

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UserRole = "admin" | "user" | "viewer";

interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  hasPermission: (action: "upload" | "delete" | "admin") => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      setAuth: (user, token) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("auth_token", token);
          // Also set as cookie for proxy/middleware to read
          document.cookie = `auth_token=${token}; path=/; max-age=86400; SameSite=Lax`;
        }
        set({ user, token, isAuthenticated: true });
      },

      clearAuth: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("auth_token");
          // Also remove cookie
          document.cookie = `auth_token=; path=/; max-age=0; SameSite=Lax`;
        }
        set({ user: null, token: null, isAuthenticated: false });
      },

      hasPermission: (action) => {
        const { user } = get();
        if (!user) return false;
        if (user.role === "admin") return true;
        if (action === "upload" && user.role === "user") return true;
        if (action === "admin") return false;
        return true;
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
);

// ─── Theme Store ──────────────────────────────────────────────────────────────
interface ThemeState {
  theme: "dark" | "light";
  lang: "en" | "ar";
  toggleTheme: () => void;
  setLang: (lang: "en" | "ar") => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "dark",
      lang: "en",
      toggleTheme: () =>
        set((s) => {
          const next = s.theme === "dark" ? "light" : "dark";
          if (typeof document !== "undefined") {
            document.documentElement.classList.toggle("dark", next === "dark");
            document.documentElement.classList.toggle("light", next === "light");
            document.documentElement.dir = s.lang === "ar" ? "rtl" : "ltr";
          }
          return { theme: next };
        }),
      setLang: (lang) => {
        if (typeof document !== "undefined") {
          document.documentElement.lang = lang;
          document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
        }
        set({ lang });
      },
    }),
    { name: "theme-storage" }
  )
);
