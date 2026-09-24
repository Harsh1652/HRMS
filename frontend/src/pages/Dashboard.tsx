import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchDashboardStats } from '../api/dashboard';
import { listEmployees } from '../api/employees';
import { toApiError } from '../api/client';
import { useAuth } from '../auth/useAuth';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { StatStrip } from '../components/StatStrip';
import { Monogram } from '../components/Monogram';
import { ErrorBanner } from '../components/ErrorBanner';
import { EmptyState } from '../components/EmptyState';
import { Skeleton, SkeletonStats } from '../components/Skeleton';
import { StatusBadge } from '../components/Badge';
import type { Employee } from '../types/api';

const scopeCopy = {
  ADMIN: { eyebrow: 'Whole company', note: 'Every employee on the register.' },
  MANAGER: { eyebrow: 'Your team', note: 'You and the people who report to you.' },
  EMPLOYEE: { eyebrow: 'Your record', note: 'Figures cover your own record only.' },
} as const;

function PersonRow({ e, right }: { e: Employee; right?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Monogram firstName={e.firstName} lastName={e.lastName} department={e.department} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-ink">{e.firstName} {e.lastName}</p>
        <p className="truncate text-[13px] text-ink-muted">{e.designation} · {e.department}</p>
      </div>
      {right}
    </li>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const role = user?.role ?? 'EMPLOYEE';
  const copy = scopeCopy[role];
  const canOpenRegister = role !== 'EMPLOYEE';

  const stats = useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboardStats });
  // One scoped list feeds both the "recent joiners" and "reporting lines" panels.
  const people = useQuery({ queryKey: ['employees', { limit: 100, forDashboard: true }], queryFn: () => listEmployees({ limit: 100 }) });

  const recent = useMemo(
    () => [...(people.data?.items ?? [])].sort((a, b) => b.joiningDate.localeCompare(a.joiningDate)).slice(0, 5),
    [people.data],
  );

  const reportingLines = useMemo(() => {
    const items = people.data?.items ?? [];
    const byId = new Map(items.map((e) => [e.id, e]));
    const groups = new Map<string, Employee[]>();
    for (const e of items) {
      if (!e.managerId) continue;
      if (!groups.has(e.managerId)) groups.set(e.managerId, []);
      groups.get(e.managerId)!.push(e);
    }
    return [...groups.entries()]
      .map(([managerId, reports]) => ({ manager: byId.get(managerId) ?? null, managerId, reports }))
      .sort((a, b) => b.reports.length - a.reports.length);
  }, [people.data]);

  return (
    <>
      <PageHeader eyebrow={copy.eyebrow} title="Dashboard" description={copy.note} />

      {stats.isError && <ErrorBanner error={toApiError(stats.error)} title="Could not load the dashboard" />}
      {stats.isPending ? (
        <SkeletonStats />
      ) : stats.data ? (
        <StatStrip
          stats={[
            { label: 'Total employees', value: stats.data.total },
            { label: 'Active', value: stats.data.active, sub: stats.data.total ? `${Math.round((stats.data.active / stats.data.total) * 100)}% of total` : undefined },
            { label: 'Inactive', value: stats.data.inactive, sub: stats.data.inactive === 0 ? 'None deactivated' : 'Login disabled' },
            { label: 'Departments', value: stats.data.byDepartment.length },
          ]}
        />
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-6">
          <Panel
            eyebrow="Headcount"
            title="By department"
            padded={false}
            actions={canOpenRegister && <Link to="/employees" className="text-[13px] text-ink-muted underline-offset-2 hover:text-ink hover:underline">Open the register →</Link>}
          >
            {stats.data && stats.data.byDepartment.length === 0 ? (
              <div className="p-4"><EmptyState title="No departments to show" /></div>
            ) : (
              <DepartmentTable rows={stats.data?.byDepartment ?? []} total={stats.data?.total ?? 0} loading={stats.isPending} canOpenRegister={canOpenRegister} />
            )}
          </Panel>

          <Panel eyebrow="Structure" title={role === 'EMPLOYEE' ? 'Your manager' : 'Reporting lines'} padded={false}>
            {people.isPending ? (
              <div className="p-4"><Skeleton className="h-3.5 w-48" /><Skeleton className="mt-3 h-3.5 w-64" /></div>
            ) : reportingLines.length === 0 ? (
              <div className="p-4"><EmptyState title="No reporting lines in view">{role === 'EMPLOYEE' ? 'Your manager is shown on your profile.' : 'Nobody in view reports to anyone else in view.'}</EmptyState></div>
            ) : (
              <ul className="divide-y divide-rule">
                {reportingLines.map(({ manager, managerId, reports }) => (
                  <li key={managerId} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 items-center gap-3 sm:w-64">
                      {manager ? (
                        <>
                          <Monogram firstName={manager.firstName} lastName={manager.lastName} department={manager.department} size="md" />
                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-semibold">{manager.firstName} {manager.lastName}</p>
                            <p className="truncate text-[12px] text-ink-muted">{manager.designation}</p>
                          </div>
                        </>
                      ) : (
                        <div className="min-w-0">
                          <p className="num text-[14px] font-semibold">{managerId}</p>
                          <p className="text-[12px] text-ink-muted">outside your view</p>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-wrap items-center gap-1.5">
                      {reports.slice(0, 8).map((r) =>
                        canOpenRegister ? (
                          <Link key={r.id} to={`/employees/${r.id}`} title={`${r.firstName} ${r.lastName}`} className="transition-opacity hover:opacity-80">
                            <Monogram firstName={r.firstName} lastName={r.lastName} department={r.department} size="sm" />
                          </Link>
                        ) : (
                          <Monogram key={r.id} firstName={r.firstName} lastName={r.lastName} department={r.department} size="sm" />
                        ),
                      )}
                      {reports.length > 8 && <span className="num text-[12px] text-ink-faint">+{reports.length - 8}</span>}
                    </div>
                    <p className="num text-[13px] text-ink-muted sm:text-right">{reports.length} report{reports.length === 1 ? '' : 's'}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel eyebrow="People" title="Recent joiners" padded={false}>
            {people.isError && <div className="p-4"><ErrorBanner error={toApiError(people.error)} /></div>}
            {people.isPending ? (
              <ul className="divide-y divide-rule px-4">{[0, 1, 2].map((i) => <li key={i} className="flex items-center gap-3 py-2.5"><Skeleton className="h-9 w-9" /><Skeleton className="h-3.5 w-40" /></li>)}</ul>
            ) : recent.length === 0 ? (
              <div className="p-4"><EmptyState title="Nobody to show" /></div>
            ) : (
              <ul className="divide-y divide-rule px-4">
                {recent.map((e) => (
                  <PersonRow key={e.id} e={e} right={<span className="num shrink-0 text-[12px] text-ink-faint">{e.joiningDate}</span>} />
                ))}
              </ul>
            )}
          </Panel>

          {role !== 'EMPLOYEE' && people.data && people.data.items.some((e) => e.status === 'INACTIVE') && (
            <Panel eyebrow="Attention" title="Inactive accounts" padded={false}>
              <ul className="divide-y divide-rule px-4">
                {people.data.items.filter((e) => e.status === 'INACTIVE').slice(0, 4).map((e) => (
                  <PersonRow key={e.id} e={e} right={<StatusBadge status={e.status} />} />
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

function DepartmentTable({ rows, total, loading, canOpenRegister }: { rows: { department: string; count: number }[]; total: number; loading: boolean; canOpenRegister: boolean }) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  if (loading) {
    return <div className="p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="mb-3 h-3.5 w-full" />)}</div>;
  }
  return (
    <table className="w-full border-collapse text-[14px]">
      <thead>
        <tr>
          <th scope="col" className="eyebrow border-b border-rule-strong px-4 py-2.5 text-left">Department</th>
          <th scope="col" className="eyebrow border-b border-rule-strong px-4 py-2.5 text-right">People</th>
          <th scope="col" className="eyebrow border-b border-rule-strong px-4 py-2.5 text-right">Share</th>
          <th scope="col" className="hidden w-2/5 border-b border-rule-strong px-4 py-2.5 sm:table-cell"><span className="sr-only">Proportion</span></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.department}>
            <td className="border-b border-rule px-4 py-2.5 font-medium last:border-b-0">
              {canOpenRegister ? <Link to={`/employees?department=${encodeURIComponent(row.department)}`} className="underline-offset-2 hover:underline">{row.department}</Link> : row.department}
            </td>
            <td className="num border-b border-rule px-4 py-2.5 text-right">{row.count}</td>
            <td className="num border-b border-rule px-4 py-2.5 text-right text-ink-muted">{total ? Math.round((row.count / total) * 100) : 0}%</td>
            <td className="hidden border-b border-rule px-4 py-2.5 sm:table-cell">
              <div className="h-1.5 w-full bg-surface-2" aria-hidden>
                <div className="h-full bg-clay" style={{ width: `${(row.count / max) * 100}%` }} />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
