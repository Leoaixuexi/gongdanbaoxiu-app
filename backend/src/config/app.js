const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Express App Configuration
 * Creates and configures Express application with all necessary middleware
 *
 * Middleware stack order:
 * 1. Security headers (helmet)
 * 2. CORS configuration
 * 3. Body parsers (JSON & URL-encoded)
 * 4. Request logging (morgan)
 * 5. Request ID middleware
 * 6. Rate limiting
 * 7. Routes
 * 8. Error handlers
 */

/**
 * Request ID middleware
 * Generates a unique ID for each incoming request for tracking and logging
 */
const requestIdMiddleware = (req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
};

/**
 * Morgan stream configuration
 * Integrates morgan HTTP logger with winston logger
 */
const morganStream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

/**
 * CORS configuration
 * Validates allowed origins from environment variable
 */
const getCorsOptions = () => {
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['http://localhost:3000'];

  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        logger.warn('CORS blocked request from origin', { origin });
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 86400, // 24 hours
  };
};

/**
 * Rate limiting configuration
 * Prevents abuse by limiting requests per IP address
 */
const createRateLimiter = () => {
  return rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes default
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10), // 100 requests per window
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    message: {
      success: false,
      error: {
        message: 'Too many requests, please try again later',
        code: 'RATE_LIMIT_EXCEEDED',
      },
    },
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        url: req.originalUrl,
        method: req.method,
      });
      res.status(429).json({
        success: false,
        error: {
          message: 'Too many requests, please try again later',
          code: 'RATE_LIMIT_EXCEEDED',
        },
      });
    },
    skip: (req) => {
      // Skip rate limiting for health check endpoint
      return req.path === '/api/health';
    },
  });
};

/**
 * Creates and configures Express application
 * @returns {express.Application} Configured Express app instance
 */
const createApp = () => {
  const app = express();

  // Trust proxy - important for rate limiting and IP detection behind reverse proxies
  app.set('trust proxy', 1);

  // 1. Security middleware - helmet for security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // 2. CORS middleware - enable Cross-Origin Resource Sharing
  app.use(cors(getCorsOptions()));

  // 3. Body parser middleware - parse JSON and URL-encoded bodies
  app.use(express.json({ limit: '10mb' })); // Limit payload size
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 4. HTTP request logging middleware
  const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
  app.use(morgan(morganFormat, { stream: morganStream }));

  // 5. Request ID middleware - add unique ID to each request
  app.use(requestIdMiddleware);

  // 6. Rate limiting middleware - apply to all routes
  app.use(createRateLimiter());

  // Health check endpoint - must be before routes
  app.get('/api/health', (req, res) => {
    res.status(200).json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
      },
    });
  });

  // Log application startup
  logger.info('Express app configured successfully', {
    environment: process.env.NODE_ENV || 'development',
    corsOrigins: process.env.CORS_ORIGINS || 'default',
  });

  // Routes will be mounted here by main app.js
  // Example:
  // app.use('/api/auth', authRoutes);
  // app.use('/api/workorders', workOrderRoutes);
  // app.use('/api/users', userRoutes);
  // app.use('/api/notifications', notificationRoutes);
  // app.use('/api/analytics', analyticsRoutes);

  return app;
};

module.exports = createApp;
