/**
 * Exhaustive branch coverage of the authorization policy. No database, no env:
 * this file must run anywhere `npm run test:unit` is typed.
 */
import { Role } from '@prisma/client';
import {
  UPDATABLE_FIELDS,
  canCreate,
  canDelete,
  canView,
  discloseMissing,
  scopeWhere,
  updatableFields,
  type Actor,
  type Target,
} from '../../src/policies/employeePolicy';

const admin: Actor = { employeeId: 'EMP000', role: Role.ADMIN };
const manager: Actor = { employeeId: 'EMP010', role: Role.MANAGER };
const employee: Actor = { employeeId: 'EMP001', role: Role.EMPLOYEE };

const self = (actor: Actor): Target => ({ id: actor.employeeId, managerId: 'EMP000' });
const reportOf = (actor: Actor): Target => ({ id: 'EMP555', managerId: actor.employeeId });
const stranger: Target = { id: 'EMP003', managerId: 'EMP000' };
const orphan: Target = { id: 'EMP777', managerId: null };
/** Two levels down: reports to someone who reports to the manager. */
const skipLevelReport: Target = { id: 'EMP888', managerId: 'EMP555' };

const fields = (set: ReadonlySet<string>) => [...set].sort();

describe('canView', () => {
  describe('ADMIN', () => {
    it.each([self(admin), stranger, orphan, reportOf(manager)])('sees %o', (target) => {
      expect(canView(admin, target)).toBe(true);
    });
  });

  describe('MANAGER', () => {
    it('sees self', () => expect(canView(manager, self(manager))).toBe(true));
    it('sees a direct report', () => expect(canView(manager, reportOf(manager))).toBe(true));
    it('does not see an employee outside the team', () => expect(canView(manager, stranger)).toBe(false));
    it('does not see an employee with no manager', () => expect(canView(manager, orphan)).toBe(false));
    it('does not see a skip-level report (one level only)', () =>
      expect(canView(manager, skipLevelReport)).toBe(false));
    it('does not see another manager', () =>
      expect(canView(manager, { id: 'EMP011', managerId: 'EMP000' })).toBe(false));
  });

  describe('EMPLOYEE', () => {
    it('sees self', () => expect(canView(employee, self(employee))).toBe(true));
    it('does not see a colleague', () =>
      expect(canView(employee, { id: 'EMP002', managerId: 'EMP010' })).toBe(false));
    it('does not see their own manager', () =>
      expect(canView(employee, { id: 'EMP010', managerId: 'EMP000' })).toBe(false));
    it('does not see someone who happens to report to them (role wins)', () =>
      expect(canView(employee, reportOf(employee))).toBe(false));
  });
});

describe('canCreate / canDelete', () => {
  it('ADMIN may create and delete', () => {
    expect(canCreate(admin)).toBe(true);
    expect(canDelete(admin)).toBe(true);
  });

  it.each([manager, employee])('%o may neither create nor delete', (actor) => {
    expect(canCreate(actor)).toBe(false);
    expect(canDelete(actor)).toBe(false);
  });
});

describe('discloseMissing (D-005: 404 vs 403 on an empty lookup)', () => {
  it('ADMIN may learn an id does not exist (404)', () => expect(discloseMissing(admin)).toBe(true));
  it('MANAGER may not (403, existence undisclosed)', () => expect(discloseMissing(manager)).toBe(false));
  it('EMPLOYEE may not (403, existence undisclosed)', () => expect(discloseMissing(employee)).toBe(false));
});

describe('updatableFields', () => {
  it('ADMIN may update every field on anyone', () => {
    for (const target of [self(admin), stranger, orphan, reportOf(manager)]) {
      expect(fields(updatableFields(admin, target))).toEqual([...UPDATABLE_FIELDS].sort());
    }
  });

  describe('MANAGER', () => {
    it('may update only phone on self', () =>
      expect(fields(updatableFields(manager, self(manager)))).toEqual(['phone']));
    it('may update designation and department on a direct report', () =>
      expect(fields(updatableFields(manager, reportOf(manager)))).toEqual(['department', 'designation']));
    it("may NOT update a direct report's phone, role, status, managerId or email", () => {
      const allowed = updatableFields(manager, reportOf(manager));
      for (const field of ['phone', 'role', 'status', 'managerId', 'email', 'firstName', 'lastName', 'joiningDate'] as const) {
        expect(allowed.has(field)).toBe(false);
      }
    });
    it('may update nothing on an employee outside the team', () =>
      expect(updatableFields(manager, stranger).size).toBe(0));
    it('may update nothing on a skip-level report', () =>
      expect(updatableFields(manager, skipLevelReport).size).toBe(0));
  });

  describe('EMPLOYEE', () => {
    it('may update only phone on self', () =>
      expect(fields(updatableFields(employee, self(employee)))).toEqual(['phone']));
    it('may NOT update own role, managerId, status, email or department', () => {
      const allowed = updatableFields(employee, self(employee));
      for (const field of ['role', 'managerId', 'status', 'email', 'department', 'designation'] as const) {
        expect(allowed.has(field)).toBe(false);
      }
    });
    it('may update nothing on anyone else', () => {
      expect(updatableFields(employee, stranger).size).toBe(0);
      expect(updatableFields(employee, reportOf(employee)).size).toBe(0);
    });
  });

  it('mutating a returned set cannot change the policy for later calls', () => {
    const first = updatableFields(employee, self(employee)) as Set<string>;
    first.add('role');
    first.add('status');

    const second = updatableFields(employee, self(employee));
    expect(fields(second)).toEqual(['phone']);
    expect(second).not.toBe(first);
  });
});

describe('scopeWhere', () => {
  it('ADMIN is unscoped', () => expect(scopeWhere(admin)).toEqual({}));

  it('MANAGER is scoped to self OR direct reports', () =>
    expect(scopeWhere(manager)).toEqual({
      OR: [{ id: 'EMP010' }, { managerId: 'EMP010' }],
    }));

  it('EMPLOYEE is scoped to self only', () => expect(scopeWhere(employee)).toEqual({ id: 'EMP001' }));

  it('uses the actor id from the token, never a caller-supplied one', () => {
    // The function signature makes this structural: there is no parameter for a
    // requested id. This test exists so the property is stated, not assumed.
    expect(scopeWhere.length).toBe(1);
  });
});
