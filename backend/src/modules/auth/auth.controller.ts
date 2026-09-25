import type { Request, Response } from 'express';
import * as authService from './auth.service';

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const result = await authService.login(req.body);
  res.status(200).json(result);
}

/** Tokens are stateless and there is no revocation list, so logout is client-side */
export async function logoutHandler(_req: Request, res: Response): Promise<void> {
  res.status(204).end();
}
