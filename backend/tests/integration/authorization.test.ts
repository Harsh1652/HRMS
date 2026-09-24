/**
 * The mandatory authorization scenarios from docs/spec.md §9, plus the extra
 * cases CLAUDE.md requires. Each block names the spec test it covers.
 *
 * Status-code rule under test (D-005): object-level denial is 403. ADMIN gets
 * 404 for an id that does not exist; every other role gets 403 for any id
 * outside their scope, existing or not.
 */
import request from 'supertest';
import { prisma } from '../../src/utils/prisma';
import { bearer, getApp, loginAs } from '../helpers/app';
import { NONEXISTENT_EMPLOYEE_ID, NON_LOGIN_EMPLOYEE_ID, SEED } from '../helpers/seedUsers';

const app = getApp();

let adminToken: string;
let managerToken: string;
let employee1Token: string;

beforeAll(async () => {
  [adminToken, managerToken, employee1Token] = await Promise.all([
    loginAs('admin'),
    loginAs('manager'),
    loginAs('employee1'),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});

const get = (path: string, token: string) => request(app).get(path).set(bearer(token));

// ---------------------------------------------------------------------------
// Reads: GET /api/employees/:id
// ---------------------------------------------------------------------------

describe('GET /api/employees/:id', () => {
  it('[Spec Test 1] employee1 reads own profile → 200', async () => {
    const res = await get(`/api/employees/${SEED.employee1.employeeId}`, employee1Token);
    expect(res.status).toBe(200);
    expect(res.body.employee).toMatchObject({
      id: 'EMP001',
      email: SEED.employee1.email,
      role: 'EMPLOYEE',
      managerId: 'EMP010',
    });
  });

  it('[Spec Test 2] employee1 reads employee2 → 403', async () => {
    const res = await get(`/api/employees/${SEED.employee2.employeeId}`, employee1Token);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(JSON.stringify(res.body)).not.toContain(SEED.employee2.email);
  });

  it('[Spec Test 4] admin reads employee2 → 200', async () => {
    const res = await get(`/api/employees/${SEED.employee2.employeeId}`, adminToken);
    expect(res.status).toBe(200);
    expect(res.body.employee.id).toBe('EMP002');
  });

  it('[Spec Test 6] manager reads employee3 (outside team) → 403', async () => {
    const res = await get(`/api/employees/${SEED.employee3.employeeId}`, managerToken);
    expect(res.status).toBe(403);
  });

  it('manager reads employee1 (direct report) → 200', async () => {
    const res = await get(`/api/employees/${SEED.employee1.employeeId}`, managerToken);
    expect(res.status).toBe(200);
    expect(res.body.employee.managerId).toBe(SEED.manager.employeeId);
  });

  it('manager reads self → 200', async () => {
    const res = await get(`/api/employees/${SEED.manager.employeeId}`, managerToken);
    expect(res.status).toBe(200);
    expect(res.body.employee.role).toBe('MANAGER');
  });

  it('manager reads a non-login employee outside the team → 403', async () => {
    const res = await get(`/api/employees/${NON_LOGIN_EMPLOYEE_ID}`, managerToken);
    expect(res.status).toBe(403);
  });

  it('employee1 reads their own manager → 403 (self only)', async () => {
    const res = await get(`/api/employees/${SEED.manager.employeeId}`, employee1Token);
    expect(res.status).toBe(403);
  });

  describe('missing vs forbidden (D-005)', () => {
    it('admin reads a nonexistent id → 404', async () => {
      const res = await get(`/api/employees/${NONEXISTENT_EMPLOYEE_ID}`, adminToken);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('employee1 reads a nonexistent id → 403 (existence undisclosed)', async () => {
      const res = await get(`/api/employees/${NONEXISTENT_EMPLOYEE_ID}`, employee1Token);
      expect(res.status).toBe(403);
    });

    it('manager reads a nonexistent id → 403 (existence undisclosed)', async () => {
      const res = await get(`/api/employees/${NONEXISTENT_EMPLOYEE_ID}`, managerToken);
      expect(res.status).toBe(403);
    });

    it('employee1 gets the same body for a real-but-forbidden id and a fake id', async () => {
      const [real, fake] = await Promise.all([
        get(`/api/employees/${SEED.employee2.employeeId}`, employee1Token),
        get(`/api/employees/${NONEXISTENT_EMPLOYEE_ID}`, employee1Token),
      ]);
      expect(real.status).toBe(403);
      expect(fake.status).toBe(403);
      expect(real.body).toEqual(fake.body);
    });
  });

  it('malformed id → 400 before any lookup', async () => {
    const res = await get('/api/employees/not-an-id', adminToken);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('no token → 401', async () => {
    const res = await request(app).get(`/api/employees/${SEED.employee1.employeeId}`);
    expect(res.status).toBe(401);
  });

  it('never returns a password hash', async () => {
    const res = await get(`/api/employees/${SEED.employee1.employeeId}`, adminToken);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2b\$/);
  });
});

// ---------------------------------------------------------------------------
// Reads: GET /api/employees (list scoping)
// ---------------------------------------------------------------------------

describe('GET /api/employees', () => {
  it('employee sees exactly one record: their own', async () => {
    const res = await get('/api/employees', employee1Token);
    expect(res.status).toBe(200);
    expect(res.body.items.map((e: { id: string }) => e.id)).toEqual(['EMP001']);
    expect(res.body.pagination.total).toBe(1);
  });

  it('manager sees exactly self + direct reports', async () => {
    const res = await get('/api/employees', managerToken);
    expect(res.status).toBe(200);
    const ids = res.body.items.map((e: { id: string }) => e.id).sort();
    expect(ids).toEqual(['EMP001', 'EMP002', 'EMP010']);
    expect(res.body.pagination.total).toBe(3);
  });

  it('admin sees everyone in the seed', async () => {
    // Other test files may have created employees before this one runs (D-009),
    // so assert on the seeded ids rather than an exact total.
    const res = await get('/api/employees?limit=100', adminToken);
    expect(res.status).toBe(200);
    const ids: string[] = res.body.items.map((e: { id: string }) => e.id);
    for (const seeded of ['EMP000', 'EMP001', 'EMP002', 'EMP003', 'EMP004', 'EMP005', 'EMP006', 'EMP007', 'EMP008', 'EMP009', 'EMP010', 'EMP011', 'EMP012', 'EMP013', 'EMP014', 'EMP015']) {
      expect(ids).toContain(seeded);
    }
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(16);
  });

  it('a filter can narrow but never widen an employee’s scope', async () => {
    // Sales has employees in the seed; employee1 is in Engineering.
    const res = await get('/api/employees?department=Sales', employee1Token);
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });

  it('a search cannot pull another employee into a manager’s scope', async () => {
    const res = await get('/api/employees?search=Priya', managerToken); // employee3
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it('admin: department filter', async () => {
    const res = await get('/api/employees?department=Engineering&limit=100', adminToken);
    expect(res.status).toBe(200);
    for (const item of res.body.items) expect(item.department).toBe('Engineering');
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(3);
  });

  it('admin: status filter', async () => {
    const res = await get('/api/employees?status=INACTIVE&limit=100', adminToken);
    expect(res.status).toBe(200);
    const ids: string[] = res.body.items.map((e: { id: string }) => e.id);
    expect(ids).toEqual(expect.arrayContaining(['EMP012', 'EMP013'])); // the two seeded INACTIVE rows
    for (const item of res.body.items) expect(item.status).toBe('INACTIVE');
  });

  it('admin: search matches id, name and email case-insensitively', async () => {
    const byId = await get('/api/employees?search=emp00', adminToken);
    // 'neha' would also match S-neha Patel (EMP005); the surname is unique.
    const byName = await get('/api/employees?search=kulkarni', adminToken);
    const byEmail = await get('/api/employees?search=EMPLOYEE2@', adminToken);
    expect(byId.body.pagination.total).toBeGreaterThanOrEqual(10);
    expect(byName.body.items.map((e: { id: string }) => e.id)).toEqual(['EMP001']);
    expect(byEmail.body.items.map((e: { id: string }) => e.id)).toEqual(['EMP002']);
  });

  it('admin: pagination', async () => {
    const page1 = await get('/api/employees?limit=5&page=1', adminToken);
    const total: number = page1.body.pagination.total;
    const totalPages = Math.ceil(total / 5);
    const lastPage = await get(`/api/employees?limit=5&page=${totalPages}`, adminToken);

    expect(page1.body.items).toHaveLength(5);
    expect(page1.body.pagination).toEqual({ page: 1, limit: 5, total, totalPages });
    expect(lastPage.body.items.length).toBe(total - 5 * (totalPages - 1));
    const ids1 = page1.body.items.map((e: { id: string }) => e.id);
    const idsLast = lastPage.body.items.map((e: { id: string }) => e.id);
    expect(ids1.some((id: string) => idsLast.includes(id))).toBe(false);
  });

  it('rejects unknown query parameters', async () => {
    const res = await get('/api/employees?role=ADMIN', adminToken);
    expect(res.status).toBe(400);
  });

  it('rejects an out-of-range limit', async () => {
    const res = await get('/api/employees?limit=1000', adminToken);
    expect(res.status).toBe(400);
  });

  it('no token → 401', async () => {
    const res = await request(app).get('/api/employees');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/me
// ---------------------------------------------------------------------------

describe('GET /api/me', () => {
  it.each([
    ['admin', 'EMP000', 'ADMIN'],
    ['manager', 'EMP010', 'MANAGER'],
    ['employee1', 'EMP001', 'EMPLOYEE'],
  ] as const)('%s → own record', async (who, id, role) => {
    const token = await loginAs(who);
    const res = await get('/api/me', token);
    expect(res.status).toBe(200);
    expect(res.body.employee.id).toBe(id);
    expect(res.body.employee.role).toBe(role);
  });

  it('no token → 401', async () => {
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Writes: POST / PUT / DELETE
// ---------------------------------------------------------------------------

const validCreateBody = (suffix: string) => ({
  firstName: 'Test',
  lastName: `User${suffix}`,
  email: `authz.${suffix}.${Date.now()}@company.com`,
  department: 'Engineering',
  designation: 'QA Engineer',
  joiningDate: '2026-10-01',
  managerId: SEED.manager.employeeId,
  password: 'Welcome@12345',
});

const put = (path: string, token: string, body: object) =>
  request(app).put(path).set(bearer(token)).send(body);
const post = (path: string, token: string, body: object) =>
  request(app).post(path).set(bearer(token)).send(body);
const del = (path: string, token: string) => request(app).delete(path).set(bearer(token));

describe('POST /api/employees', () => {
  it('[Spec Test 3] employee1 creates an employee → 403, nothing created', async () => {
    const body = validCreateBody('t3');
    const res = await post('/api/employees', employee1Token, body);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(await prisma.employee.findUnique({ where: { email: body.email } })).toBeNull();
  });

  it('manager creates an employee → 403', async () => {
    const res = await post('/api/employees', managerToken, validCreateBody('mgr'));
    expect(res.status).toBe(403);
  });

  it('[Spec Test 5] admin creates an employee → 201 with a server-generated id and a working login', async () => {
    const body = validCreateBody('t5');
    const res = await post('/api/employees', adminToken, body);

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/employees/${res.body.employee.id}`);
    expect(res.body.employee).toMatchObject({
      firstName: 'Test',
      email: body.email,
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      managerId: SEED.manager.employeeId,
    });
    expect(res.body.employee.id).toMatch(/^EMP\d{3,}$/);
    expect(Number(res.body.employee.id.slice(3))).toBeGreaterThanOrEqual(100);
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);

    // The new login works, and it is scoped like any employee.
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: body.email, password: body.password });
    expect(login.status).toBe(200);
    const meRes = await get('/api/me', login.body.token);
    expect(meRes.body.employee.id).toBe(res.body.employee.id);
    const other = await get(`/api/employees/${SEED.employee1.employeeId}`, login.body.token);
    expect(other.status).toBe(403);

    // The manager now sees the new report in their team.
    const asManager = await get(`/api/employees/${res.body.employee.id}`, managerToken);
    expect(asManager.status).toBe(200);
  });

  it('no token → 401', async () => {
    const res = await request(app).post('/api/employees').send(validCreateBody('anon'));
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/employees/:id — object-level', () => {
  it('employee1 updates employee2 → 403, nothing applied', async () => {
    const before = await prisma.employee.findUniqueOrThrow({ where: { id: SEED.employee2.employeeId } });
    const res = await put(`/api/employees/${SEED.employee2.employeeId}`, employee1Token, {
      phone: '+91-00000-00000',
    });
    expect(res.status).toBe(403);
    const after = await prisma.employee.findUniqueOrThrow({ where: { id: SEED.employee2.employeeId } });
    expect(after.phone).toBe(before.phone);
  });

  it('manager updates employee3 (outside team) → 403', async () => {
    const res = await put(`/api/employees/${SEED.employee3.employeeId}`, managerToken, { designation: 'X' });
    expect(res.status).toBe(403);
  });

  it('employee1 updates a nonexistent id → 403 (not 404)', async () => {
    const res = await put(`/api/employees/${NONEXISTENT_EMPLOYEE_ID}`, employee1Token, {
      phone: '+91-00000-00000',
    });
    expect(res.status).toBe(403);
  });

  it('admin updates a nonexistent id → 404', async () => {
    const res = await put(`/api/employees/${NONEXISTENT_EMPLOYEE_ID}`, adminToken, {
      phone: '+91-00000-00000',
    });
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/employees/:id — field-level (mass assignment)', () => {
  it.each(['role', 'managerId', 'status'] as const)(
    'employee1 changing own %s → 403 naming the field, nothing applied',
    async (field) => {
      const values = { role: 'ADMIN', managerId: SEED.admin.employeeId, status: 'INACTIVE' } as const;
      const before = await prisma.employee.findUniqueOrThrow({
        where: { id: SEED.employee1.employeeId },
        include: { user: true },
      });

      const res = await put(`/api/employees/${SEED.employee1.employeeId}`, employee1Token, {
        [field]: values[field],
      });

      expect(res.status).toBe(403);
      expect(res.body.error.details).toEqual([{ path: field, message: expect.any(String) }]);

      const after = await prisma.employee.findUniqueOrThrow({
        where: { id: SEED.employee1.employeeId },
        include: { user: true },
      });
      expect(after.managerId).toBe(before.managerId);
      expect(after.status).toBe(before.status);
      expect(after.user?.role).toBe(before.user?.role);
    },
  );

  it('employee1 mixing an allowed and a forbidden field → 403; the allowed one is NOT applied either', async () => {
    const before = await prisma.employee.findUniqueOrThrow({ where: { id: SEED.employee1.employeeId } });
    const res = await put(`/api/employees/${SEED.employee1.employeeId}`, employee1Token, {
      phone: '+91-99999-99999',
      role: 'ADMIN',
    });
    expect(res.status).toBe(403);
    expect(res.body.error.details).toEqual([{ path: 'role', message: expect.any(String) }]);
    const after = await prisma.employee.findUniqueOrThrow({ where: { id: SEED.employee1.employeeId } });
    expect(after.phone).toBe(before.phone);
  });

  it('employee1 updates own phone → 200', async () => {
    const original = (await prisma.employee.findUniqueOrThrow({ where: { id: SEED.employee1.employeeId } })).phone;
    try {
      const res = await put(`/api/employees/${SEED.employee1.employeeId}`, employee1Token, {
        phone: '+91-98450-11111',
      });
      expect(res.status).toBe(200);
      expect(res.body.employee.phone).toBe('+91-98450-11111');
    } finally {
      await prisma.employee.update({ where: { id: SEED.employee1.employeeId }, data: { phone: original } });
    }
  });

  it('manager updates a direct report designation → 200', async () => {
    const original = (await prisma.employee.findUniqueOrThrow({ where: { id: SEED.employee1.employeeId } }))
      .designation;
    try {
      const res = await put(`/api/employees/${SEED.employee1.employeeId}`, managerToken, {
        designation: 'Senior Software Engineer',
      });
      expect(res.status).toBe(200);
      expect(res.body.employee.designation).toBe('Senior Software Engineer');
    } finally {
      await prisma.employee.update({
        where: { id: SEED.employee1.employeeId },
        data: { designation: original },
      });
    }
  });

  it('manager updates a direct report phone → 403', async () => {
    const res = await put(`/api/employees/${SEED.employee1.employeeId}`, managerToken, {
      phone: '+91-00000-00000',
    });
    expect(res.status).toBe(403);
    expect(res.body.error.details).toEqual([{ path: 'phone', message: expect.any(String) }]);
  });

  it('manager updates a direct report role → 403', async () => {
    const res = await put(`/api/employees/${SEED.employee1.employeeId}`, managerToken, { role: 'MANAGER' });
    expect(res.status).toBe(403);
  });

  it('manager updates own phone → 200', async () => {
    const original = (await prisma.employee.findUniqueOrThrow({ where: { id: SEED.manager.employeeId } })).phone;
    try {
      const res = await put(`/api/employees/${SEED.manager.employeeId}`, managerToken, {
        phone: '+91-98450-22222',
      });
      expect(res.status).toBe(200);
    } finally {
      await prisma.employee.update({ where: { id: SEED.manager.employeeId }, data: { phone: original } });
    }
  });

  it('manager updates own designation → 403 (self is phone-only)', async () => {
    const res = await put(`/api/employees/${SEED.manager.employeeId}`, managerToken, { designation: 'CTO' });
    expect(res.status).toBe(403);
  });

  it('admin updates any field on anyone → 200', async () => {
    const original = await prisma.employee.findUniqueOrThrow({ where: { id: SEED.employee3.employeeId } });
    try {
      const res = await put(`/api/employees/${SEED.employee3.employeeId}`, adminToken, {
        designation: 'Senior Financial Analyst',
        department: 'Finance',
        phone: '+91-98450-33333',
      });
      expect(res.status).toBe(200);
      expect(res.body.employee.designation).toBe('Senior Financial Analyst');
    } finally {
      await prisma.employee.update({
        where: { id: SEED.employee3.employeeId },
        data: { designation: original.designation, department: original.department, phone: original.phone },
      });
    }
  });
});

describe('DELETE /api/employees/:id', () => {
  it('employee1 deletes employee2 → 403, still ACTIVE', async () => {
    const res = await del(`/api/employees/${SEED.employee2.employeeId}`, employee1Token);
    expect(res.status).toBe(403);
    const row = await prisma.employee.findUniqueOrThrow({
      where: { id: SEED.employee2.employeeId },
      include: { user: true },
    });
    expect(row.status).toBe('ACTIVE');
    expect(row.user?.isActive).toBe(true);
  });

  it('employee1 deletes self → 403 (employees cannot delete anyone)', async () => {
    const res = await del(`/api/employees/${SEED.employee1.employeeId}`, employee1Token);
    expect(res.status).toBe(403);
  });

  it('manager deletes a direct report → 403', async () => {
    const res = await del(`/api/employees/${SEED.employee1.employeeId}`, managerToken);
    expect(res.status).toBe(403);
  });

  it('employee1 deletes a nonexistent id → 403 (not 404)', async () => {
    const res = await del(`/api/employees/${NONEXISTENT_EMPLOYEE_ID}`, employee1Token);
    expect(res.status).toBe(403);
  });

  it('admin deletes a nonexistent id → 404', async () => {
    const res = await del(`/api/employees/${NONEXISTENT_EMPLOYEE_ID}`, adminToken);
    expect(res.status).toBe(404);
  });

  it('admin deletes self → 400', async () => {
    const res = await del(`/api/employees/${SEED.admin.employeeId}`, adminToken);
    expect(res.status).toBe(400);
  });

  it('admin soft-deletes an employee → 204; row kept, INACTIVE; their token and login stop working', async () => {
    const body = validCreateBody('del');
    const created = await post('/api/employees', adminToken, body);
    expect(created.status).toBe(201);
    const id: string = created.body.employee.id;

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: body.email, password: body.password });
    expect(login.status).toBe(200);
    const victimToken: string = login.body.token;

    const res = await del(`/api/employees/${id}`, adminToken);
    expect(res.status).toBe(204);

    const row = await prisma.employee.findUniqueOrThrow({ where: { id }, include: { user: true } });
    expect(row.status).toBe('INACTIVE');
    expect(row.user?.isActive).toBe(false);

    const asAdmin = await get(`/api/employees/${id}`, adminToken);
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.employee.status).toBe('INACTIVE');

    const withOldToken = await get('/api/me', victimToken);
    expect(withOldToken.status).toBe(401);

    const relogin = await request(app)
      .post('/api/auth/login')
      .send({ email: body.email, password: body.password });
    expect(relogin.status).toBe(401);

    // Idempotent.
    const again = await del(`/api/employees/${id}`, adminToken);
    expect(again.status).toBe(204);
  });
});
