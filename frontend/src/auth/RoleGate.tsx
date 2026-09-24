import type { ReactNode } from 'react';
import { useAuth } from './useAuth';
import type { Role } from '../types/api';

/** Renders children only for the listed roles. Cosmetic — the API is the real guard. */
export function RoleGate({ roles, children, fallback = null }: { roles: Role[]; children: ReactNode; fallback?: ReactNode }) {
  const { hasRole } = useAuth();
  return <>{hasRole(...roles) ? children : fallback}</>;
}
