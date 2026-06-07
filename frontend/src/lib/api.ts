import axios, { AxiosError } from 'axios';

// In dev, Vite proxies /api to the backend (see vite.config.ts).
// In production (Docker), nginx proxies /api to the backend service.
// Both make the relative base URL "/api/v1" the right default.
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

const TOKEN_KEY = 'lged.access_token';
const REFRESH_KEY = 'lged.refresh_token';
const USER_KEY = 'lged.user';

export const tokenStorage = {
  getAccess(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  getRefresh(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string) {
    localStorage.setItem(TOKEN_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  setUser(user: unknown) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  getUser<T = unknown>(): T | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = tokenStorage.getAccess();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401 from any request, clear creds and bounce to /login.
// (A more elaborate flow would attempt /auth/refresh first; kept simple for the prototype.)
let isRedirecting = false;
api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    if (error.response?.status === 401 && !isRedirecting) {
      isRedirecting = true;
      tokenStorage.clear();
      // Avoid loops if we're already on /login.
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
      }
      setTimeout(() => { isRedirecting = false; }, 1000);
    }
    return Promise.reject(error);
  },
);

/** Best-effort extraction of a human-readable error message from an Axios error. */
export function extractErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(err)) {
    const detail = (err.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      // FastAPI validation errors are arrays of { msg, loc, type } objects.
      const first = detail[0] as { msg?: string; loc?: unknown[] } | undefined;
      if (first?.msg) {
        const loc = first.loc?.slice(1).join('.') ?? '';
        return loc ? `${loc}: ${first.msg}` : first.msg;
      }
    }
    if (err.message) return err.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}
