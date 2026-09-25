import request from 'supertest';
import { prisma } from '../../src/utils/prisma';
import { bearer, getApp, loginAs } from '../helpers/app';
import { SEED } from '../helpers/seedUsers';

const app = getApp();

afterAll(async () => {
  await prisma.$disconnect();
});

const stats = (token: string) => request(app).get('/api/dashboard/stats').set(bearer(token));

interface Stats {
  total: number;
  active: number;
  inactive: number;
  byDepartment: { department: string; count: number }[];
}

function expectInternallyConsistent(body: Stats): void {
  expect(body.active + body.inactive).toBe(body.total);
  expect(body.byDepartment.reduce((sum, row) => sum + row.count, 0)).toBe(body.total);
  const names = body.byDepartment.map((row) => row.department);
  expect([...names].sort()).toEqual(names);
  expect(new Set(names).size).toBe(names.length);
}

describe('GET /api/dashboard/stats', () => {
  it('no token → 401', async () => {
    const res = await request(app).get('/api/dashboard/stats');
    expect(res.status).toBe(401);
  });

  it('ADMIN sees the whole company', async () => {
    const res = await stats(await loginAs('admin'));
    expect(res.status).toBe(200);
    expectInternallyConsistent(res.body);

    const [total, active] = await Promise.all([
      prisma.employee.count(),
      prisma.employee.count({ where: { status: 'ACTIVE' } }),
    ]);
    expect(res.body.total).toBe(total);
    expect(res.body.active).toBe(active);
    expect(res.body.total).toBeGreaterThanOrEqual(16);

    const departments = res.body.byDepartment.map((row: { department: string }) => row.department);
    expect(departments).toEqual(expect.arrayContaining(['Engineering', 'Finance', 'HR', 'Marketing', 'Sales']));
  });

  it('MANAGER sees self + direct reports only', async () => {
    const res = await stats(await loginAs('manager'));
    expect(res.status).toBe(200);
    expectInternallyConsistent(res.body);

    const scope = { OR: [{ id: SEED.manager.employeeId }, { managerId: SEED.manager.employeeId }] };
    const [total, active] = await Promise.all([
      prisma.employee.count({ where: scope }),
      prisma.employee.count({ where: { AND: [scope, { status: 'ACTIVE' }] } }),
    ]);
    expect(res.body.total).toBe(total);
    expect(res.body.active).toBe(active);
    expect(res.body.total).toBeGreaterThanOrEqual(3);

    expect(res.body.byDepartment).toEqual([{ department: 'Engineering', count: total }]);
  });

  it('EMPLOYEE sees exactly themself', async () => {
    const res = await stats(await loginAs('employee1'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      total: 1,
      active: 1,
      inactive: 0,
      byDepartment: [{ department: 'Engineering', count: 1 }],
    });
  });

  it('EMPLOYEE in another department sees only their own department', async () => {
    const res = await stats(await loginAs('employee3'));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.byDepartment).toEqual([{ department: 'Finance', count: 1 }]);
  });

  it('a MANAGER’s numbers never include an employee outside the team', async () => {
    const res = await stats(await loginAs('manager'));
    const departments = res.body.byDepartment.map((row: { department: string }) => row.department);
    expect(departments).not.toContain('Finance');
  });
});
