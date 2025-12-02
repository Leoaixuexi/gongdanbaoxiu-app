const logger = require('../utils/logger');

/**
 * Role-Based Access Control (RBAC) Middleware
 * Checks user permissions based on role configuration
 */

/**
 * Require specific permission to access route
 * Returns a middleware function that checks if user has the required permission
 * 
 * @param {string} permission - Module permission to check (e.g., 'manage_users')
 * @returns {Function} Express middleware function
 * 
 * @example
 * router.get('/users', authenticateToken, requirePermission('manage_users'), getUsersHandler);
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    try {
      // Ensure user is authenticated (should be set by authenticateToken middleware)
      if (!req.user) {
        logger.error('RBAC middleware called without authenticated user', {
          url: req.originalUrl,
          permission,
        });
        return res.status(401).json({
          success: false,
          error: {
            message: 'Authentication required',
            code: 'NOT_AUTHENTICATED',
          },
        });
      }

      // Check if user has role information
      if (!req.user.role) {
        logger.error('User object missing role information', {
          userId: req.user.id,
          url: req.originalUrl,
          permission,
        });
        return res.status(403).json({
          success: false,
          error: {
            message: 'User role information not found',
            code: 'ROLE_NOT_FOUND',
          },
        });
      }

      // Check if permissions_json exists and has modules
      const permissions = req.user.role.permissions_json;
      if (!permissions || !permissions.modules) {
        logger.error('Invalid permissions structure', {
          userId: req.user.id,
          roleId: req.user.role_id,
          url: req.originalUrl,
          permission,
        });
        return res.status(403).json({
          success: false,
          error: {
            message: 'Invalid role permissions configuration',
            code: 'INVALID_PERMISSIONS',
          },
        });
      }

      // Check if user has the required permission
      const hasPermission = permissions.modules[permission] === true;

      if (!hasPermission) {
        logger.warn('Permission denied', {
          userId: req.user.id,
          roleId: req.user.role_id,
          roleName: req.user.role.name,
          requiredPermission: permission,
          url: req.originalUrl,
          ip: req.ip,
        });
        return res.status(403).json({
          success: false,
          error: {
            message: 'You do not have permission to perform this action',
            code: 'PERMISSION_DENIED',
            details: {
              requiredPermission: permission,
            },
          },
        });
      }

      // Permission granted
      logger.debug('Permission granted', {
        userId: req.user.id,
        roleId: req.user.role_id,
        permission,
      });

      next();
    } catch (error) {
      logger.error('RBAC middleware error', {
        error: error.message,
        stack: error.stack,
        userId: req.user ? req.user.id : null,
        permission,
        url: req.originalUrl,
      });
      return res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error during permission check',
          code: 'RBAC_ERROR',
        },
      });
    }
  };
};

/**
 * Require specific role ID to access route
 * Returns a middleware function that checks if user has the required role
 * 
 * @param {number|number[]} roleIds - Single role ID or array of role IDs
 * @returns {Function} Express middleware function
 * 
 * @example
 * router.post('/config', authenticateToken, requireRole([1, 2]), updateConfigHandler);
 */
const requireRole = (roleIds) => {
  const allowedRoles = Array.isArray(roleIds) ? roleIds : [roleIds];

  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'Authentication required',
            code: 'NOT_AUTHENTICATED',
          },
        });
      }

      const hasRole = allowedRoles.includes(req.user.role_id);

      if (!hasRole) {
        logger.warn('Role requirement not met', {
          userId: req.user.id,
          userRoleId: req.user.role_id,
          requiredRoles: allowedRoles,
          url: req.originalUrl,
        });
        return res.status(403).json({
          success: false,
          error: {
            message: 'You do not have the required role to perform this action',
            code: 'ROLE_DENIED',
          },
        });
      }

      next();
    } catch (error) {
      logger.error('Role check middleware error', {
        error: error.message,
        stack: error.stack,
        userId: req.user ? req.user.id : null,
        requiredRoles: allowedRoles,
      });
      return res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error during role check',
          code: 'ROLE_CHECK_ERROR',
        },
      });
    }
  };
};

module.exports = {
  requirePermission,
  requireRole,
};
