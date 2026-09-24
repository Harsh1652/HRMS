/**
 * Jest `globalSetup`: runs once per test run, in its own process, before any
 * test file. Rebuilds the `test` schema from the real migration files and seeds
 * it, so every run starts from the documented seed state (D-009, D-017).
 *
 * `migrate reset` rather than `db push`: `db push` only syncs the Prisma models
 * and skips hand-written migration SQL — the `employee_id_seq` sequence that
 * `POST /api/employees` depends on would not exist, and every create would 500.
 * Running the migrations also means the tests verify the deliverable a reviewer
 * will actually apply.
 */
import { execSync } from 'node:child_process';
import path from 'node:path';

// globalSetup does not go through setupFiles, so load the env here as well.
import './loadEnv';

const backendRoot = path.resolve(__dirname, '../..');

function run(command: string): void {
  execSync(command, {
    cwd: backendRoot,
    stdio: 'inherit',
    env: process.env,
  });
}

export default async function globalSetup(): Promise<void> {
  // Guard again here: this process is the one that actually wipes a schema.
  if (!/schema=test/.test(process.env.DATABASE_URL ?? '')) {
    throw new Error('globalSetup: DATABASE_URL must target schema=test');
  }
  if (!/schema=test/.test(process.env.DIRECT_URL ?? '')) {
    throw new Error('globalSetup: DIRECT_URL must target schema=test');
  }

  run('npx prisma migrate reset --force --skip-generate --skip-seed');
  run('npx tsx prisma/seed.ts');
}
