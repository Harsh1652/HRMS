import { tintFor } from '../lib/tint';

/**
 * Initials on a tinted square. The tint comes from the department (see
 * lib/tint.ts), so a person keeps the same colour everywhere they appear.
 */
const SIZES = {
  sm: 'h-7 w-7 text-[12px]',
  md: 'h-9 w-9 text-[14px]',
  lg: 'h-12 w-12 text-[18px]',
  xl: 'h-16 w-16 text-[26px]',
} as const;

export function Monogram({
  firstName,
  lastName,
  department,
  size = 'md',
  className = '',
}: {
  firstName: string;
  lastName: string;
  department?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-sm font-display font-semibold leading-none ${SIZES[size]} ${tintFor(department)} ${className}`}
    >
      {initials}
    </span>
  );
}
