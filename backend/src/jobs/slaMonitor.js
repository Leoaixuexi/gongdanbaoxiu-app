const cron = require('node-cron');
const { WorkOrder, User, StatusHistory } = require('../models');
const slaService = require('../services/slaService');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');
const redisClient = require('../config/redis');
const { ROLES } = require('../utils/constants');
const { Op } = require('sequelize');

/**
 * SLA Monitor Job (T163-T170)
 * Scheduled job that runs every minute to monitor SLA compliance
 *
 * Responsibilities:
 * - Check for work orders approaching SLA deadline (warning threshold)
 * - Send warning notifications to technicians and supervisors
 * - Check for SLA violations (overdue orders)
 * - Update overdue flags in database
 * - Send escalation notifications to supervisors and managers
 * - Create audit logs for all SLA events
 * - Track warned orders in Redis to avoid duplicate notifications
 *
 * Performance optimizations:
 * - Batch database queries
 * - Use Redis for deduplication
 * - Process orders in parallel where possible
 * - Limit result sets with proper indexes
 * - Graceful error handling (don't crash app)
 *
 * Schedule: Runs every 1 minute (cron: '* * * * *')
 */

// Job state
let isJobRunning = false;
let lastRunTime = null;
let jobStats = {
  totalRuns: 0,
  totalWarningsSent: 0,
  totalEscalationsSent: 0,
  totalOrdersMarkedOverdue: 0,
  lastRunDuration: 0,
  errors: 0,
};

/**
 * Redis key generator for warned orders
 * Format: sla:warned:{workOrderId}
 */
const getWarnedKey = (workOrderId) => `sla:warned:${workOrderId}`;

/**
 * Check if order has already been warned
 * Uses Redis to track which orders have received warnings
 *
 * @param {number} workOrderId - Work order ID
 * @returns {Promise<boolean>} True if already warned
 */
const hasBeenWarned = async (workOrderId) => {
  try {
    const key = getWarnedKey(workOrderId);
    const exists = await redisClient.exists(key);
    return exists;
  } catch (error) {
    logger.error('Error checking warned status in Redis', {
      workOrderId,
      error: error.message,
    });
    // If Redis fails, assume not warned to be safe (may send duplicate)
    return false;
  }
};

/**
 * Mark order as warned in Redis
 * Sets key with 24 hour expiration
 *
 * @param {number} workOrderId - Work order ID
 * @returns {Promise<void>}
 */
const markAsWarned = async (workOrderId) => {
  try {
    const key = getWarnedKey(workOrderId);
    const ttl = 24 * 60 * 60; // 24 hours in seconds
    await redisClient.set(key, '1', ttl);
    logger.debug('Order marked as warned in Redis', { workOrderId, ttl });
  } catch (error) {
    logger.error('Error marking order as warned in Redis', {
      workOrderId,
      error: error.message,
    });
    // Non-critical error - continue processing
  }
};

/**
 * T164: Check for SLA warnings
 * Finds orders approaching deadline and sends warning notifications
 *
 * @returns {Promise<Object>} Warning check results
 */
const checkSLAWarnings = async () => {
  try {
    logger.debug('Checking for SLA warnings...');

    const now = new Date();

    // Find all active work orders (not completed)
    const activeOrders = await WorkOrder.findAll({
      where: {
        status: {
          [Op.ne]: 'Completed',
        },
      },
      include: [
        {
          model: User,
          as: 'assigned_technician',
          attributes: ['id', 'name', 'supervisor_id'],
        },
      ],
    });

    logger.debug('Active work orders found for warning check', {
      count: activeOrders.length,
    });

    let warningsProcessed = 0;
    let warningsSent = 0;
    const errors = [];

    // Check each order for warning threshold
    for (const order of activeOrders) {
      try {
        // Skip if already warned (check Redis)
        const alreadyWarned = await hasBeenWarned(order.id);
        if (alreadyWarned) {
          logger.debug('Order already warned, skipping', {
            workOrderId: order.id,
            orderNumber: order.order_number,
          });
          continue;
        }

        // Get SLA status
        const slaStatus = await slaService.checkSLAStatus(order);

        // Check if in warning zone (not overdue, but warning threshold reached)
        if (slaStatus.isWarning && !slaStatus.isOverdue) {
          warningsProcessed++;

          logger.info('Work order approaching SLA deadline', {
            workOrderId: order.id,
            orderNumber: order.order_number,
            timeRemaining: slaStatus.timeRemaining,
            percentageUsed: slaStatus.percentageUsed,
          });

          // T165: Send warning notifications
          await sendWarningNotifications(order, slaStatus);

          // Mark as warned in Redis to avoid duplicates
          await markAsWarned(order.id);

          // T169: Log warning in status history
          await StatusHistory.create({
            work_order_id: order.id,
            previous_status: order.status,
            new_status: order.status,
            actor_id: null, // System action
            notes: `SLA Warning: ${slaStatus.timeRemaining.toFixed(2)} hours remaining (${slaStatus.percentageUsed.toFixed(0)}% of SLA time used). Deadline: ${new Date(order.sla_deadline).toLocaleString('zh-CN')}`,
          });

          warningsSent++;
        }
      } catch (error) {
        logger.error('Error processing warning for work order', {
          workOrderId: order.id,
          orderNumber: order.order_number,
          error: error.message,
        });
        errors.push({
          workOrderId: order.id,
          orderNumber: order.order_number,
          error: error.message,
        });
        // Continue processing other orders
      }
    }

    logger.info('SLA warning check completed', {
      totalActive: activeOrders.length,
      warningsProcessed,
      warningsSent,
      errors: errors.length,
    });

    return {
      totalActive: activeOrders.length,
      warningsProcessed,
      warningsSent,
      errors,
    };
  } catch (error) {
    logger.error('Error in checkSLAWarnings', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * T165: Send warning notifications
 * Sends notifications to assigned technician and supervisor
 *
 * @param {Object} workOrder - Work order object
 * @param {Object} slaStatus - SLA status object
 * @returns {Promise<void>}
 */
const sendWarningNotifications = async (workOrder, slaStatus) => {
  try {
    const recipientIds = [];

    // Notify assigned technician
    if (workOrder.assigned_technician_id) {
      recipientIds.push(workOrder.assigned_technician_id);
    }

    // Notify technician's supervisor
    if (workOrder.assigned_technician && workOrder.assigned_technician.supervisor_id) {
      recipientIds.push(workOrder.assigned_technician.supervisor_id);
    }

    // Remove duplicates
    const uniqueRecipientIds = [...new Set(recipientIds)];

    if (uniqueRecipientIds.length === 0) {
      logger.warn('No recipients for SLA warning notification', {
        workOrderId: workOrder.id,
        orderNumber: workOrder.order_number,
      });
      return;
    }

    // Send notification
    await notificationService.sendWorkOrderNotification(
      {
        id: workOrder.id,
        order_number: workOrder.order_number,
        floor: workOrder.floor,
        location: workOrder.location,
        priority: workOrder.priority,
        status: workOrder.status,
        sla_deadline: workOrder.sla_deadline,
      },
      uniqueRecipientIds,
      'sla_warning',
      {
        remainingHours: slaStatus.timeRemaining.toFixed(2),
        percentageUsed: slaStatus.percentageUsed.toFixed(0),
      }
    );

    logger.info('SLA warning notifications sent', {
      workOrderId: workOrder.id,
      orderNumber: workOrder.order_number,
      recipientCount: uniqueRecipientIds.length,
      timeRemaining: slaStatus.timeRemaining,
    });
  } catch (error) {
    logger.error('Error sending warning notifications', {
      workOrderId: workOrder.id,
      orderNumber: workOrder.order_number,
      error: error.message,
    });
    throw error;
  }
};

/**
 * T166: Check for SLA violations
 * Finds orders that have exceeded their SLA deadline
 *
 * @returns {Promise<Object>} Violation check results
 */
const checkSLAViolations = async () => {
  try {
    logger.debug('Checking for SLA violations...');

    const now = new Date();

    // T166: Find active orders where deadline has passed
    const overdueOrders = await WorkOrder.findAll({
      where: {
        status: {
          [Op.ne]: 'Completed',
        },
        sla_deadline: {
          [Op.lt]: now,
        },
        is_overdue: false, // Not yet marked as overdue
      },
      include: [
        {
          model: User,
          as: 'assigned_technician',
          attributes: ['id', 'name', 'supervisor_id'],
        },
        {
          model: User,
          as: 'submitter',
          attributes: ['id', 'name'],
        },
      ],
    });

    logger.info('Overdue work orders found', {
      count: overdueOrders.length,
    });

    if (overdueOrders.length === 0) {
      return {
        totalOverdue: 0,
        updated: 0,
        escalationsSent: 0,
        errors: [],
      };
    }

    let updated = 0;
    let escalationsSent = 0;
    const errors = [];

    // Process each overdue order
    for (const order of overdueOrders) {
      try {
        // Calculate how long overdue
        const overdueMs = now.getTime() - new Date(order.sla_deadline).getTime();
        const overdueHours = (overdueMs / (1000 * 60 * 60)).toFixed(2);

        logger.info('Processing overdue work order', {
          workOrderId: order.id,
          orderNumber: order.order_number,
          deadline: order.sla_deadline,
          overdueHours,
        });

        // T167: Update overdue flag
        await slaService.updateOverdueStatus(order.id, true);
        updated++;

        // T168: Send escalation notifications
        await sendEscalationNotifications(order, overdueHours);
        escalationsSent++;

        // T169: Create status history for escalation
        await StatusHistory.create({
          work_order_id: order.id,
          previous_status: order.status,
          new_status: order.status,
          actor_id: null, // System action
          notes: `SLA VIOLATION: Work order is overdue by ${overdueHours} hours. Deadline was ${new Date(order.sla_deadline).toLocaleString('zh-CN')}. Escalated to supervisor and management.`,
        });
      } catch (error) {
        logger.error('Error processing overdue work order', {
          workOrderId: order.id,
          orderNumber: order.order_number,
          error: error.message,
        });
        errors.push({
          workOrderId: order.id,
          orderNumber: order.order_number,
          error: error.message,
        });
        // Continue processing other orders
      }
    }

    logger.info('SLA violation check completed', {
      totalOverdue: overdueOrders.length,
      updated,
      escalationsSent,
      errors: errors.length,
    });

    return {
      totalOverdue: overdueOrders.length,
      updated,
      escalationsSent,
      errors,
    };
  } catch (error) {
    logger.error('Error in checkSLAViolations', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * T168: Send escalation notifications
 * Sends notifications to supervisor and all managers/admins
 *
 * @param {Object} workOrder - Work order object
 * @param {string} overdueHours - Hours overdue (formatted string)
 * @returns {Promise<void>}
 */
const sendEscalationNotifications = async (workOrder, overdueHours) => {
  try {
    const recipientIds = [];

    // Notify technician's supervisor
    if (workOrder.assigned_technician && workOrder.assigned_technician.supervisor_id) {
      recipientIds.push(workOrder.assigned_technician.supervisor_id);
    }

    // Notify all managers and admins
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

    // Remove duplicates
    const uniqueRecipientIds = [...new Set(recipientIds)];

    if (uniqueRecipientIds.length === 0) {
      logger.warn('No recipients for escalation notification', {
        workOrderId: workOrder.id,
        orderNumber: workOrder.order_number,
      });
      return;
    }

    // Send escalation notification
    await notificationService.sendWorkOrderNotification(
      {
        id: workOrder.id,
        order_number: workOrder.order_number,
        floor: workOrder.floor,
        location: workOrder.location,
        priority: workOrder.priority,
        status: workOrder.status,
        sla_deadline: workOrder.sla_deadline,
      },
      uniqueRecipientIds,
      'escalation',
      {
        reason: `SLA violation - overdue by ${overdueHours} hours`,
        overdueHours,
        technicianName: workOrder.assigned_technician ? workOrder.assigned_technician.name : 'Unassigned',
        deadline: new Date(workOrder.sla_deadline).toLocaleString('zh-CN'),
      }
    );

    logger.info('Escalation notifications sent', {
      workOrderId: workOrder.id,
      orderNumber: workOrder.order_number,
      recipientCount: uniqueRecipientIds.length,
      overdueHours,
    });
  } catch (error) {
    logger.error('Error sending escalation notifications', {
      workOrderId: workOrder.id,
      orderNumber: workOrder.order_number,
      error: error.message,
    });
    throw error;
  }
};

/**
 * Main SLA monitoring job execution
 * T170: Run all SLA checks and handle errors gracefully
 *
 * @returns {Promise<Object>} Job execution results
 */
const executeSLAMonitor = async () => {
  // Prevent concurrent executions
  if (isJobRunning) {
    logger.warn('SLA monitor job already running, skipping this execution');
    return { skipped: true, reason: 'Job already running' };
  }

  isJobRunning = true;
  const startTime = Date.now();

  try {
    logger.info('SLA monitor job starting...');

    // T164: Check for SLA warnings
    const warningResults = await checkSLAWarnings();

    // T166: Check for SLA violations
    const violationResults = await checkSLAViolations();

    const duration = Date.now() - startTime;
    lastRunTime = new Date();

    // Update stats
    jobStats.totalRuns++;
    jobStats.totalWarningsSent += warningResults.warningsSent;
    jobStats.totalEscalationsSent += violationResults.escalationsSent;
    jobStats.totalOrdersMarkedOverdue += violationResults.updated;
    jobStats.lastRunDuration = duration;

    const results = {
      success: true,
      timestamp: lastRunTime.toISOString(),
      duration,
      warnings: warningResults,
      violations: violationResults,
      stats: { ...jobStats },
    };

    logger.info('SLA monitor job completed', {
      duration,
      warningsSent: warningResults.warningsSent,
      escalationsSent: violationResults.escalationsSent,
      overdueUpdated: violationResults.updated,
      totalErrors: warningResults.errors.length + violationResults.errors.length,
    });

    return results;
  } catch (error) {
    const duration = Date.now() - startTime;
    jobStats.errors++;

    logger.error('SLA monitor job failed', {
      error: error.message,
      stack: error.stack,
      duration,
    });

    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      duration,
    };
  } finally {
    isJobRunning = false;
  }
};

/**
 * T170: Initialize and register SLA monitor job
 * Sets up cron schedule to run every minute
 *
 * @returns {Object} Cron task object
 */
const initSLAMonitor = () => {
  logger.info('Initializing SLA monitor job...');

  // T170: Schedule to run every 1 minute
  const task = cron.schedule('* * * * *', async () => {
    try {
      await executeSLAMonitor();
    } catch (error) {
      logger.error('Unhandled error in SLA monitor cron job', {
        error: error.message,
        stack: error.stack,
      });
      // Don't throw - prevent job from crashing
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Shanghai', // Adjust to your timezone
  });

  logger.info('SLA monitor job registered successfully', {
    schedule: 'Every 1 minute (* * * * *)',
    timezone: 'Asia/Shanghai',
  });

  return task;
};

/**
 * Stop SLA monitor job (for graceful shutdown)
 */
const stopSLAMonitor = (task) => {
  if (task) {
    task.stop();
    logger.info('SLA monitor job stopped');
  }
};

/**
 * Get job statistics
 * @returns {Object} Job statistics
 */
const getJobStats = () => {
  return {
    ...jobStats,
    isRunning: isJobRunning,
    lastRunTime: lastRunTime ? lastRunTime.toISOString() : null,
  };
};

/**
 * Manual execution (for testing or admin trigger)
 * @returns {Promise<Object>} Execution results
 */
const runManually = async () => {
  logger.info('SLA monitor job triggered manually');
  return await executeSLAMonitor();
};

module.exports = {
  initSLAMonitor,
  stopSLAMonitor,
  executeSLAMonitor,
  runManually,
  getJobStats,
};
