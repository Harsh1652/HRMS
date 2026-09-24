import type { ReactNode } from 'react';

/**
 * A register-style table: hairline rules, eyebrow headers, no zebra stripes.
 * Rows may be clickable; the whole row is the target, with a visible hover.
 */
export function Table({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto border-y border-rule ${className}`}>
      <table className="w-full min-w-[640px] border-collapse text-[14px]">{children}</table>
    </div>
  );
}

export function Th({ children, className = '', align = 'left' }: { children?: ReactNode; className?: string; align?: 'left' | 'right' }) {
  return (
    <th scope="col" className={`eyebrow border-b border-rule-strong px-3 py-2.5 font-semibold ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, className = '', align = 'left' }: { children?: ReactNode; className?: string; align?: 'left' | 'right' }) {
  return <td className={`border-b border-rule px-3 py-2.5 align-middle ${align === 'right' ? 'text-right' : ''} ${className}`}>{children}</td>;
}

export function Tr({ children, onClick, className = '' }: { children: ReactNode; onClick?: () => void; className?: string }) {
  const interactive = !!onClick;
  return (
    <tr
      onClick={onClick}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      className={`${interactive ? 'cursor-pointer hover:bg-surface-2 focus-visible:bg-surface-2' : ''} ${className}`}
    >
      {children}
    </tr>
  );
}
