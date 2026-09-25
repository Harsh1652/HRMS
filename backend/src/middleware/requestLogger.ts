import pinoHttp from 'pino-http';
import { logger } from '../utils/logger';

/** Auth headers are redacted so a leaked log can't be replayed as a session. */
export const requestLogger = pinoHttp({
  logger,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie'],
    censor: '[REDACTED]',
  },
  customLogLevel(_req, res, error) {
    if (error || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req(req) {
      return { id: req.id, method: req.method, url: req.url };
    },
    res(res) {
      return { statusCode: res.statusCode };
    },
  },
});
