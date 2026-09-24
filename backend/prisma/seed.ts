/**
 * Seed data for development and tests.
 *
 * Five login accounts (password `Password@123`) plus eleven non-login employees
 * (16 rows, EMP000–EMP015) so the dashboard and filters have something to show.
 * Every Employee gets a User (D-003); the non-login ones get an unpublished
 * random password.
 *
 * Idempotent: employees upsert on `id`, users upsert on `email`. Re-running
 * resets the five known passwords and re-links managers, so a broken dev DB is
 * one `npx prisma db seed` away from the documented state.
 *
 * Reporting lines matter for the authorization tests — do not change them
 * without updating tests/authorization.test.ts and docs/AUTHORIZATION.md:
 *   EMP010 (manager@) manages exactly EMP001 and EMP002.
 *   EMP003 reports to EMP000 and is therefore OUTSIDE manager@'s team.
 */
import { randomBytes } from 'node:crypto';
import { EmploymentStatus, PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export const SEED_PASSWORD = 'Password@123';
const SALT_ROUNDS = 12;

interface SeedEmployee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  department: string;
  designation: string;
  joiningDate: string; // YYYY-MM-DD
  status: EmploymentStatus;
  managerId: string | null;
  role: Role;
  /** Only the five documented accounts have a known password. */
  login: boolean;
}

// Ordered so that every managerId refers to a row created earlier in the list.
const EMPLOYEES: SeedEmployee[] = [
  // --- Login accounts (docs/spec.md §8, CLAUDE.md "Seed users") ------------
  {
    id: 'EMP000', firstName: 'Asha', lastName: 'Menon', email: 'admin@company.com',
    phone: '+91-98450-00000', department: 'HR', designation: 'Head of People',
    joiningDate: '2019-04-01', status: EmploymentStatus.ACTIVE, managerId: null,
    role: Role.ADMIN, login: true,
  },
  {
    id: 'EMP010', firstName: 'Rahul', lastName: 'Verma', email: 'manager@company.com',
    phone: '+91-98450-00010', department: 'Engineering', designation: 'Engineering Manager',
    joiningDate: '2020-07-01', status: EmploymentStatus.ACTIVE, managerId: 'EMP000',
    role: Role.MANAGER, login: true,
  },
  {
    id: 'EMP001', firstName: 'Neha', lastName: 'Kulkarni', email: 'employee1@company.com',
    phone: '+91-98450-00001', department: 'Engineering', designation: 'Software Engineer',
    joiningDate: '2022-01-10', status: EmploymentStatus.ACTIVE, managerId: 'EMP010',
    role: Role.EMPLOYEE, login: true,
  },
  {
    id: 'EMP002', firstName: 'Arjun', lastName: 'Iyer', email: 'employee2@company.com',
    phone: '+91-98450-00002', department: 'Engineering', designation: 'Software Engineer',
    joiningDate: '2022-03-14', status: EmploymentStatus.ACTIVE, managerId: 'EMP010',
    role: Role.EMPLOYEE, login: true,
  },
  {
    id: 'EMP003', firstName: 'Priya', lastName: 'Nair', email: 'employee3@company.com',
    phone: '+91-98450-00003', department: 'Finance', designation: 'Financial Analyst',
    joiningDate: '2021-11-01', status: EmploymentStatus.ACTIVE, managerId: 'EMP000',
    role: Role.EMPLOYEE, login: true,
  },

  // --- Non-login employees --------------------------------------------------
  {
    id: 'EMP011', firstName: 'Kavya', lastName: 'Reddy', email: 'kavya.reddy@company.com',
    phone: '+91-98450-00011', department: 'Sales', designation: 'Sales Manager',
    joiningDate: '2020-02-17', status: EmploymentStatus.ACTIVE, managerId: 'EMP000',
    role: Role.MANAGER, login: false,
  },
  {
    id: 'EMP004', firstName: 'Vikram', lastName: 'Singh', email: 'vikram.singh@company.com',
    phone: '+91-98450-00004', department: 'Sales', designation: 'Account Executive',
    joiningDate: '2021-06-21', status: EmploymentStatus.ACTIVE, managerId: 'EMP011',
    role: Role.EMPLOYEE, login: false,
  },
  {
    id: 'EMP005', firstName: 'Sneha', lastName: 'Patel', email: 'sneha.patel@company.com',
    phone: '+91-98450-00005', department: 'Sales', designation: 'Account Executive',
    joiningDate: '2022-08-08', status: EmploymentStatus.ACTIVE, managerId: 'EMP011',
    role: Role.EMPLOYEE, login: false,
  },
  {
    id: 'EMP006', firstName: 'Rohan', lastName: 'Desai', email: 'rohan.desai@company.com',
    phone: null, department: 'Marketing', designation: 'Marketing Lead',
    joiningDate: '2020-10-05', status: EmploymentStatus.ACTIVE, managerId: 'EMP000',
    role: Role.EMPLOYEE, login: false,
  },
  {
    id: 'EMP007', firstName: 'Ananya', lastName: 'Bose', email: 'ananya.bose@company.com',
    phone: '+91-98450-00007', department: 'Marketing', designation: 'Content Strategist',
    joiningDate: '2023-01-16', status: EmploymentStatus.ACTIVE, managerId: 'EMP006',
    role: Role.EMPLOYEE, login: false,
  },
  {
    id: 'EMP008', firstName: 'Karthik', lastName: 'Rao', email: 'karthik.rao@company.com',
    phone: '+91-98450-00008', department: 'Finance', designation: 'Senior Accountant',
    joiningDate: '2018-09-03', status: EmploymentStatus.ACTIVE, managerId: 'EMP000',
    role: Role.EMPLOYEE, login: false,
  },
  {
    id: 'EMP009', firstName: 'Meera', lastName: 'Joshi', email: 'meera.joshi@company.com',
    phone: '+91-98450-00009', department: 'HR', designation: 'HR Business Partner',
    joiningDate: '2021-02-01', status: EmploymentStatus.ACTIVE, managerId: 'EMP000',
    role: Role.EMPLOYEE, login: false,
  },
  {
    id: 'EMP012', firstName: 'Aditya', lastName: 'Kumar', email: 'aditya.kumar@company.com',
    phone: '+91-98450-00012', department: 'Engineering', designation: 'DevOps Engineer',
    joiningDate: '2019-12-09', status: EmploymentStatus.INACTIVE, managerId: 'EMP000',
    role: Role.EMPLOYEE, login: false,
  },
  {
    id: 'EMP013', firstName: 'Divya', lastName: 'Sharma', email: 'divya.sharma@company.com',
    phone: null, department: 'Sales', designation: 'Sales Development Rep',
    joiningDate: '2023-05-22', status: EmploymentStatus.INACTIVE, managerId: 'EMP011',
    role: Role.EMPLOYEE, login: false,
  },
  {
    id: 'EMP014', firstName: 'Sanjay', lastName: 'Gupta', email: 'sanjay.gupta@company.com',
    phone: '+91-98450-00014', department: 'Finance', designation: 'Payroll Specialist',
    joiningDate: '2022-11-14', status: EmploymentStatus.ACTIVE, managerId: 'EMP008',
    role: Role.EMPLOYEE, login: false,
  },
  {
    id: 'EMP015', firstName: 'Lakshmi', lastName: 'Pillai', email: 'lakshmi.pillai@company.com',
    phone: '+91-98450-00015', department: 'Marketing', designation: 'Designer',
    joiningDate: '2024-02-05', status: EmploymentStatus.ACTIVE, managerId: 'EMP006',
    role: Role.EMPLOYEE, login: false,
  },
];

/**
 * Hosted Postgres occasionally refuses the first connection right after a
 * schema reset (seen on Supabase when the test runner pushes then seeds within
 * seconds). A few bounded retries keep `npm test` from failing on that alone.
 */
async function connectWithRetry(attempts = 5, delayMs = 2000): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await prisma.$connect();
      return;
    } catch (error) {
      if (attempt >= attempts) throw error;
      console.warn(`Database not reachable (attempt ${attempt}/${attempts}); retrying in ${delayMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function main(): Promise<void> {
  await connectWithRetry();
  const knownHash = await bcrypt.hash(SEED_PASSWORD, SALT_ROUNDS);

  for (const row of EMPLOYEES) {
    const { role, login, joiningDate, ...employee } = row;

    await prisma.employee.upsert({
      where: { id: employee.id },
      create: { ...employee, joiningDate: new Date(joiningDate) },
      update: { ...employee, joiningDate: new Date(joiningDate) },
    });

    // Non-login accounts get a fresh random secret on every seed. Nobody knows
    // it, which is the point: the row exists so the employee has a role.
    const passwordHash = login
      ? knownHash
      : await bcrypt.hash(randomBytes(24).toString('base64url'), SALT_ROUNDS);

    await prisma.user.upsert({
      where: { email: employee.email },
      create: {
        email: employee.email,
        passwordHash,
        role,
        employeeId: employee.id,
        isActive: employee.status === EmploymentStatus.ACTIVE,
      },
      update: {
        passwordHash,
        role,
        employeeId: employee.id,
        isActive: employee.status === EmploymentStatus.ACTIVE,
      },
    });
  }

  const [employees, users] = await Promise.all([prisma.employee.count(), prisma.user.count()]);

  console.log(`Seed complete: ${employees} employees, ${users} users.`);
  console.log('Login accounts (password: %s):', SEED_PASSWORD);
  for (const row of EMPLOYEES.filter((e) => e.login)) {
    console.log(`  ${row.email.padEnd(24)} ${row.role.padEnd(9)} ${row.id}  reports to ${row.managerId ?? '—'}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
