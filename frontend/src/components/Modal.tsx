import { useEffect, type ReactNode } from 'react';

export function Modal({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/30 p-4 sm:items-center" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md border border-rule-strong bg-surface"
      >
        <div className="border-b border-rule px-5 py-3.5">
          <h2 id="modal-title" className="text-lg">{title}</h2>
        </div>
        <div className="px-5 py-4 text-[14px] text-ink-muted">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-rule px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
