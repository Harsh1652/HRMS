import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './utils/prisma';
import { logger } from './utils/logger';

const app = createApp();
const server = app.listen(env.PORT, () => {
  logger.info(`HRMS API listening on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
});

/**
 * Stop accepting connections, let in-flight requests finish, then release the
 * database pool. Without this, a redeploy can cut a request mid-transaction.
 */
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

  // Do not hang forever on a stuck connection.
  setTimeout(() => {
    logger.error('Forcing shutdown after 10s');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
