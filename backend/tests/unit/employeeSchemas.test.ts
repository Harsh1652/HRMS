import { createEmployeeSchema, updateEmployeeSchema } from '../../src/modules/employees/employees.schemas';

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
