/**
 * Jest `setupFiles` for the `unit` project. Unit tests never touch a database,
 * but any module that imports `src/config/env.ts` validates the environment at
 * import time. These placeholders satisfy the schema; nothing connects to them.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://unit:unit@localhost:5432/unit?schema=test';
process.env.DIRECT_URL ??= 'postgresql://unit:unit@localhost:5432/unit?schema=test';
process.env.JWT_SECRET ??= 'unit-test-secret-unit-test-secret-unit-test';
process.env.LOG_LEVEL = 'silent';
