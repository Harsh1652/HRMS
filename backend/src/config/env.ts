import 'dotenv/config';
import { z } from 'zod';

/**
 * Environment is validated once, at boot. A missing or malformed variable should
 * crash the process immediately rather than surface as a confusing 500 later.
 * CLAUDE.md rule 10: secrets and config come only from here.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  /** Pooled Supabase connection (port 6543, `?pgbouncer=true`) — used by the app. */
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  /** Direct Supabase connection (port 5432) — used by `prisma migrate`. */
  DIRECT_URL: z.string().min(1, 'DIRECT_URL is required'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('30m'),

  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  // pino's levels, plus 'silent' (which pino accepts) so tests can mute logging.
  LOG_LEVEL: z.enum(['silent', 'fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  /** Comma-separated list is accepted so a staging + local origin can coexist. */
  corsOrigins: raw.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};

export type Env = typeof env;
