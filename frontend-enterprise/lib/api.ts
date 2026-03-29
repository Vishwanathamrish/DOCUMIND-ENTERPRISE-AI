// lib/api.ts — Axios API client with base URL from .env

import axios from "axios";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor — attach auth token if present
apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("auth_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor — handle 401
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("auth_token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (username: string, password: string) =>
    apiClient.post("/api/v2/auth/login", { username, password }),
  register: (username: string, email: string, password: string) =>
    apiClient.post("/api/v2/auth/register", { username, email, password }),
  me: () => apiClient.get("/api/v2/auth/me"),
};

// ─── Documents ────────────────────────────────────────────────────────────────
export const documentsApi = {
  upload: (file: File, onProgress?: (pct: number) => void) => {
    const form = new FormData();
    form.append("file", file);
    return apiClient.post("/api/v2/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    });
  },
  list: (limit = 50, offset = 0) =>
    apiClient.get(`/api/v2/documents?limit=${limit}&offset=${offset}`),
  get: (id: string) => apiClient.get(`/api/v2/documents/${id}`),
  delete: (id: string) => apiClient.delete(`/api/v1/documents/${id}`),
  search: (q: string, docType?: string, limit = 20) =>
    apiClient.get(`/api/v2/search`, { params: { q, doc_type: docType, limit } }),
  reextract: (id: string) => apiClient.post(`/api/v2/documents/${id}/reextract`),
  setStatus: (id: string, status: string) =>
    apiClient.patch(`/api/v2/documents/${id}/status`, { status }),
};

// ─── Q&A ──────────────────────────────────────────────────────────────────────
export const qaApi = {
  ask: (documentId: string, question: string) =>
    apiClient.post("/api/v2/ask", { document_id: documentId, question }),
};

// ─── Analytics ────────────────────────────────────────────────────────────────
export const analyticsApi = {
  get: () => apiClient.get("/api/v2/analytics"),
};

// ─── Export ───────────────────────────────────────────────────────────────────
export const exportApi = {
  export: (documentId: string, format: "json" | "csv" | "excel") =>
    apiClient.get(`/api/v2/export/${documentId}?format=${format}`, {
      responseType: "blob",
    }),
};

// ─── Agents ───────────────────────────────────────────────────────────────────
export const agentsApi = {
  status: () => apiClient.get("/api/v2/agents/status"),
};
