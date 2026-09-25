process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://unit:unit@localhost:5432/unit?schema=test';
process.env.DIRECT_URL ??= 'postgresql://unit:unit@localhost:5432/unit?schema=test';
process.env.JWT_SECRET ??= 'unit-test-secret-unit-test-secret-unit-test';
process.env.LOG_LEVEL = 'silent';
