const { User, Role, AuditLog } = require('../models');
const { login: wechatLogin } = require('../config/wechat');
const { generateToken, verifyToken } = require('../utils/jwt');
const { comparePassword } = require('../utils/password');
const logger = require('../utils/logger');
const { AUDIT_ACTION_TYPES, HTTP_STATUS } = require('../utils/constants');

/**
 * Authentication Controller
 * Handles user authentication via WeChat Mini Program
 *
 * Features:
 * - WeChat login (code2Session)
 * - JWT token generation
 * - Token refresh
 * - User info retrieval
 * - Audit logging for security events
 */

/**
 * Username/Password Login
 *
 * Workflow:
 * 1. Validate username and password
 * 2. Find user by username field
 * 3. Verify password
 * 4. Check if user is active
 * 5. Update last login timestamp
 * 6. Generate JWT token
 * 7. Log login event
 * 8. Return user info and token
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 *
 * Request body:
 * {
 *   username: string (required) - Username (stored in contact_phone field)
 *   password: string (required) - Password
 * }
 *
 * Response:
 * {
 *   token: string,
 *   user: {...},
 *   permissions: {...}
 * }
 */
const loginHandler = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        message: '用户名和密码不能为空',
      });
    }

    logger.info('Processing login request', { username });

    // Find user by username (using contact_phone field as username)
    const user = await User.findOne({
      where: { contact_phone: username },
      include: [
        {
          model: Role,
          as: 'role',
          attributes: ['id', 'name', 'display_name', 'permissions_json'],
        },
      ],
    });

    if (!user) {
      logger.warn('Login failed: user not found', { username });
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        message: '用户名或密码错误',
      });
    }

    // Check if user is active
    if (!user.active) {
      logger.warn('Login failed: user inactive', { userId: user.id });
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        message: '账号已被禁用，请联系管理员',
      });
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      logger.warn('Login failed: invalid password', { userId: user.id });
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        message: '用户名或密码错误',
      });
    }

    // Update last login timestamp
    await user.update({
      last_login_at: new Date(),
    });

    // Generate JWT token
    const tokenPayload = {
      userId: user.id,
      roleId: user.role_id,
    };

    const token = generateToken(tokenPayload);
    const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

    // Log login event
    await AuditLog.create({
      user_id: user.id,
      action: AUDIT_ACTION_TYPES.USER_LOGIN,
      resource_type: 'auth',
      resource_id: user.id,
      details: {
        loginMethod: 'password',
        username,
      },
    });

    // Return user info and token
    const responseData = {
      user: {
        id: user.id,
        name: user.name,
        role_id: user.role_id,
        role: {
          id: user.role.id,
          name: user.role.name,
          display_name: user.role.display_name,
          permissions: user.role.permissions_json,
        },
        contact_phone: user.contact_phone,
        department: user.department,
        active: user.active,
        last_login_at: user.last_login_at,
      },
      token,
      permissions: user.role.permissions_json,
    };

    logger.info('Login successful', { userId: user.id });

    return res.status(HTTP_STATUS.OK).json(responseData);
  } catch (error) {
    logger.error('Login handler error', {
      error: error.message,
      stack: error.stack,
    });

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      message: '登录失败，请稍后重试',
    });
  }
};

/**
 * WeChat Mini Program Login
 *
 * Workflow:
 * 1. Exchange WeChat code for openid and session_key
 * 2. Find or create user by openid
 * 3. Update last login timestamp
 * 4. Generate JWT token
 * 5. Log login event
 * 6. Return user info and token
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 *
 * Request body:
 * {
 *   code: string (required) - Temporary login code from WeChat client
 *   userInfo: object (optional) - User info from WeChat (nickname, avatar, etc.)
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     user: {...},
 *     token: string,
 *     expiresIn: string
 *   }
 * }
 */
const wechatLoginHandler = async (req, res) => {
  try {
    const { code, userInfo } = req.body;

    if (!code) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          message: 'WeChat login code is required',
          code: 'CODE_REQUIRED',
        },
      });
    }

    logger.info('Processing WeChat login request');

    // Step 1: Exchange code for openid and session_key
    let wechatData;
    try {
      wechatData = await wechatLogin(code);
    } catch (error) {
      logger.error('WeChat login API failed', {
        error: error.message,
      });
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          message: 'WeChat login failed. Please try again.',
          code: 'WECHAT_LOGIN_FAILED',
        },
      });
    }

    const { openid, session_key, unionid } = wechatData;

    // Step 2: Find or create user by openid
    let user = await User.findOne({
      where: { wechat_openid: openid },
      include: [
        {
          model: Role,
          as: 'role',
          attributes: ['id', 'name', 'display_name', 'permissions_json'],
        },
      ],
    });

    const isNewUser = !user;

    if (isNewUser) {
      // New user - create with default Property Staff role (role_id = 4)
      // In production, you might want to require admin approval or additional info
      logger.info('Creating new user from WeChat login', {
        openid: openid.substring(0, 10) + '...',
      });

      user = await User.create({
        wechat_openid: openid,
        name: userInfo?.nickName || 'WeChat User',
        role_id: 4, // Default: Property Staff
        active: true, // Auto-activate new users
        last_login_at: new Date(),
      });

      // Reload with role information
      user = await User.findByPk(user.id, {
        include: [
          {
            model: Role,
            as: 'role',
            attributes: ['id', 'name', 'display_name', 'permissions_json'],
          },
        ],
      });

      logger.info('New user created successfully', {
        userId: user.id,
        roleId: user.role_id,
      });
    } else {
      // Existing user - check if active
      if (!user.active) {
        logger.warn('Inactive user attempted login', {
          userId: user.id,
          openid: openid.substring(0, 10) + '...',
        });
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          error: {
            message: 'Your account has been deactivated. Please contact administrator.',
            code: 'USER_INACTIVE',
          },
        });
      }

      // Step 3: Update last login timestamp
      await user.update({
        last_login_at: new Date(),
      });

      logger.info('Existing user logged in', {
        userId: user.id,
        roleId: user.role_id,
      });
    }

    // Step 4: Generate JWT token
    const tokenPayload = {
      userId: user.id,
      roleId: user.role_id,
      openid: openid,
    };

    const token = generateToken(tokenPayload);
    const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

    // Step 5: Log login event
    await AuditLog.create({
      user_id: user.id,
      action: AUDIT_ACTION_TYPES.USER_LOGIN,
      resource_type: 'auth',
      resource_id: user.id,
      details: {
        isNewUser,
        loginMethod: 'wechat',
      },
    });

    // Step 6: Return user info and token
    // Don't send sensitive information
    const responseData = {
      user: {
        id: user.id,
        name: user.name,
        role_id: user.role_id,
        role: {
          id: user.role.id,
          name: user.role.name,
          display_name: user.role.display_name,
          permissions: user.role.permissions_json,
        },
        contact_phone: user.contact_phone,
        department: user.department,
        active: user.active,
        last_login_at: user.last_login_at,
      },
      token,
      expiresIn,
    };

    logger.info('WeChat login completed successfully', {
      userId: user.id,
      isNewUser,
    });

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    logger.error('WeChat login handler error', {
      error: error.message,
      stack: error.stack,
    });

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        message: 'Internal server error during login',
        code: 'LOGIN_ERROR',
      },
    });
  }
};

/**
 * Refresh JWT token
 *
 * Generates a new token from a valid existing token
 * Useful for extending session without re-login
 *
 * @param {Object} req - Express request (with authenticated user)
 * @param {Object} res - Express response
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     token: string,
 *     expiresIn: string
 *   }
 * }
 */
const refreshToken = async (req, res) => {
  try {
    const user = req.user;

    logger.info('Refreshing token', {
      userId: user.id,
    });

    // Check if user is still active
    if (!user.active) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          message: 'User account is inactive',
          code: 'USER_INACTIVE',
        },
      });
    }

    // Generate new token
    const tokenPayload = {
      userId: user.id,
      roleId: user.role_id,
      openid: user.wechat_openid,
    };

    const token = generateToken(tokenPayload);
    const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

    logger.info('Token refreshed successfully', {
      userId: user.id,
    });

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        token,
        expiresIn,
      },
    });
  } catch (error) {
    logger.error('Token refresh error', {
      error: error.message,
      stack: error.stack,
      userId: req.user ? req.user.id : null,
    });

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        message: 'Failed to refresh token',
        code: 'TOKEN_REFRESH_FAILED',
      },
    });
  }
};

/**
 * Logout
 *
 * Logs the logout event and optionally blacklists the token
 * (Token blacklisting requires Redis implementation)
 *
 * @param {Object} req - Express request (with authenticated user)
 * @param {Object} res - Express response
 *
 * Response:
 * {
 *   success: true,
 *   message: string
 * }
 */
const logout = async (req, res) => {
  try {
    const user = req.user;

    logger.info('User logging out', {
      userId: user.id,
    });

    // Log logout event
    await AuditLog.create({
      user_id: user.id,
      action: AUDIT_ACTION_TYPES.USER_LOGOUT,
      resource_type: 'auth',
      resource_id: user.id,
      details: {
        logoutMethod: 'explicit',
      },
    });

    // TODO: Implement token blacklisting in Redis
    // const token = req.headers.authorization.substring(7);
    // await redisClient.set(`blacklist:${token}`, '1', 'EX', JWT_EXPIRES_IN_SECONDS);

    logger.info('User logged out successfully', {
      userId: user.id,
    });

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    logger.error('Logout error', {
      error: error.message,
      stack: error.stack,
      userId: req.user ? req.user.id : null,
    });

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        message: 'Failed to logout',
        code: 'LOGOUT_FAILED',
      },
    });
  }
};

/**
 * Get current user info
 *
 * Returns detailed information about the authenticated user
 *
 * @param {Object} req - Express request (with authenticated user)
 * @param {Object} res - Express response
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     user: {...}
 *   }
 * }
 */
const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.id;

    logger.debug('Fetching current user info', { userId });

    // Fetch fresh user data with role information
    const user = await User.findByPk(userId, {
      include: [
        {
          model: Role,
          as: 'role',
          attributes: ['id', 'name', 'display_name', 'permissions_json'],
        },
        {
          model: User,
          as: 'supervisor',
          attributes: ['id', 'name', 'contact_phone', 'department'],
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
        'created_at',
      ],
    });

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        },
      });
    }

    if (!user.active) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          message: 'User account is inactive',
          code: 'USER_INACTIVE',
        },
      });
    }

    // Format response (don't expose sensitive data)
    const userData = {
      id: user.id,
      name: user.name,
      role_id: user.role_id,
      role: {
        id: user.role.id,
        name: user.role.name,
        display_name: user.role.display_name,
        permissions: user.role.permissions_json,
      },
      contact_phone: user.contact_phone,
      department: user.department,
      supervisor_id: user.supervisor_id,
      supervisor: user.supervisor
        ? {
            id: user.supervisor.id,
            name: user.supervisor.name,
            contact_phone: user.supervisor.contact_phone,
            department: user.supervisor.department,
          }
        : null,
      active: user.active,
      last_login_at: user.last_login_at,
      created_at: user.created_at,
    };

    logger.debug('Current user info fetched successfully', { userId });

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        user: userData,
      },
    });
  } catch (error) {
    logger.error('Failed to get current user info', {
      error: error.message,
      stack: error.stack,
      userId: req.user ? req.user.id : null,
    });

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        message: 'Failed to fetch user information',
        code: 'USER_FETCH_FAILED',
      },
    });
  }
};

/**
 * User By OpenID Handler
 *
 * Get or create user by WeChat openid (from cloud function)
 * This is used for hybrid architecture where cloud functions
 * handle the initial WeChat login and provide the openid
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
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
 *   permissions: {...}
 * }
 */
const userByOpenIdHandler = async (req, res) => {
  try {
    const { openid } = req.body;

    if (!openid) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        message: 'WeChat openid is required',
      });
    }

    logger.info('Processing user-by-openid request', {
      openid: openid.substring(0, 10) + '...',
    });

    // Find user by openid
    let user = await User.findOne({
      where: { wechat_openid: openid },
      include: [
        {
          model: Role,
          as: 'role',
          attributes: ['id', 'name', 'display_name', 'permissions_json'],
        },
      ],
    });

    const isNewUser = !user;

    if (isNewUser) {
      // New user - create with default Property Staff role (role_id = 4)
      logger.info('Creating new user from openid', {
        openid: openid.substring(0, 10) + '...',
      });

      user = await User.create({
        wechat_openid: openid,
        name: '微信用户',
        role_id: 4, // Default: Property Staff
        active: true,
        last_login_at: new Date(),
      });

      // Reload with role association
      user = await User.findByPk(user.id, {
        include: [
          {
            model: Role,
            as: 'role',
            attributes: ['id', 'name', 'display_name', 'permissions_json'],
          },
        ],
      });
    } else {
      // Existing user - update last login
      await user.update({
        last_login_at: new Date(),
      });
    }

    // Check if user is active
    if (!user.active) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        message: '账号已被禁用，请联系管理员',
      });
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      roleId: user.role_id,
    });

    // Log login event
    await AuditLog.create({
      user_id: user.id,
      action: 'USER_LOGIN',
      resource_type: 'auth',
      resource_id: null,
      details: {
        loginMethod: 'cloud_openid',
        isNewUser,
        openid: openid.substring(0, 10) + '...',
      },
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });

    logger.info('User-by-openid successful', {
      userId: user.id,
      roleId: user.role_id,
      isNewUser,
    });

    // Return user data (exclude sensitive fields)
    const userData = {
      id: user.id,
      name: user.name,
      role_id: user.role_id,
      contact_phone: user.contact_phone,
      department: user.department,
      active: user.active,
      last_login_at: user.last_login_at,
      created_at: user.created_at,
    };

    return res.json({
      user: userData,
      token,
      permissions: user.role?.permissions_json || {},
    });
  } catch (error) {
    logger.error('User-by-openid failed', {
      error: error.message,
      stack: error.stack,
    });

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      message: '登录失败，请稍后重试',
    });
  }
};

module.exports = {
  loginHandler,
  wechatLoginHandler,
  userByOpenIdHandler,
  refreshToken,
  logout,
  getCurrentUser,
};
