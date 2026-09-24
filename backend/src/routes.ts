import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes';
import { employeesRouter } from './modules/employees/employees.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';
import { meHandler } from './modules/employees/employees.controller';
import { authenticate } from './middleware/authenticate';
import { asyncHandler } from './utils/asyncHandler';

/**
 * Everything under /api mounts here. Each module router applies `authenticate`
 * itself (per-route or router-wide), so this file stays a plain table of
 * contents and the docs route in app.ts is never accidentally protected.
 */
export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/employees', employeesRouter);
apiRouter.use('/dashboard', dashboardRouter);

// The caller's own profile. Lives at the top level per the spec; the id comes
// from the token, so it is the employees read path with no user-supplied id.
apiRouter.get('/me', authenticate, asyncHandler(meHandler));
