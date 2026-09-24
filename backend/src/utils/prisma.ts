import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

/**
 * Single client for the process. Cached on globalThis so that `tsx watch`
 * reloads do not open a new connection pool on every file change.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isProduction ? ['warn', 'error'] : ['warn', 'error'],
  });

if (!env.isProduction) {
  globalForPrisma.prisma = prisma;
}
