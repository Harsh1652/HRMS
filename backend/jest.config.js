// @ts-check
/** @typedef {import('jest').Config} Config */

/**
 * Two projects (D-013):
 *
 *  unit         — pure logic, no database, no env file. Runs anywhere.
 *                 Holds the policy tests: the authorization rules are verified
 *                 with zero infrastructure.
 *  integration  — drives the Express app through supertest against the `test`
 *                 schema of the Supabase database. `loadEnv` reads `.env.test`
 *                 and `globalSetup` resets + seeds that schema once per run (D-009).
 *
 * `npm test` runs both. `npm run test:unit` runs only the first.
 *
 * Plain JS rather than TS because Jest needs `ts-node` to load a `.ts` config,
 * and that is not a project dependency.
 */

/** @type {Pick<Config, 'preset' | 'testEnvironment'>} */
const shared = {
  preset: 'ts-jest',
  testEnvironment: 'node',
};

/** @type {Config} */
const config = {
  verbose: true,
  // Global, not per-project: integration tests pay for bcrypt + a remote DB.
  testTimeout: 30_000,
  projects: [
    {
      ...shared,
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
      setupFiles: ['<rootDir>/tests/setup/unitEnv.ts'],
    },
    {
      ...shared,
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
      setupFiles: ['<rootDir>/tests/setup/loadEnv.ts'],
      globalSetup: '<rootDir>/tests/setup/globalSetup.ts',
    },
  ],
};

module.exports = config;
