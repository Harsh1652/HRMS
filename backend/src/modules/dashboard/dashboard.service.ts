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

export interface RecentJoiner {
  id: string;
  firstName: string;
  lastName: string;
  department: string;
  designation: string;
  joiningDate: string;
}

/**
 * A deliberate, narrow exception to per-role scoping: every signed-in user sees the
 * latest active joiners, but only these directory fields. Contact details, manager,
 * role and status stay behind `scopeWhere`, and full records still need `canView`.
 */
export async function recentJoiners(limit = 5): Promise<RecentJoiner[]> {
  const rows = await prisma.employee.findMany({
    where: { status: EmploymentStatus.ACTIVE },
    select: { id: true, firstName: true, lastName: true, department: true, designation: true, joiningDate: true },
    orderBy: [{ joiningDate: 'desc' }, { id: 'desc' }],
    take: limit,
  });
  return rows.map((row) => ({ ...row, joiningDate: row.joiningDate.toISOString().slice(0, 10) }));
}
