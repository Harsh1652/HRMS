import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Express 4 doesn't pass rejected promises to error middleware, so without this the request would hang. */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
