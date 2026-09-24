import type { EmploymentStatus, Prisma, Role } from '@prisma/client';

/**
 * The one Prisma `select` used for every employee read. Explicit so that a new
 * column (or `passwordHash`, ever) cannot leak by default (CLAUDE.md rule 8).
 */
export const employeeSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  department: true,
  designation: true,
  joiningDate: true,
  status: true,
  managerId: true,
  createdAt: true,
  updatedAt: true,
  manager: { select: { id: true, firstName: true, lastName: true } },
  user: { select: { role: true, isActive: true } },
} satisfies Prisma.EmployeeSelect;

export type EmployeeRow = Prisma.EmployeeGetPayload<{ select: typeof employeeSelect }>;

export interface EmployeeDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  department: string;
  designation: string;
  /** Calendar date, `YYYY-MM-DD`. */
  joiningDate: string;
  status: EmploymentStatus;
  /** From the linked User (D-003). Null only for a row with no login, which the seed never creates. */
  role: Role | null;
  managerId: string | null;
  manager: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export function toEmployeeDto(row: EmployeeRow): EmployeeDto {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    department: row.department,
    designation: row.designation,
    joiningDate: row.joiningDate.toISOString().slice(0, 10),
    status: row.status,
    role: row.user?.role ?? null,
    managerId: row.managerId,
    manager: row.manager
      ? { id: row.manager.id, name: `${row.manager.firstName} ${row.manager.lastName}` }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
