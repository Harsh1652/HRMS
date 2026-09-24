import type { ReactNode } from 'react';

export interface Stat {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}

/**
 * Headline figures as one ruled strip — divided by vertical rules, capped by a
 * heavy ink rule — the way a printed register's head is set.
 */
export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 border border-rule border-t-2 border-t-ink bg-surface sm:grid-cols-4 sm:divide-x sm:divide-rule">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className={`px-4 py-4 ${index % 2 === 1 ? 'border-l border-rule sm:border-l-0' : ''} ${index >= 2 ? 'border-t border-rule sm:border-t-0' : ''}`}
        >
          <p className="eyebrow">{stat.label}</p>
          <p className="num mt-1.5 font-display text-[38px] font-medium leading-none text-ink sm:text-[42px]">{stat.value}</p>
          {stat.sub && <p className="mt-1.5 text-[13px] text-ink-muted">{stat.sub}</p>}
        </div>
      ))}
    </div>
  );
}
