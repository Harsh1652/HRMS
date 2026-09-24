export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="inline-flex items-center gap-2 text-[13px] text-ink-muted" role="status" aria-live="polite">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-rule-strong border-t-ink" aria-hidden />
      {label}…
    </div>
  );
}
