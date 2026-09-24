import type { Config } from 'tailwindcss';

/**
 * "Ledger" — a warm, paper-toned register. No black, no blue, no neon.
 * Hierarchy comes from type and 1px rules, not shadows. Corners stay near-square.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F4EFE6',
        surface: '#FBF8F2',
        'surface-2': '#F0EADF',
        rule: '#D9D0C1',
        'rule-strong': '#B9AE9C',
        ink: '#2B2520',
        'ink-muted': '#6B625A',
        'ink-faint': '#9A8F84',
        accent: '#B5563A',
        'accent-deep': '#8E3F2A',
        'accent-tint': '#F3E2DA',
        sage: '#6E7F5A',
        'sage-tint': '#E6EADF',
        clay: '#A8907A',
        'clay-tint': '#EFE7DD',
        warn: '#A3672B',
        'warn-tint': '#F4E8D6',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '3px',
        sm: '2px',
        md: '4px',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.04em' }],
      },
      maxWidth: {
        content: '72rem',
      },
    },
  },
  plugins: [],
} satisfies Config;
