import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as authApi from '../api/auth';
import { clearToken, getToken, SESSION_EXPIRED_EVENT, setToken } from './token';
import type { AuthUser, Role } from '../types/api';

export interface AuthState {
  /** `undefined` while the stored session is being validated on first load. */
  user: AuthUser | null | undefined;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  /** Set when the session ended without the user choosing to log out. */
  expiredNotice: string | null;
  clearExpiredNotice: () => void;
  hasRole: (...roles: Role[]) => boolean;
}

// eslint-disable-next-line react-refresh/only-export-components -- context object, not a component
export const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [expiredNotice, setExpiredNotice] = useState<string | null>(null);

  // On first load, a live token in sessionStorage is re-validated against /me.
  // The server, not the client, decides whether the session still stands.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) {
        setUser(null);
        return;
      }
      try {
        const me = await authApi.fetchMe();
        if (cancelled) return;
        setUser({
          id: '',
          email: me.email,
          role: me.role ?? 'EMPLOYEE',
          employeeId: me.id,
          name: `${me.firstName} ${me.lastName}`,
        });
      } catch {
        if (cancelled) return;
        clearToken();
        setUser(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Token expiry timer or a 401 from any request ends the session.
  useEffect(() => {
    const onExpired = () => {
      setUser((current) => {
        if (current) setExpiredNotice('Your session has ended. Please sign in again.');
        return null;
      });
      queryClient.clear();
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [queryClient]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    setToken(result.token);
    setUser(result.user);
    setExpiredNotice(null);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // The token may already be dead; local logout proceeds regardless.
    }
    clearToken();
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      login,
      logout,
      expiredNotice,
      clearExpiredNotice: () => setExpiredNotice(null),
      hasRole: (...roles) => !!user && roles.includes(user.role),
    }),
    [user, login, logout, expiredNotice],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
