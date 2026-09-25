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

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}` },
  });
}

const TRANSIENT_DB_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024']);

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

function translateZodError(error: unknown): AppError | null {
  if (!(error instanceof ZodError)) return null;
  return new BadRequestError(
    'Request validation failed',
    error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
  );
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const appError =
    error instanceof AppError
      ? error
      : (translatePrismaError(error) ?? translateZodError(error));

  if (appError) {
    if (appError.status >= 500) {
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
