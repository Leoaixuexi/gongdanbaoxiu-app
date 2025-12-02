const { body, param, query, validationResult } = require('express-validator');
const { WORK_ORDER_STATUSES, PRIORITIES } = require('../utils/constants');
const logger = require('../utils/logger');

/**
 * Input Validation Middleware
 * Uses express-validator to validate and sanitize request inputs
 */

/**
 * Handle validation errors
 * Checks for validation errors and returns formatted error response
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
      userId: req.user ? req.user.id : null,
    });

    return res.status(400).json({
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
 * Validation rules for work order creation
 * Validates required fields for creating a new work order
 */
const validateWorkOrderCreate = [
  body('floor')
    .trim()
    .notEmpty()
    .withMessage('Floor is required')
    .isLength({ max: 20 })
    .withMessage('Floor must not exceed 20 characters')
    .escape(),

  body('location')
    .trim()
    .notEmpty()
    .withMessage('Location is required')
    .isLength({ max: 255 })
    .withMessage('Location must not exceed 255 characters')
    .escape(),

  body('fault_type_id')
    .notEmpty()
    .withMessage('Fault type is required')
    .isInt({ min: 1 })
    .withMessage('Fault type ID must be a positive integer')
    .toInt(),

  body('priority')
    .notEmpty()
    .withMessage('Priority is required')
    .isIn(PRIORITIES)
    .withMessage('Invalid priority value. Must be one of: ' + PRIORITIES.join(', ')),

  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ min: 10, max: 5000 })
    .withMessage('Description must be between 10 and 5000 characters')
    .escape(),

  body('photos_json')
    .optional()
    .isArray({ max: 9 })
    .withMessage('Maximum 9 photos allowed'),

  body('photos_json.*')
    .optional()
    .isURL()
    .withMessage('Each photo must be a valid URL'),

  handleValidationErrors,
];

/**
 * Validation rules for work order status update
 * Validates status transitions and required fields
 */
const validateWorkOrderUpdate = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Work order ID must be a positive integer')
    .toInt(),

  body('status')
    .optional()
    .isIn(WORK_ORDER_STATUSES)
    .withMessage('Invalid status value. Must be one of: ' + WORK_ORDER_STATUSES.join(', ')),

  body('completion_notes')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Completion notes must not exceed 5000 characters')
    .escape(),

  body('review_notes')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Review notes must not exceed 5000 characters')
    .escape(),

  body('photos_json')
    .optional()
    .isArray({ max: 9 })
    .withMessage('Maximum 9 photos allowed'),

  body('photos_json.*')
    .optional()
    .isURL()
    .withMessage('Each photo must be a valid URL'),

  handleValidationErrors,
];

/**
 * Validation rules for work order review
 * Validates review submission with status and notes
 */
const validateWorkOrderReview = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Work order ID must be a positive integer')
    .toInt(),

  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['Completed', 'Needs Rework'])
    .withMessage('Invalid status. Must be either "Completed" or "Needs Rework"'),

  body('review_notes')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Review notes must not exceed 5000 characters')
    .escape(),

  handleValidationErrors,
];

/**
 * Validation rules for user creation
 * Validates required fields for creating a new user
 */
const validateUserCreate = [
  body('wechat_openid')
    .trim()
    .notEmpty()
    .withMessage('WeChat OpenID is required')
    .isLength({ max: 255 })
    .withMessage('WeChat OpenID must not exceed 255 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Invalid WeChat OpenID format'),

  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .escape(),

  body('role_id')
    .notEmpty()
    .withMessage('Role ID is required')
    .isInt({ min: 1, max: 5 })
    .withMessage('Role ID must be between 1 and 5')
    .toInt(),

  body('contact_phone')
    .optional()
    .trim()
    .matches(/^[0-9+\-() ]{7,20}$/)
    .withMessage('Invalid phone number format')
    .escape(),

  body('department')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Department must not exceed 100 characters')
    .escape(),

  body('supervisor_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Supervisor ID must be a positive integer')
    .toInt(),

  handleValidationErrors,
];

/**
 * Validation rules for user update
 * Validates fields for updating an existing user
 */
const validateUserUpdate = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer')
    .toInt(),

  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .escape(),

  body('role_id')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Role ID must be between 1 and 5')
    .toInt(),

  body('contact_phone')
    .optional()
    .trim()
    .matches(/^[0-9+\-() ]{7,20}$/)
    .withMessage('Invalid phone number format')
    .escape(),

  body('department')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Department must not exceed 100 characters')
    .escape(),

  body('supervisor_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Supervisor ID must be a positive integer')
    .toInt(),

  body('active')
    .optional()
    .isBoolean()
    .withMessage('Active status must be a boolean')
    .toBoolean(),

  handleValidationErrors,
];

/**
 * Validation rules for pagination query parameters
 */
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),

  handleValidationErrors,
];

/**
 * Validation rules for work order ID parameter
 */
const validateWorkOrderId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Work order ID must be a positive integer')
    .toInt(),

  handleValidationErrors,
];

/**
 * Validation rules for user ID parameter
 */
const validateUserId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer')
    .toInt(),

  handleValidationErrors,
];

/**
 * Validation rules for role ID parameter
 */
const validateRoleId = [
  param('id')
    .isInt({ min: 1, max: 5 })
    .withMessage('Role ID must be between 1 and 5')
    .toInt(),

  handleValidationErrors,
];

/**
 * Validation rules for role permission update
 * Validates permissions JSON structure
 */
const validateRolePermissions = [
  param('id')
    .isInt({ min: 1, max: 5 })
    .withMessage('Role ID must be between 1 and 5')
    .toInt(),

  body('permissions_json')
    .notEmpty()
    .withMessage('Permissions JSON is required')
    .isObject()
    .withMessage('Permissions must be a valid JSON object'),

  body('permissions_json.modules')
    .notEmpty()
    .withMessage('Permissions JSON must contain a modules object')
    .isObject()
    .withMessage('Modules must be a valid object'),

  handleValidationErrors,
];

/**
 * Validation rules for audit log query parameters
 */
const validateAuditLogQuery = [
  query('user_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer')
    .toInt(),

  query('action_type')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Action type must not exceed 50 characters'),

  query('resource_type')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Resource type must not exceed 50 characters'),

  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),

  handleValidationErrors,
];

/**
 * Validation rules for duplicate detection query parameters
 */
const validateDuplicateQuery = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),

  query('minSimilarity')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Minimum similarity must be between 0 and 100')
    .toInt(),

  handleValidationErrors,
];

module.exports = {
  validateWorkOrderCreate,
  validateWorkOrderUpdate,
  validateWorkOrderReview,
  validateUserCreate,
  validateUserUpdate,
  validatePagination,
  validateWorkOrderId,
  validateUserId,
  validateRoleId,
  validateRolePermissions,
  validateAuditLogQuery,
  validateDuplicateQuery,
  handleValidationErrors,
};
