import { Fragment } from 'react';
import { Link } from 'react-router-dom';

export function Breadcrumb({ items }: { items: { label: string; to?: string; mono?: boolean }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1.5 text-[13px] text-ink-muted">
      {items.map((item, i) => (
        <Fragment key={`${item.label}-${i}`}>
          {i > 0 && <span className="text-ink-faint" aria-hidden>/</span>}
          {item.to ? (
            <Link to={item.to} className={`underline-offset-2 hover:text-ink hover:underline ${item.mono ? 'num' : ''}`}>{item.label}</Link>
          ) : (
            <span className={`text-ink ${item.mono ? 'num' : ''}`} aria-current="page">{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
