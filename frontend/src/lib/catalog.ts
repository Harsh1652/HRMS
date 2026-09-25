// Same lists as backend/src/modules/employees/employees.catalog.ts; the API rejects anything else.
export const DESIGNATIONS_BY_DEPARTMENT: Record<string, readonly string[]> = {
  Engineering: ['Engineering Manager', 'Senior Software Engineer', 'Software Engineer', 'DevOps Engineer', 'QA Engineer'],
  Finance: ['Finance Manager', 'Senior Accountant', 'Financial Analyst', 'Payroll Specialist'],
  HR: ['Head of People', 'HR Business Partner', 'HR Executive', 'Recruiter'],
  Marketing: ['Marketing Lead', 'Content Strategist', 'Designer', 'Copywriter'],
  Sales: ['Sales Manager', 'Account Executive', 'Sales Development Rep'],
};

export const DEPARTMENTS = Object.keys(DESIGNATIONS_BY_DEPARTMENT);

export const FIELD_LABELS: Record<string, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  email: 'Email',
  phone: 'Phone',
  department: 'Department',
  designation: 'Designation',
  joiningDate: 'Joining date',
  managerId: 'Manager',
  role: 'Role',
  status: 'Status',
  password: 'Password',
};
