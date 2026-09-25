import type { Role } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { verifyPassword } from '../../utils/password';
import { getTokenLifetimeSeconds, signAccessToken } from '../../utils/jwt';
import { UnauthorizedError } from '../../utils/AppError';
import type { LoginInput } from './auth.schemas';

export interface LoginResult {
  token: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    role: Role;
    employeeId: string;
    name: string;
  };
}

/**
 * Bcrypt hash of a random string. Unknown emails are still compared against it
 * so response timing doesn't reveal whether an account exists.
 */
const HASH = '$2b$12$Rszk84Gdbqhxg3hLnZtRMOLnCvdQVU2f9RenZ8nI1FXcFzcj6B/9u';

const INVALID = 'Invalid email or password';

export async function login(input: LoginInput): Promise<LoginResult> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      role: true,
      isActive: true,
      employeeId: true,
      employee: { select: { firstName: true, lastName: true } },
    },
  });

  const passwordMatches = await verifyPassword(input.password, user?.passwordHash ?? HASH);
  if (!user || !passwordMatches) {
    throw new UnauthorizedError(INVALID);
  }

  // Checked after the password so only the owner learns the account is deactivated.
  if (!user.isActive) {
    throw new UnauthorizedError('This account has been deactivated');
  }

  const token = signAccessToken({ sub: user.id, employeeId: user.employeeId, role: user.role });

  return {
    token,
    expiresIn: getTokenLifetimeSeconds(token),
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
      name: `${user.employee.firstName} ${user.employee.lastName}`,
    },
  };
}
