import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './utils/prisma';
import { logger } from './utils/logger';

const app = createApp();
const server = app.listen(env.PORT, () => {
  logger.info(`HRMS API listening on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
});

function shutdown(signal: string): void {
  logger.info(`${signal} received, shutting down`);

  server.close(async (error) => {
    if (error) {
      logger.error({ err: error }, 'Error while closing the HTTP server');
      process.exitCode = 1;
    }
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });

  setTimeout(() => {
    logger.error('Forcing shutdown after 10s');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
