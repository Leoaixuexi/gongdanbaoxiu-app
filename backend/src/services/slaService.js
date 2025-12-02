const { WorkOrder, SLARule, StatusHistory, AuditLog } = require('../models');
const logger = require('../utils/logger');
const { SLA_ESCALATION_THRESHOLD_PCT } = require('../utils/constants');

/**
 * SLA Service (T161-T162)
 * Handles SLA deadline calculations, status checks, and overdue updates
 *
 * Features:
 * - Calculate SLA deadlines based on priority and rules
 * - Get warning thresholds for escalation
 * - Check SLA status for work orders
 * - Update overdue flags with audit logging
 *
 * Used by:
 * - Work order creation (initial deadline calculation)
 * - SLA monitor job (checking and updating status)
 * - Work order endpoints (enriching response data)
 */

/**
 * Calculate SLA deadline for a work order (T162)
 *
 * Calculates the deadline by adding target_resolution_hours from SLA rules
 * to the work order creation timestamp.
 *
 * @param {Object} workOrder - Work order object with created_at and priority
 * @returns {Promise<Date>} SLA deadline as Date object
 */
const calculateSLADeadline = async (workOrder) => {
  try {
    if (!workOrder || !workOrder.priority) {
      throw new Error('Work order with priority is required');
    }

    const priority = workOrder.priority;
    const createdAt = workOrder.created_at || new Date();

    logger.debug('Calculating SLA deadline', {
      workOrderId: workOrder.id,
      priority,
      createdAt,
    });

    // Query SLA rule for this priority
    const slaRule = await SLARule.findOne({
      where: {
        priority,
        active: true,
      },
    });

    let resolutionHours = 24; // Default fallback

    if (!slaRule) {
      logger.warn('No active SLA rule found for priority, using default 24 hours', {
        workOrderId: workOrder.id,
        priority,
      });
    } else {
      resolutionHours = slaRule.target_resolution_hours;
    }

    // Calculate deadline: created_at + target_resolution_hours
    const deadline = new Date(createdAt);
    deadline.setHours(deadline.getHours() + resolutionHours);

    logger.debug('SLA deadline calculated', {
      workOrderId: workOrder.id,
      priority,
      resolutionHours,
      deadline: deadline.toISOString(),
    });

    return deadline;
  } catch (error) {
    logger.error('Error calculating SLA deadline', {
      workOrderId: workOrder ? workOrder.id : null,
      priority: workOrder ? workOrder.priority : null,
      error: error.message,
    });

    // Fallback to 24 hours from creation
    const deadline = new Date(workOrder.created_at || new Date());
    deadline.setHours(deadline.getHours() + 24);
    return deadline;
  }
};

/**
 * Get SLA warning threshold for a work order
 *
 * Calculates the time when warning should be sent based on escalation threshold.
 * Default threshold is 80%, meaning warning at 20% time remaining.
 *
 * @param {Object} workOrder - Work order object with created_at, priority, and sla_deadline
 * @returns {Promise<Date>} Warning threshold as Date object
 */
const getSLAWarningThreshold = async (workOrder) => {
  try {
    if (!workOrder || !workOrder.priority) {
      throw new Error('Work order with priority is required');
    }

    const priority = workOrder.priority;
    const createdAt = new Date(workOrder.created_at || new Date());
    const deadline = new Date(workOrder.sla_deadline);

    logger.debug('Calculating SLA warning threshold', {
      workOrderId: workOrder.id,
      priority,
      createdAt: createdAt.toISOString(),
      deadline: deadline.toISOString(),
    });

    // Get SLA rule for escalation threshold
    const slaRule = await SLARule.findOne({
      where: {
        priority,
        active: true,
      },
    });

    let escalationThresholdPct = SLA_ESCALATION_THRESHOLD_PCT; // Default 80%

    if (slaRule && slaRule.escalation_threshold_pct) {
      escalationThresholdPct = slaRule.escalation_threshold_pct;
    }

    // Calculate total duration in milliseconds
    const totalDuration = deadline.getTime() - createdAt.getTime();

    // Calculate warning threshold time
    // Warning at: created_at + (total_duration * escalation_threshold_pct / 100)
    const warningTime = new Date(createdAt.getTime() + (totalDuration * escalationThresholdPct / 100));

    logger.debug('SLA warning threshold calculated', {
      workOrderId: workOrder.id,
      priority,
      escalationThresholdPct,
      warningTime: warningTime.toISOString(),
      totalDurationHours: (totalDuration / (1000 * 60 * 60)).toFixed(2),
    });

    return warningTime;
  } catch (error) {
    logger.error('Error calculating SLA warning threshold', {
      workOrderId: workOrder ? workOrder.id : null,
      error: error.message,
    });

    // Fallback: warning at 80% of deadline
    const createdAt = new Date(workOrder.created_at || new Date());
    const deadline = new Date(workOrder.sla_deadline);
    const totalDuration = deadline.getTime() - createdAt.getTime();
    const warningTime = new Date(createdAt.getTime() + (totalDuration * 0.8));
    return warningTime;
  }
};

/**
 * Check SLA status for a work order
 *
 * Returns comprehensive SLA status information including:
 * - Whether order is overdue
 * - Whether order is in warning zone
 * - Time remaining (can be negative if overdue)
 * - Percentage of SLA time used
 * - Overall status: 'ok', 'warning', or 'overdue'
 *
 * @param {Object} workOrder - Work order object with created_at and sla_deadline
 * @returns {Promise<Object>} SLA status object
 */
const checkSLAStatus = async (workOrder) => {
  try {
    if (!workOrder) {
      throw new Error('Work order is required');
    }

    const now = new Date();
    const createdAt = new Date(workOrder.created_at);
    const deadline = new Date(workOrder.sla_deadline);
    const warningThreshold = await getSLAWarningThreshold(workOrder);

    // Calculate time remaining in milliseconds
    const timeRemainingMs = deadline.getTime() - now.getTime();
    const timeRemainingHours = timeRemainingMs / (1000 * 60 * 60);

    // Calculate total duration and elapsed time
    const totalDurationMs = deadline.getTime() - createdAt.getTime();
    const elapsedMs = now.getTime() - createdAt.getTime();

    // Calculate percentage used (can exceed 100% if overdue)
    const percentageUsed = totalDurationMs > 0 ? (elapsedMs / totalDurationMs) * 100 : 0;

    // Determine status
    const isOverdue = now >= deadline;
    const isWarning = !isOverdue && now >= warningThreshold;

    let status = 'ok';
    if (isOverdue) {
      status = 'overdue';
    } else if (isWarning) {
      status = 'warning';
    }

    const slaStatus = {
      isOverdue,
      isWarning,
      timeRemaining: parseFloat(timeRemainingHours.toFixed(2)), // Can be negative if overdue
      percentageUsed: parseFloat(percentageUsed.toFixed(2)),
      status,
      deadline: deadline.toISOString(),
      warningThreshold: warningThreshold.toISOString(),
    };

    logger.debug('SLA status checked', {
      workOrderId: workOrder.id,
      orderNumber: workOrder.order_number,
      slaStatus,
    });

    return slaStatus;
  } catch (error) {
    logger.error('Error checking SLA status', {
      workOrderId: workOrder ? workOrder.id : null,
      error: error.message,
    });

    // Return safe fallback status
    return {
      isOverdue: false,
      isWarning: false,
      timeRemaining: 0,
      percentageUsed: 0,
      status: 'ok',
      deadline: workOrder ? workOrder.sla_deadline : null,
      warningThreshold: null,
    };
  }
};

/**
 * Update work order overdue status
 *
 * Sets the is_overdue flag and creates an audit log entry.
 * Used by SLA monitor job when detecting violations.
 *
 * @param {number} workOrderId - Work order ID
 * @param {boolean} isOverdue - Overdue status to set
 * @returns {Promise<Object>} Updated work order
 */
const updateOverdueStatus = async (workOrderId, isOverdue) => {
  try {
    if (!workOrderId) {
      throw new Error('Work order ID is required');
    }

    logger.info('Updating work order overdue status', {
      workOrderId,
      isOverdue,
    });

    // Fetch work order
    const workOrder = await WorkOrder.findByPk(workOrderId);

    if (!workOrder) {
      throw new Error(`Work order not found: ${workOrderId}`);
    }

    // Check if status actually changed (avoid unnecessary updates)
    if (workOrder.is_overdue === isOverdue) {
      logger.debug('Overdue status unchanged, skipping update', {
        workOrderId,
        isOverdue,
      });
      return workOrder;
    }

    // Update is_overdue flag
    await workOrder.update({
      is_overdue: isOverdue,
    });

    // Calculate how long overdue
    const now = new Date();
    const deadline = new Date(workOrder.sla_deadline);
    const overdueMs = now.getTime() - deadline.getTime();
    const overdueHours = overdueMs / (1000 * 60 * 60);

    // Create audit log entry
    await AuditLog.create({
      timestamp: new Date(),
      user_id: null, // System action
      ip_address: null,
      action_type: isOverdue ? 'sla_violation' : 'sla_restored',
      resource_type: 'work_order',
      resource_id: workOrderId,
      before_state: {
        is_overdue: !isOverdue,
      },
      after_state: {
        is_overdue: isOverdue,
      },
      success: true,
      error_message: null,
    });

    logger.info('Work order overdue status updated', {
      workOrderId,
      orderNumber: workOrder.order_number,
      isOverdue,
      overdueHours: overdueHours > 0 ? parseFloat(overdueHours.toFixed(2)) : null,
    });

    return workOrder;
  } catch (error) {
    logger.error('Error updating overdue status', {
      workOrderId,
      isOverdue,
      error: error.message,
      stack: error.stack,
    });

    // Create failed audit log
    await AuditLog.create({
      timestamp: new Date(),
      user_id: null,
      ip_address: null,
      action_type: 'sla_update_failed',
      resource_type: 'work_order',
      resource_id: workOrderId,
      before_state: null,
      after_state: null,
      success: false,
      error_message: error.message,
    });

    throw error;
  }
};

module.exports = {
  calculateSLADeadline,
  getSLAWarningThreshold,
  checkSLAStatus,
  updateOverdueStatus,
};
