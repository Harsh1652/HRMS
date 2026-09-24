import type { ReactNode } from 'react';

/**
 * A bordered surface with a titled header bar. Sections become objects on the
 * page instead of runs of text separated by whitespace.
 */
export function Panel({
  title,
  eyebrow,
  actions,
  children,
  padded = true,
  className = '',
}: {
  title?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
  padded?: boolean;
  className?: string;
}) {
  return (
    <section className={`border border-rule bg-surface ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-rule bg-surface-2/60 px-4 py-2.5">
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && <h2 className="truncate text-[17px]">{title}</h2>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={padded ? 'p-4' : ''}>{children}</div>
    </section>
  );
}
