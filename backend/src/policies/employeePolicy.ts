import { Role, type Prisma } from '@prisma/client';

/**
 * Every authorization decision in the API is made here and only here.
 *
 * These are pure functions over two small shapes — the caller (from the verified
 * JWT) and the target row — so they can be unit-tested with no database, and so
 * a reviewer can read the whole access model in one file. Nothing else in
 * `src/` is allowed to branch on `role` (CLAUDE.md security rule 3).
 *
 * The rules, in prose (docs/AUTHORIZATION.md must match this file exactly):
 *
 *   ADMIN     sees, creates, updates (any field) and soft-deletes anyone.
 *   MANAGER   sees self and direct reports; updates own phone; updates a direct
 *             report's designation and department; nothing else.
 *   EMPLOYEE  sees self; updates own phone; nothing else.
 *
 * "Direct report" is one level: target.managerId === actor.employeeId.
 */

/** What the policy needs to know about the caller. Always sourced from the JWT. */
export interface Actor {
  employeeId: string;
  role: Role;
}

/** What the policy needs to know about the employee being acted on. */
export interface Target {
  id: string;
  managerId: string | null;
}

/** Every column a PUT may touch. `role` lives on User but is exposed on the Employee DTO. */
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

/** May the actor read this employee's record? */
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

/** May the actor create employees (and their login)? */
export function canCreate(actor: Actor): boolean {
  return actor.role === Role.ADMIN;
}

/** May the actor soft-delete employees? */
export function canDelete(actor: Actor): boolean {
  return actor.role === Role.ADMIN;
}

/**
 * When a lookup finds nothing, may the actor be told the id does not exist?
 *
 * ADMIN can see every row, so an empty result genuinely means "missing" → 404.
 * Anyone else gets 403 whether the id is missing or merely outside their scope,
 * so probing 403-vs-404 cannot map which ids exist (D-005).
 */
export function discloseMissing(actor: Actor): boolean {
  return actor.role === Role.ADMIN;
}

/**
 * Which fields may the actor change on this target? An empty set means the
 * update is forbidden outright. The service rejects the whole request if any
 * submitted key is outside this set — there is no partial application.
 *
 * Returns a fresh Set each call: a caller that mutates the result must not be
 * able to change the policy for every later request.
 */
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

/**
 * The Prisma `where` fragment that limits any list, count or lookup to what the
 * actor may see. Applied inside the database query (CLAUDE.md rule 5) — never
 * as a JavaScript filter over a broader result.
 */
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
