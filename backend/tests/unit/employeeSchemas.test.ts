import { Role } from '@prisma/client';
import { createEmployeeSchema, updateEmployeeSchema } from '../../src/modules/employees/employees.schemas';
import { DESIGNATIONS_BY_DEPARTMENT } from '../../src/modules/employees/employees.catalog';
import { assertDesignationFits, assertHasManager } from '../../src/modules/employees/employees.rules';

const validCreate = {
  firstName: 'Ravi',
  lastName: 'Menon',
  email: 'ravi.menon@company.com',
  department: 'Engineering',
  designation: 'Software Engineer',
  joiningDate: '2026-09-01',
  password: 'Welcome@12345',
};

describe('phone validation', () => {
  it.each(['9845000001', ' 9845000001 '])('accepts 10 digits (%j)', (phone) => {
    expect(updateEmployeeSchema.safeParse({ phone }).success).toBe(true);
    expect(createEmployeeSchema.safeParse({ ...validCreate, phone }).success).toBe(true);
  });

  it.each([
    ['letters', '98450abcde'],
    ['more than 10 digits', '98450000011'],
    ['fewer than 10 digits', '984500000'],
    ['country code and dashes', '+91-98450-00001'],
    ['spaces inside', '98450 00001'],
    ['empty string', ''],
  ])('rejects %s', (_label, phone) => {
    const update = updateEmployeeSchema.safeParse({ phone });
    expect(update.success).toBe(false);
    expect(update.error?.issues[0]?.path).toEqual(['phone']);
    expect(createEmployeeSchema.safeParse({ ...validCreate, phone }).success).toBe(false);
  });

  it('allows clearing the phone with null, or leaving it out on create', () => {
    expect(updateEmployeeSchema.safeParse({ phone: null }).success).toBe(true);
    expect(createEmployeeSchema.safeParse(validCreate).success).toBe(true);
  });
});

describe('name validation', () => {
  it.each(['Neha', 'De Souza', 'Mary-Jane', "O'Brien"])('accepts %j', (firstName) => {
    expect(updateEmployeeSchema.safeParse({ firstName }).success).toBe(true);
  });

  it.each(['Neha1', 'Inc)', 'a_b', 'Neha  Rao', '-Neha', '123'])('rejects %j', (lastName) => {
    const res = updateEmployeeSchema.safeParse({ lastName });
    expect(res.success).toBe(false);
    expect(res.error?.issues[0]?.path).toEqual(['lastName']);
  });
});

describe('department and designation', () => {
  it('accepts only the fixed departments and designations', () => {
    expect(updateEmployeeSchema.safeParse({ department: 'Finance' }).success).toBe(true);
    expect(updateEmployeeSchema.safeParse({ department: 'dfgh' }).success).toBe(false);
    expect(updateEmployeeSchema.safeParse({ designation: 'cvb' }).success).toBe(false);
  });

  it('accepts every pairing in the catalog', () => {
    for (const [department, designations] of Object.entries(DESIGNATIONS_BY_DEPARTMENT)) {
      for (const designation of designations) expect(() => assertDesignationFits(department, designation)).not.toThrow();
    }
  });

  it('rejects a designation from another department, naming the field', () => {
    expect(() => assertDesignationFits('Finance', 'Software Engineer')).toThrow(
      expect.objectContaining({ status: 400, details: [expect.objectContaining({ path: 'designation' })] }),
    );
  });
});

describe('manager requirement', () => {
  it('lets only ADMIN have no manager', () => {
    expect(() => assertHasManager(Role.ADMIN, null)).not.toThrow();
    expect(() => assertHasManager(Role.EMPLOYEE, 'EMP010')).not.toThrow();
    for (const role of [Role.EMPLOYEE, Role.MANAGER]) {
      expect(() => assertHasManager(role, null)).toThrow(
        expect.objectContaining({ status: 400, details: [expect.objectContaining({ path: 'managerId' })] }),
      );
    }
  });
});
