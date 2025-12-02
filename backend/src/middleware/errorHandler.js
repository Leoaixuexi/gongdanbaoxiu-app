const logger = require('../utils/logger');

/**
 * Global Error Handler Middleware
 * Catches all errors and returns standardized error responses
 * Must be the last middleware in the chain
 */

/**
 * Error handler middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
  // Default error values
  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred';
  let details = null;

  // Log the error with context
  logger.error('Error handler caught exception', {
    error: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    name: err.name,
    url: req.originalUrl,
    method: req.method,
    userId: req.user ? req.user.id : null,
    ip: req.ip,
  });

  // Handle Sequelize validation errors
  if (err.name === 'SequelizeValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = err.errors.map((e) => ({
      field: e.path,
      message: e.message,
      value: e.value,
      type: e.type,
    }));
  }
  // Handle Sequelize unique constraint errors
  else if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 409;
    errorCode = 'DUPLICATE_ENTRY';
    message = 'A record with this value already exists';
    details = err.errors.map((e) => ({
      field: e.path,
      message: e.message,
      value: e.value,
    }));
  }
  // Handle Sequelize foreign key constraint errors
  else if (err.name === 'SequelizeForeignKeyConstraintError') {
    statusCode = 400;
    errorCode = 'FOREIGN_KEY_VIOLATION';
    message = 'Referenced record does not exist';
    details = {
      table: err.table,
      field: err.fields,
    };
  }
  // Handle Sequelize database connection errors
  else if (err.name === 'SequelizeConnectionError') {
    statusCode = 503;
    errorCode = 'DATABASE_CONNECTION_ERROR';
    message = 'Database connection failed';
    // Don't expose connection details in production
    if (process.env.NODE_ENV !== 'production') {
      details = { error: err.message };
    }
  }
  // Handle JWT errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = 'INVALID_TOKEN';
    message = 'Invalid authentication token';
  }
  else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 'TOKEN_EXPIRED';
    message = 'Authentication token has expired';
  }
  // Handle custom application errors with statusCode property
  else if (err.statusCode) {
    statusCode = err.statusCode;
    errorCode = err.code || errorCode;
    message = err.message || message;
    details = err.details || details;
  }
  // Handle validation errors from express-validator (shouldn't reach here normally)
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = err.message;
    details = err.details;
  }
  // Handle generic errors
  else if (err.message) {
    message = err.message;
  }

  // Construct error response
  const errorResponse = {
    success: false,
    error: {
      message,
      code: errorCode,
    },
  };

  // Add details if available (but not in production for security)
  if (details) {
    errorResponse.error.details = details;
  }

  // Add stack trace in development only
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    errorResponse.error.stack = err.stack.split('\n');
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found handler
 * Handles routes that don't exist
 */
const notFoundHandler = (req, res) => {
  logger.warn('Route not found', {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found',
      code: 'NOT_FOUND',
      details: {
        method: req.method,
        path: req.originalUrl,
      },
    },
  });
};

/**
 * Custom error class for application errors
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'APP_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  errorHandler,
  notFoundHandler,
  AppError,
};
