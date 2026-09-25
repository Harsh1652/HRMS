import { z } from 'zod';
import { EmploymentStatus, Role } from '@prisma/client';

export const employeeIdSchema = z.string().regex(/^EMP\d{3,}$/, 'Employee id must look like EMP001');

export const idParamSchema = z.object({ id: employeeIdSchema }).strict();

export const listQuerySchema = z
  .object({
    search: z.string().trim().min(1).max(100).optional(),
    department: z.string().trim().min(1).max(100).optional(),
    status: z.nativeEnum(EmploymentStatus).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type ListQuery = z.infer<typeof listQuerySchema>;

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Not a real calendar date');

const name = z.string().trim().min(1).max(80);
const label = z.string().trim().min(1).max(100);
const phone = z.string().trim().regex(/^\d{10}$/, 'Phone must be exactly 10 digits');

export const createEmployeeSchema = z
  .object({
    firstName: name,
    lastName: name,
    email: z.string().trim().toLowerCase().email(),
    phone: phone.nullable().optional(),
    department: label,
    designation: label,
    joiningDate: dateOnly,
    managerId: employeeIdSchema.nullable().optional(),
    role: z.nativeEnum(Role).default('EMPLOYEE'),
    status: z.nativeEnum(EmploymentStatus).default('ACTIVE'),
    password: z.string().min(10, 'Password must be at least 10 characters').max(200),
  })
  .strict();

export const updateEmployeeSchema = z
  .object({
    firstName: name.optional(),
    lastName: name.optional(),
    email: z.string().trim().toLowerCase().email().optional(),
    phone: phone.nullable().optional(),
    department: label.optional(),
    designation: label.optional(),
    joiningDate: dateOnly.optional(),
    managerId: employeeIdSchema.nullable().optional(),
    role: z.nativeEnum(Role).optional(),
    status: z.nativeEnum(EmploymentStatus).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
