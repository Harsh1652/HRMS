import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger';

const styles: Record<Variant, string> = {
  primary: 'bg-accent text-surface hover:bg-accent-deep border-accent',
  secondary: 'bg-surface text-ink hover:bg-surface-2 border-rule-strong',
  quiet: 'bg-transparent text-ink-muted hover:text-ink hover:bg-surface-2 border-transparent',
  danger: 'bg-surface text-accent-deep hover:bg-accent-tint border-accent',
};

export function Button({
  variant = 'secondary',
  loading = false,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; children: ReactNode }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded border px-3.5 text-[14px] font-semibold tracking-[0.01em] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    >
      {loading && <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  );
}
