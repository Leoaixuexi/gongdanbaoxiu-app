/**
 * Frontend Constants
 * Mirrors backend constants and adds UI-specific constants
 */

// Work Order Status Values (mirrors backend)
const WORK_ORDER_STATUSES = [
  'Pending Repair',
  'In Progress',
  'Repaired',
  'Needs Rework',
  'Completed',
];

// Work Order Priority Levels (mirrors backend)
const PRIORITIES = [
  'Low',
  'Normal',
  'High',
  'Emergency',
];

// System Roles (mirrors cloud database)
const ROLES = {
  ADMIN: 1,                  // 系统管理员
  PROPERTY_MANAGER: 2,       // 物业经理
  MAINTENANCE_STAFF: 3,      // 维修员
  PROPERTY_STAFF: 4,         // 物业员工
};

// Notification Types (mirrors backend)
const NOTIFICATION_TYPES = [
  'template_message',
  'push',
];

// Delivery Statuses (mirrors backend)
const DELIVERY_STATUSES = [
  'pending',
  'sent',
  'failed',
  'delivered',
];

// Module Permissions (mirrors backend)
const MODULE_PERMISSIONS = [
  'submit_work_orders',
  'review_work_orders',
  'view_analytics',
  'manage_users',
  'configure_system',
];

// Status Display Names (Chinese)
const STATUS_DISPLAY_NAMES = {
  'Pending Repair': '待维修',
  'In Progress': '维修中',
  'Repaired': '已维修',
  'Needs Rework': '需返工',
  'Completed': '已完成',
};

// Priority Display Names (Chinese)
const PRIORITY_DISPLAY_NAMES = {
  'Low': '低',
  'Normal': '普通',
  'High': '高',
  'Emergency': '紧急',
};

// Role Display Names (Chinese) - matches cloud database
const ROLE_DISPLAY_NAMES = {
  1: '系统管理员',
  2: '物业经理',
  3: '维修员',
  4: '物业员工',
};

// Status Colors for UI badges/tags
const STATUS_COLORS = {
  'Pending Repair': '#ff9800',    // Orange
  'In Progress': '#2196f3',       // Blue
  'Repaired': '#4caf50',          // Green
  'Needs Rework': '#f44336',      // Red
  'Completed': '#9e9e9e',         // Grey
};

// Priority Colors for UI badges/tags
const PRIORITY_COLORS = {
  'Low': '#9e9e9e',               // Grey
  'Normal': '#2196f3',            // Blue
  'High': '#ff9800',              // Orange
  'Emergency': '#f44336',         // Red
};

// Delivery Status Display Names (Chinese)
const DELIVERY_STATUS_DISPLAY_NAMES = {
  'pending': '待发送',
  'sent': '已发送',
  'failed': '发送失败',
  'delivered': '已送达',
};

// Delivery Status Colors
const DELIVERY_STATUS_COLORS = {
  'pending': '#ff9800',
  'sent': '#2196f3',
  'failed': '#f44336',
  'delivered': '#4caf50',
};

// API Base URL - from config file
const config = require('../config/index');
const API_BASE_URL = config.baseURL;

// Maximum Values
const MAX_PHOTOS_PER_ORDER = 9;
const MAX_PHOTO_SIZE_MB = 5;
const MAX_CONCURRENT_ORDERS_PER_TECHNICIAN = 5;

// Storage Keys
const STORAGE_KEYS = {
  TOKEN: 'auth_token',
  USER_INFO: 'user_info',
  USER_PERMISSIONS: 'user_permissions',
  LAST_LOGIN: 'last_login',
  SETTINGS: 'app_settings',
  WECHAT_OPENID: 'wechat_openid',
};

// HTTP Status Codes
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

// Request Timeout (milliseconds)
const REQUEST_TIMEOUT = 10000;

// Image Compression Quality
const IMAGE_QUALITY = 80;

// Pagination
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

module.exports = {
  WORK_ORDER_STATUSES,
  PRIORITIES,
  ROLES,
  NOTIFICATION_TYPES,
  DELIVERY_STATUSES,
  MODULE_PERMISSIONS,
  STATUS_DISPLAY_NAMES,
  PRIORITY_DISPLAY_NAMES,
  ROLE_DISPLAY_NAMES,
  STATUS_COLORS,
  PRIORITY_COLORS,
  DELIVERY_STATUS_DISPLAY_NAMES,
  DELIVERY_STATUS_COLORS,
  API_BASE_URL,
  MAX_PHOTOS_PER_ORDER,
  MAX_PHOTO_SIZE_MB,
  MAX_CONCURRENT_ORDERS_PER_TECHNICIAN,
  STORAGE_KEYS,
  HTTP_STATUS,
  REQUEST_TIMEOUT,
  IMAGE_QUALITY,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
};
