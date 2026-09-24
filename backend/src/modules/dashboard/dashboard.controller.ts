import type { Request, Response } from 'express';
import { requireUser } from '../../middleware/authenticate';
import * as dashboardService from './dashboard.service';

export async function statsHandler(req: Request, res: Response): Promise<void> {
  res.status(200).json(await dashboardService.stats(requireUser(req)));
}
