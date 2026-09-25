import { execSync } from 'node:child_process';
import path from 'node:path';

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
  // This process wipes the schema, so refuse unless both URLs point at schema=test.
  if (!/schema=test/.test(process.env.DATABASE_URL ?? '')) {
    throw new Error('globalSetup: DATABASE_URL must target schema=test');
  }
  if (!/schema=test/.test(process.env.DIRECT_URL ?? '')) {
    throw new Error('globalSetup: DIRECT_URL must target schema=test');
  }

  run('npx prisma migrate reset --force --skip-generate --skip-seed');
  run('npx tsx prisma/seed.ts');
}
