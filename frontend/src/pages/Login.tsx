import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { toApiError } from '../api/client';
import { Button } from '../components/Button';
import { TextField } from '../components/FormField';
import { ErrorBanner } from '../components/ErrorBanner';
import { Monogram } from '../components/Monogram';
import type { ApiError } from '../types/api';

const schema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type FormValues = z.infer<typeof schema>;

const DEMO = [
  { first: 'Asha', last: 'Menon', dept: 'HR', email: 'admin@company.com', role: 'HR / Admin', sees: 'Every record. Creates, edits and deactivates.' },
  { first: 'Rahul', last: 'Verma', dept: 'Engineering', email: 'manager@company.com', role: 'Manager', sees: 'Themself and their direct reports.' },
  { first: 'Neha', last: 'Kulkarni', dept: 'Engineering', email: 'employee1@company.com', role: 'Employee', sees: 'Their own record only.' },
];

export function LoginPage() {
  const { user, login, expiredNotice, clearExpiredNotice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [apiError, setApiError] = useState<ApiError | null>(null);

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  if (user) return <Navigate to="/" replace />;

  const onSubmit = form.handleSubmit(async (values) => {
    setApiError(null);
    clearExpiredNotice();
    try {
      await login(values.email, values.password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== '/login' ? from : '/', { replace: true });
    } catch (error) {
      setApiError(toApiError(error));
      form.resetField('password');
    }
  });

  const fill = (email: string) => {
    form.setValue('email', email, { shouldDirty: true });
    form.setValue('password', 'Password@123', { shouldDirty: true });
    form.setFocus('password');
  };

  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[1.15fr_1fr]">
      {/* Left: the register's statement of who sees what. */}
      <section className="border-b border-rule bg-surface-2 px-6 py-8 sm:px-10 lg:flex lg:flex-col lg:justify-between lg:border-b-0 lg:border-r lg:px-14 lg:py-12">
        <div>
          <p className="font-display text-[22px] font-semibold leading-none tracking-tight">HRMS</p>
          <p className="eyebrow mt-1">Staff register</p>
        </div>

        <div className="mt-10 lg:mt-0">
          <h1 className="max-w-[16ch] text-[34px] leading-[1.05] sm:text-[44px] lg:text-[52px]">
            One register. Every person sees exactly their part of it.
          </h1>
          <p className="mt-4 max-w-prose text-[15px] text-ink-muted">
            Access is decided by the server on every request — the interface only reflects it. Sign in as any of the demo accounts to see the difference.
          </p>

          <ul className="mt-8 divide-y divide-rule border-y border-rule">
            {DEMO.map((d) => (
              <li key={d.email}>
                <button
                  type="button"
                  onClick={() => fill(d.email)}
                  className="group flex w-full items-center gap-4 px-1 py-3 text-left transition-colors hover:bg-surface"
                  title={`Fill the form with ${d.email}`}
                >
                  <Monogram firstName={d.first} lastName={d.last} department={d.dept} size="lg" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold text-ink">{d.role}</span>
                      <span className="num truncate text-[12px] text-ink-faint">{d.email}</span>
                    </span>
                    <span className="block text-[13px] text-ink-muted">{d.sees}</span>
                  </span>
                  <span className="hidden text-[13px] text-ink-faint group-hover:text-ink sm:block">Use →</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 num text-[12px] text-ink-faint">Password for every demo account: Password@123</p>
        </div>

        <p className="mt-10 hidden text-[12px] text-ink-faint lg:block">HR Management System · assessment build</p>
      </section>

      {/* Right: the form on its own surface. */}
      <section className="flex items-center px-6 py-10 sm:px-10 lg:px-14">
        <div className="w-full max-w-md border border-rule bg-surface">
          <div className="border-b border-rule px-6 py-4">
            <p className="eyebrow">Sign in</p>
            <h2 className="text-[24px]">Your company account</h2>
          </div>
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5 px-6 py-6">
            {expiredNotice && (
              <div className="border-l-2 border-warn bg-warn-tint px-3 py-2 text-[14px] text-ink" role="status">
                {expiredNotice}
              </div>
            )}
            <ErrorBanner error={apiError} />

            <TextField label="Email" type="email" autoComplete="username" autoFocus error={form.formState.errors.email?.message} {...form.register('email')} />
            <TextField label="Password" type="password" autoComplete="current-password" error={form.formState.errors.password?.message} {...form.register('password')} />

            <Button type="submit" variant="primary" loading={form.formState.isSubmitting} className="mt-1 h-10">
              Sign in
            </Button>
            <p className="text-[12px] text-ink-faint">Sessions last 30 minutes and end when the tab closes.</p>
          </form>
        </div>
      </section>
    </main>
  );
}
