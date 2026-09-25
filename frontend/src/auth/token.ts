// Token lives in memory, mirrored to sessionStorage so a refresh keeps the session
// but closing the tab ends it. `exp` is read here only to log out on time; the server still decides.

const STORAGE_KEY = 'hrms.token';

let token: string | null = null;
let expiryTimer: ReturnType<typeof setTimeout> | null = null;

export const SESSION_EXPIRED_EVENT = 'hrms:session-expired';

function readStorage(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStorage(value: string | null): void {
  try {
    if (value === null) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage can be blocked (e.g. private mode); the in-memory copy still works.
  }
}

export function getTokenExpiry(value: string): number | null {
  try {
    const payload = value.split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.exp === 'number' ? json.exp : null;
  } catch {
    return null;
  }
}

export function isTokenLive(value: string): boolean {
  const exp = getTokenExpiry(value);
  return exp !== null && exp * 1000 > Date.now();
}

function scheduleExpiry(value: string): void {
  if (expiryTimer) clearTimeout(expiryTimer);
  const exp = getTokenExpiry(value);
  if (exp === null) return;
  const msLeft = exp * 1000 - Date.now();
  expiryTimer = setTimeout(() => {
    clearToken();
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }, Math.max(0, msLeft));
}

export function getToken(): string | null {
  if (token === null) {
    const stored = readStorage();
    if (stored && isTokenLive(stored)) {
      token = stored;
      scheduleExpiry(stored);
    } else if (stored) {
      writeStorage(null);
    }
  }
  return token;
}

export function setToken(value: string): void {
  token = value;
  writeStorage(value);
  scheduleExpiry(value);
}

export function clearToken(): void {
  token = null;
  writeStorage(null);
  if (expiryTimer) {
    clearTimeout(expiryTimer);
    expiryTimer = null;
  }
}
