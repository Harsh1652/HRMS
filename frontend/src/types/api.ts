/** Mirrors backend/openapi.yaml. Keep in sync when the contract changes. */

export type Role = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
export type EmploymentStatus = 'ACTIVE' | 'INACTIVE';

export interface ApiError {
  code: 'BAD_REQUEST' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'INTERNAL_ERROR' | string;
  message: string;
  details?: { path: string; message: string }[];
}

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  employeeId: string;
  name: string;
}

export interface LoginResponse {
  token: string;
  expiresIn: number;
  user: AuthUser;
}

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  department: string;
  designation: string;
  /** YYYY-MM-DD */
  joiningDate: string;
  status: EmploymentStatus;
  role: Role | null;
  managerId: string | null;
  manager: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeListResponse {
  items: Employee[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface EmployeeListQuery {
  search?: string;
  department?: string;
  status?: EmploymentStatus;
  page?: number;
  limit?: number;
}

export interface CreateEmployeeInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  department: string;
  designation: string;
  joiningDate: string;
  managerId?: string | null;
  role?: Role;
  status?: EmploymentStatus;
  password: string;
}

export type UpdateEmployeeInput = Partial<Omit<CreateEmployeeInput, 'password'>>;

export interface DashboardStats {
  total: number;
  active: number;
  inactive: number;
  byDepartment: { department: string; count: number }[];
}
