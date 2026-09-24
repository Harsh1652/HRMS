/**
 * The central error translator, exercised with hand-built errors. No database.
 * Every response must have the shape { error: { code, message, details? } }.
 */
import { Prisma } from '@prisma/client';
import { z, type ZodError } from 'zod';
import type { NextFunction, Request, Response } from 'express';
import { errorHandler } from '../../src/middleware/errorHandler';
import { ForbiddenError, NotFoundError } from '../../src/utils/AppError';

interface Captured {
  status: number;
  body: { error: { code: string; message: string; details?: unknown; debug?: string } };
  headers: Record<string, string>;
}

function run(error: unknown): Captured {
  const captured: Captured = { status: 0, body: { error: { code: '', message: '' } }, headers: {} };
  const res = {
    setHeader: (k: string, v: string) => { captured.headers[k] = v; },
    status: (s: number) => { captured.status = s; return res; },
    json: (b: Captured['body']) => { captured.body = b; return res; },
  } as unknown as Response;
  errorHandler(error, { originalUrl: '/test', method: 'GET' } as Request, res, (() => {}) as NextFunction);
  return captured;
}

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('boom', { code, clientVersion: '6.19.3' });

describe('errorHandler', () => {
  it('passes an AppError through with its status and code', () => {
    const r = run(new ForbiddenError('nope', [{ path: 'role', message: 'Not permitted' }]));
    expect(r.status).toBe(403);
    expect(r.body.error).toEqual({ code: 'FORBIDDEN', message: 'nope', details: [{ path: 'role', message: 'Not permitted' }] });
  });

  it('maps NotFoundError to 404', () => {
    expect(run(new NotFoundError('Employee')).status).toBe(404);
  });

  it('maps a Zod error to 400 with per-field details', () => {
    const result = z.object({ email: z.string().email() }).safeParse({ email: 'x' });
    const r = run(result.success ? new Error('unexpected') : (result.error as ZodError));
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('BAD_REQUEST');
    expect(r.body.error.details).toEqual([{ path: 'email', message: expect.any(String) }]);
  });

  it('maps a Prisma unique violation (P2002) to 409', () => {
    const r = run(prismaError('P2002'));
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('CONFLICT');
  });

  it('maps Prisma P2025 (record not found) to 404', () => {
    expect(run(prismaError('P2025')).status).toBe(404);
  });

  it.each(['P2024', 'P1001', 'P1002', 'P1008', 'P1017'])(
    'maps transient database error %s to 503 with Retry-After',
    (code) => {
      const r = run(prismaError(code));
      expect(r.status).toBe(503);
      expect(r.body.error.code).toBe('SERVICE_UNAVAILABLE');
      expect(r.headers['Retry-After']).toBe('5');
    },
  );

  it('maps a Prisma initialization error (cannot connect) to 503', () => {
    const r = run(new Prisma.PrismaClientInitializationError('down', '6.19.3'));
    expect(r.status).toBe(503);
  });

  it('turns an unknown error into an opaque 500 that never leaks a stack', () => {
    const r = run(new Error('secret internal detail'));
    expect(r.status).toBe(500);
    expect(r.body.error.code).toBe('INTERNAL_ERROR');
    expect(r.body.error.message).toBe('Something went wrong');
    expect(JSON.stringify(r.body)).not.toContain('at ');
  });
});
