import { EmploymentStatus } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import type { AuthenticatedUser } from '../../middleware/authenticate';
import { scopeWhere } from '../../policies/employeePolicy';

export interface DashboardStats {
  total: number;
  active: number;
  inactive: number;
  byDepartment: { department: string; count: number }[];
}

/**
 * Headline numbers for the dashboard, scoped to what the caller may see
 * (CLAUDE.md rule 5): every count and the grouping carry `scopeWhere(actor)`
 * inside the query. An EMPLOYEE therefore sees 1 / 1 / their own department;
 * a MANAGER sees their team; ADMIN sees the company.
 */
export async function stats(actor: AuthenticatedUser): Promise<DashboardStats> {
  const scope = scopeWhere(actor);

  const [total, active, groups] = await Promise.all([
    prisma.employee.count({ where: scope }),
    prisma.employee.count({ where: { AND: [scope, { status: EmploymentStatus.ACTIVE }] } }),
    prisma.employee.groupBy({
      by: ['department'],
      where: scope,
      _count: { _all: true },
      orderBy: { department: 'asc' },
    }),
  ]);

  return {
    total,
    active,
    inactive: total - active,
    byDepartment: groups.map((group) => ({ department: group.department, count: group._count._all })),
  };
}
