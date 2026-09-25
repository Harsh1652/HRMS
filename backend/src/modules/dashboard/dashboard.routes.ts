import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate } from '../../middleware/authenticate';
import { recentJoinersHandler, statsHandler } from './dashboard.controller';

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

dashboardRouter.get('/stats', asyncHandler(statsHandler));
dashboardRouter.get('/recent-joiners', asyncHandler(recentJoinersHandler));
