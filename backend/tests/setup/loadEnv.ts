/**
 * Jest `setupFiles` entry: runs before every test file's imports, so
 * `src/config/env.ts` sees the test values. `.env.test` points every URL at the
 * `test` schema (D-006, D-009); the real `.env` is never read during tests.
 */
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

const envFile = path.resolve(__dirname, '../../.env.test');

if (!fs.existsSync(envFile)) {
  throw new Error(
    `Missing ${envFile}. Copy backend/.env.test.example to backend/.env.test and fill in the Supabase URLs (with schema=test).`,
  );
}

// `override: true` so a stray DATABASE_URL in the shell cannot point tests at
// the real schema.
dotenv.config({ path: envFile, override: true });

if (!/schema=test/.test(process.env.DATABASE_URL ?? '')) {
  throw new Error('Refusing to run tests: DATABASE_URL in .env.test must contain "schema=test".');
}
