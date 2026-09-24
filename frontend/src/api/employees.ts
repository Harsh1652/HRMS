import { api } from './client';
import type {
  CreateEmployeeInput,
  Employee,
  EmployeeListQuery,
  EmployeeListResponse,
  UpdateEmployeeInput,
} from '../types/api';

export async function listEmployees(query: EmployeeListQuery = {}): Promise<EmployeeListResponse> {
  const params = Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== '' && value !== null),
  );
  const { data } = await api.get<EmployeeListResponse>('/employees', { params });
  return data;
}

export async function getEmployee(id: string): Promise<Employee> {
  const { data } = await api.get<{ employee: Employee }>(`/employees/${id}`);
  return data.employee;
}

export async function createEmployee(input: CreateEmployeeInput): Promise<Employee> {
  const { data } = await api.post<{ employee: Employee }>('/employees', input);
  return data.employee;
}

export async function updateEmployee(id: string, input: UpdateEmployeeInput): Promise<Employee> {
  const { data } = await api.put<{ employee: Employee }>(`/employees/${id}`, input);
  return data.employee;
}

export async function deactivateEmployee(id: string): Promise<void> {
  await api.delete(`/employees/${id}`);
}
