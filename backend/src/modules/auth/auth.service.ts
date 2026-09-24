import type { Role } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { verifyPassword } from '../../utils/password';
import { getTokenLifetimeSeconds, signAccessToken } from '../../utils/jwt';
import { UnauthorizedError } from '../../utils/AppError';
import type { LoginInput } from './auth.schemas';

export interface LoginResult {
  token: string;
  /** Seconds until `token` expires. */
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
 * A real bcrypt hash of a random string. When the email is unknown we still run
 * a compare against it so the response time does not reveal whether the account
 * exists (CLAUDE.md rule 9 covers the message; this covers the timing).
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

  // Same message and roughly the same work for unknown email and wrong password.
  const passwordMatches = await verifyPassword(input.password, user?.passwordHash ?? HASH);
  if (!user || !passwordMatches) {
    throw new UnauthorizedError(INVALID);
  }

  // Only someone who knows the password learns that the account is deactivated.
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
