/**
 * The five documented login accounts, as seeded by prisma/seed.ts. Tests refer to
 * these by name so a change to the seed shows up as a compile error here rather
 * than as a mysterious 401.
 */
export const SEED_PASSWORD = 'Password@123';

export const SEED = {
  admin: { email: 'admin@company.com', employeeId: 'EMP000', role: 'ADMIN' },
  manager: { email: 'manager@company.com', employeeId: 'EMP010', role: 'MANAGER' },
  employee1: { email: 'employee1@company.com', employeeId: 'EMP001', role: 'EMPLOYEE' },
  employee2: { email: 'employee2@company.com', employeeId: 'EMP002', role: 'EMPLOYEE' },
  employee3: { email: 'employee3@company.com', employeeId: 'EMP003', role: 'EMPLOYEE' },
} as const;

export type SeedUserKey = keyof typeof SEED;

/** Ids that exist in the seed but belong to no login account. */
export const NON_LOGIN_EMPLOYEE_ID = 'EMP004';
/** An id that the seed never creates and the sequence (start 100) never reaches soon. */
export const NONEXISTENT_EMPLOYEE_ID = 'EMP999';
