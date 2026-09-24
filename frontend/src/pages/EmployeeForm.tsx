import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { createEmployee, getEmployee, listEmployees, updateEmployee } from '../api/employees';
import { toApiError } from '../api/client';
import { useAuth } from '../auth/useAuth';
import { Panel } from '../components/Panel';
import { Breadcrumb } from '../components/Breadcrumb';
import { useToast } from '../components/useToast';
import { Button } from '../components/Button';
import { Spinner } from '../components/Spinner';
import { ErrorBanner } from '../components/ErrorBanner';
import { SelectField, TextField } from '../components/FormField';
import { editableFieldsFor, type EditableField } from '../lib/permissions';
import type { ApiError, CreateEmployeeInput, Employee, UpdateEmployeeInput } from '../types/api';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const optionalPhone = z.string().trim().min(6, 'At least 6 characters').max(20).or(z.literal(''));

const baseSchema = z.object({
  firstName: z.string().trim().min(1, 'Required').max(80),
  lastName: z.string().trim().min(1, 'Required').max(80),
  email: z.string().trim().min(1, 'Required').email('Enter a valid email'),
  phone: optionalPhone,
  department: z.string().trim().min(1, 'Required').max(100),
  designation: z.string().trim().min(1, 'Required').max(100),
  joiningDate: dateOnly,
  managerId: z.string(),
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  password: z.string(),
});
type FormValues = z.infer<typeof baseSchema>;

const createSchema = baseSchema.extend({ password: z.string().min(10, 'At least 10 characters').max(200) });

function toDefaults(e?: Employee): FormValues {
  return {
    firstName: e?.firstName ?? '',
    lastName: e?.lastName ?? '',
    email: e?.email ?? '',
    phone: e?.phone ?? '',
    department: e?.department ?? '',
    designation: e?.designation ?? '',
    joiningDate: e?.joiningDate ?? new Date().toISOString().slice(0, 10),
    managerId: e?.managerId ?? '',
    role: e?.role ?? 'EMPLOYEE',
    status: e?.status ?? 'ACTIVE',
    password: '',
  };
}

export function EmployeeFormPage() {
  const { id } = useParams();
  const isCreate = !id;
  const { user } = useAuth();

  const existing = useQuery({ queryKey: ['employee', id], queryFn: () => getEmployee(id!), enabled: !isCreate });

  if (isCreate && user?.role !== 'ADMIN') return <Navigate to="/employees" replace />;
  if (!isCreate && existing.isPending) return <Spinner label="Loading record" />;
  if (!isCreate && existing.isError) {
    return (
      <>
        <Breadcrumb items={[{ label: 'Register', to: '/employees' }, { label: id ?? '', mono: true }, { label: 'Edit' }]} />
        <h1 className="text-[28px]">Could not load</h1>
        <div className="mt-4 max-w-xl"><ErrorBanner error={toApiError(existing.error)} /></div>
        <p className="mt-4 text-[14px]"><Link to="/employees" className="underline underline-offset-2">← Back to the register</Link></p>
      </>
    );
  }

  return <EmployeeFormInner key={id ?? 'new'} employee={isCreate ? undefined : existing.data} />;
}

function EmployeeFormInner({ employee }: { employee?: Employee }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const isCreate = !employee;

  const editable: Set<EditableField> = useMemo(
    () => (isCreate ? new Set(['firstName', 'lastName', 'email', 'phone', 'department', 'designation', 'joiningDate', 'managerId', 'role', 'status'] as EditableField[]) : user ? editableFieldsFor(user, employee) : new Set()),
    [isCreate, user, employee],
  );
  const can = (f: EditableField) => editable.has(f);

  // Manager options: whatever the caller may see. ADMIN → everyone; a MANAGER
  // editing a report gets their own team, which is all they could assign anyway.
  const managers = useQuery({
    queryKey: ['employees', { limit: 100, forManagerPicker: true }],
    queryFn: () => listEmployees({ limit: 100, status: 'ACTIVE' }),
    enabled: can('managerId'),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(isCreate ? createSchema : baseSchema),
    defaultValues: toDefaults(employee),
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (isCreate) {
        const payload: CreateEmployeeInput = {
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          phone: values.phone || null,
          department: values.department,
          designation: values.designation,
          joiningDate: values.joiningDate,
          managerId: values.managerId || null,
          role: values.role,
          status: values.status,
          password: values.password,
        };
        return createEmployee(payload);
      }
      // Send only fields the policy allows AND that actually changed, so an
      // unchanged disallowed field never triggers a needless 403.
      const dirty = form.formState.dirtyFields;
      const payload: UpdateEmployeeInput = {};
      if (can('firstName') && dirty.firstName) payload.firstName = values.firstName;
      if (can('lastName') && dirty.lastName) payload.lastName = values.lastName;
      if (can('email') && dirty.email) payload.email = values.email;
      if (can('phone') && dirty.phone) payload.phone = values.phone || null;
      if (can('department') && dirty.department) payload.department = values.department;
      if (can('designation') && dirty.designation) payload.designation = values.designation;
      if (can('joiningDate') && dirty.joiningDate) payload.joiningDate = values.joiningDate;
      if (can('managerId') && dirty.managerId) payload.managerId = values.managerId || null;
      if (can('role') && dirty.role) payload.role = values.role;
      if (can('status') && dirty.status) payload.status = values.status;
      if (Object.keys(payload).length === 0) throw Object.assign(new Error('Nothing changed'), { noop: true });
      return updateEmployee(employee!.id, payload);
    },
    onSuccess: async (saved) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['employees'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['me'] }),
      ]);
      queryClient.setQueryData(['employee', saved.id], saved);
      toast.push({ tone: 'success', title: isCreate ? `Created ${saved.id}` : 'Changes saved', body: `${saved.firstName} ${saved.lastName}` });
      navigate(`/employees/${saved.id}`, { replace: true });
    },
    onError: (error) => {
      if ((error as { noop?: boolean }).noop) {
        setApiError({ code: 'NOOP', message: 'Nothing has changed.' });
        return;
      }
      setApiError(toApiError(error));
    },
  });

  const errors = form.formState.errors;
  const disabledNote = 'Not editable for your role';

  return (
    <>
      <Breadcrumb items={isCreate ? [{ label: 'Register', to: '/employees' }, { label: 'New employee' }] : [{ label: 'Register', to: '/employees' }, { label: employee.id, to: `/employees/${employee.id}`, mono: true }, { label: 'Edit' }]} />
      <header className="mb-6 border-b border-rule pb-5">
        <p className="eyebrow">{isCreate ? 'New record' : 'Edit record'}</p>
        <h1 className="text-[28px] leading-tight sm:text-[32px]">{isCreate ? 'Add employee' : `${employee.firstName} ${employee.lastName}`}</h1>
        <p className="mt-1 max-w-prose text-[14px] text-ink-muted">{isCreate ? 'Creates the employee and their login together. The ID is assigned by the server.' : 'Fields you cannot change for this person are shown but locked; the server rejects them regardless.'}</p>
      </header>

      <form onSubmit={form.handleSubmit((v) => { setApiError(null); mutation.mutate(v); })} noValidate className="max-w-3xl">
        <ErrorBanner error={apiError} title={apiError?.code === 'FORBIDDEN' ? 'The server refused part of this change' : undefined} />

        <Panel eyebrow="Person" title="Name and contact" className="mt-4">
          <fieldset className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <TextField label="First name" disabled={!can('firstName')} hint={!can('firstName') ? disabledNote : undefined} error={errors.firstName?.message} {...form.register('firstName')} />
          <TextField label="Last name" disabled={!can('lastName')} hint={!can('lastName') ? disabledNote : undefined} error={errors.lastName?.message} {...form.register('lastName')} />
          <TextField label="Email" type="email" disabled={!can('email')} hint={!can('email') ? disabledNote : isCreate ? 'Also the login email' : 'Changing this changes the login'} error={errors.email?.message} {...form.register('email')} />
          <TextField label="Phone" mono disabled={!can('phone')} hint={!can('phone') ? disabledNote : 'Optional'} error={errors.phone?.message} {...form.register('phone')} />
          </fieldset>
        </Panel>

        <Panel eyebrow="Position" title="Where they sit" className="mt-5">
          <fieldset className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <TextField label="Department" disabled={!can('department')} hint={!can('department') ? disabledNote : undefined} error={errors.department?.message} {...form.register('department')} />
          <TextField label="Designation" disabled={!can('designation')} hint={!can('designation') ? disabledNote : undefined} error={errors.designation?.message} {...form.register('designation')} />
          <TextField label="Joining date" type="date" mono disabled={!can('joiningDate')} hint={!can('joiningDate') ? disabledNote : undefined} error={errors.joiningDate?.message} {...form.register('joiningDate')} />
          <SelectField label="Reports to" disabled={!can('managerId')} hint={!can('managerId') ? disabledNote : managers.isPending ? 'Loading…' : undefined} error={errors.managerId?.message} {...form.register('managerId')}>
            <option value="">— No manager —</option>
            {managers.data?.items.filter((m) => m.id !== employee?.id).map((m) => (
              <option key={m.id} value={m.id}>{m.firstName} {m.lastName} · {m.id}</option>
            ))}
          </SelectField>
          </fieldset>
        </Panel>

        <Panel eyebrow="Access" title="Account" className="mt-5">
          <fieldset className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <SelectField label="Role" disabled={!can('role')} hint={!can('role') ? disabledNote : undefined} error={errors.role?.message} {...form.register('role')}>
            <option value="EMPLOYEE">Employee</option>
            <option value="MANAGER">Manager</option>
            <option value="ADMIN">HR / Admin</option>
          </SelectField>
          <SelectField label="Status" disabled={!can('status')} hint={!can('status') ? disabledNote : 'Inactive disables the login'} error={errors.status?.message} {...form.register('status')}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </SelectField>
          {isCreate && (
            <TextField label="Initial password" type="password" autoComplete="new-password" hint="At least 10 characters. Share it with the employee securely." error={errors.password?.message} {...form.register('password')} className="sm:col-span-2" />
          )}
          </fieldset>
        </Panel>

        <div className="mt-6 flex items-center gap-3">
          <Button type="submit" variant="primary" loading={mutation.isPending}>{isCreate ? 'Create employee' : 'Save changes'}</Button>
          <Button type="button" variant="quiet" onClick={() => navigate(isCreate ? '/employees' : `/employees/${employee.id}`)}>Cancel</Button>
        </div>
      </form>
    </>
  );
}
