/** Placeholder blocks in the surface tint; a page keeps its shape while data loads. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <span className={`block animate-pulse rounded-sm bg-surface-2 ${className}`} aria-hidden />;
}

export function SkeletonRows({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div role="status" aria-label="Loading" className="divide-y divide-rule border-y border-rule">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-3 py-3">
          <Skeleton className="h-9 w-9" />
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className={`h-3.5 ${c === 0 ? 'w-40' : 'w-24'}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading" className="grid grid-cols-2 border border-rule border-t-2 border-t-rule-strong bg-surface sm:grid-cols-4 sm:divide-x sm:divide-rule">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="px-4 py-4">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="mt-3 h-9 w-14" />
        </div>
      ))}
    </div>
  );
}
