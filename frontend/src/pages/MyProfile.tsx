import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMe } from '../api/auth';
import { updateEmployee } from '../api/employees';
import { toApiError } from '../api/client';
import { ErrorBanner } from '../components/ErrorBanner';
import { Button } from '../components/Button';
import { TextField } from '../components/FormField';
import { RoleBadge, StatusBadge } from '../components/Badge';
import { Panel } from '../components/Panel';
import { KeyValue, KeyValueList } from '../components/KeyValue';
import { Monogram } from '../components/Monogram';
import { Skeleton } from '../components/Skeleton';
import { useToast } from '../components/useToast';
import type { ApiError, Employee } from '../types/api';

const phoneSchema = z.object({
  phone: z.string().trim().min(6, 'At least 6 characters').max(20, 'At most 20 characters').or(z.literal('')),
});
type PhoneForm = z.infer<typeof phoneSchema>;

export function MyProfilePage() {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe });

  if (me.isPending) {
    return <div className="flex items-center gap-4"><Skeleton className="h-16 w-16" /><div><Skeleton className="h-6 w-56" /><Skeleton className="mt-2 h-3.5 w-40" /></div></div>;
  }
  if (me.isError) {
    return <><h1 className="text-[28px]">Could not load your profile</h1><div className="mt-4 max-w-xl"><ErrorBanner error={toApiError(me.error)} /></div></>;
  }

  const e = me.data;

  return (
    <>
      <header className="mb-6 flex flex-col gap-4 border-b border-rule pb-5 sm:flex-row sm:items-center">
        <Monogram firstName={e.firstName} lastName={e.lastName} department={e.department} size="xl" />
        <div>
          <p className="eyebrow">My profile</p>
          <h1 className="text-[28px] leading-tight sm:text-[32px]">{e.firstName} {e.lastName}</h1>
          <p className="mt-0.5 text-[14px] text-ink-muted">{e.designation} · {e.department}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-6">
          <Panel eyebrow="Contact" title="How to reach you">
            <KeyValueList>
              <KeyValue label="Email">{e.email}</KeyValue>
              <KeyValue label="Phone" mono>{e.phone ?? <span className="text-ink-faint">Not set</span>}</KeyValue>
            </KeyValueList>
          </Panel>
          <Panel eyebrow="Position" title="Where you sit">
            <KeyValueList>
              <KeyValue label="Department">{e.department}</KeyValue>
              <KeyValue label="Designation">{e.designation}</KeyValue>
              <KeyValue label="Joined" mono>{e.joiningDate}</KeyValue>
              <KeyValue label="Reports to">{e.manager ? <>{e.manager.name} <span className="num text-ink-faint">{e.manager.id}</span></> : <span className="text-ink-faint">—</span>}</KeyValue>
            </KeyValueList>
          </Panel>
          <Panel eyebrow="Access" title="Your account">
            <KeyValueList>
              <KeyValue label="Employee ID" mono>{e.id}</KeyValue>
              <KeyValue label="Role"><RoleBadge role={e.role} /></KeyValue>
              <KeyValue label="Status"><StatusBadge status={e.status} /></KeyValue>
            </KeyValueList>
          </Panel>
        </div>

        <PhoneEditor employee={e} onSaved={(updated) => queryClient.setQueryData(['me'], updated)} />
      </div>
    </>
  );
}

function PhoneEditor({ employee, onSaved }: { employee: Employee; onSaved: (e: Employee) => void }) {
  const toast = useToast();
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const form = useForm<PhoneForm>({ resolver: zodResolver(phoneSchema), defaultValues: { phone: employee.phone ?? '' } });

  const mutation = useMutation({
    mutationFn: (values: PhoneForm) => updateEmployee(employee.id, { phone: values.phone === '' ? null : values.phone }),
    onSuccess: (updated) => {
      onSaved(updated);
      form.reset({ phone: updated.phone ?? '' });
      setApiError(null);
      toast.push({ tone: 'success', title: 'Phone updated' });
    },
    onError: (error) => setApiError(toApiError(error)),
  });

  return (
    <Panel eyebrow="Self-service" title="Update phone" className="h-fit">
      <p className="text-[13px] text-ink-muted">The one field you can change yourself. Everything else is maintained by HR — and the server enforces that, not this page.</p>
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} noValidate className="mt-4 flex flex-col gap-4">
        <ErrorBanner error={apiError} />
        <TextField label="Phone" mono placeholder="+91-98450-00000" error={form.formState.errors.phone?.message} {...form.register('phone')} />
        <div className="flex justify-end">
          <Button type="submit" variant="primary" loading={mutation.isPending} disabled={!form.formState.isDirty}>Save</Button>
        </div>
      </form>
    </Panel>
  );
}
