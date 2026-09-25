import fs from 'node:fs';
import path from 'node:path';
import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import { env } from './config/env';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiRouter } from './routes';

function loadOpenApiSpec(): Record<string, unknown> {
  const specPath = path.resolve(__dirname, '..', 'openapi.yaml');
  return YAML.parse(fs.readFileSync(specPath, 'utf8')) as Record<string, unknown>;
}

export function createApp(): Express {
  const app = express();
  const openApiSpec = loadOpenApiSpec();

  app.use(helmet());
  app.use(requestLogger);
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
  });

  // Docs are public. Helmet's CSP blocks Swagger UI's inline scripts, so it's off for this path only.
  app.get('/api/docs.json', (_req, res) => {
    res.status(200).json(openApiSpec);
  });
  app.use(
    '/api/docs',
    helmet({ contentSecurityPolicy: false }),
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, {
      customSiteTitle: 'HRMS API docs',
      swaggerOptions: { persistAuthorization: true },
    }),
  );

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
