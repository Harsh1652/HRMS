import { Role } from '@prisma/client';
import { BadRequestError } from '../../utils/AppError';
import { DESIGNATIONS_BY_DEPARTMENT, isDesignationIn, type Department } from './employees.catalog';

export function assertDesignationFits(department: string, designation: string): void {
  if (isDesignationIn(department, designation)) return;
  const options = DESIGNATIONS_BY_DEPARTMENT[department as Department];
  throw new BadRequestError(`${designation} is not a designation in ${department}`, [
    {
      path: 'designation',
      message: options ? `Choose one of: ${options.join(', ')}` : `Unknown department ${department}`,
    },
  ]);
}

// Only the admin role may sit at the top of the org chart.
export function assertHasManager(role: Role, managerId: string | null | undefined): void {
  if (role === Role.ADMIN || managerId) return;
  throw new BadRequestError('Every employee except an admin needs a manager', [
    { path: 'managerId', message: 'Required unless the role is ADMIN' },
  ]);
}
