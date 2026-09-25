import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../config/env';

export interface AccessTokenPayload {
  sub: string;
  employeeId: string;
  role: Role;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function getTokenLifetimeSeconds(token: string): number {
  const decoded = jwt.decode(token);
  if (typeof decoded !== 'object' || decoded === null || !decoded.exp || !decoded.iat) {
    throw new Error('Token is missing exp/iat claims');
  }
  return decoded.exp - decoded.iat;
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded !== 'object' || decoded === null) {
    throw new jwt.JsonWebTokenError('Unexpected token payload');
  }
  const { sub, employeeId, role } = decoded as Record<string, unknown>;
  if (typeof sub !== 'string' || typeof employeeId !== 'string' || typeof role !== 'string') {
    throw new jwt.JsonWebTokenError('Token payload is missing required claims');
  }
  return { sub, employeeId, role: role as Role };
}
