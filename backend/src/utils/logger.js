const winston = require('winston');
const path = require('path');
const fs = require('fs');

/**
 * Winston Logger Configuration
 * Provides centralized logging with file rotation and environment-specific formats
 */

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Define log colors for console output
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
};

winston.addColors(logColors);

// Custom format for filtering sensitive data
const sanitizeFormat = winston.format((info) => {
  // Remove sensitive fields from logs
  const sensitiveFields = ['password', 'token', 'authorization', 'jwt', 'secret', 'openid'];

  if (info.meta && typeof info.meta === 'object') {
    sensitiveFields.forEach((field) => {
      if (field in info.meta) {
        info.meta[field] = '[REDACTED]';
      }
    });
  }

  // Sanitize error stack traces in production
  if (process.env.NODE_ENV === 'production' && info.stack) {
    delete info.stack;
  }

  return info;
});

// Create the logger instance
const logger = winston.createLogger({
  levels: logLevels,
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    sanitizeFormat(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'workorder-backend' },
  transports: [
    // Error log file - only errors
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Combined log file - all levels
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  // Handle uncaught exceptions and unhandled rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
    }),
  ],
});

// Console logging for non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          let logMessage = timestamp + ' [' + level + ']: ' + message;

          // Add metadata if present
          const metaKeys = Object.keys(meta);
          if (metaKeys.length > 0) {
            logMessage += '\n' + JSON.stringify(meta, null, 2);
          }

          return logMessage;
        })
      ),
    })
  );
}

// Add helper methods for structured logging
logger.logRequest = (req, message = 'HTTP Request') => {
  logger.info(message, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userId: req.user && req.user.id ? req.user.id : undefined,
  });
};

logger.logError = (error, context = {}) => {
  logger.error(error.message, {
    ...context,
    stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
    name: error.name,
  });
};

module.exports = logger;
