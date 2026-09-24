import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deactivateEmployee, getEmployee, listEmployees } from '../api/employees';
import { toApiError } from '../api/client';
import { useAuth } from '../auth/useAuth';
import { Button } from '../components/Button';
import { ErrorBanner } from '../components/ErrorBanner';
import { Modal } from '../components/Modal';
import { Panel } from '../components/Panel';
import { KeyValue, KeyValueList } from '../components/KeyValue';
import { Monogram } from '../components/Monogram';
import { Breadcrumb } from '../components/Breadcrumb';
import { Skeleton } from '../components/Skeleton';
import { RoleBadge, StatusBadge } from '../components/Badge';
import { useToast } from '../components/useToast';
import { editableFieldsFor } from '../lib/permissions';
import type { ApiError } from '../types/api';

export function EmployeeDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [deactivateError, setDeactivateError] = useState<ApiError | null>(null);

  const employee = useQuery({ queryKey: ['employee', id], queryFn: () => getEmployee(id), enabled: !!id });
  // Scoped list, reused across pages; direct reports are derived client-side.
  const people = useQuery({ queryKey: ['employees', { limit: 100, forDashboard: true }], queryFn: () => listEmployees({ limit: 100 }) });
  const reports = useMemo(() => (people.data?.items ?? []).filter((p) => p.managerId === id), [people.data, id]);

  const deactivate = useMutation({
    mutationFn: () => deactivateEmployee(id),
    onSuccess: async () => {
      setConfirming(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['employee', id] }),
        queryClient.invalidateQueries({ queryKey: ['employees'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
      toast.push({ tone: 'success', title: 'Employee deactivated', body: 'The record is kept; their login is disabled.' });
    },
    onError: (error) => setDeactivateError(toApiError(error)),
  });

  if (employee.isPending) {
    return (
      <>
        <Breadcrumb items={[{ label: 'Register', to: '/employees' }, { label: id, mono: true }]} />
        <div className="flex items-center gap-4"><Skeleton className="h-16 w-16" /><div><Skeleton className="h-6 w-56" /><Skeleton className="mt-2 h-3.5 w-40" /></div></div>
      </>
    );
  }

  if (employee.isError) {
    const err = toApiError(employee.error);
    return (
      <>
        <Breadcrumb items={[{ label: 'Register', to: '/employees' }, { label: id, mono: true }]} />
        <h1 className="text-[28px]">{err.code === 'FORBIDDEN' ? 'Not available to you' : err.code === 'NOT_FOUND' ? 'No such employee' : 'Could not load'}</h1>
        <div className="mt-4 max-w-xl"><ErrorBanner error={err} /></div>
      </>
    );
  }

  const e = employee.data;
  const editable = user ? editableFieldsFor(user, e) : new Set<string>();
  const canEdit = editable.size > 0;
  const canDeactivate = user?.role === 'ADMIN' && e.id !== user.employeeId && e.status === 'ACTIVE';
  const isSelf = user?.employeeId === e.id;
  const managerInView = e.manager ? people.data?.items.find((p) => p.id === e.manager!.id) : undefined;

  return (
    <>
      <Breadcrumb items={[{ label: 'Register', to: '/employees' }, { label: e.id, mono: true }]} />

      <header className="mb-6 flex flex-col gap-4 border-b border-rule pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <Monogram firstName={e.firstName} lastName={e.lastName} department={e.department} size="xl" />
          <div>
            <h1 className="text-[28px] leading-tight sm:text-[32px]">{e.firstName} {e.lastName}</h1>
            <p className="mt-0.5 text-[14px] text-ink-muted">{e.designation} · {e.department}{isSelf ? ' · this is you' : ''}</p>
            <div className="mt-2 flex items-center gap-3"><StatusBadge status={e.status} /><RoleBadge role={e.role} /></div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {canEdit && <Button onClick={() => navigate(`/employees/${e.id}/edit`)}>Edit</Button>}
          {canDeactivate && <Button variant="danger" onClick={() => { setDeactivateError(null); setConfirming(true); }}>Deactivate</Button>}
        </div>
      </header>

      {e.status === 'INACTIVE' && <div className="mb-5 border-l-2 border-clay bg-clay-tint px-3 py-2 text-[14px]">This employee is inactive. Their login is disabled. HR can reactivate by editing the status.</div>}
      <ErrorBanner error={deactivateError} title="Could not deactivate" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-6">
          <Panel eyebrow="Contact" title="How to reach them">
            <KeyValueList>
              <KeyValue label="Email"><a href={`mailto:${e.email}`} className="underline-offset-2 hover:underline">{e.email}</a></KeyValue>
              <KeyValue label="Phone" mono>{e.phone ?? <span className="text-ink-faint">Not set</span>}</KeyValue>
            </KeyValueList>
          </Panel>
          <Panel eyebrow="Position" title="Where they sit">
            <KeyValueList>
              <KeyValue label="Department">{e.department}</KeyValue>
              <KeyValue label="Designation">{e.designation}</KeyValue>
              <KeyValue label="Joined" mono>{e.joiningDate}</KeyValue>
              <KeyValue label="Reports to">
                {e.manager ? (user?.role === 'ADMIN' || managerInView ? <Link to={`/employees/${e.manager.id}`} className="underline-offset-2 hover:underline">{e.manager.name} <span className="num text-ink-faint">{e.manager.id}</span></Link> : <>{e.manager.name} <span className="num text-ink-faint">{e.manager.id}</span></>) : <span className="text-ink-faint">—</span>}
              </KeyValue>
            </KeyValueList>
          </Panel>
          <Panel eyebrow="Access" title="Account">
            <KeyValueList>
              <KeyValue label="Employee ID" mono>{e.id}</KeyValue>
              <KeyValue label="Role"><RoleBadge role={e.role} /></KeyValue>
              <KeyValue label="Status"><StatusBadge status={e.status} /></KeyValue>
              <KeyValue label="Login">{e.status === 'ACTIVE' ? 'Enabled' : <span className="text-clay">Disabled</span>}</KeyValue>
            </KeyValueList>
            {canEdit && <p className="mt-3 text-[12px] text-ink-faint">You may edit: {[...editable].join(', ')}. Anything else is rejected by the API with a 403.</p>}
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel eyebrow="Team" title={`Direct reports${reports.length ? ` · ${reports.length}` : ''}`} padded={false}>
            {people.isPending ? (
              <div className="p-4"><Skeleton className="h-3.5 w-40" /></div>
            ) : reports.length === 0 ? (
              <p className="p-4 text-[14px] text-ink-muted">{people.data && people.data.items.length > 0 ? 'No direct reports in your view.' : 'None.'}</p>
            ) : (
              <ul className="divide-y divide-rule">
                {reports.map((r) => (
                  <li key={r.id}>
                    <Link to={`/employees/${r.id}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2">
                      <Monogram firstName={r.firstName} lastName={r.lastName} department={r.department} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold">{r.firstName} {r.lastName}</span>
                        <span className="block truncate text-[12px] text-ink-muted">{r.designation}</span>
                      </span>
                      <StatusBadge status={r.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {managerInView && (
            <Panel eyebrow="Manager" title="Reports to" padded={false}>
              <Link to={`/employees/${managerInView.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
                <Monogram firstName={managerInView.firstName} lastName={managerInView.lastName} department={managerInView.department} size="lg" />
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold">{managerInView.firstName} {managerInView.lastName}</span>
                  <span className="block truncate text-[13px] text-ink-muted">{managerInView.designation} · {managerInView.department}</span>
                </span>
              </Link>
            </Panel>
          )}
        </div>
      </div>

      <Modal
        open={confirming}
        title={`Deactivate ${e.firstName} ${e.lastName}?`}
        onClose={() => setConfirming(false)}
        footer={<><Button variant="quiet" onClick={() => setConfirming(false)}>Keep active</Button><Button variant="danger" loading={deactivate.isPending} onClick={() => deactivate.mutate()}>Deactivate</Button></>}
      >
        <p>The record stays on the register with status <strong className="text-ink">Inactive</strong>, and their login is disabled immediately. HR can reactivate later by editing the status.</p>
      </Modal>
    </>
  );
}
