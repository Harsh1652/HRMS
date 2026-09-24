import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import {
  AppError,
  BadRequestError,
  ConflictError,
  NotFoundError,
  ServiceUnavailableError,
} from '../utils/AppError';

/** 404 for unmatched routes. Mounted after every real route. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}` },
  });
}

/**
 * Prisma codes that mean "the database is busy or unreachable right now":
 *   P1001 can't reach · P1002 timed out · P1008 operation timeout ·
 *   P1017 server closed the connection · P2024 pool exhausted.
 * These are 503s the client may retry, not 500s to be debugged.
 */
const TRANSIENT_DB_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024']);

/** Maps Prisma's error codes onto the API's own error types. */
function translatePrismaError(error: unknown): AppError | null {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return new ServiceUnavailableError('The database is not reachable right now. Please try again.');
  }
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return null;

  if (TRANSIENT_DB_CODES.has(error.code)) {
    return new ServiceUnavailableError(
      error.code === 'P2024'
        ? 'The server is busy talking to the database. Please try again in a moment.'
        : 'The database is not reachable right now. Please try again.',
    );
  }

  switch (error.code) {
    case 'P2002': {
      const target = error.meta?.target;
      const fields = Array.isArray(target) ? target.join(', ') : String(target ?? 'field');
      return new ConflictError(`A record with this ${fields} already exists`);
    }
    case 'P2003':
      return new ConflictError('Referenced record does not exist');
    case 'P2025':
      return new NotFoundError('Record');
    default:
      return null;
  }
}

/** A Zod error that escaped `validate` (e.g. thrown inside a service). */
function translateZodError(error: unknown): AppError | null {
  if (!(error instanceof ZodError)) return null;
  return new BadRequestError(
    'Request validation failed',
    error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
  );
}

/**
 * Central error translator. Every response body has the same shape:
 *   { error: { code, message, details? } }
 * Unknown errors are logged with their stack and returned as an opaque 500.
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  // Express identifies error middleware by arity, so the 4th argument must exist.
  _next: NextFunction,
): void {
  const appError =
    error instanceof AppError
      ? error
      : (translatePrismaError(error) ?? translateZodError(error));

  if (appError) {
    if (appError.status >= 500) {
      // Keep the original error for the log: the translated one loses the Prisma code.
      logger.error({ err: error, path: req.originalUrl }, appError.message);
    }
    if (appError.status === 503) res.setHeader('Retry-After', '5');
    res.status(appError.status).json({
      error: {
        code: appError.code,
        message: appError.message,
        ...(appError.details !== undefined ? { details: appError.details } : {}),
      },
    });
    return;
  }

  logger.error({ err: error, path: req.originalUrl, method: req.method }, 'Unhandled error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
      ...(env.isProduction ? {} : { debug: error instanceof Error ? error.message : String(error) }),
    },
  });
}
