import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

const envFile = path.resolve(__dirname, '../../.env.test');

if (!fs.existsSync(envFile)) {
  throw new Error(
    `Missing ${envFile}. Copy backend/.env.test.example to backend/.env.test and fill in the Supabase URLs (with schema=test).`,
  );
}

dotenv.config({ path: envFile, override: true });

if (!/schema=test/.test(process.env.DATABASE_URL ?? '')) {
  throw new Error('Refusing to run tests: DATABASE_URL in .env.test must contain "schema=test".');
}
