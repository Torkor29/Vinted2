import winston from 'winston';
import { config } from '../config.js';
import { mkdirSync } from 'fs';

mkdirSync(config.logging.dir, { recursive: true });

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, module, ...meta }) => {
  const mod = module ? `[${module}]` : '';
  const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} ${level} ${mod} ${message}${extra}`;
});

const logger = winston.createLogger({
  level: config.logging.level,
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat,
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), logFormat),
    }),
    new winston.transports.File({
      filename: `${config.logging.dir}/error.log`,
      level: 'error',
      maxsize: 10_000_000,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: `${config.logging.dir}/combined.log`,
      maxsize: 10_000_000,
      maxFiles: 10,
    }),
  ],
});

export function createLogger(module) {
  return logger.child({ module });
}

export default logger;
