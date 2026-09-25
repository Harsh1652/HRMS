import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes';
import { employeesRouter } from './modules/employees/employees.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';
import { meHandler } from './modules/employees/employees.controller';
import { authenticate } from './middleware/authenticate';
import { asyncHandler } from './utils/asyncHandler';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/employees', employeesRouter);
apiRouter.use('/dashboard', dashboardRouter);

apiRouter.get('/me', authenticate, asyncHandler(meHandler));
