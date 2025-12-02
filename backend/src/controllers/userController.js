const { User, Role, WorkOrder, AuditLog, sequelize } = require('../models');
const { hashPassword } = require('../utils/password');
const logger = require('../utils/logger');
const { AUDIT_ACTION_TYPES, HTTP_STATUS, ROLES } = require('../utils/constants');
const { Op } = require('sequelize');

/**
 * User Management Controller (T138-T149)
 * Handles user CRUD operations, role management, and audit logging
 *
 * Implements:
 * - T139-T140: Create user with OpenID validation
 * - T141: Update user information
 * - T142: List users with filtering and pagination
 * - T143: Get user details with statistics
 * - T144: Get all roles with permissions
 * - T145: Update role permissions (super admin only)
 * - T146-T147: Get audit logs with filtering and pagination
 * - T149: Audit logging for all user management actions
 */

/**
 * Validate WeChat OpenID format (T140)
 * OpenID should start with 'o' and be 28 characters long
 *
 * @param {string} openid - WeChat OpenID to validate
 * @returns {boolean} True if valid format
 */
const validateOpenIDFormat = (openid) => {
  if (!openid || typeof openid !== 'string') return false;
  // WeChat OpenID typically starts with 'o' and is 28 characters
  return openid.startsWith('o') && openid.length === 28;
};

/**
 * Create audit log entry (T149)
 * Logs all user management actions with before/after state
 *
 * @param {Object} params - Audit log parameters
 * @param {number} params.userId - User who performed the action
 * @param {string} params.actionType - Type of action performed
 * @param {string} params.resourceType - Type of resource affected
 * @param {number} params.resourceId - ID of affected resource
 * @param {Object} params.beforeState - State before change
 * @param {Object} params.afterState - State after change
 * @param {boolean} params.success - Whether action succeeded
 * @param {string} params.errorMessage - Error message if failed
 * @param {string} params.ipAddress - Client IP address
 */
const createAuditLog = async ({
  userId,
  actionType,
  resourceType,
  resourceId,
  beforeState = null,
  afterState = null,
  success = true,
  errorMessage = null,
  ipAddress = null,
}) => {
  try {
    await AuditLog.create({
      timestamp: new Date(),
      user_id: userId,
      ip_address: ipAddress,
      action_type: actionType,
      resource_type: resourceType,
      resource_id: resourceId,
      before_state: beforeState,
      after_state: afterState,
      success,
      error_message: errorMessage,
    });
  } catch (error) {
    // Don't let audit log failures break the main operation
    logger.error('Failed to create audit log', {
      error: error.message,
      actionType,
      resourceType,
      resourceId,
    });
  }
};

/**
 * T139-T140: Create new user
 * POST /api/users
 * Only accessible by admins with 'manage_users' permission
 *
 * @route POST /api/users
 * @access Private (manage_users permission required)
 */
const createUser = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      wechat_openid,
      name,
      role_id,
      contact_phone,
      department,
      supervisor_id,
      active = true,
    } = req.body;

    // Validate WeChat OpenID format (T140)
    if (!validateOpenIDFormat(wechat_openid)) {
      await createAuditLog({
        userId: req.user.id,
        actionType: AUDIT_ACTION_TYPES.USER_CREATED,
        resourceType: 'user',
        resourceId: null,
        success: false,
        errorMessage: 'Invalid WeChat OpenID format',
        ipAddress: req.ip,
      });

      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          message: 'Invalid WeChat OpenID format. Must start with "o" and be 28 characters long.',
          code: 'INVALID_OPENID_FORMAT',
        },
      });
    }

    // Check if OpenID already registered (T140)
    const existingUser = await User.findOne({
      where: { wechat_openid },
      transaction,
    });

    if (existingUser) {
      await createAuditLog({
        userId: req.user.id,
        actionType: AUDIT_ACTION_TYPES.USER_CREATED,
        resourceType: 'user',
        resourceId: null,
        success: false,
        errorMessage: 'WeChat OpenID already registered',
        ipAddress: req.ip,
      });

      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        error: {
          message: 'This WeChat OpenID is already registered',
          code: 'OPENID_ALREADY_EXISTS',
        },
      });
    }

    // Validate role exists
    const role = await Role.findByPk(role_id, { transaction });
    if (!role) {
      await transaction.rollback();
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          message: 'Invalid role ID',
          code: 'ROLE_NOT_FOUND',
        },
      });
    }

    // Validate supervisor exists if provided
    if (supervisor_id) {
      const supervisor = await User.findByPk(supervisor_id, { transaction });
      if (!supervisor) {
        await transaction.rollback();
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: {
            message: 'Invalid supervisor ID',
            code: 'SUPERVISOR_NOT_FOUND',
          },
        });
      }
    }

    // Create user
    const newUser = await User.create(
      {
        wechat_openid,
        name,
        role_id,
        contact_phone,
        department,
        supervisor_id,
        active,
      },
      { transaction }
    );

    // Load user with role information
    const userWithRole = await User.findByPk(newUser.id, {
      include: [
        {
          model: Role,
          as: 'role',
          attributes: ['id', 'name', 'display_name'],
        },
        {
          model: User,
          as: 'supervisor',
          attributes: ['id', 'name', 'department'],
        },
      ],
      transaction,
    });

    // Create audit log (T149)
    await createAuditLog({
      userId: req.user.id,
      actionType: AUDIT_ACTION_TYPES.USER_CREATED,
      resourceType: 'user',
      resourceId: newUser.id,
      afterState: {
        wechat_openid,
        name,
        role_id,
        contact_phone,
        department,
        supervisor_id,
        active,
      },
      success: true,
      ipAddress: req.ip,
    });

    await transaction.commit();

    logger.info('User created successfully', {
      userId: newUser.id,
      createdBy: req.user.id,
      roleId: role_id,
    });

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: {
        user: userWithRole,
      },
      message: 'User created successfully',
    });
  } catch (error) {
    await transaction.rollback();

    logger.error('Error creating user', {
      error: error.message,
      stack: error.stack,
      userId: req.user.id,
    });

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        message: 'Failed to create user',
        code: 'USER_CREATE_ERROR',
      },
    });
  }
};

/**
 * T141: Update user information
 * PATCH /api/users/:id
 * Only accessible by admins with 'manage_users' permission
 *
 * @route PATCH /api/users/:id
 * @access Private (manage_users permission required)
 */
const updateUser = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.params.id;
    const { name, role_id, contact_phone, department, supervisor_id, active } = req.body;

    // Find user
    const user = await User.findByPk(userId, {
      include: [
        {
          model: Role,
          as: 'role',
          attributes: ['id', 'name', 'display_name'],
        },
      ],
      transaction,
    });

    if (!user) {
      await transaction.rollback();
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        },
      });
    }

    // Security check: Cannot deactivate yourself
    if (active === false && user.id === req.user.id) {
      await transaction.rollback();
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          message: 'You cannot deactivate your own account',
          code: 'CANNOT_DEACTIVATE_SELF',
        },
      });
    }

    // Security check: Cannot change your own role
    if (role_id && role_id !== user.role_id && user.id === req.user.id) {
      await transaction.rollback();
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          message: 'You cannot change your own role',
          code: 'CANNOT_CHANGE_OWN_ROLE',
        },
      });
    }

    // Validate role exists if being changed
    if (role_id && role_id !== user.role_id) {
      const role = await Role.findByPk(role_id, { transaction });
      if (!role) {
        await transaction.rollback();
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: {
            message: 'Invalid role ID',
            code: 'ROLE_NOT_FOUND',
          },
        });
      }
    }

    // Validate supervisor exists if being changed
    if (supervisor_id !== undefined && supervisor_id !== user.supervisor_id) {
      if (supervisor_id !== null) {
        const supervisor = await User.findByPk(supervisor_id, { transaction });
        if (!supervisor) {
          await transaction.rollback();
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            error: {
              message: 'Invalid supervisor ID',
              code: 'SUPERVISOR_NOT_FOUND',
            },
          });
        }
      }
    }

    // Capture before state for audit log (T149)
    const beforeState = {
      name: user.name,
      role_id: user.role_id,
      contact_phone: user.contact_phone,
      department: user.department,
      supervisor_id: user.supervisor_id,
      active: user.active,
    };

    // Update user
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (role_id !== undefined) updateData.role_id = role_id;
    if (contact_phone !== undefined) updateData.contact_phone = contact_phone;
    if (department !== undefined) updateData.department = department;
    if (supervisor_id !== undefined) updateData.supervisor_id = supervisor_id;
    if (active !== undefined) updateData.active = active;

    await user.update(updateData, { transaction });

    // Load updated user with relationships
    const updatedUser = await User.findByPk(userId, {
      include: [
        {
          model: Role,
          as: 'role',
          attributes: ['id', 'name', 'display_name'],
        },
        {
          model: User,
          as: 'supervisor',
          attributes: ['id', 'name', 'department'],
        },
      ],
      transaction,
    });

    // Capture after state for audit log
    const afterState = {
      name: updatedUser.name,
      role_id: updatedUser.role_id,
      contact_phone: updatedUser.contact_phone,
      department: updatedUser.department,
      supervisor_id: updatedUser.supervisor_id,
      active: updatedUser.active,
    };

    // Create audit log with before/after state (T149)
    await createAuditLog({
      userId: req.user.id,
      actionType: active === false ? AUDIT_ACTION_TYPES.USER_DEACTIVATED : AUDIT_ACTION_TYPES.USER_UPDATED,
      resourceType: 'user',
      resourceId: userId,
      beforeState,
      afterState,
      success: true,
      ipAddress: req.ip,
    });

    await transaction.commit();

    logger.info('User updated successfully', {
      userId,
      updatedBy: req.user.id,
      changes: Object.keys(updateData),
    });

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        user: updatedUser,
      },
      message: 'User updated successfully',
    });
  } catch (error) {
    await transaction.rollback();

    logger.error('Error updating user', {
      error: error.message,
      stack: error.stack,
      userId: req.params.id,
      updatedBy: req.user.id,
    });

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        message: 'Failed to update user',
        code: 'USER_UPDATE_ERROR',
      },
    });
  }
};

/**
 * T142: Get all users with filtering and pagination
 * GET /api/users
 * Support query filters: role_id, active, department, search
 *
 * @route GET /api/users
 * @access Private (manage_users permission required)
 */
const getUsers = async (req, res) => {
  try {
    const {
      role_id,
      active,
      department,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    // Build where clause
    const where = {};

    if (role_id) {
      where.role_id = parseInt(role_id, 10);
    }

    if (active !== undefined) {
      where.active = active === 'true' || active === '1';
    }

    if (department) {
      where.department = department;
    }

    if (search) {
      where.name = {
        [Op.like]: `%${search}%`,
      };
    }

    // Calculate pagination
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    // Query users
    const { count, rows: users } = await User.findAndCountAll({
      where,
      include: [
        {
          model: Role,
          as: 'role',
          attributes: ['id', 'name', 'display_name'],
        },
        {
          model: User,
          as: 'supervisor',
          attributes: ['id', 'name', 'department'],
        },
      ],
      order: [['created_at', 'DESC']],
      limit: limitNum,
      offset,
    });

    logger.info('Users retrieved', {
      filters: { role_id, active, department, search },
      count,
      page: pageNum,
      requestedBy: req.user.id,
    });

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        users,
        pagination: {
          total: count,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(count / limitNum),
        },
      },
    });
  } catch (error) {
    logger.error('Error retrieving users', {
      error: error.message,
      stack: error.stack,
      requestedBy: req.user.id,
    });

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        message: 'Failed to retrieve users',
        code: 'USERS_RETRIEVAL_ERROR',
      },
    });
  }
};

/**
 * T143: Get user by ID with statistics
 * GET /api/users/:id
 * Returns user with role, supervisor, and work order statistics
 *
 * @route GET /api/users/:id
 * @access Private (manage_users permission required)
 */
const getUserById = async (req, res) => {
  try {
    const userId = req.params.id;

    // Find user with relationships
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
          attributes: ['id', 'name', 'department', 'contact_phone'],
        },
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

    // Get work order statistics
    const assignedOrders = await WorkOrder.count({
      where: { assigned_technician_id: userId },
    });

    const completedOrders = await WorkOrder.count({
      where: {
        assigned_technician_id: userId,
        status: 'Completed',
      },
    });

    const inProgressOrders = await WorkOrder.count({
      where: {
        assigned_technician_id: userId,
        status: 'In Progress',
      },
    });

    logger.info('User details retrieved', {
      userId,
      requestedBy: req.user.id,
    });

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        user,
        statistics: {
          assigned_orders: assignedOrders,
          completed_orders: completedOrders,
          in_progress_orders: inProgressOrders,
          completion_rate: assignedOrders > 0
            ? Math.round((completedOrders / assignedOrders) * 100)
            : 0,
        },
      },
    });
  } catch (error) {
    logger.error('Error retrieving user', {
      error: error.message,
      stack: error.stack,
      userId: req.params.id,
      requestedBy: req.user.id,
    });

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        message: 'Failed to retrieve user',
        code: 'USER_RETRIEVAL_ERROR',
      },
    });
  }
};

/**
 * T144: Get all roles with permissions
 * GET /api/roles
 * Returns all roles with their permissions and user count
 *
 * @route GET /api/roles
 * @access Private (authenticated users)
 */
const getRoles = async (req, res) => {
  try {
    // Get all roles
    const roles = await Role.findAll({
      attributes: ['id', 'name', 'display_name', 'permissions_json', 'created_at'],
      order: [['id', 'ASC']],
    });

    // Get user count for each role
    const rolesWithCount = await Promise.all(
      roles.map(async (role) => {
        const userCount = await User.count({
          where: { role_id: role.id },
        });

        return {
          id: role.id,
          name: role.name,
          display_name: role.display_name,
          permissions_json: role.permissions_json,
          created_at: role.created_at,
          user_count: userCount,
        };
      })
    );

    logger.info('Roles retrieved', {
      count: roles.length,
      requestedBy: req.user ? req.user.id : 'anonymous',
    });

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        roles: rolesWithCount,
      },
    });
  } catch (error) {
    logger.error('Error retrieving roles', {
      error: error.message,
      stack: error.stack,
    });

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        message: 'Failed to retrieve roles',
        code: 'ROLES_RETRIEVAL_ERROR',
      },
    });
  }
};

/**
 * T145: Update role permissions
 * PATCH /api/roles/:id/permissions
 * Only accessible by super admin (role_id = 1)
 *
 * @route PATCH /api/roles/:id/permissions
 * @access Private (super admin only)
 */
const updateRolePermissions = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const roleId = req.params.id;
    const { permissions_json } = req.body;

    // Security check: Only super admin can update role permissions
    if (req.user.role_id !== ROLES.SUPER_ADMIN) {
      await createAuditLog({
        userId: req.user.id,
        actionType: AUDIT_ACTION_TYPES.ROLE_UPDATED,
        resourceType: 'role',
        resourceId: roleId,
        success: false,
        errorMessage: 'Unauthorized: Only super admin can update role permissions',
        ipAddress: req.ip,
      });

      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          message: 'Only super admin can update role permissions',
          code: 'SUPER_ADMIN_REQUIRED',
        },
      });
    }

    // Find role
    const role = await Role.findByPk(roleId, { transaction });

    if (!role) {
      await transaction.rollback();
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          message: 'Role not found',
          code: 'ROLE_NOT_FOUND',
        },
      });
    }

    // Validate permissions structure
    if (!permissions_json || typeof permissions_json !== 'object') {
      await transaction.rollback();
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          message: 'Invalid permissions structure',
          code: 'INVALID_PERMISSIONS',
        },
      });
    }

    if (!permissions_json.modules || typeof permissions_json.modules !== 'object') {
      await transaction.rollback();
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          message: 'Permissions JSON must contain a modules object',
          code: 'INVALID_PERMISSIONS_STRUCTURE',
        },
      });
    }

    // Capture before state
    const beforeState = {
      permissions_json: role.permissions_json,
    };

    // Update role permissions
    await role.update(
      { permissions_json },
      { transaction }
    );

    // Capture after state
    const afterState = {
      permissions_json,
    };

    // Create audit log (T149)
    await createAuditLog({
      userId: req.user.id,
      actionType: AUDIT_ACTION_TYPES.ROLE_UPDATED,
      resourceType: 'role',
      resourceId: roleId,
      beforeState,
      afterState,
      success: true,
      ipAddress: req.ip,
    });

    await transaction.commit();

    logger.info('Role permissions updated', {
      roleId,
      roleName: role.name,
      updatedBy: req.user.id,
    });

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        role: {
          id: role.id,
          name: role.name,
          display_name: role.display_name,
          permissions_json: role.permissions_json,
        },
      },
      message: 'Role permissions updated successfully',
    });
  } catch (error) {
    await transaction.rollback();

    logger.error('Error updating role permissions', {
      error: error.message,
      stack: error.stack,
      roleId: req.params.id,
      updatedBy: req.user.id,
    });

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        message: 'Failed to update role permissions',
        code: 'ROLE_UPDATE_ERROR',
      },
    });
  }
};

/**
 * T146-T147: Get audit logs with filtering and pagination
 * GET /api/audit-logs
 * Support filters: user_id, action_type, resource_type, date range
 *
 * @route GET /api/audit-logs
 * @access Private (manage_users permission required)
 */
const getAuditLogs = async (req, res) => {
  try {
    const {
      user_id,
      action_type,
      resource_type,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = req.query;

    // Build where clause
    const where = {};

    if (user_id) {
      where.user_id = parseInt(user_id, 10);
    }

    if (action_type) {
      where.action_type = action_type;
    }

    if (resource_type) {
      where.resource_type = resource_type;
    }

    // Date range filter
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999); // End of day
        where.timestamp[Op.lte] = endDateTime;
      }
    }

    // Calculate pagination (T147)
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    // Query audit logs
    const { count, rows: auditLogs } = await AuditLog.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'role_id'],
          include: [
            {
              model: Role,
              as: 'role',
              attributes: ['name', 'display_name'],
            },
          ],
        },
      ],
      order: [['timestamp', 'DESC']],
      limit: limitNum,
      offset,
    });

    logger.info('Audit logs retrieved', {
      filters: { user_id, action_type, resource_type, startDate, endDate },
      count,
      page: pageNum,
      requestedBy: req.user.id,
    });

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        audit_logs: auditLogs,
        pagination: {
          total: count,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(count / limitNum),
        },
      },
    });
  } catch (error) {
    logger.error('Error retrieving audit logs', {
      error: error.message,
      stack: error.stack,
      requestedBy: req.user.id,
    });

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        message: 'Failed to retrieve audit logs',
        code: 'AUDIT_LOGS_RETRIEVAL_ERROR',
      },
    });
  }
};

module.exports = {
  createUser,
  updateUser,
  getUsers,
  getUserById,
  getRoles,
  updateRolePermissions,
  getAuditLogs,
  validateOpenIDFormat,
  createAuditLog,
};
