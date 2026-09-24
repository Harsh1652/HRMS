import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';

interface FieldFrameProps {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  htmlFor: string;
}

function FieldFrame({ label, error, hint, children, htmlFor }: FieldFrameProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="eyebrow">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[13px] text-accent-deep" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[13px] text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}

const inputClass = (error?: string, extra = '') =>
  `h-10 w-full rounded border px-3 text-[15px] transition-colors focus:border-ink disabled:bg-surface-2 disabled:text-ink-muted ${
    error ? 'border-accent' : 'border-rule-strong'
  } ${extra}`;

export const TextField = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string; mono?: boolean }
>(function TextField({ label, error, hint, id, mono, className = '', ...rest }, ref) {
  const fieldId = id ?? rest.name ?? label.toLowerCase().replace(/\s+/g, '-');
  return (
    <FieldFrame label={label} error={error} hint={hint} htmlFor={fieldId}>
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={!!error}
        className={inputClass(error, `${mono ? 'font-mono' : ''} ${className}`)}
        {...rest}
      />
    </FieldFrame>
  );
});

export const SelectField = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string; hint?: string; children: ReactNode }
>(function SelectField({ label, error, hint, id, children, className = '', ...rest }, ref) {
  const fieldId = id ?? rest.name ?? label.toLowerCase().replace(/\s+/g, '-');
  return (
    <FieldFrame label={label} error={error} hint={hint} htmlFor={fieldId}>
      <select ref={ref} id={fieldId} aria-invalid={!!error} className={inputClass(error, `appearance-none ${className}`)} {...rest}>
        {children}
      </select>
    </FieldFrame>
  );
});
