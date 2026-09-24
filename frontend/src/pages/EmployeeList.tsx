import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { listEmployees } from '../api/employees';
import { fetchDashboardStats } from '../api/dashboard';
import { toApiError } from '../api/client';
import { useAuth } from '../auth/useAuth';
import { RoleGate } from '../auth/RoleGate';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { ErrorBanner } from '../components/ErrorBanner';
import { EmptyState } from '../components/EmptyState';
import { Table, Td, Th, Tr } from '../components/Table';
import { RoleBadge, StatusBadge } from '../components/Badge';
import { Monogram } from '../components/Monogram';
import { SkeletonRows } from '../components/Skeleton';
import type { EmploymentStatus } from '../types/api';

const PAGE_SIZE = 20;

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function EmployeeListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const search = params.get('q') ?? '';
  const department = params.get('department') ?? '';
  const status = (params.get('status') ?? '') as EmploymentStatus | '';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);

  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebounced(searchInput, 300);

  useEffect(() => {
    if (debouncedSearch === search) return;
    const next = new URLSearchParams(params);
    if (debouncedSearch) next.set('q', debouncedSearch);
    else next.delete('q');
    next.delete('page');
    setParams(next, { replace: true });
  }, [debouncedSearch, search, params, setParams]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  const query = { search: search || undefined, department: department || undefined, status: status || undefined, page, limit: PAGE_SIZE };
  const employees = useQuery({ queryKey: ['employees', query], queryFn: () => listEmployees(query), placeholderData: keepPreviousData });
  const stats = useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboardStats });

  const isManager = user?.role === 'MANAGER';
  const pagination = employees.data?.pagination;
  const filtered = !!(search || department || status);

  return (
    <>
      <PageHeader
        eyebrow={isManager ? 'Your team' : 'Register'}
        title={isManager ? 'My team' : 'Employees'}
        description={isManager ? 'You and your direct reports.' : 'Everyone on the register. Click a row to open a record.'}
        actions={
          <RoleGate roles={['ADMIN']}>
            <Button variant="primary" onClick={() => navigate('/employees/new')}>Add employee</Button>
          </RoleGate>
        }
      />

      {/* Summary strip: the scope in numbers, before any filtering. */}
      {stats.data && (
        <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-ink-muted">
          <span><span className="num font-semibold text-ink">{stats.data.total}</span> people</span>
          <span><span className="num font-semibold text-ink">{stats.data.active}</span> active</span>
          <span><span className="num font-semibold text-ink">{stats.data.inactive}</span> inactive</span>
          <span><span className="num font-semibold text-ink">{stats.data.byDepartment.length}</span> departments</span>
          {filtered && pagination && (
            <span className="ml-auto">
              Showing <span className="num font-semibold text-ink">{pagination.total}</span> matching ·{' '}
              <button type="button" className="underline underline-offset-2 hover:text-ink" onClick={() => { setSearchInput(''); setParams({}); }}>clear filters</button>
            </span>
          )}
        </div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-3 border border-rule bg-surface p-3 sm:grid-cols-[1fr_200px_160px]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="search" className="eyebrow">Search</label>
          <input id="search" type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Name, email or ID" className="h-10 rounded border border-rule-strong bg-surface px-3 text-[15px] focus:border-ink" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="department" className="eyebrow">Department</label>
          <select id="department" value={department} onChange={(e) => setParam('department', e.target.value)} className="h-10 rounded border border-rule-strong bg-surface px-3 text-[15px] focus:border-ink">
            <option value="">All</option>
            {stats.data?.byDepartment.map((d) => <option key={d.department} value={d.department}>{d.department} ({d.count})</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="eyebrow">Status</label>
          <select id="status" value={status} onChange={(e) => setParam('status', e.target.value)} className="h-10 rounded border border-rule-strong bg-surface px-3 text-[15px] focus:border-ink">
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {employees.isPending && <SkeletonRows rows={6} columns={5} />}
      {employees.isError && <ErrorBanner error={toApiError(employees.error)} title="Could not load employees" />}

      {employees.data && employees.data.items.length === 0 && (
        <EmptyState title="No one matches">
          {filtered ? <button type="button" className="underline underline-offset-2 hover:text-ink" onClick={() => { setSearchInput(''); setParams({}); }}>Clear filters</button> : 'The register is empty.'}
        </EmptyState>
      )}

      {employees.data && employees.data.items.length > 0 && (
        <>
          <Table className={`bg-surface ${employees.isFetching ? 'opacity-60' : ''} transition-opacity`}>
            <thead>
              <tr>
                <Th>Person</Th>
                <Th>ID</Th>
                <Th>Department</Th>
                <Th>Designation</Th>
                <Th>Reports to</Th>
                <Th>Status</Th>
                <Th>Role</Th>
              </tr>
            </thead>
            <tbody>
              {employees.data.items.map((e) => (
                <Tr key={e.id} onClick={() => navigate(`/employees/${e.id}`)}>
                  <Td>
                    <span className="flex items-center gap-3">
                      <Monogram firstName={e.firstName} lastName={e.lastName} department={e.department} size="md" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{e.firstName} {e.lastName}</span>
                        <span className="block truncate text-[13px] text-ink-muted">{e.email}</span>
                      </span>
                    </span>
                  </Td>
                  <Td className="num text-ink-muted">{e.id}</Td>
                  <Td>{e.department}</Td>
                  <Td>{e.designation}</Td>
                  <Td>{e.manager ? <><span>{e.manager.name}</span> <span className="num text-ink-faint">{e.manager.id}</span></> : <span className="text-ink-faint">—</span>}</Td>
                  <Td><StatusBadge status={e.status} /></Td>
                  <Td><RoleBadge role={e.role} /></Td>
                </Tr>
              ))}
            </tbody>
          </Table>

          {pagination && (
            <div className="mt-3 flex flex-col items-start justify-between gap-2 text-[13px] text-ink-muted sm:flex-row sm:items-center">
              <p>
                Rows <span className="num text-ink">{(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of <span className="num text-ink">{pagination.total}</span>
              </p>
              {pagination.totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button variant="quiet" disabled={pagination.page <= 1} onClick={() => setParam('page', String(pagination.page - 1))}>← Previous</Button>
                  <span className="num">Page {pagination.page} of {pagination.totalPages}</span>
                  <Button variant="quiet" disabled={pagination.page >= pagination.totalPages} onClick={() => setParam('page', String(pagination.page + 1))}>Next →</Button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <p className="mt-8 text-[12px] text-ink-faint">Rows are limited to what your role may see; the API applies the same rule to every request.</p>
    </>
  );
}
