import type { ApiError } from '../types/api';

/** Shows the API's own message, plus field details when it sent any. */
export function ErrorBanner({ error, title }: { error: ApiError | string | null | undefined; title?: string }) {
  if (!error) return null;
  const apiError = typeof error === 'string' ? { code: 'ERROR', message: error } : error;
  return (
    <div className="rounded border border-accent bg-accent-tint px-3.5 py-2.5 text-[14px] text-ink" role="alert">
      {title && <p className="font-semibold">{title}</p>}
      <p>{apiError.message}</p>
      {apiError.details && apiError.details.length > 0 && (
        <ul className="mt-1.5 list-disc pl-5 text-[13px] text-ink-muted">
          {apiError.details.map((d) => (
            <li key={`${d.path}-${d.message}`}>
              <span className="font-mono text-ink">{d.path}</span> — {d.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
