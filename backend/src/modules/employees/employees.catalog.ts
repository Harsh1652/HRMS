export const DESIGNATIONS_BY_DEPARTMENT = {
  Engineering: ['Engineering Manager', 'Senior Software Engineer', 'Software Engineer', 'DevOps Engineer', 'QA Engineer'],
  Finance: ['Finance Manager', 'Senior Accountant', 'Financial Analyst', 'Payroll Specialist'],
  HR: ['Head of People', 'HR Business Partner', 'HR Executive', 'Recruiter'],
  Marketing: ['Marketing Lead', 'Content Strategist', 'Designer', 'Copywriter'],
  Sales: ['Sales Manager', 'Account Executive', 'Sales Development Rep'],
} as const;

export type Department = keyof typeof DESIGNATIONS_BY_DEPARTMENT;

export const DEPARTMENTS = Object.keys(DESIGNATIONS_BY_DEPARTMENT) as [Department, ...Department[]];

export const DESIGNATIONS = [...new Set(Object.values(DESIGNATIONS_BY_DEPARTMENT).flat())] as [string, ...string[]];

export function isDesignationIn(department: string, designation: string): boolean {
  const list: readonly string[] | undefined = DESIGNATIONS_BY_DEPARTMENT[department as Department];
  return list?.includes(designation) ?? false;
}
