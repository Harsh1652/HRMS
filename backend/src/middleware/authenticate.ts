import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { verifyAccessToken } from '../utils/jwt';
import { UnauthorizedError } from '../utils/AppError';

/** The authenticated caller. Populated only by this middleware, only from the JWT. */
export interface AuthenticatedUser {
  userId: string;
  employeeId: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Rejects the request unless it carries a valid `Authorization: Bearer <token>`
 * for a user who is still active.
 *
 * The `isActive` re-check (CLAUDE.md rule 2) costs one indexed lookup per
 * request and is what makes soft-delete take effect immediately instead of
 * whenever the deactivated user's token happens to expire.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new UnauthorizedError('Missing bearer token'));
    return;
  }

  const token = header.slice('Bearer '.length).trim();

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    // Expired vs malformed is deliberately not distinguished to the client.
    next(new UnauthorizedError('Invalid or expired token'));
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, isActive: true, role: true, employeeId: true },
    });

    if (!user || !user.isActive) {
      next(new UnauthorizedError('Account is inactive'));
      return;
    }

    // Role and employeeId are taken from the database row, not the token, so a
    // role change or re-assignment takes effect on the very next request.
    req.user = { userId: user.id, employeeId: user.employeeId, role: user.role };
    next();
  } catch (error) {
    next(error);
  }
}

/** For handlers that run after `authenticate` and need a non-optional user. */
export function requireUser(req: Request): AuthenticatedUser {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}
