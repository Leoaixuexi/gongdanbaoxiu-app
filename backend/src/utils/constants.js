/**
 * System Constants
 * Defines all enums, statuses, and constant values used throughout the application
 */

/**
 * Work Order Status Values
 * Maps to the status field in work_orders table
 */
const WORK_ORDER_STATUSES = [
  'Pending Repair',
  'In Progress',
  'Repaired',
  'Needs Rework',
  'Completed',
];

/**
 * Work Order Priority Levels
 * Maps to the priority field in work_orders table
 */
const PRIORITIES = [
  'Low',
  'Normal',
  'High',
  'Emergency',
];

/**
 * System Roles with Fixed IDs
 * Maps to the id field in roles table
 */
const ROLES = {
  SUPER_ADMIN: 1,
  SYSTEM_ADMIN: 2,
  ADMINISTRATIVE_MANAGER: 3,
  PROPERTY_STAFF: 4,
  MAINTENANCE_WORKER: 5,
};

/**
 * Notification Types
 * Maps to the notification_type field in notifications table
 */
const NOTIFICATION_TYPES = [
  'template_message',
  'push',
];

/**
 * Notification Delivery Statuses
 * Maps to the delivery_status field in notifications table
 */
const DELIVERY_STATUSES = [
  'pending',
  'sent',
  'failed',
  'delivered',
];

/**
 * Module-level Permissions
 * Used in roles.permissions_json.modules object
 */
const MODULE_PERMISSIONS = [
  'submit_work_orders',
  'review_work_orders',
  'view_analytics',
  'manage_users',
  'configure_system',
];

/**
 * Status Transition Rules
 * Defines valid state transitions for work order status
 */
const VALID_STATUS_TRANSITIONS = {
  'Pending Repair': ['In Progress'],
  'In Progress': ['Repaired', 'Needs Rework'],
  'Repaired': ['Completed', 'Needs Rework'],
  'Needs Rework': ['Pending Repair'],
  'Completed': [], // Terminal state - no transitions allowed
};

/**
 * Maximum Values
 */
const MAX_PHOTOS_PER_ORDER = 9;
const MAX_CONCURRENT_ORDERS_PER_TECHNICIAN = 5;
const MAX_NOTIFICATION_RETRIES = 3;
const MAX_PHOTO_SIZE_MB = 5;

/**
 * SLA Configuration
 */
const SLA_ESCALATION_THRESHOLD_PCT = 80; // Default escalation at 80% of deadline

/**
 * Audit Log Action Types
 */
const AUDIT_ACTION_TYPES = {
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  PERMISSION_CHANGED: 'permission_changed',
  WORK_ORDER_CREATED: 'work_order_created',
  WORK_ORDER_UPDATED: 'work_order_updated',
  STATUS_CHANGED: 'status_changed',
  USER_CREATED: 'user_created',
  USER_UPDATED: 'user_updated',
  USER_DEACTIVATED: 'user_deactivated',
  CONFIG_UPDATED: 'config_updated',
  ROLE_UPDATED: 'role_updated',
};

/**
 * HTTP Status Codes
 */
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
};

module.exports = {
  WORK_ORDER_STATUSES,
  PRIORITIES,
  ROLES,
  NOTIFICATION_TYPES,
  DELIVERY_STATUSES,
  MODULE_PERMISSIONS,
  VALID_STATUS_TRANSITIONS,
  MAX_PHOTOS_PER_ORDER,
  MAX_CONCURRENT_ORDERS_PER_TECHNICIAN,
  MAX_NOTIFICATION_RETRIES,
  MAX_PHOTO_SIZE_MB,
  SLA_ESCALATION_THRESHOLD_PCT,
  AUDIT_ACTION_TYPES,
  HTTP_STATUS,
};
