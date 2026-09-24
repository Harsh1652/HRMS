import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import {
  createEmployeeSchema,
  idParamSchema,
  listQuerySchema,
  updateEmployeeSchema,
} from './employees.schemas';
import {
  createHandler,
  deleteHandler,
  getByIdHandler,
  listHandler,
  updateHandler,
} from './employees.controller';

export const employeesRouter = Router();

// Every employee route requires a session. What each role may then see or
// change is decided in the service via policies/employeePolicy.ts — there is
// deliberately no role check here, so the policy is the single place to read.
employeesRouter.use(authenticate);

employeesRouter.get('/', validate({ query: listQuerySchema }), asyncHandler(listHandler));
employeesRouter.post('/', validate({ body: createEmployeeSchema }), asyncHandler(createHandler));

employeesRouter.get('/:id', validate({ params: idParamSchema }), asyncHandler(getByIdHandler));
employeesRouter.put(
  '/:id',
  validate({ params: idParamSchema, body: updateEmployeeSchema }),
  asyncHandler(updateHandler),
);
employeesRouter.delete('/:id', validate({ params: idParamSchema }), asyncHandler(deleteHandler));
