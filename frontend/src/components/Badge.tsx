import type { EmploymentStatus, Role } from '../types/api';

/** Status as a small dot + word. No pills, no saturated colour. */
export function StatusBadge({ status }: { status: EmploymentStatus }) {
  const active = status === 'ACTIVE';
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-sage' : 'bg-clay'}`} aria-hidden />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

const roleLabel: Record<Role, string> = { ADMIN: 'HR / Admin', MANAGER: 'Manager', EMPLOYEE: 'Employee' };

export function RoleBadge({ role }: { role: Role | null }) {
  if (!role) return <span className="text-ink-faint">—</span>;
  return <span className="rounded-sm border border-rule bg-surface px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-[0.06em] text-ink-muted">{roleLabel[role]}</span>;
}
