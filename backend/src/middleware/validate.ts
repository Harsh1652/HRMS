import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { BadRequestError } from '../utils/AppError';

interface ValidationSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

function formatZodError(error: ZodError): { path: string; message: string }[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

/**
 * Validates and replaces `body`, `query` and `params` with their parsed results,
 * so handlers receive coerced, typed values rather than raw strings.
 *
 * Validation is about shape. Which fields the caller is *allowed* to send is a
 * separate question answered by `policies/employeePolicy.ts` in the service.
 */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params);
      if (schemas.query) req.query = schemas.query.parse(req.query);
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new BadRequestError('Request validation failed', formatZodError(error)));
        return;
      }
      next(error);
    }
  };
}
