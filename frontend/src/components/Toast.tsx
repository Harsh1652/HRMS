import { createContext, useCallback, useMemo, useState, type ReactNode } from 'react';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
}

export interface ToastApi {
  push: (toast: Omit<ToastItem, 'id'>) => void;
}

// eslint-disable-next-line react-refresh/only-export-components -- context object, not a component
export const ToastContext = createContext<ToastApi | null>(null);

const TONE_RULE: Record<ToastTone, string> = {
  success: 'border-l-sage',
  error: 'border-l-accent',
  info: 'border-l-rule-strong',
};

let nextId = 1;

/** Quiet confirmations, bottom-right, auto-dismissing. No icons, no colour fills. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => setItems((current) => current.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      const id = nextId++;
      setItems((current) => [...current, { ...toast, id }]);
      setTimeout(() => dismiss(id), toast.tone === 'error' ? 7000 : 4000);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto w-full max-w-sm border border-rule border-l-2 bg-surface px-4 py-3 text-[14px] ${TONE_RULE[t.tone]}`}
            role="status"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">{t.title}</p>
                {t.body && <p className="mt-0.5 text-ink-muted">{t.body}</p>}
              </div>
              <button type="button" onClick={() => dismiss(t.id)} className="text-ink-faint hover:text-ink" aria-label="Dismiss">
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
