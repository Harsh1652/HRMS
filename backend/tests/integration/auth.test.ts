import request from 'supertest';
import jwt from 'jsonwebtoken';
import { prisma } from '../../src/utils/prisma';
import { env } from '../../src/config/env';
import { bearer, getApp, loginAs } from '../helpers/app';
import { SEED, SEED_PASSWORD } from '../helpers/seedUsers';

const app = getApp();

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/auth/login', () => {
  it('returns a token, its lifetime and the user for valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: SEED.employee1.email, password: SEED_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      token: expect.any(String),
      expiresIn: expect.any(Number),
      user: {
        id: expect.any(String),
        email: SEED.employee1.email,
        role: 'EMPLOYEE',
        employeeId: 'EMP001',
        name: expect.any(String),
      },
    });
    expect(response.body.expiresIn).toBeGreaterThan(0);
    expect(response.body.expiresIn).toBeLessThanOrEqual(30 * 60);

    // The token carries the identity the API will trust.
    const decoded = jwt.verify(response.body.token, env.JWT_SECRET) as jwt.JwtPayload;
    expect(decoded.employeeId).toBe('EMP001');
    expect(decoded.role).toBe('EMPLOYEE');
  });

  it('never returns the password hash', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: SEED.admin.email, password: SEED_PASSWORD });

    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|\$2b\$/);
  });

  it('is case-insensitive on email', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'Employee1@Company.com', password: SEED_PASSWORD });

    expect(response.status).toBe(200);
  });

  it('rejects a wrong password with a generic message', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: SEED.employee1.email, password: 'definitely-not-it' });

    expect(response.status).toBe(401);
    expect(response.body.error).toEqual({
      code: 'UNAUTHORIZED',
      message: 'Invalid email or password',
    });
  });

  it('rejects an unknown email with the *same* body as a wrong password', async () => {
    const [unknown, wrong] = await Promise.all([
      request(app).post('/api/auth/login').send({ email: 'nobody@company.com', password: SEED_PASSWORD }),
      request(app).post('/api/auth/login').send({ email: SEED.employee1.email, password: 'wrong' }),
    ]);

    expect(unknown.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
  });

  it('returns 400 with field details when the body is invalid', async () => {
    const response = await request(app).post('/api/auth/login').send({ email: 'not-an-email' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('BAD_REQUEST');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'email' }),
        expect.objectContaining({ path: 'password' }),
      ]),
    );
  });

  it('rejects unknown body fields (strict schema)', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: SEED.employee1.email, password: SEED_PASSWORD, role: 'ADMIN' });

    expect(response.status).toBe(400);
  });

  it('rejects a deactivated account even with the correct password', async () => {
    await prisma.user.update({ where: { email: SEED.employee3.email }, data: { isActive: false } });
    try {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: SEED.employee3.email, password: SEED_PASSWORD });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    } finally {
      await prisma.user.update({ where: { email: SEED.employee3.email }, data: { isActive: true } });
    }
  });
});

describe('authenticate middleware (via POST /api/auth/logout)', () => {
  it('returns 204 with a valid token', async () => {
    const token = await loginAs('employee1');
    const response = await request(app).post('/api/auth/logout').set(bearer(token));
    expect(response.status).toBe(204);
  });

  it('returns 401 without a token', async () => {
    const response = await request(app).post('/api/auth/logout');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for a non-bearer scheme', async () => {
    const response = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', 'Basic ZW1wbG95ZWUxOnBhc3N3b3Jk');
    expect(response.status).toBe(401);
  });

  it('returns 401 for a tampered token', async () => {
    const token = await loginAs('employee1');
    // Flip the last character of the signature.
    const last = token.at(-1) === 'a' ? 'b' : 'a';
    const tampered = token.slice(0, -1) + last;

    const response = await request(app).post('/api/auth/logout').set(bearer(tampered));
    expect(response.status).toBe(401);
  });

  it('returns 401 for an expired token', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: SEED.employee1.email } });
    const expired = jwt.sign(
      { sub: user.id, employeeId: user.employeeId, role: user.role },
      env.JWT_SECRET,
      { expiresIn: '-1s' },
    );

    const response = await request(app).post('/api/auth/logout').set(bearer(expired));
    expect(response.status).toBe(401);
  });

  it('returns 401 for a token signed with the wrong secret', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: SEED.employee1.email } });
    const forged = jwt.sign(
      { sub: user.id, employeeId: user.employeeId, role: 'ADMIN' },
      'not-the-real-secret-not-the-real-secret',
      { expiresIn: '30m' },
    );

    const response = await request(app).post('/api/auth/logout').set(bearer(forged));
    expect(response.status).toBe(401);
  });

  it('returns 401 for a still-valid token once the user is deactivated', async () => {
    const token = await loginAs('employee2', { fresh: true });

    await prisma.user.update({ where: { email: SEED.employee2.email }, data: { isActive: false } });
    try {
      const response = await request(app).post('/api/auth/logout').set(bearer(token));
      expect(response.status).toBe(401);
    } finally {
      await prisma.user.update({ where: { email: SEED.employee2.email }, data: { isActive: true } });
    }
  });
});

describe('API docs', () => {
  it('serves the OpenAPI document without authentication', async () => {
    const response = await request(app).get('/api/docs.json');
    expect(response.status).toBe(200);
    expect(response.body.openapi).toMatch(/^3\./);
    expect(response.body.paths['/auth/login']).toBeDefined();
  });

  it('serves Swagger UI without authentication', async () => {
    const response = await request(app).get('/api/docs/');
    expect(response.status).toBe(200);
    expect(response.text).toContain('swagger-ui');
  });
});

describe('unmatched routes', () => {
  it('returns a structured 404', async () => {
    const response = await request(app).get('/api/does-not-exist');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
