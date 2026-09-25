// @ts-check
/** @typedef {import('jest').Config} Config */

/** @type {Pick<Config, 'preset' | 'testEnvironment'>} */
const shared = {
  preset: 'ts-jest',
  testEnvironment: 'node',
};

/** @type {Config} */
const config = {
  verbose: true,
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
