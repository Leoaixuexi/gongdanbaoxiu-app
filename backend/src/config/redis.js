const Redis = require('ioredis');
const logger = require('../utils/logger');

/**
 * Redis Client Configuration
 * Provides Redis connection with retry strategy and helper functions
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Connection event handling and logging
 * - Helper functions for common operations
 * - Error handling and recovery
 */

// Redis configuration from environment variables
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  // Retry strategy with exponential backoff
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    logger.warn('Redis connection retry', { attempt: times, delay });
    return delay;
  },
  // Connection timeout
  connectTimeout: 10000,
  // Keep alive settings
  keepAlive: 30000,
  // Enable offline queue to buffer commands when disconnected
  enableOfflineQueue: true,
  // Maximum retry attempts
  maxRetriesPerRequest: 3,
  // Reconnect on error
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      // Reconnect when Redis is in READONLY mode
      logger.warn('Redis reconnecting due to READONLY error');
      return true;
    }
    return false;
  },
};

// Create Redis client instance
const redisClient = new Redis(redisConfig);

// Connection event handlers
redisClient.on('connect', () => {
  logger.info('Redis client connecting', {
    host: redisConfig.host,
    port: redisConfig.port,
    db: redisConfig.db,
  });
});

redisClient.on('ready', () => {
  logger.info('Redis client ready', {
    host: redisConfig.host,
    port: redisConfig.port,
  });
});

redisClient.on('error', (error) => {
  logger.error('Redis client error', {
    error: error.message,
    code: error.code,
    host: redisConfig.host,
    port: redisConfig.port,
  });
});

redisClient.on('close', () => {
  logger.warn('Redis connection closed', {
    host: redisConfig.host,
    port: redisConfig.port,
  });
});

redisClient.on('reconnecting', (delay) => {
  logger.info('Redis client reconnecting', {
    delay,
    host: redisConfig.host,
    port: redisConfig.port,
  });
});

redisClient.on('end', () => {
  logger.warn('Redis connection ended', {
    host: redisConfig.host,
    port: redisConfig.port,
  });
});

/**
 * Helper function to handle Redis errors
 * @param {Error} error - Redis error
 * @param {string} operation - Operation that failed
 * @throws {Error} Formatted error
 */
const handleRedisError = (error, operation) => {
  logger.error(`Redis ${operation} failed`, {
    error: error.message,
    code: error.code,
  });
  throw new Error(`Redis ${operation} failed: ${error.message}`);
};

/**
 * Get value by key
 * @param {string} key - Redis key
 * @returns {Promise<string|null>} Value or null if not found
 */
const get = async (key) => {
  try {
    if (!key) {
      throw new Error('Key is required');
    }
    const value = await redisClient.get(key);
    logger.debug('Redis GET', { key, found: !!value });
    return value;
  } catch (error) {
    handleRedisError(error, 'GET');
  }
};

/**
 * Set key-value pair with optional TTL
 * @param {string} key - Redis key
 * @param {string} value - Value to store
 * @param {number} ttl - Time to live in seconds (optional)
 * @returns {Promise<string>} 'OK' on success
 */
const set = async (key, value, ttl = null) => {
  try {
    if (!key) {
      throw new Error('Key is required');
    }
    if (value === undefined || value === null) {
      throw new Error('Value is required');
    }

    let result;
    if (ttl && ttl > 0) {
      // Set with expiration
      result = await redisClient.setex(key, ttl, String(value));
      logger.debug('Redis SET with TTL', { key, ttl, valueLength: String(value).length });
    } else {
      // Set without expiration
      result = await redisClient.set(key, String(value));
      logger.debug('Redis SET', { key, valueLength: String(value).length });
    }
    return result;
  } catch (error) {
    handleRedisError(error, 'SET');
  }
};

/**
 * Delete key(s)
 * @param {string|string[]} keys - Key or array of keys to delete
 * @returns {Promise<number>} Number of keys deleted
 */
const del = async (keys) => {
  try {
    if (!keys) {
      throw new Error('Key(s) required');
    }
    const keysArray = Array.isArray(keys) ? keys : [keys];
    const count = await redisClient.del(...keysArray);
    logger.debug('Redis DEL', { keys: keysArray, count });
    return count;
  } catch (error) {
    handleRedisError(error, 'DEL');
  }
};

/**
 * Get hash field value
 * @param {string} key - Redis hash key
 * @param {string} field - Hash field name
 * @returns {Promise<string|null>} Field value or null if not found
 */
const hget = async (key, field) => {
  try {
    if (!key || !field) {
      throw new Error('Key and field are required');
    }
    const value = await redisClient.hget(key, field);
    logger.debug('Redis HGET', { key, field, found: !!value });
    return value;
  } catch (error) {
    handleRedisError(error, 'HGET');
  }
};

/**
 * Set hash field value
 * @param {string} key - Redis hash key
 * @param {string} field - Hash field name
 * @param {string} value - Value to store
 * @returns {Promise<number>} 1 if new field, 0 if field updated
 */
const hset = async (key, field, value) => {
  try {
    if (!key || !field) {
      throw new Error('Key and field are required');
    }
    if (value === undefined || value === null) {
      throw new Error('Value is required');
    }
    const result = await redisClient.hset(key, field, String(value));
    logger.debug('Redis HSET', { key, field, isNew: result === 1 });
    return result;
  } catch (error) {
    handleRedisError(error, 'HSET');
  }
};

/**
 * Get all hash fields and values
 * @param {string} key - Redis hash key
 * @returns {Promise<Object>} Object with all fields and values
 */
const hgetall = async (key) => {
  try {
    if (!key) {
      throw new Error('Key is required');
    }
    const hash = await redisClient.hgetall(key);
    logger.debug('Redis HGETALL', { key, fieldCount: Object.keys(hash).length });
    return hash;
  } catch (error) {
    handleRedisError(error, 'HGETALL');
  }
};

/**
 * Delete hash field(s)
 * @param {string} key - Redis hash key
 * @param {string|string[]} fields - Field or array of fields to delete
 * @returns {Promise<number>} Number of fields deleted
 */
const hdel = async (key, fields) => {
  try {
    if (!key || !fields) {
      throw new Error('Key and field(s) are required');
    }
    const fieldsArray = Array.isArray(fields) ? fields : [fields];
    const count = await redisClient.hdel(key, ...fieldsArray);
    logger.debug('Redis HDEL', { key, fields: fieldsArray, count });
    return count;
  } catch (error) {
    handleRedisError(error, 'HDEL');
  }
};

/**
 * Check if key exists
 * @param {string} key - Redis key
 * @returns {Promise<boolean>} True if key exists
 */
const exists = async (key) => {
  try {
    if (!key) {
      throw new Error('Key is required');
    }
    const result = await redisClient.exists(key);
    logger.debug('Redis EXISTS', { key, exists: result === 1 });
    return result === 1;
  } catch (error) {
    handleRedisError(error, 'EXISTS');
  }
};

/**
 * Set key expiration
 * @param {string} key - Redis key
 * @param {number} seconds - Expiration time in seconds
 * @returns {Promise<boolean>} True if timeout was set
 */
const expire = async (key, seconds) => {
  try {
    if (!key) {
      throw new Error('Key is required');
    }
    if (!seconds || seconds <= 0) {
      throw new Error('Valid expiration time is required');
    }
    const result = await redisClient.expire(key, seconds);
    logger.debug('Redis EXPIRE', { key, seconds, success: result === 1 });
    return result === 1;
  } catch (error) {
    handleRedisError(error, 'EXPIRE');
  }
};

/**
 * Get time to live for key
 * @param {string} key - Redis key
 * @returns {Promise<number>} TTL in seconds, -1 if no expiration, -2 if key doesn't exist
 */
const ttl = async (key) => {
  try {
    if (!key) {
      throw new Error('Key is required');
    }
    const seconds = await redisClient.ttl(key);
    logger.debug('Redis TTL', { key, ttl: seconds });
    return seconds;
  } catch (error) {
    handleRedisError(error, 'TTL');
  }
};

/**
 * Increment value by amount
 * @param {string} key - Redis key
 * @param {number} amount - Amount to increment (default 1)
 * @returns {Promise<number>} Value after increment
 */
const incr = async (key, amount = 1) => {
  try {
    if (!key) {
      throw new Error('Key is required');
    }
    const result = amount === 1
      ? await redisClient.incr(key)
      : await redisClient.incrby(key, amount);
    logger.debug('Redis INCR', { key, amount, result });
    return result;
  } catch (error) {
    handleRedisError(error, 'INCR');
  }
};

/**
 * Decrement value by amount
 * @param {string} key - Redis key
 * @param {number} amount - Amount to decrement (default 1)
 * @returns {Promise<number>} Value after decrement
 */
const decr = async (key, amount = 1) => {
  try {
    if (!key) {
      throw new Error('Key is required');
    }
    const result = amount === 1
      ? await redisClient.decr(key)
      : await redisClient.decrby(key, amount);
    logger.debug('Redis DECR', { key, amount, result });
    return result;
  } catch (error) {
    handleRedisError(error, 'DECR');
  }
};

/**
 * Graceful shutdown
 * Closes Redis connection
 * @returns {Promise<void>}
 */
const shutdown = async () => {
  try {
    logger.info('Closing Redis connection');
    await redisClient.quit();
    logger.info('Redis connection closed gracefully');
  } catch (error) {
    logger.error('Error closing Redis connection', {
      error: error.message,
    });
    // Force close if graceful close fails
    redisClient.disconnect();
  }
};

// Export Redis client and helper functions
module.exports = redisClient;

// Also export helper functions as properties
module.exports.get = get;
module.exports.set = set;
module.exports.del = del;
module.exports.hget = hget;
module.exports.hset = hset;
module.exports.hgetall = hgetall;
module.exports.hdel = hdel;
module.exports.exists = exists;
module.exports.expire = expire;
module.exports.ttl = ttl;
module.exports.incr = incr;
module.exports.decr = decr;
module.exports.shutdown = shutdown;
