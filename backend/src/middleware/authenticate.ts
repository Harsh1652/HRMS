import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { verifyAccessToken } from '../utils/jwt';
import { UnauthorizedError } from '../utils/AppError';

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
 * Requires a valid bearer token for a user who is still active. Re-checking
 * `isActive` costs one lookup per request but makes deactivation take effect
 * immediately instead of when the token expires
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
    // Don't tell the client whether it was expired or malformed.
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

    // Use the DB row, not the token, so role changes apply on the next request.
    req.user = { userId: user.id, employeeId: user.employeeId, role: user.role };
    next();
  } catch (error) {
    next(error);
  }
}

export function requireUser(req: Request): AuthenticatedUser {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}
