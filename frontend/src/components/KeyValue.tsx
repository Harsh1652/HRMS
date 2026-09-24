import type { ReactNode } from 'react';

export function KeyValueList({ children }: { children: ReactNode }) {
  return <dl className="-my-1">{children}</dl>;
}

export function KeyValue({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 border-b border-rule py-2.5 last:border-b-0 sm:grid-cols-[150px_1fr] sm:gap-4">
      <dt className="eyebrow pt-0.5">{label}</dt>
      <dd className={`text-[15px] text-ink ${mono ? 'num' : ''}`}>{children}</dd>
    </div>
  );
}
