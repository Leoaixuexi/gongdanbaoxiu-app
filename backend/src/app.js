require('dotenv').config();
const createApp = require('./config/app');
const db = require('./models');
const redisClient = require('./config/redis');
const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

/**
 * Main Application Entry Point
 * Initializes Express server with database, Redis, and all routes
 *
 * Startup sequence:
 * 1. Load environment variables
 * 2. Create Express app with middleware
 * 3. Test database and Redis connections
 * 4. Mount API routes
 * 5. Add error handlers
 * 6. Start HTTP server
 * 7. Setup graceful shutdown
 */

// Validate required environment variables
const requiredEnvVars = [
  'PORT',
  'DB_HOST',
  'DB_NAME',
  'DB_USER',
  'JWT_SECRET',
  'WECHAT_APPID',
  'WECHAT_SECRET',
];

const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);
if (missingEnvVars.length > 0) {
  logger.error('Missing required environment variables', {
    missing: missingEnvVars,
  });
  process.exit(1);
}

// Create Express application
const app = createApp();

// Store server instance and job tasks for graceful shutdown
let server = null;
let slaMonitorTask = null;

/**
 * Initialize database connection
 * Tests connection and syncs models
 */
const initializeDatabase = async () => {
  try {
    logger.info('Connecting to database...');

    // Test database connection
    await db.sequelize.authenticate();
    logger.info('Database connection established successfully', {
      database: process.env.DB_NAME,
      host: process.env.DB_HOST,
    });

    // Sync database models
    // In production, use migrations instead of sync
    if (process.env.NODE_ENV !== 'production') {
      await db.sequelize.sync({ alter: false });
      logger.info('Database models synchronized');
    } else {
      logger.info('Skipping model sync in production (use migrations)');
    }

    return true;
  } catch (error) {
    logger.error('Unable to connect to database', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Test Redis connection
 */
const testRedisConnection = async () => {
  try {
    logger.info('Testing Redis connection...');
    await redisClient.ping();
    logger.info('Redis connection successful');
    return true;
  } catch (error) {
    logger.error('Redis connection failed', {
      error: error.message,
    });
    // Redis failure is not fatal - app can run without it
    logger.warn('Continuing without Redis (some features may be limited)');
    return false;
  }
};

/**
 * Mount API routes
 * Routes are mounted in order of specificity
 */
const mountRoutes = () => {
  logger.info('Mounting API routes...');

  // Import route modules
  const authRoutes = require('./routes/auth');
  const workOrderRoutes = require('./routes/workOrders');
  const analyticsRoutes = require('./routes/analytics');
  const userRoutes = require('./routes/users');
  // const notificationRoutes = require('./routes/notifications');

  // Mount routes
  app.use('/api/auth', authRoutes);
  app.use('/api/workorders', workOrderRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/users', userRoutes);
  // app.use('/api/notifications', notificationRoutes);

  // API root endpoint
  app.get('/api', (req, res) => {
    res.json({
      success: true,
      message: 'Work Order Management System API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      endpoints: {
        auth: '/api/auth',
        workorders: '/api/workorders',
        analytics: '/api/analytics',
        users: '/api/users',
      },
    });
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  logger.info('API routes mounted successfully');
};

/**
 * Add error handling middleware
 * Must be added AFTER all routes
 */
const addErrorHandlers = () => {
  // 404 handler - catches all unmatched routes
  app.use(notFoundHandler);

  // Global error handler - catches all errors
  app.use(errorHandler);

  logger.info('Error handlers configured');
};

/**
 * Initialize scheduled jobs
 * T170: Start SLA monitor and other background jobs
 */
const initializeJobs = () => {
  try {
    logger.info('Initializing scheduled jobs...');

    // Initialize SLA monitor job (runs every minute)
    const slaMonitor = require('./jobs/slaMonitor');
    slaMonitorTask = slaMonitor.initSLAMonitor();

    logger.info('All scheduled jobs initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize scheduled jobs', {
      error: error.message,
      stack: error.stack,
    });
    // Non-critical - application can continue without jobs
    // Jobs can be started manually if needed
  }
};

/**
 * Start HTTP server
 */
const startServer = () => {
  const PORT = process.env.PORT || 3000;

  server = app.listen(PORT, () => {
    logger.info('Server started successfully', {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
    });

    // Log available routes in development
    if (process.env.NODE_ENV !== 'production') {
      logger.info('Available endpoints:', {
        health: `http://localhost:${PORT}/api/health`,
        api: `http://localhost:${PORT}/api`,
      });
    }
  });

  // Handle server errors
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`Port ${PORT} is already in use`);
    } else {
      logger.error('Server error', { error: error.message });
    }
    process.exit(1);
  });

  return server;
};

/**
 * Graceful shutdown handler
 * Closes all connections cleanly before exit
 */
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, starting graceful shutdown...`);

  // Stop accepting new connections
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        // Stop scheduled jobs
        if (slaMonitorTask) {
          const slaMonitor = require('./jobs/slaMonitor');
          slaMonitor.stopSLAMonitor(slaMonitorTask);
          logger.info('SLA monitor job stopped');
        }

        // Close database connection
        await db.sequelize.close();
        logger.info('Database connection closed');

        // Close Redis connection
        await redisClient.shutdown();
        logger.info('Redis connection closed');

        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown', {
          error: error.message,
        });
        process.exit(1);
      }
    });

    // Force shutdown if graceful shutdown takes too long
    setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, 30000); // 30 second timeout
  } else {
    process.exit(0);
  }
};

/**
 * Setup signal handlers for graceful shutdown
 */
const setupShutdownHandlers = () => {
  // Handle SIGTERM (e.g., from Kubernetes)
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  // Handle SIGINT (e.g., Ctrl+C)
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', {
      error: error.message,
      stack: error.stack,
    });
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Promise Rejection', {
      reason: reason instanceof Error ? reason.message : reason,
      stack: reason instanceof Error ? reason.stack : undefined,
    });
    gracefulShutdown('UNHANDLED_REJECTION');
  });

  logger.info('Shutdown handlers configured');
};

/**
 * Main application initialization
 */
const main = async () => {
  try {
    logger.info('Starting Work Order Management System API...');
    logger.info('Environment', {
      nodeEnv: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      platform: process.platform,
    });

    // Initialize database
    await initializeDatabase();

    // Test Redis connection
    await testRedisConnection();

    // Mount routes
    mountRoutes();

    // Add error handlers (must be last)
    addErrorHandlers();

    // Setup graceful shutdown
    setupShutdownHandlers();

    // Start server
    startServer();

    // Initialize scheduled jobs (after server starts)
    initializeJobs();

    logger.info('Application initialization completed successfully');
  } catch (error) {
    logger.error('Failed to start application', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
};

// Start the application
if (require.main === module) {
  main();
}

// Export app for testing
module.exports = app;
