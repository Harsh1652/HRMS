import { EmploymentStatus, type Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { hashPassword } from '../../utils/password';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../utils/AppError';
import type { AuthenticatedUser } from '../../middleware/authenticate';
import {
  canCreate,
  canDelete,
  canView,
  discloseMissing,
  scopeWhere,
  updatableFields,
  type UpdatableField,
} from '../../policies/employeePolicy';
import { employeeSelect, toEmployeeDto, type EmployeeDto, type EmployeeRow } from './employees.dto';
import type { CreateEmployeeInput, ListQuery, UpdateEmployeeInput } from './employees.schemas';

export interface EmployeeListResult {
  items: EmployeeDto[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

/** Filters are AND-ed with `scopeWhere`, so they can narrow the caller's view but never widen it. */
export async function list(actor: AuthenticatedUser, query: ListQuery): Promise<EmployeeListResult> {
  const filters: Prisma.EmployeeWhereInput[] = [];

  if (query.department) filters.push({ department: query.department });
  if (query.status) filters.push({ status: query.status });
  if (query.search) {
    filters.push({
      OR: [
        { id: { contains: query.search, mode: 'insensitive' } },
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ],
    });
  }

  const where: Prisma.EmployeeWhereInput = { AND: [scopeWhere(actor), ...filters] };

  const [total, rows] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      select: employeeSelect,
      orderBy: [{ id: 'asc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return {
    items: rows.map(toEmployeeDto),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

/**
 * Loads a target row for any read, update or delete. On a miss, `discloseMissing`
 * picks 404 or 403. The `canView` check is redundant with the scoped query but
 * keeps the rule visible here.
 */
async function findScoped(actor: AuthenticatedUser, id: string): Promise<EmployeeRow> {
  const row = await prisma.employee.findFirst({
    where: { id, AND: [scopeWhere(actor)] },
    select: employeeSelect,
  });

  if (!row) {
    if (discloseMissing(actor)) throw new NotFoundError('Employee');
    throw new ForbiddenError();
  }

  if (!canView(actor, row)) throw new ForbiddenError();

  return row;
}

export async function getById(actor: AuthenticatedUser, id: string): Promise<EmployeeDto> {
  return toEmployeeDto(await findScoped(actor, id));
}

export function me(actor: AuthenticatedUser): Promise<EmployeeDto> {
  return getById(actor, actor.employeeId);
}

async function assertValidManager(employeeId: string | null, managerId: string): Promise<void> {
  if (employeeId !== null && managerId === employeeId) {
    throw new BadRequestError('An employee cannot be their own manager', [
      { path: 'managerId', message: 'Cannot equal the employee id' },
    ]);
  }

  const manager = await prisma.employee.findUnique({
    where: { id: managerId },
    select: { id: true, managerId: true },
  });
  if (!manager) {
    throw new BadRequestError('managerId does not refer to an existing employee', [
      { path: 'managerId', message: `No employee with id ${managerId}` },
    ]);
  }

  if (employeeId === null) return;

  const MAX_DEPTH = 32;
  let cursor: string | null = manager.managerId;
  for (let depth = 0; cursor !== null && depth < MAX_DEPTH; depth += 1) {
    if (cursor === employeeId) {
      throw new BadRequestError('That manager already reports to this employee — the reporting line would loop', [
        { path: 'managerId', message: 'Creates a reporting cycle' },
      ]);
    }
    const next: { managerId: string | null } | null = await prisma.employee.findUnique({
      where: { id: cursor },
      select: { managerId: true },
    });
    cursor = next?.managerId ?? null;
  }
}

export async function create(actor: AuthenticatedUser, input: CreateEmployeeInput): Promise<EmployeeDto> {
  if (!canCreate(actor)) throw new ForbiddenError('Only an administrator can create employees');

  if (input.managerId) await assertValidManager(null, input.managerId);

  const passwordHash = await hashPassword(input.password);

  const row = await prisma.$transaction(async (tx) => {
    const seq = await tx.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('employee_id_seq')`;
    const nextval = seq[0]?.nextval;
    if (nextval === undefined) {
      throw new Error('employee_id_seq returned no value');
    }
    const id = `EMP${String(nextval).padStart(3, '0')}`;

    await tx.employee.create({
      data: {
        id,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone ?? null,
        department: input.department,
        designation: input.designation,
        joiningDate: new Date(`${input.joiningDate}T00:00:00Z`),
        status: input.status,
        managerId: input.managerId ?? null,
      },
    });

    await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        role: input.role,
        employeeId: id,
        isActive: input.status === EmploymentStatus.ACTIVE,
      },
    });

    return tx.employee.findUniqueOrThrow({ where: { id }, select: employeeSelect });
  });

  return toEmployeeDto(row);
}

/**
 * Mass-assignment guard: load the target through the scoped path, reject the
 * whole request with 403 if any key is outside `updatableFields`, then build
 * `data` field by field so the request body never reaches Prisma. Login fields
 * (`email`, `role`, `status`) are updated on the User row in the same transaction.
 */
export async function update(
  actor: AuthenticatedUser,
  id: string,
  input: UpdateEmployeeInput,
): Promise<EmployeeDto> {
  const target = await findScoped(actor, id);

  const allowed = updatableFields(actor, target);
  const submitted = Object.keys(input) as UpdatableField[];
  const denied = submitted.filter((field) => !allowed.has(field));

  if (denied.length > 0) {
    throw new ForbiddenError(
      `You are not permitted to update: ${denied.join(', ')}`,
      denied.map((field) => ({ path: field, message: 'Not permitted for your role' })),
    );
  }

  if (input.managerId) await assertValidManager(id, input.managerId);

  const employeeData: Prisma.EmployeeUpdateInput = {};
  if (input.firstName !== undefined) employeeData.firstName = input.firstName;
  if (input.lastName !== undefined) employeeData.lastName = input.lastName;
  if (input.email !== undefined) employeeData.email = input.email;
  if (input.phone !== undefined) employeeData.phone = input.phone;
  if (input.department !== undefined) employeeData.department = input.department;
  if (input.designation !== undefined) employeeData.designation = input.designation;
  if (input.joiningDate !== undefined) employeeData.joiningDate = new Date(`${input.joiningDate}T00:00:00Z`);
  if (input.status !== undefined) employeeData.status = input.status;
  if (input.managerId !== undefined) {
    employeeData.manager = input.managerId ? { connect: { id: input.managerId } } : { disconnect: true };
  }

  const userData: Prisma.UserUpdateManyMutationInput = {};
  if (input.email !== undefined) userData.email = input.email;
  if (input.role) userData.role = input.role;
  if (input.status !== undefined) userData.isActive = input.status === EmploymentStatus.ACTIVE;

  const row = await prisma.$transaction(async (tx) => {
    if (Object.keys(employeeData).length > 0) {
      await tx.employee.update({ where: { id }, data: employeeData });
    }
    if (Object.keys(userData).length > 0) {
      await tx.user.updateMany({ where: { employeeId: id }, data: userData });
    }
    return tx.employee.findUniqueOrThrow({ where: { id }, select: employeeSelect });
  });

  return toEmployeeDto(row);
}

/** Soft delete. `authenticate` re-reads `isActive`, so the user's token stops working immediately. */
export async function softDelete(actor: AuthenticatedUser, id: string): Promise<void> {
  if (!canDelete(actor)) throw new ForbiddenError('Only an administrator can deactivate employees');

  await findScoped(actor, id);

  // Business rule: stops the last admin from locking everyone out.
  if (id === actor.employeeId) {
    throw new BadRequestError('You cannot deactivate your own account');
  }

  await prisma.$transaction([
    prisma.employee.update({ where: { id }, data: { status: EmploymentStatus.INACTIVE } }),
    prisma.user.updateMany({ where: { employeeId: id }, data: { isActive: false } }),
  ]);
}
