const express = require('express');
const router = express.Router();
const workOrderController = require('../controllers/workOrderController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const {
  validateWorkOrderCreate,
  validatePagination,
  validateWorkOrderId,
  validateWorkOrderUpdate,
  validateWorkOrderReview,
  validateDuplicateQuery,
} = require('../middleware/validation');

/**
 * Work Order Routes (T063, T080-T081)
 *
 * All routes require authentication.
 * Some routes require specific permissions.
 *
 * Routes:
 * - POST   /workorders          - Create new work order (requires submit_work_orders permission)
 * - GET    /workorders          - List work orders with filtering and pagination
 * - GET    /workorders/:id      - Get work order details by ID
 * - PATCH  /workorders/:id/start   - Start repair work (assigned technician only)
 * - PATCH  /workorders/:id/repair  - Update repair status (assigned technician only)
 */

/**
 * POST /workorders
 * Create new work order
 *
 * Required permission: submit_work_orders
 *
 * Request body:
 * {
 *   floor: string (required, max 20 chars)
 *   location: string (required, max 255 chars)
 *   fault_type_id: number (required, positive integer)
 *   priority: string (required, one of: Low, Normal, High, Emergency)
 *   description: string (required, 10-5000 chars)
 *   photos_json: array[string] (optional, max 9 URLs)
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     id: number,
 *     order_number: string,
 *     floor: string,
 *     location: string,
 *     fault_type_id: number,
 *     priority: string,
 *     description: string,
 *     photos_json: array[string],
 *     status: string,
 *     submitter_id: number,
 *     assigned_technician_id: number,
 *     assigned_at: datetime,
 *     sla_deadline: datetime,
 *     is_overdue: boolean,
 *     created_at: datetime,
 *     updated_at: datetime,
 *     submitter: {...},
 *     assigned_technician: {...},
 *     fault_type: {...}
 *   }
 * }
 */
router.post(
  '/',
  authenticateToken,
  requirePermission('submit_work_orders'),
  validateWorkOrderCreate,
  workOrderController.create
);

/**
 * GET /workorders
 * List work orders with filtering and pagination
 *
 * Role-based filtering:
 * - Property staff: See only their submitted orders
 * - Maintenance workers: See only their assigned orders
 * - Managers/admins: See all orders
 *
 * Query parameters:
 * - status: string (optional, filter by status)
 * - priority: string (optional, filter by priority)
 * - floor: string (optional, filter by floor)
 * - fault_type_id: number (optional, filter by fault type)
 * - is_overdue: boolean (optional, filter by overdue status)
 * - page: number (optional, default: 1)
 * - limit: number (optional, default: 20, max: 100)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     workOrders: [...],
 *     pagination: {
 *       total: number,
 *       page: number,
 *       limit: number,
 *       totalPages: number
 *     }
 *   }
 * }
 */
router.get(
  '/',
  authenticateToken,
  validatePagination,
  workOrderController.getWorkOrders
);

/**
 * GET /workorders/duplicates
 * Get duplicate work orders within a date range (T149b)
 *
 * Permission: Requires manage_users permission (admin only)
 *
 * Query parameters:
 * - startDate: string (required, ISO 8601 date format)
 * - endDate: string (required, ISO 8601 date format)
 * - minSimilarity: number (optional, default: 75, range: 0-100)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     duplicate_groups: [
 *       {
 *         primary_order: {...},
 *         duplicates: [
 *           {
 *             work_order: {...},
 *             similarity_score: number
 *           }
 *         ]
 *       }
 *     ],
 *     summary: {
 *       total_groups: number,
 *       total_duplicates: number,
 *       date_range: { startDate, endDate },
 *       min_similarity: number
 *     }
 *   }
 * }
 *
 * Algorithm:
 * - Compares location similarity (40% weight) using Levenshtein distance
 * - Checks fault type match (35% weight)
 * - Calculates time proximity (25% weight, within 24h window)
 * - Groups orders with similarity >= minSimilarity threshold
 *
 * Error responses:
 * - 400: Missing or invalid date range
 * - 403: User does not have manage_users permission
 */
router.get(
  '/duplicates',
  authenticateToken,
  requirePermission('manage_users'),
  validateDuplicateQuery,
  workOrderController.getDuplicates
);

/**
 * GET /workorders/:id
 * Get work order details by ID
 *
 * Permission check:
 * - Submitter can view their own orders
 * - Assigned technician can view assigned orders
 * - Managers/admins can view all orders
 *
 * URL parameters:
 * - id: number (required, positive integer)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     id: number,
 *     order_number: string,
 *     floor: string,
 *     location: string,
 *     fault_type_id: number,
 *     priority: string,
 *     description: string,
 *     photos_json: array[string],
 *     status: string,
 *     submitter_id: number,
 *     assigned_technician_id: number,
 *     assigned_at: datetime,
 *     sla_deadline: datetime,
 *     is_overdue: boolean,
 *     created_at: datetime,
 *     updated_at: datetime,
 *     submitter: {...},
 *     assigned_technician: {...},
 *     fault_type: {...},
 *     status_history: [...],
 *     notifications: [...]
 *   }
 * }
 */
router.get(
  '/:id',
  authenticateToken,
  validateWorkOrderId,
  workOrderController.getWorkOrderById
);

/**
 * PATCH /workorders/:id/start
 * Start repair work on a work order (T080)
 *
 * Permission: Only the assigned technician can start the work order
 *
 * URL parameters:
 * - id: number (required, positive integer)
 *
 * Validations:
 * - User must be the assigned technician
 * - Current status must be "Pending Repair"
 * - Technician must not exceed max 5 concurrent "In Progress" orders
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     ...work order with updated status "In Progress" and started_at timestamp
 *   }
 * }
 *
 * Error responses:
 * - 403: User is not the assigned technician
 * - 400: Current status is not "Pending Repair"
 * - 409: Technician has reached concurrent order limit (5 orders)
 */
router.patch(
  '/:id/start',
  authenticateToken,
  validateWorkOrderId,
  workOrderController.startRepair
);

/**
 * PATCH /workorders/:id/repair
 * Update repair status to "Repaired" or "Needs Rework" (T081-T087)
 *
 * Permission: Only the assigned technician can update the repair status
 *
 * URL parameters:
 * - id: number (required, positive integer)
 *
 * Request body:
 * {
 *   status: string (required, "Repaired" or "Needs Rework")
 *   completion_notes: string (optional for "Repaired", required for "Needs Rework", max 5000 chars)
 *   photos_json: array[string] (optional, max 9 URLs)
 * }
 *
 * Validations:
 * - User must be the assigned technician
 * - Current status must be "In Progress"
 * - Status transition must be valid per state machine
 * - completion_notes required for "Needs Rework"
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     ...work order with updated status and timestamps
 *   }
 * }
 *
 * Behavior:
 * - If "Repaired": Sets repaired_at timestamp
 * - If "Needs Rework": Increments rework_count, notifies supervisor
 * - Creates StatusHistory record with notes and photos
 * - Sends notifications to submitter (and supervisor if needs rework)
 * - Creates audit log entry
 *
 * Error responses:
 * - 403: User is not the assigned technician
 * - 400: Invalid status, invalid transition, or missing required notes
 */
router.patch(
  '/:id/repair',
  authenticateToken,
  validateWorkOrderId,
  validateWorkOrderUpdate,
  workOrderController.updateRepairStatus
);

/**
 * PATCH /workorders/:id/review
 * Review work order and mark as Completed or Needs Rework (T096-T103)
 *
 * Permission: Submitter (property staff who created the order) OR users with review_work_orders permission
 *
 * URL parameters:
 * - id: number (required, positive integer)
 *
 * Request body:
 * {
 *   status: string (required, "Completed" or "Needs Rework")
 *   review_notes: string (optional for "Completed", required for "Needs Rework", max 5000 chars)
 * }
 *
 * Validations:
 * - User must be submitter OR have review_work_orders permission
 * - Current status must be "Repaired"
 * - Status transition must be valid per state machine
 * - review_notes required for "Needs Rework" (must explain why rejected)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     ...work order with updated status, timestamps, and status_history
 *   }
 * }
 *
 * Behavior:
 * - If "Completed": Sets completed_at and reviewed_at timestamps, notifies technician (success)
 * - If "Needs Rework": Sets reviewed_at, increments rework_count, notifies technician and supervisor
 * - Creates StatusHistory record with review notes
 * - Creates audit log entry with review decision
 *
 * Error responses:
 * - 403: User is not authorized to review (not submitter and no review permission)
 * - 400: Invalid status, invalid transition, or missing required review notes
 * - 404: Work order not found
 */
router.patch(
  '/:id/review',
  authenticateToken,
  validateWorkOrderReview,
  workOrderController.reviewWorkOrder
);

module.exports = router;
