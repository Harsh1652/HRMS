import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { loginSchema } from './auth.schemas';
import { loginHandler, logoutHandler } from './auth.controller';

export const authRouter = Router();

authRouter.post('/login', validate({ body: loginSchema }), asyncHandler(loginHandler));

authRouter.post('/logout', authenticate, asyncHandler(logoutHandler));
