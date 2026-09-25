import { Role, type Prisma } from '@prisma/client';

/**
 * All authorization decisions live here, as pure functions that are easy to
 * unit test. Nothing else should branch on `role`.
 *
 *   ADMIN     sees, creates, updates (any field) and soft-deletes anyone.
 *   MANAGER   sees self and direct reports; updates own phone; updates a direct
 *             report's designation and department; nothing else.
 *   EMPLOYEE  sees self; updates own phone; nothing else.
 *
 * "Direct report" is one level: target.managerId === actor.employeeId.
 */

export interface Actor {
  employeeId: string;
  role: Role;
}

export interface Target {
  id: string;
  managerId: string | null;
}

export const UPDATABLE_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'department',
  'designation',
  'joiningDate',
  'managerId',
  'role',
  'status',
] as const;

export type UpdatableField = (typeof UPDATABLE_FIELDS)[number];

const ALL_FIELDS: ReadonlySet<UpdatableField> = new Set(UPDATABLE_FIELDS);
const PHONE_ONLY: ReadonlySet<UpdatableField> = new Set<UpdatableField>(['phone']);
const TEAM_FIELDS: ReadonlySet<UpdatableField> = new Set<UpdatableField>(['designation', 'department']);
const NOTHING: ReadonlySet<UpdatableField> = new Set();

function isSelf(actor: Actor, target: Target): boolean {
  return target.id === actor.employeeId;
}

function isDirectReport(actor: Actor, target: Target): boolean {
  return target.managerId !== null && target.managerId === actor.employeeId;
}

export function canView(actor: Actor, target: Target): boolean {
  switch (actor.role) {
    case Role.ADMIN:
      return true;
    case Role.MANAGER:
      return isSelf(actor, target) || isDirectReport(actor, target);
    case Role.EMPLOYEE:
      return isSelf(actor, target);
  }
}

export function canCreate(actor: Actor): boolean {
  return actor.role === Role.ADMIN;
}

export function canDelete(actor: Actor): boolean {
  return actor.role === Role.ADMIN;
}

/**
 * Whether a miss may be reported as 404. Only ADMIN sees every row; everyone
 * else gets 403 either way, so they can't probe which ids exist.
 */
export function discloseMissing(actor: Actor): boolean {
  return actor.role === Role.ADMIN;
}

export function updatableFields(actor: Actor, target: Target): ReadonlySet<UpdatableField> {
  switch (actor.role) {
    case Role.ADMIN:
      return new Set(ALL_FIELDS);
    case Role.MANAGER:
      if (isSelf(actor, target)) return new Set(PHONE_ONLY);
      if (isDirectReport(actor, target)) return new Set(TEAM_FIELDS);
      return new Set(NOTHING);
    case Role.EMPLOYEE:
      return isSelf(actor, target) ? new Set(PHONE_ONLY) : new Set(NOTHING);
  }
}

/** Limits any query to what the actor may see. Apply it in the query, not as a filter afterwards. */
export function scopeWhere(actor: Actor): Prisma.EmployeeWhereInput {
  switch (actor.role) {
    case Role.ADMIN:
      return {};
    case Role.MANAGER:
      return { OR: [{ id: actor.employeeId }, { managerId: actor.employeeId }] };
    case Role.EMPLOYEE:
      return { id: actor.employeeId };
  }
}
