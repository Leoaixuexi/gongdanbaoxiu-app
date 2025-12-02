const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission, requireRole } = require('../middleware/rbac');
const {
  validateUserCreate,
  validateUserUpdate,
  validateUserId,
  validateRoleId,
  validateRolePermissions,
  validateAuditLogQuery,
  validatePagination,
} = require('../middleware/validation');

/**
 * User Management Routes (T148)
 * All routes require authentication
 * Most routes require 'manage_users' permission
 * Role permission updates require super admin role
 */

/**
 * @route   POST /api/users
 * @desc    Create new user
 * @access  Private (manage_users permission)
 * @implements T139-T140
 */
router.post(
  '/',
  authenticateToken,
  requirePermission('manage_users'),
  validateUserCreate,
  userController.createUser
);

/**
 * @route   PATCH /api/users/:id
 * @desc    Update user information
 * @access  Private (manage_users permission)
 * @implements T141
 */
router.patch(
  '/:id',
  authenticateToken,
  requirePermission('manage_users'),
  validateUserUpdate,
  userController.updateUser
);

/**
 * @route   GET /api/users
 * @desc    Get all users with filtering and pagination
 * @access  Private (manage_users permission)
 * @query   role_id, active, department, search, page, limit
 * @implements T142
 */
router.get(
  '/',
  authenticateToken,
  requirePermission('manage_users'),
  validatePagination,
  userController.getUsers
);

/**
 * @route   GET /api/roles
 * @desc    Get all roles with permissions
 * @access  Private (authenticated)
 * @implements T144
 * @note    Must be defined before /:id to avoid route conflict
 */
router.get(
  '/roles',
  authenticateToken,
  userController.getRoles
);

/**
 * @route   PATCH /api/roles/:id/permissions
 * @desc    Update role permissions
 * @access  Private (super admin only - role_id = 1)
 * @implements T145
 * @note    Must be defined before /:id to avoid route conflict
 */
router.patch(
  '/roles/:id/permissions',
  authenticateToken,
  requireRole(1), // Super admin only
  validateRolePermissions,
  userController.updateRolePermissions
);

/**
 * @route   GET /api/audit-logs
 * @desc    Get audit logs with filtering and pagination
 * @access  Private (manage_users permission)
 * @query   user_id, action_type, resource_type, startDate, endDate, page, limit
 * @implements T146-T147
 * @note    Must be defined before /:id to avoid route conflict
 */
router.get(
  '/audit-logs',
  authenticateToken,
  requirePermission('manage_users'),
  validateAuditLogQuery,
  userController.getAuditLogs
);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID with statistics
 * @access  Private (manage_users permission)
 * @implements T143
 */
router.get(
  '/:id',
  authenticateToken,
  requirePermission('manage_users'),
  validateUserId,
  userController.getUserById
);

module.exports = router;
