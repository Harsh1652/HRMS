/**
 * Employee module behaviour that is not about *who* may do what (that is
 * authorization.test.ts) but about *what* the endpoints do: validation, the id
 * sequence, uniqueness, manager integrity, and User/Employee consistency.
 * Everything here runs as ADMIN and operates on rows it creates.
 */
import request from 'supertest';
import { prisma } from '../../src/utils/prisma';
import { bearer, getApp, loginAs } from '../helpers/app';
import { SEED } from '../helpers/seedUsers';

const app = getApp();
let adminToken: string;

beforeAll(async () => {
  adminToken = await loginAs('admin');
});

afterAll(async () => {
  await prisma.$disconnect();
});

let counter = 0;
const body = (overrides: Record<string, unknown> = {}) => {
  counter += 1;
  return {
    firstName: 'Emp',
    lastName: `Test${counter}`,
    email: `emp.test.${counter}.${Date.now()}@company.com`,
    department: 'Engineering',
    designation: 'Engineer',
    joiningDate: '2026-01-15',
    password: 'Welcome@12345',
    ...overrides,
  };
};

const post = (b: object) => request(app).post('/api/employees').set(bearer(adminToken)).send(b);
const put = (id: string, b: object) => request(app).put(`/api/employees/${id}`).set(bearer(adminToken)).send(b);
const get = (path: string) => request(app).get(path).set(bearer(adminToken));

async function createOne(overrides: Record<string, unknown> = {}) {
  const b = body(overrides);
  const res = await post(b);
  expect(res.status).toBe(201);
  return { id: res.body.employee.id as string, body: b, employee: res.body.employee };
}

describe('POST /api/employees — validation', () => {
  it('rejects an empty body with one detail per missing required field', async () => {
    const res = await post({});
    expect(res.status).toBe(400);
    const paths = res.body.error.details.map((d: { path: string }) => d.path).sort();
    expect(paths).toEqual(['department', 'designation', 'email', 'firstName', 'joiningDate', 'lastName', 'password']);
  });

  it.each([
    ['malformed email', { email: 'nope' }],
    ['malformed joiningDate', { joiningDate: '15/01/2026' }],
    ['impossible joiningDate', { joiningDate: '2026-02-30' }],
    ['short password', { password: 'short' }],
    ['bad role', { role: 'SUPERUSER' }],
    ['bad status', { status: 'FIRED' }],
    ['bad managerId format', { managerId: '10' }],
    ['unknown key', { id: 'EMP001' }],
    ['unknown key (passwordHash)', { passwordHash: 'x' }],
  ])('rejects %s → 400', async (_label, overrides) => {
    const res = await post(body(overrides));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('rejects a managerId that does not exist → 400 naming managerId', async () => {
    const res = await post(body({ managerId: 'EMP999' }));
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ path: 'managerId', message: expect.any(String) }]);
  });

  it('rejects a duplicate email → 409', async () => {
    const first = await createOne();
    const res = await post(body({ email: first.body.email }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rejects an email already used by a seed user → 409', async () => {
    const res = await post(body({ email: SEED.employee1.email }));
    expect(res.status).toBe(409);
  });

  it('normalises email to lowercase', async () => {
    const stamp = Date.now();
    const res = await post(body({ email: `Mixed.Case.${stamp}@Company.com` }));
    expect(res.status).toBe(201);
    expect(res.body.employee.email).toBe(`mixed.case.${stamp}@company.com`);
  });
});

describe('POST /api/employees — behaviour', () => {
  it('assigns increasing ids from the sequence, at or above EMP100', async () => {
    const a = await createOne();
    const b = await createOne();
    const na = Number(a.id.slice(3));
    const nb = Number(b.id.slice(3));
    expect(na).toBeGreaterThanOrEqual(100);
    expect(nb).toBeGreaterThan(na);
  });

  it('applies defaults: role EMPLOYEE, status ACTIVE, no manager, no phone', async () => {
    const { employee } = await createOne();
    expect(employee).toMatchObject({ role: 'EMPLOYEE', status: 'ACTIVE', managerId: null, manager: null, phone: null });
  });

  it('creates the User in the same transaction with the right role and isActive', async () => {
    const { id, body: b } = await createOne({ role: 'MANAGER', status: 'INACTIVE' });
    const user = await prisma.user.findUniqueOrThrow({ where: { employeeId: id } });
    expect(user.email).toBe(b.email);
    expect(user.role).toBe('MANAGER');
    expect(user.isActive).toBe(false);
    expect(user.passwordHash).not.toBe(b.password);
    expect(user.passwordHash).toMatch(/^\$2b\$12\$/);
  });

  it('returns the manager summary when managerId is given', async () => {
    // EMP011 (Sales manager, non-login) rather than EMP010: authorization.test.ts
    // asserts EMP010's team is exactly {EMP001, EMP002}, and file order is not fixed.
    const { employee } = await createOne({ managerId: 'EMP011' });
    expect(employee.manager).toEqual({ id: 'EMP011', name: expect.stringContaining('Kavya') });
  });

  it('returns joiningDate as a plain YYYY-MM-DD', async () => {
    const { employee } = await createOne({ joiningDate: '2026-03-31' });
    expect(employee.joiningDate).toBe('2026-03-31');
  });
});

describe('PUT /api/employees/:id — validation', () => {
  it('rejects an empty body → 400', async () => {
    const { id } = await createOne();
    const res = await put(id, {});
    expect(res.status).toBe(400);
  });

  it('rejects an unknown key → 400 (before the policy sees it)', async () => {
    const { id } = await createOne();
    const res = await put(id, { passwordHash: 'x' });
    expect(res.status).toBe(400);
  });

  it('rejects a malformed id → 400', async () => {
    const res = await put('EMP-1', { phone: '+91-98450-00000' });
    expect(res.status).toBe(400);
  });

  it('rejects self as manager → 400', async () => {
    const { id } = await createOne();
    const res = await put(id, { managerId: id });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('managerId');
  });

  it('rejects a nonexistent manager → 400', async () => {
    const { id } = await createOne();
    const res = await put(id, { managerId: 'EMP999' });
    expect(res.status).toBe(400);
  });

  it('rejects a reporting cycle (A → B → A) → 400', async () => {
    const a = await createOne();
    const b = await createOne({ managerId: a.id });
    const res = await put(a.id, { managerId: b.id });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/loop/i);
  });

  it('rejects a longer reporting cycle (A → B → C → A) → 400', async () => {
    const a = await createOne();
    const b = await createOne({ managerId: a.id });
    const c = await createOne({ managerId: b.id });
    const res = await put(a.id, { managerId: c.id });
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate email → 409', async () => {
    const { id } = await createOne();
    const res = await put(id, { email: SEED.employee2.email });
    expect(res.status).toBe(409);
  });
});

describe('PUT /api/employees/:id — behaviour', () => {
  it('updates only the fields sent', async () => {
    const { id, employee } = await createOne();
    const res = await put(id, { designation: 'Staff Engineer' });
    expect(res.status).toBe(200);
    expect(res.body.employee.designation).toBe('Staff Engineer');
    expect(res.body.employee.firstName).toBe(employee.firstName);
    expect(res.body.employee.department).toBe(employee.department);
  });

  it('clears the manager with managerId: null', async () => {
    const { id } = await createOne({ managerId: SEED.manager.employeeId });
    const res = await put(id, { managerId: null });
    expect(res.status).toBe(200);
    expect(res.body.employee.managerId).toBeNull();
    expect(res.body.employee.manager).toBeNull();
  });

  it('clears the phone with phone: null', async () => {
    const { id } = await createOne({ phone: '+91-98450-00000' });
    const res = await put(id, { phone: null });
    expect(res.status).toBe(200);
    expect(res.body.employee.phone).toBeNull();
  });

  it('changing email also changes the login email (D-015)', async () => {
    const { id, body: b } = await createOne();
    const newEmail = `renamed.${Date.now()}@company.com`;
    const res = await put(id, { email: newEmail });
    expect(res.status).toBe(200);

    const oldLogin = await request(app).post('/api/auth/login').send({ email: b.email, password: b.password });
    const newLogin = await request(app).post('/api/auth/login').send({ email: newEmail, password: b.password });
    expect(oldLogin.status).toBe(401);
    expect(newLogin.status).toBe(200);
  });

  it('changing role changes the login role and takes effect on the next request (D-015)', async () => {
    const { id, body: b } = await createOne();
    const login = await request(app).post('/api/auth/login').send({ email: b.email, password: b.password });
    const token: string = login.body.token;

    // As EMPLOYEE, cannot see employee1.
    expect((await request(app).get(`/api/employees/${SEED.employee1.employeeId}`).set(bearer(token))).status).toBe(403);

    const res = await put(id, { role: 'ADMIN' });
    expect(res.status).toBe(200);
    expect(res.body.employee.role).toBe('ADMIN');

    // Same token, next request: authenticate re-reads the role from the DB.
    expect((await request(app).get(`/api/employees/${SEED.employee1.employeeId}`).set(bearer(token))).status).toBe(200);
  });

  it('setting status INACTIVE via PUT disables the login (D-015)', async () => {
    const { id, body: b } = await createOne();
    const res = await put(id, { status: 'INACTIVE' });
    expect(res.status).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { employeeId: id } });
    expect(user.isActive).toBe(false);
    const login = await request(app).post('/api/auth/login').send({ email: b.email, password: b.password });
    expect(login.status).toBe(401);
  });

  it('setting status back to ACTIVE re-enables the login', async () => {
    const { id, body: b } = await createOne({ status: 'INACTIVE' });
    const res = await put(id, { status: 'ACTIVE' });
    expect(res.status).toBe(200);
    const login = await request(app).post('/api/auth/login').send({ email: b.email, password: b.password });
    expect(login.status).toBe(200);
  });
});

describe('GET /api/employees — created rows appear in filters', () => {
  it('a created INACTIVE employee shows up under status=INACTIVE and not under ACTIVE', async () => {
    const { id } = await createOne({ status: 'INACTIVE', department: 'Ops' });
    const inactive = await get('/api/employees?status=INACTIVE&department=Ops&limit=100');
    const active = await get('/api/employees?status=ACTIVE&department=Ops&limit=100');
    expect(inactive.body.items.map((e: { id: string }) => e.id)).toContain(id);
    expect(active.body.items.map((e: { id: string }) => e.id)).not.toContain(id);
  });
});
