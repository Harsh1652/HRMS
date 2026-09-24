import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { loginSchema } from './auth.schemas';
import { loginHandler, logoutHandler } from './auth.controller';

export const authRouter = Router();

// The one unauthenticated API route (besides /api/docs).
authRouter.post('/login', validate({ body: loginSchema }), asyncHandler(loginHandler));

// Requires a valid token so a caller with a bad token gets the same 401 as elsewhere.
authRouter.post('/logout', authenticate, asyncHandler(logoutHandler));
