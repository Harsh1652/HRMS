import type { ReactNode } from 'react';

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="border border-dashed border-rule-strong px-6 py-10 text-center">
      <p className="font-display text-lg text-ink">{title}</p>
      {children && <div className="mt-1 text-[14px] text-ink-muted">{children}</div>}
    </div>
  );
}
