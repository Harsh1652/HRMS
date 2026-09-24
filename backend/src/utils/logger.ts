import pino from 'pino';
import { env } from '../config/env';

/**
 * Process-wide logger. Pretty output in development only; JSON everywhere else
 * so log shippers can parse it. Tests are silenced to keep Jest output readable.
 */
export const logger = pino({
  level: env.isTest ? 'silent' : env.LOG_LEVEL,
  ...(env.NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } } }
    : {}),
});
