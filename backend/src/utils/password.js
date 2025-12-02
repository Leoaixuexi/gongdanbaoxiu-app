const bcrypt = require('bcryptjs');
const logger = require('./logger');

/**
 * Password Hashing Utilities
 * Note: This system uses WeChat OpenID authentication primarily,
 * but these utilities are included for future use or alternative auth methods
 */

const SALT_ROUNDS = 10;

/**
 * Hash a plain text password using bcrypt
 * @param {string} password - Plain text password to hash
 * @returns {Promise<string>} Hashed password
 */
const hashPassword = async (password) => {
  try {
    if (!password || typeof password !== 'string' || password.trim().length === 0) {
      throw new Error('Password must be a non-empty string');
    }

    // Never log the actual password
    logger.debug('Hashing password');

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    return hash;
  } catch (error) {
    logger.error('Error hashing password', { error: error.message });
    throw error;
  }
};

/**
 * Compare a plain text password with a hashed password
 * @param {string} password - Plain text password to verify
 * @param {string} hash - Hashed password to compare against
 * @returns {Promise<boolean>} True if passwords match, false otherwise
 */
const comparePassword = async (password, hash) => {
  try {
    if (!password || typeof password !== 'string') {
      throw new Error('Password must be a non-empty string');
    }

    if (!hash || typeof hash !== 'string') {
      throw new Error('Hash must be a non-empty string');
    }

    // Never log passwords or hashes
    logger.debug('Comparing password with hash');

    const isMatch = await bcrypt.compare(password, hash);
    return isMatch;
  } catch (error) {
    logger.error('Error comparing password', { error: error.message });
    throw error;
  }
};

module.exports = {
  hashPassword,
  comparePassword,
};
