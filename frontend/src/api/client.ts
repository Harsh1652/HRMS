import axios, { AxiosError } from 'axios';
import type { ApiError } from '../types/api';
import { clearToken, getToken, SESSION_EXPIRED_EVENT } from '../auth/token';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach the bearer token from the store on every request.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// A 401 from any route means the session is over: clear it and let the auth
// layer redirect. The login route's own 401 (bad credentials) is excluded so
// the form can show the message instead of bouncing.
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const isLoginCall = error.config?.url?.endsWith('/auth/login');
    if (error.response?.status === 401 && !isLoginCall) {
      clearToken();
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  },
);

/** Normalises anything thrown by an API call into the backend's error shape. */
export function toApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as { error?: ApiError } | undefined;
    if (body?.error?.message) return body.error;
    if (error.code === 'ECONNABORTED') return { code: 'TIMEOUT', message: 'The server took too long to respond.' };
    if (!error.response) return { code: 'NETWORK', message: 'Cannot reach the API. Is the backend running?' };
    return { code: 'HTTP_' + error.response.status, message: error.message };
  }
  return { code: 'UNKNOWN', message: error instanceof Error ? error.message : 'Something went wrong.' };
}
