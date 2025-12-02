const jwt = require('jsonwebtoken');
const logger = require('./logger');

/**
 * JWT Utility Functions
 * Handles token generation and verification for authentication
 */

/**
 * Generate JWT token with payload
 * @param {Object} payload - Data to encode in token (user info)
 * @returns {string} Signed JWT token
 */
const generateToken = (payload) => {
  try {
    const secret = process.env.JWT_SECRET;
    const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

    if (!secret) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }

    // Never log sensitive payload data
    logger.debug('Generating JWT token');

    const token = jwt.sign(payload, secret, {
      expiresIn,
      issuer: 'workorder-system',
    });

    return token;
  } catch (error) {
    logger.error('Error generating JWT token', { error: error.message });
    throw error;
  }
};

/**
 * Verify and decode JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
const verifyToken = (token) => {
  try {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }

    const decoded = jwt.verify(token, secret, {
      issuer: 'workorder-system',
    });

    // Never log the token itself
    logger.debug('JWT token verified successfully');

    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logger.warn('JWT token expired', { expiredAt: error.expiredAt });
      throw new Error('Token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      logger.warn('Invalid JWT token', { error: error.message });
      throw new Error('Invalid token');
    } else if (error.name === 'NotBeforeError') {
      logger.warn('JWT token not active yet', { notBefore: error.notBefore });
      throw new Error('Token not yet active');
    } else {
      logger.error('Error verifying JWT token', { error: error.message });
      throw error;
    }
  }
};

module.exports = {
  generateToken,
  verifyToken,
};
