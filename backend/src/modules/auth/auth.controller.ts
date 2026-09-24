import type { Request, Response } from 'express';
import * as authService from './auth.service';

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const result = await authService.login(req.body);
  res.status(200).json(result);
}

/**
 * Access tokens are stateless and short-lived (30 min), so logout is the client
 * discarding its copy. The endpoint exists so the frontend has one call to make
 * and so the request is logged. There is no server-side revocation list — an
 * MVP trade-off documented in the README.
 */
export async function logoutHandler(_req: Request, res: Response): Promise<void> {
  res.status(204).end();
}
