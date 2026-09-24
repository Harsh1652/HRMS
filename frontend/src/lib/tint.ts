/**
 * Department → tint. Derived from the name so a person keeps the same colour
 * everywhere they appear and departments read as families without a legend.
 */
const TINTS = [
  'bg-sage-tint text-sage',
  'bg-accent-tint text-accent-deep',
  'bg-clay-tint text-clay',
  'bg-warn-tint text-warn',
  'bg-surface-2 text-ink-muted',
] as const;

export function tintFor(key: string | null | undefined): string {
  if (!key) return TINTS[4];
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[hash % TINTS.length];
}
