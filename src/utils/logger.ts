import winston from 'winston';
import path from 'path';
import { config } from '../config';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta, null, 2)}`;
    }
    return log;
  })
);

const logger = winston.createLogger({
  level: config.logLevel,
  format: logFormat,
  defaultMeta: { service: 'discord-drive-bot' },
  transports: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Add console transport for development
if (config.nodeEnv !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

export class Logger {
  static info(message: string, meta?: any): void {
    logger.info(message, meta);
  }

  static error(message: string, error?: Error, meta?: any): void {
    logger.error(message, { error: error?.stack, ...meta });
  }

  static warn(message: string, meta?: any): void {
    logger.warn(message, meta);
  }

  static debug(message: string, meta?: any): void {
    logger.debug(message, meta);
  }

  static audit(userId: bigint, action: string, details: any): void {
    logger.info('AUDIT', {
      userId: userId.toString(),
      action,
      ...details,
      timestamp: new Date().toISOString()
    });
  }

  static security(event: string, details: any): void {
    logger.warn('SECURITY', {
      event,
      ...details,
      timestamp: new Date().toISOString()
    });
  }

  static performance(operation: string, duration: number, details?: any): void {
    logger.info('PERFORMANCE', {
      operation,
      duration,
      ...details,
      timestamp: new Date().toISOString()
    });
  }
}

export default logger;
