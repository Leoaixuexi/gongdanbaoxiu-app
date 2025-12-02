const { verifyToken } = require('../utils/jwt');
const { User, Role } = require('../models');
const logger = require('../utils/logger');

/**
 * Authentication Middleware
 * Verifies JWT tokens and loads user information
 */

/**
 * Authenticate JWT token from Authorization header
 * Extracts Bearer token, verifies it, and loads user with role information
 * Attaches user object to req.user for downstream middleware
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Missing or invalid Authorization header', {
        ip: req.ip,
        url: req.originalUrl,
      });
      return res.status(401).json({
        success: false,
        error: {
          message: 'Authentication token is required',
          code: 'NO_TOKEN',
        },
      });
    }

    // Extract token (remove 'Bearer ' prefix)
    const token = authHeader.substring(7);

    // Verify token
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      logger.warn('Invalid JWT token', {
        error: error.message,
        ip: req.ip,
        url: req.originalUrl,
      });
      return res.status(401).json({
        success: false,
        error: {
          message: error.message || 'Invalid or expired token',
          code: 'INVALID_TOKEN',
        },
      });
    }

    // Load user from database with role information
    const user = await User.findByPk(decoded.userId, {
      include: [
        {
          model: Role,
          as: 'role',
          attributes: ['id', 'name', 'display_name', 'permissions_json'],
        },
      ],
      attributes: [
        'id',
        'wechat_openid',
        'name',
        'role_id',
        'contact_phone',
        'department',
        'supervisor_id',
        'active',
        'last_login_at',
      ],
    });

    if (!user) {
      logger.warn('User not found for valid token', {
        userId: decoded.userId,
        ip: req.ip,
      });
      return res.status(401).json({
        success: false,
        error: {
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        },
      });
    }

    // Check if user account is active
    if (!user.active) {
      logger.warn('Inactive user attempted access', {
        userId: user.id,
        ip: req.ip,
      });
      return res.status(403).json({
        success: false,
        error: {
          message: 'User account is inactive',
          code: 'USER_INACTIVE',
        },
      });
    }

    // Attach user to request object for downstream middleware
    req.user = user;

    logger.debug('User authenticated successfully', {
      userId: user.id,
      roleId: user.role_id,
    });

    next();
  } catch (error) {
    logger.error('Authentication middleware error', {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
    });
    return res.status(500).json({
      success: false,
      error: {
        message: 'Internal server error during authentication',
        code: 'AUTH_ERROR',
      },
    });
  }
};

module.exports = {
  authenticateToken,
};
