/**
 * Access-token store: memory first, mirrored to sessionStorage so a page refresh
 * keeps the session but closing the tab ends it (CLAUDE.md frontend rules).
 *
 * The JWT's `exp` is decoded client-side so the app can log out on its own
 * clock instead of waiting for the next 401. The server remains the real guard.
 */

const STORAGE_KEY = 'hrms.token';

let token: string | null = null;
let expiryTimer: ReturnType<typeof setTimeout> | null = null;

/** Fired on window when the session ends for any reason other than an explicit logout. */
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
    // Private mode or blocked storage: the in-memory copy still works for this tab.
  }
}

/** Seconds since epoch at which the token expires, or null if unreadable. */
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
