import type { AuthUser, Employee } from '../types/api';

// Mirrors updatableFields in backend/src/policies/employeePolicy.ts, for display only.
// The API re-checks every request, so any drift shows up as a 403, not a silent success.
export const ALL_FIELDS = ['firstName', 'lastName', 'email', 'phone', 'department', 'designation', 'joiningDate', 'managerId', 'role', 'status'] as const;
export type EditableField = (typeof ALL_FIELDS)[number];

export function editableFieldsFor(actor: AuthUser, target: Pick<Employee, 'id' | 'managerId'>): Set<EditableField> {
  const isSelf = target.id === actor.employeeId;
  const isDirectReport = target.managerId !== null && target.managerId === actor.employeeId;

  switch (actor.role) {
    case 'ADMIN':
      return new Set(ALL_FIELDS);
    case 'MANAGER':
      if (isSelf) return new Set<EditableField>(['phone']);
      if (isDirectReport) return new Set<EditableField>(['designation', 'department']);
      return new Set();
    case 'EMPLOYEE':
      return isSelf ? new Set<EditableField>(['phone']) : new Set();
  }
}
