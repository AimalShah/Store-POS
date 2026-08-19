import pino from 'pino';
import fs from 'fs';
import path from 'path';

const isDev = process.env.NODE_ENV !== 'production';
const logLevel = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info');

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFile = path.join(logsDir, `app-${new Date().toISOString().split('T')[0]}.log`);

const logger = pino({
  level: logLevel,
  base: {
    pid: process.pid,
    hostname: process.env.HOSTNAME || 'localhost',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      '*.password',
      '*.pin',
      '*.token',
      '*.jwtSecret',
      '*.authorization',
      'req.headers.authorization',
      'req.body.password',
      'req.body.pin',
    ],
    censor: '[REDACTED]',
  },
}, isDev
  ? pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    })
  : pino.destination({ dest: logFile, sync: false, minLength: 4096 })
);

export function createRequestLogger(req, res, next) {
  const start = process.hrtime.bigint();
  const { method, url, ip } = req;

  res.on('finish', () => {
    const durationNs = Number(process.hrtime.bigint() - start);
    const durationMs = durationNs / 1e6;
    logger.info({
      method,
      url,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      ip,
      userAgent: req.headers['user-agent'],
    }, 'HTTP request');
  });

  next();
}

export default logger;