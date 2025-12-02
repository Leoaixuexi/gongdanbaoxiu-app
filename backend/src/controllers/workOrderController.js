const { WorkOrder, User, FaultType, StatusHistory, Notification, AuditLog, SLARule, sequelize } = require('../models');
const assignmentService = require('../services/assignmentService');
const notificationService = require('../services/notificationService');
const slaService = require('../services/slaService');
const logger = require('../utils/logger');
const { AUDIT_ACTION_TYPES, HTTP_STATUS, ROLES, VALID_STATUS_TRANSITIONS, MAX_CONCURRENT_ORDERS_PER_TECHNICIAN } = require('../utils/constants');
const { Op } = require('sequelize');

/**
 * Work Order Controller
 * Handles work order creation, listing, retrieval, and repair execution operations
 *
 * Implements:
 * - T060-T062: Create work order with auto-assignment and notifications
 * - T064: List work orders with role-based filtering
 * - T065: Get work order details with permission checks
 * - T066-T067: Audit logging for critical operations
 * - T080: Start repair work on assigned work orders
 * - T081-T087: Update repair status with validation and notifications
 */

/**
 * Validate status transition (T082, T087)
 * Checks if the requested status transition is valid per state machine
 *
 * @param {string} currentStatus - Current work order status
 * @param {string} newStatus - Requested new status
 * @returns {boolean} True if transition is valid
 */
const validateStatusTransition = (currentStatus, newStatus) => {
  const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || [];
  return allowedTransitions.includes(newStatus);
};

/**
 * Check concurrent order limit for technician (T087)
 * Verifies that technician doesn't exceed max concurrent "In Progress" orders
 *
 * @param {number} technicianId - Technician user ID
 * @returns {Promise<Object>} Object with canStart boolean and current count
 */
const checkConcurrentOrderLimit = async (technicianId) => {
  try {
    const inProgressCount = await WorkOrder.count({
      where: {
        assigned_technician_id: technicianId,
        status: 'In Progress',
      },
    });

    const canStart = inProgressCount < MAX_CONCURRENT_ORDERS_PER_TECHNICIAN;

    return {
      canStart,
      currentCount: inProgressCount,
      maxAllowed: MAX_CONCURRENT_ORDERS_PER_TECHNICIAN,
    };
  } catch (error) {
    logger.error('Error checking concurrent order limit', {
      technicianId,
      error: error.message,
    });
    throw error;
  }
};

/**
 * T171: Enrich work order with SLA calculated fields
 * Adds time_remaining, percentage_used, and sla_status to work order object
 *
 * @param {Object} workOrder - Work order object
 * @returns {Promise<Object>} Work order with SLA fields added
 */
const enrichWithSLAData = async (workOrder) => {
  try {
    // Skip if work order is completed (SLA no longer relevant)
    if (workOrder.status === 'Completed') {
      return {
        ...workOrder.toJSON(),
        time_remaining: null,
        percentage_used: null,
        sla_status: 'completed',
      };
    }

    // Get SLA status
    const slaStatus = await slaService.checkSLAStatus(workOrder);

    // Add calculated fields to work order
    return {
      ...workOrder.toJSON(),
      time_remaining: slaStatus.timeRemaining,
      percentage_used: slaStatus.percentageUsed,
      sla_status: slaStatus.status,
    };
  } catch (error) {
    logger.error('Error enriching work order with SLA data', {
      workOrderId: workOrder.id,
      error: error.message,
    });
    // Return work order without SLA enrichment on error
    return workOrder.toJSON();
  }
};

/**
 * Enrich multiple work orders with SLA data
 * @param {Array} workOrders - Array of work orders
 * @returns {Promise<Array>} Enriched work orders
 */
const enrichMultipleWithSLAData = async (workOrders) => {
  return Promise.all(workOrders.map((order) => enrichWithSLAData(order)));
};

/**
 * Generate unique work order number
 * Format: WO-YYYYMMDD-####
 * Sequential numbering resets daily
 *
 * @returns {Promise<string>} Generated order number
 */
const generateOrderNumber = async () => {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD
  const prefix = `WO-${dateStr}-`;

  // Find the highest order number for today
  const latestOrder = await WorkOrder.findOne({
    where: {
      order_number: {
        [Op.like]: `${prefix}%`,
      },
    },
    order: [['order_number', 'DESC']],
  });

  let sequence = 1;
  if (latestOrder) {
    // Extract sequence number from order_number (last 4 digits)
    const lastSequence = parseInt(latestOrder.order_number.slice(-4), 10);
    sequence = lastSequence + 1;
  }

  // Pad sequence to 4 digits
  const sequenceStr = sequence.toString().padStart(4, '0');
  return `${prefix}${sequenceStr}`;
};

/**
 * Calculate SLA deadline based on priority and SLA rules
 *
 * @param {string} priority - Work order priority (Low, Normal, High, Emergency)
 * @returns {Promise<Date>} Calculated SLA deadline
 */
const calculateSLADeadline = async (priority) => {
  try {
    // Find SLA rule for this priority
    const slaRule = await SLARule.findOne({
      where: {
        priority,
        active: true,
      },
    });

    if (!slaRule) {
      logger.warn('No active SLA rule found for priority, using default', { priority });
      // Default fallback: 24 hours
      const deadline = new Date();
      deadline.setHours(deadline.getHours() + 24);
      return deadline;
    }

    // Calculate deadline based on target_resolution_hours
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + slaRule.target_resolution_hours);

    logger.debug('SLA deadline calculated', {
      priority,
      resolutionHours: slaRule.target_resolution_hours,
      deadline: deadline.toISOString(),
    });

    return deadline;
  } catch (error) {
    logger.error('Error calculating SLA deadline', {
      priority,
      error: error.message,
    });
    // Fallback to 24 hours
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + 24);
    return deadline;
  }
};

/**
 * Create new work order (T060-T062, T066-T067)
 *
 * Workflow:
 * 1. Validate input
 * 2. Generate unique order number
 * 3. Calculate SLA deadline
 * 4. Create work order in database
 * 5. Auto-assign technician
 * 6. Update work order with assignment
 * 7. Create initial status history
 * 8. Send notifications
 * 9. Create audit log
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const create = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { floor, location, fault_type_id, priority, description, photos_json } = req.body;
    const submitter_id = req.user.id;

    logger.info('Creating work order', {
      submitter_id,
      floor,
      location,
      fault_type_id,
      priority,
    });

    // Validate fault type exists
    const faultType = await FaultType.findByPk(fault_type_id);
    if (!faultType) {
      await transaction.rollback();
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          message: 'Invalid fault type',
          code: 'INVALID_FAULT_TYPE',
        },
      });
    }

    // Generate order number
    const order_number = await generateOrderNumber();

    // Calculate SLA deadline
    const sla_deadline = await calculateSLADeadline(priority);

    // Create work order (initial status: Pending Repair, no technician yet)
    const workOrder = await WorkOrder.create(
      {
        order_number,
        floor,
        location,
        fault_type_id,
        priority,
        description,
        photos_json: photos_json || null,
        status: 'Pending Repair',
        submitter_id,
        assigned_technician_id: null, // Will be set after assignment
        sla_deadline,
        is_overdue: false,
      },
      { transaction }
    );

    logger.info('Work order created', {
      workOrderId: workOrder.id,
      order_number: workOrder.order_number,
    });

    // T061: Auto-assign technician
    let assignedTechnician = null;
    try {
      assignedTechnician = await assignmentService.assignWorkOrder(
        workOrder.id,
        fault_type_id
      );

      // Update work order with assigned technician
      await workOrder.update(
        {
          assigned_technician_id: assignedTechnician.id,
          assigned_at: new Date(),
        },
        { transaction }
      );

      logger.info('Technician assigned to work order', {
        workOrderId: workOrder.id,
        technicianId: assignedTechnician.id,
        technicianName: assignedTechnician.name,
      });
    } catch (assignmentError) {
      logger.error('Failed to auto-assign technician', {
        workOrderId: workOrder.id,
        error: assignmentError.message,
      });
      // Don't fail the entire creation - work order can be assigned manually
      // Keep assigned_technician_id as null
    }

    // Create initial status history record
    await StatusHistory.create(
      {
        work_order_id: workOrder.id,
        status: 'Pending Repair',
        actor_id: submitter_id,
        notes: 'Work order created',
      },
      { transaction }
    );

    // T067: Create audit log entry
    await AuditLog.create(
      {
        user_id: submitter_id,
        action: AUDIT_ACTION_TYPES.WORK_ORDER_CREATED,
        resource_type: 'work_order',
        resource_id: workOrder.id,
        details: {
          order_number: workOrder.order_number,
          priority: workOrder.priority,
          fault_type_id: workOrder.fault_type_id,
          assigned_technician_id: assignedTechnician ? assignedTechnician.id : null,
        },
      },
      { transaction }
    );

    // Commit transaction before sending notifications
    await transaction.commit();

    // T062: Send notifications (non-blocking, don't fail if notifications fail)
    try {
      const recipientIds = [];

      // Notify submitter (confirmation)
      recipientIds.push(submitter_id);

      // Notify assigned technician
      if (assignedTechnician) {
        recipientIds.push(assignedTechnician.id);
      }

      // Notify supervisor if priority is High or Emergency
      if (priority === 'High' || priority === 'Emergency') {
        const submitter = await User.findByPk(submitter_id);
        if (submitter && submitter.supervisor_id) {
          recipientIds.push(submitter.supervisor_id);
        }

        // Also notify all managers/admins
        const managers = await User.findAll({
          where: {
            role_id: {
              [Op.in]: [ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN, ROLES.ADMINISTRATIVE_MANAGER],
            },
            active: true,
          },
          attributes: ['id'],
        });
        managers.forEach((manager) => recipientIds.push(manager.id));
      }

      // Remove duplicates
      const uniqueRecipientIds = [...new Set(recipientIds)];

      // Send notifications
      await notificationService.sendWorkOrderNotification(
        {
          id: workOrder.id,
          order_number: workOrder.order_number,
          floor: workOrder.floor,
          location: workOrder.location,
          priority: workOrder.priority,
          description: workOrder.description,
        },
        uniqueRecipientIds,
        'work_order_created',
        {
          faultTypeName: faultType.name,
        }
      );

      logger.info('Notifications sent for new work order', {
        workOrderId: workOrder.id,
        recipientCount: uniqueRecipientIds.length,
      });
    } catch (notificationError) {
      logger.error('Failed to send notifications', {
        workOrderId: workOrder.id,
        error: notificationError.message,
      });
      // Don't fail the request - notifications are not critical
    }

    // Fetch complete work order with relations
    const completeWorkOrder = await WorkOrder.findByPk(workOrder.id, {
      include: [
        {
          model: User,
          as: 'submitter',
          attributes: ['id', 'name', 'contact_phone', 'department'],
        },
        {
          model: User,
          as: 'assigned_technician',
          attributes: ['id', 'name', 'contact_phone', 'department'],
        },
        {
          model: FaultType,
          as: 'fault_type',
          attributes: ['id', 'name', 'category'],
        },
      ],
    });

    logger.info('Work order creation completed successfully', {
      workOrderId: workOrder.id,
      order_number: workOrder.order_number,
    });

    // T171: Enrich with SLA calculated fields
    const enrichedWorkOrder = await enrichWithSLAData(completeWorkOrder);

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: enrichedWorkOrder,
    });
  } catch (error) {
    await transaction.rollback();

    logger.error('Failed to create work order', {
      error: error.message,
      stack: error.stack,
      submitter_id: req.user ? req.user.id : null,
    });

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        message: 'Failed to create work order',
        code: 'WORK_ORDER_CREATION_FAILED',
      },
    });
  }
};

/**
 * Get work orders with filtering and pagination (T064, T103, T172)
 *
 * Role-based filtering:
 * - Property staff: See only their submitted orders
 * - Maintenance workers: See only their assigned orders
 * - Managers/admins: See all orders
 *
 * Special filters:
 * - pendingReview=true: Show only orders with status "Repaired" (pending review)
 *   - Property staff: Only their submitted orders that are in "Repaired" status
 *   - Users with review permission: All orders in "Repaired" status
 * - isOverdue=true: Show only orders that have exceeded SLA deadline (T172)
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const getWorkOrders = async (req, res) => {
  try {
    const {
      status,
      priority,
      floor,
      fault_type_id,
      isOverdue,
      pendingReview,
      page = 1,
      limit = 20,
    } = req.query;

    const user = req.user;

    logger.info('Fetching work orders', {
      userId: user.id,
      roleId: user.role_id,
      filters: { status, priority, floor, fault_type_id, isOverdue, pendingReview },
      page,
      limit,
    });

    // Build where clause based on role and filters
    const where = {};

    // T103: Handle pendingReview filter
    if (pendingReview === 'true') {
      // Show only orders in "Repaired" status (pending review)
      where.status = 'Repaired';

      // Check if user has review permission
      const hasReviewPermission =
        user.role &&
        user.role.permissions_json &&
        user.role.permissions_json.modules &&
        user.role.permissions_json.modules.review_work_orders === true;

      // If property staff without review permission, only show their submitted orders
      if (user.role_id === ROLES.PROPERTY_STAFF && !hasReviewPermission) {
        where.submitter_id = user.id;
      }
      // If has review permission, show all "Repaired" orders (no additional filter)
    } else {
      // Standard role-based filtering (when not filtering for pending review)
      if (user.role_id === ROLES.PROPERTY_STAFF) {
        // Property staff sees only their submitted orders
        where.submitter_id = user.id;
      } else if (user.role_id === ROLES.MAINTENANCE_WORKER) {
        // Maintenance workers see only their assigned orders
        where.assigned_technician_id = user.id;
      }
      // Managers and admins see all orders (no additional filter)
    }

    // Apply query filters (only if not using pendingReview which sets status)
    if (status && pendingReview !== 'true') {
      where.status = status;
    }
    if (priority) {
      where.priority = priority;
    }
    if (floor) {
      where.floor = floor;
    }
    if (fault_type_id) {
      where.fault_type_id = parseInt(fault_type_id, 10);
    }
    // T172: Support isOverdue filter
    if (isOverdue !== undefined) {
      where.is_overdue = isOverdue === 'true';
    }

    // Calculate pagination
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    // Fetch work orders with relations
    const { count, rows: workOrders } = await WorkOrder.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'submitter',
          attributes: ['id', 'name', 'contact_phone', 'department'],
        },
        {
          model: User,
          as: 'assigned_technician',
          attributes: ['id', 'name', 'contact_phone', 'department'],
        },
        {
          model: FaultType,
          as: 'fault_type',
          attributes: ['id', 'name', 'category'],
        },
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit, 10),
      offset,
    });

    const totalPages = Math.ceil(count / parseInt(limit, 10));

    // T171: Enrich all work orders with SLA calculated fields
    const enrichedWorkOrders = await enrichMultipleWithSLAData(workOrders);

    logger.info('Work orders fetched successfully', {
      userId: user.id,
      count,
      page,
      totalPages,
    });

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        workOrders: enrichedWorkOrders,
        pagination: {
          total: count,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          totalPages,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to fetch work orders', {
      error: error.message,
      stack: error.stack,
      userId: req.user ? req.user.id : null,
    });

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        message: 'Failed to fetch work orders',
        code: 'WORK_ORDER_FETCH_FAILED',
      },
    });
  }
};

/**
 * Get work order by ID with permission check (T065)
 *
 * Permission rules:
 * - Submitter can view their own orders
 * - Assigned technician can view assigned orders
 * - Managers/admins can view all orders
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const getWorkOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    logger.info('Fetching work order by ID', {
      workOrderId: id,
      userId: user.id,
      roleId: user.role_id,
    });

    // Fetch work order with all relations
    const workOrder = await WorkOrder.findByPk(id, {
      include: [
        {
          model: User,
          as: 'submitter',
          attributes: ['id', 'name', 'contact_phone', 'department', 'role_id'],
        },
        {
          model: User,
          as: 'assigned_technician',
          attributes: ['id', 'name', 'contact_phone', 'department', 'role_id'],
        },
        {
          model: FaultType,
          as: 'fault_type',
          attributes: ['id', 'name', 'category', 'parent_id'],
        },
        {
          model: StatusHistory,
          as: 'status_history',
          include: [
            {
              model: User,
              as: 'actor',
              attributes: ['id', 'name', 'role_id'],
            },
          ],
          order: [['created_at', 'DESC']],
        },
        {
          model: Notification,
          as: 'notifications',
          attributes: ['id', 'notification_type', 'event_type', 'delivery_status', 'sent_at'],
        },
      ],
    });

    if (!workOrder) {
      logger.warn('Work order not found', { workOrderId: id });
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          message: 'Work order not found',
          code: 'WORK_ORDER_NOT_FOUND',
        },
      });
    }

    // Check permission
    const isSubmitter = workOrder.submitter_id === user.id;
    const isAssignedTechnician = workOrder.assigned_technician_id === user.id;
    const isManager =
      user.role_id === ROLES.SUPER_ADMIN ||
      user.role_id === ROLES.SYSTEM_ADMIN ||
      user.role_id === ROLES.ADMINISTRATIVE_MANAGER;

    if (!isSubmitter && !isAssignedTechnician && !isManager) {
      logger.warn('Permission denied for work order access', {
        workOrderId: id,
        userId: user.id,
        roleId: user.role_id,
      });
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          message: 'You do not have permission to view this work order',
          code: 'PERMISSION_DENIED',
        },
      });
    }

    logger.info('Work order fetched successfully', {
      workOrderId: id,
      userId: user.id,
    });

    // T171: Enrich with SLA calculated fields
    const enrichedWorkOrder = await enrichWithSLAData(workOrder);

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: enrichedWorkOrder,
    });
  } catch (error) {
    logger.error('Failed to fetch work order', {
      error: error.message,
      stack: error.stack,
      workOrderId: req.params.id,
      userId: req.user ? req.user.id : null,
    });

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        message: 'Failed to fetch work order',
        code: 'WORK_ORDER_FETCH_FAILED',
      },
    });
  }
};

/**
 * Start repair work on a work order (T080)
 *
 * Workflow:
 * 1. Verify user is the assigned technician
 * 2. Verify current status is "Pending Repair"
 * 3. Check concurrent work order limit (max 5 "In Progress" per technician)
 * 4. Update status to "In Progress"
 * 5. Set started_at timestamp
 * 6. Create StatusHistory record
 * 7. Send notification to submitter
 * 8. Create audit log entry
 * 9. Return updated work order
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const startRepair = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const user = req.user;

    logger.info('Starting repair on work order', {
      workOrderId: id,
      technicianId: user.id,
    });

    // Fetch work order with lock for concurrent update prevention (optimistic locking)
    const workOrder = await WorkOrder.findByPk(id, {
      lock: transaction.LOCK.UPDATE,
      transaction,
      include: [
        {
          model: User,
          as: 'submitter',
          attributes: ['id', 'name', 'contact_phone', 'department'],
        },
        {
          model: User,
          as: 'assigned_technician',
          attributes: ['id', 'name', 'contact_phone', 'department'],
        },
        {
          model: FaultType,
          as: 'fault_type',
          attributes: ['id', 'name', 'category'],
        },
      ],
    });

    if (!workOrder) {
      await transaction.rollback();
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          message: 'Work order not found',
          code: 'WORK_ORDER_NOT_FOUND',
        },
      });
    }

    // Verify user is the assigned technician
    if (workOrder.assigned_technician_id !== user.id) {
      await transaction.rollback();
      logger.warn('User is not the assigned technician', {
        workOrderId: id,
        userId: user.id,
        assignedTechnicianId: workOrder.assigned_technician_id,
      });
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          message: 'Only the assigned technician can start this work order',
          code: 'NOT_ASSIGNED_TECHNICIAN',
        },
      });
    }

    // Verify current status is "Pending Repair"
    if (workOrder.status !== 'Pending Repair') {
      await transaction.rollback();
      logger.warn('Work order is not in Pending Repair status', {
        workOrderId: id,
        currentStatus: workOrder.status,
      });
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          message: `Cannot start repair. Current status is "${workOrder.status}". Expected "Pending Repair".`,
          code: 'INVALID_STATUS_FOR_START',
          details: {
            currentStatus: workOrder.status,
            expectedStatus: 'Pending Repair',
          },
        },
      });
    }

    // Check concurrent work order limit
    const limitCheck = await checkConcurrentOrderLimit(user.id);
    if (!limitCheck.canStart) {
      await transaction.rollback();
      logger.warn('Technician has reached concurrent order limit', {
        technicianId: user.id,
        currentCount: limitCheck.currentCount,
        maxAllowed: limitCheck.maxAllowed,
      });
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        error: {
          message: `Cannot start repair. You have reached the maximum limit of ${limitCheck.maxAllowed} concurrent orders. Please complete some orders before starting new ones.`,
          code: 'CONCURRENT_ORDER_LIMIT_REACHED',
          details: {
            currentCount: limitCheck.currentCount,
            maxAllowed: limitCheck.maxAllowed,
          },
        },
      });
    }

    // Update work order status
    await workOrder.update(
      {
        status: 'In Progress',
        started_at: new Date(),
      },
      { transaction }
    );

    // Create status history record
    await StatusHistory.create(
      {
        work_order_id: workOrder.id,
        status: 'In Progress',
        actor_id: user.id,
        notes: 'Repair work started',
      },
      { transaction }
    );

    // Create audit log entry
    await AuditLog.create(
      {
        user_id: user.id,
        action: AUDIT_ACTION_TYPES.STATUS_CHANGED,
        resource_type: 'work_order',
        resource_id: workOrder.id,
        details: {
          order_number: workOrder.order_number,
          previous_status: 'Pending Repair',
          new_status: 'In Progress',
          started_at: workOrder.started_at,
        },
      },
      { transaction }
    );

    // Commit transaction before sending notifications
    await transaction.commit();

    logger.info('Work order repair started successfully', {
      workOrderId: id,
      technicianId: user.id,
    });

    // Send notification to submitter (non-blocking)
    try {
      await notificationService.sendWorkOrderNotification(
        {
          id: workOrder.id,
          order_number: workOrder.order_number,
          floor: workOrder.floor,
          location: workOrder.location,
          priority: workOrder.priority,
          status: 'In Progress',
        },
        [workOrder.submitter_id],
        'status_changed',
        {
          notes: 'Repair work has started',
        }
      );
    } catch (notificationError) {
      logger.error('Failed to send notification', {
        workOrderId: id,
        error: notificationError.message,
      });
      // Don't fail the request - notifications are not critical
    }

    // Fetch updated work order with all relations
    const updatedWorkOrder = await WorkOrder.findByPk(id, {
      include: [
        {
          model: User,
          as: 'submitter',
          attributes: ['id', 'name', 'contact_phone', 'department'],
        },
        {
          model: User,
          as: 'assigned_technician',
          attributes: ['id', 'name', 'contact_phone', 'department'],
        },
        {
          model: FaultType,
          as: 'fault_type',
          attributes: ['id', 'name', 'category'],
        },
      ],
    });

    // T171: Enrich with SLA calculated fields
    const enrichedWorkOrder = await enrichWithSLAData(updatedWorkOrder);

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: enrichedWorkOrder,
    });
  } catch (error) {
    await transaction.rollback();

    logger.error('Failed to start repair', {
      error: error.message,
      stack: error.stack,
      workOrderId: req.params.id,
      userId: req.user ? req.user.id : null,
    });

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        message: 'Failed to start repair',
        code: 'START_REPAIR_FAILED',
      },
    });
  }
};

/**
 * Review work order and mark as Completed or Needs Rework (T096-T103)
 *
 * Workflow:
 * 1. Verify user is the submitter OR has review_work_orders permission
 * 2. Verify current status is "Repaired"
 * 3. Validate status transition (T097)
 * 4. If "Completed" (approved):
 *    - Set status to "Completed"
 *    - Set reviewed_at timestamp (T098)
 *    - Set completed_at timestamp (T098)
 *    - Create StatusHistory record (T101)
 *    - Send notification to technician (success)
 *    - Create audit log entry (T102)
 * 5. If "Needs Rework" (rejected):
 *    - Set status to "Needs Rework" (T099)
 *    - Set reviewed_at timestamp
 *    - Increment rework_count (T099)
 *    - Require review_notes (mandatory, explain why rejected)
 *    - Create StatusHistory record (T101)
 *    - Send notification to technician and supervisor (T100)
 *    - Create audit log entry (T102)
 * 6. Return updated work order with all relations
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const reviewWorkOrder = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { status, review_notes } = req.body;
    const user = req.user;

    logger.info('Reviewing work order', {
      workOrderId: id,
      reviewerId: user.id,
      reviewStatus: status,
    });

    // Validate status parameter
    if (!status || !['Completed', 'Needs Rework'].includes(status)) {
      await transaction.rollback();
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          message: 'Invalid status. Must be either "Completed" or "Needs Rework"',
          code: 'INVALID_STATUS',
        },
      });
    }

    // Fetch work order with lock for concurrent update prevention
    const workOrder = await WorkOrder.findByPk(id, {
      lock: transaction.LOCK.UPDATE,
      transaction,
      include: [
        {
          model: User,
          as: 'submitter',
          attributes: ['id', 'name', 'contact_phone', 'department', 'supervisor_id'],
        },
        {
          model: User,
          as: 'assigned_technician',
          attributes: ['id', 'name', 'contact_phone', 'department', 'supervisor_id'],
        },
        {
          model: FaultType,
          as: 'fault_type',
          attributes: ['id', 'name', 'category'],
        },
      ],
    });

    if (!workOrder) {
      await transaction.rollback();
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          message: 'Work order not found',
          code: 'WORK_ORDER_NOT_FOUND',
        },
      });
    }

    // Verify user is submitter OR has review permission
    const isSubmitter = workOrder.submitter_id === user.id;
    const hasReviewPermission =
      user.role &&
      user.role.permissions_json &&
      user.role.permissions_json.modules &&
      user.role.permissions_json.modules.review_work_orders === true;

    if (!isSubmitter && !hasReviewPermission) {
      await transaction.rollback();
      logger.warn('User is not authorized to review this work order', {
        workOrderId: id,
        userId: user.id,
        isSubmitter,
        hasReviewPermission,
      });
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          message: 'Only the submitter or users with review permission can review this work order',
          code: 'NOT_AUTHORIZED_TO_REVIEW',
        },
      });
    }

    // Verify current status is "Repaired" (T097)
    if (workOrder.status !== 'Repaired') {
      await transaction.rollback();
      logger.warn('Work order is not in Repaired status', {
        workOrderId: id,
        currentStatus: workOrder.status,
      });
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          message: `Cannot review work order. Current status is "${workOrder.status}". Expected "Repaired".`,
          code: 'INVALID_STATUS_FOR_REVIEW',
          details: {
            currentStatus: workOrder.status,
            expectedStatus: 'Repaired',
          },
        },
      });
    }

    // Validate status transition (T097)
    if (!validateStatusTransition(workOrder.status, status)) {
      await transaction.rollback();
      logger.warn('Invalid status transition', {
        workOrderId: id,
        currentStatus: workOrder.status,
        requestedStatus: status,
      });
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          message: `Invalid status transition from "${workOrder.status}" to "${status}"`,
          code: 'INVALID_STATUS_TRANSITION',
          details: {
            currentStatus: workOrder.status,
            requestedStatus: status,
            allowedTransitions: VALID_STATUS_TRANSITIONS[workOrder.status] || [],
          },
        },
      });
    }

    // Validate review_notes for "Needs Rework" (mandatory)
    if (status === 'Needs Rework' && (!review_notes || review_notes.trim().length === 0)) {
      await transaction.rollback();
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          message: 'Review notes are required when marking order as "Needs Rework". Please explain why the work is being rejected.',
          code: 'REVIEW_NOTES_REQUIRED',
        },
      });
    }

    // Prepare update data
    const updateData = {
      status,
      review_notes: review_notes || null,
      reviewed_at: new Date(),
    };

    // If "Completed", set completed_at timestamp (T098)
    if (status === 'Completed') {
      updateData.completed_at = new Date();
    }

    // If "Needs Rework", increment rework_count (T099)
    if (status === 'Needs Rework') {
      updateData.rework_count = workOrder.rework_count + 1;
      // Do NOT set completed_at (work not done)
    }

    // Update work order
    await workOrder.update(updateData, { transaction });

    // Create status history record (T101)
    await StatusHistory.create(
      {
        work_order_id: workOrder.id,
        status,
        actor_id: user.id,
        notes: review_notes || `Work order marked as ${status}`,
      },
      { transaction }
    );

    // Create audit log entry (T102)
    await AuditLog.create(
      {
        user_id: user.id,
        action: AUDIT_ACTION_TYPES.STATUS_CHANGED,
        resource_type: 'work_order',
        resource_id: workOrder.id,
        details: {
          order_number: workOrder.order_number,
          previous_status: 'Repaired',
          new_status: status,
          review_notes: review_notes || null,
          rework_count: updateData.rework_count || workOrder.rework_count,
          reviewed_by: user.name,
          is_submitter: isSubmitter,
        },
      },
      { transaction }
    );

    // Commit transaction before sending notifications
    await transaction.commit();

    logger.info('Work order review completed successfully', {
      workOrderId: id,
      reviewerId: user.id,
      reviewStatus: status,
      reworkCount: updateData.rework_count || workOrder.rework_count,
    });

    // Send notifications (non-blocking)
    try {
      const recipientIds = [];

      // Always notify assigned technician
      if (workOrder.assigned_technician_id) {
        recipientIds.push(workOrder.assigned_technician_id);
      }

      // If "Needs Rework", also notify supervisor (T100)
      if (status === 'Needs Rework') {
        if (workOrder.assigned_technician && workOrder.assigned_technician.supervisor_id) {
          recipientIds.push(workOrder.assigned_technician.supervisor_id);
        }
        // Also notify submitter's supervisor if different
        if (workOrder.submitter && workOrder.submitter.supervisor_id) {
          recipientIds.push(workOrder.submitter.supervisor_id);
        }
      }

      // Remove duplicates
      const uniqueRecipientIds = [...new Set(recipientIds)];

      await notificationService.sendWorkOrderNotification(
        {
          id: workOrder.id,
          order_number: workOrder.order_number,
          floor: workOrder.floor,
          location: workOrder.location,
          priority: workOrder.priority,
          status,
        },
        uniqueRecipientIds,
        'status_changed',
        {
          notes: review_notes || `Work order marked as ${status}`,
          reviewed_by: user.name,
        }
      );

      logger.info('Notifications sent for work order review', {
        workOrderId: id,
        recipientCount: uniqueRecipientIds.length,
      });
    } catch (notificationError) {
      logger.error('Failed to send notifications', {
        workOrderId: id,
        error: notificationError.message,
      });
      // Don't fail the request - notifications are not critical
    }

    // Fetch updated work order with all relations
    const updatedWorkOrder = await WorkOrder.findByPk(id, {
      include: [
        {
          model: User,
          as: 'submitter',
          attributes: ['id', 'name', 'contact_phone', 'department'],
        },
        {
          model: User,
          as: 'assigned_technician',
          attributes: ['id', 'name', 'contact_phone', 'department'],
        },
        {
          model: FaultType,
          as: 'fault_type',
          attributes: ['id', 'name', 'category'],
        },
        {
          model: StatusHistory,
          as: 'status_history',
          include: [
            {
              model: User,
              as: 'actor',
              attributes: ['id', 'name', 'role_id'],
            },
          ],
          order: [['created_at', 'DESC']],
        },
      ],
    });

    // T171: Enrich with SLA calculated fields
    const enrichedWorkOrder = await enrichWithSLAData(updatedWorkOrder);

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: enrichedWorkOrder,
    });
  } catch (error) {
    await transaction.rollback();

    logger.error('Failed to review work order', {
      error: error.message,
      stack: error.stack,
      workOrderId: req.params.id,
      userId: req.user ? req.user.id : null,
    });

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        message: 'Failed to review work order',
        code: 'REVIEW_WORK_ORDER_FAILED',
      },
    });
  }
};

/**
 * Update repair status (T081-T087)
 *
 * Workflow:
 * 1. Verify user is the assigned technician
 * 2. Verify current status is "In Progress"
 * 3. Validate status transition
 * 4. If "Repaired":
 *    - Set repaired_at timestamp
 *    - Require completion_notes (optional but recommended)
 * 5. If "Needs Rework":
 *    - Increment rework_count
 *    - Require completion_notes (why it needs rework)
 * 6. Create StatusHistory record with notes and photos
 * 7. Update work order timestamps
 * 8. Send notifications
 * 9. Create audit log entry
 * 10. Return updated work order
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const updateRepairStatus = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { status, completion_notes, photos_json } = req.body;
    const user = req.user;

    logger.info('Updating repair status', {
      workOrderId: id,
      technicianId: user.id,
      newStatus: status,
    });

    // Validate status parameter
    if (!status || !['Repaired', 'Needs Rework'].includes(status)) {
      await transaction.rollback();
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          message: 'Invalid status. Must be either "Repaired" or "Needs Rework"',
          code: 'INVALID_STATUS',
        },
      });
    }

    // Fetch work order with lock for concurrent update prevention
    const workOrder = await WorkOrder.findByPk(id, {
      lock: transaction.LOCK.UPDATE,
      transaction,
      include: [
        {
          model: User,
          as: 'submitter',
          attributes: ['id', 'name', 'contact_phone', 'department', 'supervisor_id'],
        },
        {
          model: User,
          as: 'assigned_technician',
          attributes: ['id', 'name', 'contact_phone', 'department'],
        },
        {
          model: FaultType,
          as: 'fault_type',
          attributes: ['id', 'name', 'category'],
        },
      ],
    });

    if (!workOrder) {
      await transaction.rollback();
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          message: 'Work order not found',
          code: 'WORK_ORDER_NOT_FOUND',
        },
      });
    }

    // Verify user is the assigned technician
    if (workOrder.assigned_technician_id !== user.id) {
      await transaction.rollback();
      logger.warn('User is not the assigned technician', {
        workOrderId: id,
        userId: user.id,
        assignedTechnicianId: workOrder.assigned_technician_id,
      });
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          message: 'Only the assigned technician can update this work order',
          code: 'NOT_ASSIGNED_TECHNICIAN',
        },
      });
    }

    // Verify current status is "In Progress"
    if (workOrder.status !== 'In Progress') {
      await transaction.rollback();
      logger.warn('Work order is not in In Progress status', {
        workOrderId: id,
        currentStatus: workOrder.status,
      });
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          message: `Cannot update repair status. Current status is "${workOrder.status}". Expected "In Progress".`,
          code: 'INVALID_STATUS_FOR_UPDATE',
          details: {
            currentStatus: workOrder.status,
            expectedStatus: 'In Progress',
          },
        },
      });
    }

    // Validate status transition (T082)
    if (!validateStatusTransition(workOrder.status, status)) {
      await transaction.rollback();
      logger.warn('Invalid status transition', {
        workOrderId: id,
        currentStatus: workOrder.status,
        requestedStatus: status,
      });
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          message: `Invalid status transition from "${workOrder.status}" to "${status}"`,
          code: 'INVALID_STATUS_TRANSITION',
          details: {
            currentStatus: workOrder.status,
            requestedStatus: status,
            allowedTransitions: VALID_STATUS_TRANSITIONS[workOrder.status] || [],
          },
        },
      });
    }

    // Validate completion_notes for "Needs Rework"
    if (status === 'Needs Rework' && (!completion_notes || completion_notes.trim().length === 0)) {
      await transaction.rollback();
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          message: 'Completion notes are required when marking order as "Needs Rework"',
          code: 'COMPLETION_NOTES_REQUIRED',
        },
      });
    }

    // Prepare update data
    const updateData = {
      status,
      completion_notes: completion_notes || null,
    };

    // If "Repaired", set repaired_at timestamp
    if (status === 'Repaired') {
      updateData.repaired_at = new Date();
    }

    // If "Needs Rework", increment rework_count
    if (status === 'Needs Rework') {
      updateData.rework_count = workOrder.rework_count + 1;
    }

    // Update work order (T085)
    await workOrder.update(updateData, { transaction });

    // Create status history record with notes and photos (T083)
    await StatusHistory.create(
      {
        work_order_id: workOrder.id,
        status,
        actor_id: user.id,
        notes: completion_notes || `Status updated to ${status}`,
        photos_json: photos_json || null,
      },
      { transaction }
    );

    // Create audit log entry (T086)
    await AuditLog.create(
      {
        user_id: user.id,
        action: AUDIT_ACTION_TYPES.STATUS_CHANGED,
        resource_type: 'work_order',
        resource_id: workOrder.id,
        details: {
          order_number: workOrder.order_number,
          previous_status: 'In Progress',
          new_status: status,
          completion_notes: completion_notes || null,
          rework_count: updateData.rework_count || workOrder.rework_count,
          has_photos: photos_json && photos_json.length > 0,
        },
      },
      { transaction }
    );

    // Commit transaction before sending notifications
    await transaction.commit();

    logger.info('Repair status updated successfully', {
      workOrderId: id,
      technicianId: user.id,
      newStatus: status,
      reworkCount: updateData.rework_count || workOrder.rework_count,
    });

    // Send notifications (T084) (non-blocking)
    try {
      const recipientIds = [workOrder.submitter_id];

      // If "Needs Rework", also notify supervisor
      if (status === 'Needs Rework' && workOrder.submitter.supervisor_id) {
        recipientIds.push(workOrder.submitter.supervisor_id);
      }

      // Remove duplicates
      const uniqueRecipientIds = [...new Set(recipientIds)];

      await notificationService.sendWorkOrderNotification(
        {
          id: workOrder.id,
          order_number: workOrder.order_number,
          floor: workOrder.floor,
          location: workOrder.location,
          priority: workOrder.priority,
          status,
        },
        uniqueRecipientIds,
        'status_changed',
        {
          notes: completion_notes || `Status updated to ${status}`,
        }
      );

      logger.info('Notifications sent for status update', {
        workOrderId: id,
        recipientCount: uniqueRecipientIds.length,
      });
    } catch (notificationError) {
      logger.error('Failed to send notifications', {
        workOrderId: id,
        error: notificationError.message,
      });
      // Don't fail the request - notifications are not critical
    }

    // Fetch updated work order with all relations
    const updatedWorkOrder = await WorkOrder.findByPk(id, {
      include: [
        {
          model: User,
          as: 'submitter',
          attributes: ['id', 'name', 'contact_phone', 'department'],
        },
        {
          model: User,
          as: 'assigned_technician',
          attributes: ['id', 'name', 'contact_phone', 'department'],
        },
        {
          model: FaultType,
          as: 'fault_type',
          attributes: ['id', 'name', 'category'],
        },
      ],
    });

    // T171: Enrich with SLA calculated fields
    const enrichedWorkOrder = await enrichWithSLAData(updatedWorkOrder);

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: enrichedWorkOrder,
    });
  } catch (error) {
    await transaction.rollback();

    logger.error('Failed to update repair status', {
      error: error.message,
      stack: error.stack,
      workOrderId: req.params.id,
      userId: req.user ? req.user.id : null,
    });

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        message: 'Failed to update repair status',
        code: 'UPDATE_REPAIR_STATUS_FAILED',
      },
    });
  }
};

/**
 * T149b: Get duplicate work orders
 * GET /api/workorders/duplicates
 * Returns work orders grouped by similarity
 *
 * @route GET /api/workorders/duplicates
 * @access Private (manage_users permission)
 */
const getDuplicates = async (req, res) => {
  try {
    const { startDate, endDate, minSimilarity = 75 } = req.query;

    // Validate date range
    if (!startDate || !endDate) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          message: 'Start date and end date are required',
          code: 'MISSING_DATE_RANGE',
        },
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          message: 'Invalid date format',
          code: 'INVALID_DATE_FORMAT',
        },
      });
    }

    if (start > end) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          message: 'Start date must be before end date',
          code: 'INVALID_DATE_RANGE',
        },
      });
    }

    // Import duplicate detection service
    const duplicateDetectionService = require('../services/duplicateDetectionService');

    // Find duplicate groups
    const duplicateGroups = await duplicateDetectionService.getAllDuplicateGroups({
      startDate: start,
      endDate: end,
      minSimilarity: parseInt(minSimilarity, 10),
    });

    logger.info('Duplicate work orders retrieved', {
      dateRange: { startDate, endDate },
      minSimilarity,
      groupsFound: duplicateGroups.length,
      requestedBy: req.user.id,
    });

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        duplicate_groups: duplicateGroups,
        summary: {
          total_groups: duplicateGroups.length,
          total_duplicates: duplicateGroups.reduce((sum, group) => sum + group.duplicates.length, 0),
          date_range: { startDate, endDate },
          min_similarity: minSimilarity,
        },
      },
    });
  } catch (error) {
    logger.error('Error retrieving duplicate work orders', {
      error: error.message,
      stack: error.stack,
      requestedBy: req.user.id,
    });

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        message: 'Failed to retrieve duplicate work orders',
        code: 'DUPLICATES_RETRIEVAL_ERROR',
      },
    });
  }
};

module.exports = {
  create,
  getWorkOrders,
  getWorkOrderById,
  startRepair,
  updateRepairStatus,
  reviewWorkOrder,
  getDuplicates,
};
