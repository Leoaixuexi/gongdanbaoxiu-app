const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const { HTTP_STATUS } = require('../utils/constants');

/**
 * Authentication Routes
 *
 * Handles user authentication and session management for WeChat Mini Program.
 *
 * Routes:
 * - POST   /auth/wechat-login  - WeChat Mini Program login
 * - POST   /auth/refresh       - Refresh JWT token
 * - POST   /auth/logout        - Logout (client-side token removal)
 * - GET    /auth/me            - Get current user info
 */

/**
 * Validation error handler middleware
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorDetails = errors.array().map((error) => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
    }));

    logger.warn('Validation failed', {
      url: req.originalUrl,
      method: req.method,
      errors: errorDetails,
    });

    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errorDetails,
      },
    });
  }

  next();
};

/**
 * POST /auth/login
 * Username/Password login endpoint
 *
 * Authenticates user with username and password.
 *
 * Request body:
 * {
 *   username: string (required) - Username (contact_phone)
 *   password: string (required) - User password
 * }
 *
 * Response:
 * {
 *   user: {...},
 *   token: string,
 *   permissions: object
 * }
 *
 * Error responses:
 * - 400: Missing username or password
 * - 401: Invalid credentials
 * - 403: User account inactive
 * - 500: Internal server error
 */
router.post(
  '/login',
  [
    body('username')
      .trim()
      .notEmpty()
      .withMessage('Username is required'),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
    handleValidationErrors,
  ],
  authController.loginHandler
);

/**
 * POST /auth/wechat-login
 * WeChat Mini Program login endpoint
 *
 * Exchanges WeChat temporary code for user session and JWT token.
 * Creates new user account if first login.
 *
 * Request body:
 * {
 *   code: string (required) - Temporary login code from wx.login()
 *   userInfo: object (optional) - User info from WeChat (nickname, avatar, etc.)
 *     {
 *       nickName: string,
 *       avatarUrl: string,
 *       gender: number,
 *       country: string,
 *       province: string,
 *       city: string,
 *       language: string
 *     }
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     user: {
 *       id: number,
 *       name: string,
 *       role_id: number,
 *       role: {
 *         id: number,
 *         name: string,
 *         display_name: string,
 *         permissions: object
 *       },
 *       contact_phone: string,
 *       department: string,
 *       active: boolean,
 *       last_login_at: datetime
 *     },
 *     token: string,
 *     expiresIn: string
 *   }
 * }
 *
 * Error responses:
 * - 400: Missing or invalid code
 * - 401: WeChat login failed
 * - 403: User account inactive
 * - 500: Internal server error
 */
router.post(
  '/wechat-login',
  [
    body('code')
      .trim()
      .notEmpty()
      .withMessage('WeChat login code is required')
      .isString()
      .withMessage('Code must be a string')
      .isLength({ min: 10, max: 100 })
      .withMessage('Invalid code format'),
    body('userInfo')
      .optional()
      .isObject()
      .withMessage('userInfo must be an object'),
    body('userInfo.nickName')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Nickname too long'),
    handleValidationErrors,
  ],
  authController.wechatLoginHandler
);

/**
 * POST /auth/refresh
 * Refresh JWT token
 *
 * Generates a new token from a valid existing token.
 * Extends the session without requiring re-login.
 *
 * Headers:
 * - Authorization: Bearer <token> (required)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     token: string,
 *     expiresIn: string
 *   }
 * }
 *
 * Error responses:
 * - 401: Invalid or expired token
 * - 403: User account inactive
 * - 500: Internal server error
 */
router.post('/refresh', authenticateToken, authController.refreshToken);

/**
 * POST /auth/logout
 * Logout endpoint
 *
 * Logs the logout event for audit purposes.
 * Client should remove the token from storage.
 *
 * Headers:
 * - Authorization: Bearer <token> (required)
 *
 * Response:
 * {
 *   success: true,
 *   message: "Logged out successfully"
 * }
 *
 * Error responses:
 * - 401: Invalid or expired token
 * - 500: Internal server error
 */
router.post('/logout', authenticateToken, authController.logout);

/**
 * POST /auth/user-by-openid
 * Cloud-based authentication using WeChat openid
 *
 * Used in hybrid architecture where cloud functions provide the openid.
 * Finds existing user or creates new user with the provided openid.
 *
 * Request body:
 * {
 *   openid: string (required) - WeChat openid from cloud function
 * }
 *
 * Response:
 * {
 *   user: {...},
 *   token: string,
 *   permissions: object
 * }
 *
 * Error responses:
 * - 400: Missing openid
 * - 401: Invalid openid or user inactive
 * - 500: Internal server error
 */
router.post(
  '/user-by-openid',
  [
    body('openid')
      .trim()
      .notEmpty()
      .withMessage('WeChat openid is required')
      .isString()
      .withMessage('Openid must be a string')
      .isLength({ min: 20, max: 100 })
      .withMessage('Invalid openid format'),
    handleValidationErrors,
  ],
  authController.userByOpenIdHandler
);

/**
 * GET /auth/me
 * Get current user information
 *
 * Returns detailed information about the authenticated user,
 * including role, permissions, and supervisor.
 *
 * Headers:
 * - Authorization: Bearer <token> (required)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     user: {
 *       id: number,
 *       name: string,
 *       role_id: number,
 *       role: {
 *         id: number,
 *         name: string,
 *         display_name: string,
 *         permissions: {
 *           modules: {
 *             submit_work_orders: boolean,
 *             review_work_orders: boolean,
 *             view_analytics: boolean,
 *             manage_users: boolean,
 *             configure_system: boolean
 *           },
 *           actions: {
 *             create_work_order: boolean,
 *             update_work_order: boolean,
 *             ...
 *           }
 *         }
 *       },
 *       contact_phone: string,
 *       department: string,
 *       supervisor_id: number,
 *       supervisor: {
 *         id: number,
 *         name: string,
 *         contact_phone: string,
 *         department: string
 *       },
 *       active: boolean,
 *       last_login_at: datetime,
 *       created_at: datetime
 *     }
 *   }
 * }
 *
 * Error responses:
 * - 401: Invalid or expired token
 * - 403: User account inactive
 * - 404: User not found
 * - 500: Internal server error
 */
router.get('/me', authenticateToken, authController.getCurrentUser);

module.exports = router;
