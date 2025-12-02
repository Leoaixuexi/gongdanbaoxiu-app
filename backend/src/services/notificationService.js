const { Notification, User, WorkOrder } = require('../models');
const { sendTemplateMessage } = require('../config/wechat');
const { DELIVERY_STATUSES, MAX_NOTIFICATION_RETRIES } = require('../utils/constants');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

/**
 * WeChat Notification Service
 *
 * Handles sending WeChat template messages and managing notification records.
 * Features:
 * - Integration with WeChat template message API
 * - Automatic retry with exponential backoff
 * - Database tracking of all notifications
 * - Support for multiple event types
 * - Batch notification support
 * - Failed notification retry mechanism
 *
 * Supported Event Types:
 * - work_order_created: New work order submitted
 * - status_changed: Work order status updated
 * - sla_warning: SLA deadline approaching
 * - escalation: Work order escalated to supervisor
 */

/**
 * WeChat Template IDs (should be configured in .env in production)
 * These are placeholder IDs - replace with actual WeChat template IDs
 */
const TEMPLATE_IDS = {
  work_order_created: process.env.WECHAT_TEMPLATE_CREATED || 'TEMPLATE_ID_CREATED',
  status_changed: process.env.WECHAT_TEMPLATE_STATUS || 'TEMPLATE_ID_STATUS',
  sla_warning: process.env.WECHAT_TEMPLATE_SLA || 'TEMPLATE_ID_SLA',
  escalation: process.env.WECHAT_TEMPLATE_ESCALATION || 'TEMPLATE_ID_ESCALATION',
};

/**
 * Send work order notification to recipients
 *
 * Creates notification records in database and sends WeChat template messages.
 * Implements automatic retry with exponential backoff for failed sends.
 *
 * @param {Object} workOrder - Work order object (must include related data)
 * @param {Array<number>} recipientIds - Array of user IDs to notify
 * @param {string} eventType - Type of event ('work_order_created', 'status_changed', 'sla_warning', 'escalation')
 * @param {Object} additionalData - Optional additional data for template
 * @returns {Promise<Object>} Object with success count and failed notifications
 * @throws {Error} If notification setup fails
 */
const sendWorkOrderNotification = async (
  workOrder,
  recipientIds,
  eventType,
  additionalData = {}
) => {
  try {
    // Validate input parameters
    if (!workOrder || !workOrder.id) {
      throw new Error('Valid work order object is required');
    }

    if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
      throw new Error('At least one recipient ID is required');
    }

    if (!eventType || !TEMPLATE_IDS[eventType]) {
      throw new Error(`Invalid event type: ${eventType}`);
    }

    logger.info('Sending work order notifications', {
      workOrderId: workOrder.id,
      orderNumber: workOrder.order_number,
      recipientCount: recipientIds.length,
      eventType,
    });

    // Fetch recipient users with their WeChat openids
    const recipients = await User.findAll({
      where: {
        id: {
          [Op.in]: recipientIds,
        },
        active: true, // Only send to active users
      },
      attributes: ['id', 'wechat_openid', 'name'],
    });

    if (recipients.length === 0) {
      logger.warn('No active recipients found for notification', {
        workOrderId: workOrder.id,
        requestedRecipientIds: recipientIds,
      });
      return {
        success: 0,
        failed: 0,
        skipped: recipientIds.length,
        details: [],
      };
    }

    // Prepare notification content based on event type
    const content = generateNotificationContent(workOrder, eventType, additionalData);
    const templateData = generateTemplateData(workOrder, eventType, additionalData);
    const templateId = TEMPLATE_IDS[eventType];
    const page = `pages/workorder/detail?id=${workOrder.id}`; // Navigate to work order detail page

    // Send notifications to all recipients
    const results = await Promise.allSettled(
      recipients.map(async (recipient) => {
        return sendNotificationToRecipient(
          workOrder.id,
          recipient,
          eventType,
          templateId,
          templateData,
          content,
          page
        );
      })
    );

    // Analyze results
    const successCount = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
    const failedResults = results
      .map((r, index) => ({
        recipient: recipients[index],
        result: r,
      }))
      .filter((item) => item.result.status === 'rejected' || !item.result.value.success);

    logger.info('Notification batch completed', {
      workOrderId: workOrder.id,
      eventType,
      totalRecipients: recipients.length,
      successCount,
      failedCount: failedResults.length,
    });

    return {
      success: successCount,
      failed: failedResults.length,
      skipped: recipientIds.length - recipients.length,
      details: failedResults.map((item) => ({
        recipientId: item.recipient.id,
        recipientName: item.recipient.name,
        error:
          item.result.status === 'rejected'
            ? item.result.reason.message
            : item.result.value.error,
      })),
    };
  } catch (error) {
    logger.error('Failed to send work order notifications', {
      workOrderId: workOrder ? workOrder.id : null,
      eventType,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Send notification to a single recipient with retry logic
 *
 * @private
 * @param {number} workOrderId - Work order ID
 * @param {Object} recipient - Recipient user object
 * @param {string} eventType - Event type
 * @param {string} templateId - WeChat template ID
 * @param {Object} templateData - Template data
 * @param {string} content - Notification content text
 * @param {string} page - Mini program page path
 * @returns {Promise<Object>} Send result
 */
const sendNotificationToRecipient = async (
  workOrderId,
  recipient,
  eventType,
  templateId,
  templateData,
  content,
  page
) => {
  let notificationRecord = null;

  try {
    // Create notification record in database
    notificationRecord = await Notification.create({
      work_order_id: workOrderId,
      recipient_id: recipient.id,
      notification_type: 'template_message',
      event_type: eventType,
      content,
      delivery_status: 'pending',
      retry_count: 0,
    });

    logger.debug('Notification record created', {
      notificationId: notificationRecord.id,
      workOrderId,
      recipientId: recipient.id,
    });

    // Attempt to send WeChat template message with retry
    const sendResult = await sendWithRetry(
      recipient.wechat_openid,
      templateId,
      templateData,
      page,
      notificationRecord
    );

    // Update notification record with success
    await notificationRecord.update({
      delivery_status: 'sent',
      sent_at: new Date(),
    });

    logger.info('Notification sent successfully', {
      notificationId: notificationRecord.id,
      recipientId: recipient.id,
      recipientName: recipient.name,
      msgid: sendResult.msgid,
    });

    return {
      success: true,
      notificationId: notificationRecord.id,
      msgid: sendResult.msgid,
    };
  } catch (error) {
    // Update notification record with failure
    if (notificationRecord) {
      await notificationRecord.update({
        delivery_status: 'failed',
        error_message: error.message.substring(0, 500), // Limit error message length
      });
    }

    logger.error('Failed to send notification to recipient', {
      notificationId: notificationRecord ? notificationRecord.id : null,
      recipientId: recipient.id,
      recipientName: recipient.name,
      error: error.message,
    });

    return {
      success: false,
      notificationId: notificationRecord ? notificationRecord.id : null,
      error: error.message,
    };
  }
};

/**
 * Send WeChat template message with exponential backoff retry
 *
 * @private
 * @param {string} openid - Recipient WeChat openid
 * @param {string} templateId - Template ID
 * @param {Object} templateData - Template data
 * @param {string} page - Page path
 * @param {Object} notificationRecord - Notification database record
 * @param {number} attempt - Current attempt number (0-indexed)
 * @returns {Promise<Object>} Send result from WeChat API
 */
const sendWithRetry = async (
  openid,
  templateId,
  templateData,
  page,
  notificationRecord,
  attempt = 0
) => {
  try {
    // Attempt to send
    const result = await sendTemplateMessage(openid, templateId, templateData, page);
    return result;
  } catch (error) {
    const isLastAttempt = attempt >= MAX_NOTIFICATION_RETRIES - 1;

    logger.warn('Notification send attempt failed', {
      notificationId: notificationRecord.id,
      attempt: attempt + 1,
      maxRetries: MAX_NOTIFICATION_RETRIES,
      isLastAttempt,
      error: error.message,
    });

    // Update retry count
    await notificationRecord.update({
      retry_count: attempt + 1,
    });

    // If not last attempt, retry with exponential backoff
    if (!isLastAttempt) {
      // Exponential backoff: 2^attempt seconds (1s, 2s, 4s)
      const delayMs = 1000 * Math.pow(2, attempt);
      logger.debug('Retrying notification after delay', {
        notificationId: notificationRecord.id,
        delayMs,
        nextAttempt: attempt + 2,
      });

      await new Promise((resolve) => setTimeout(resolve, delayMs));

      // Retry
      return sendWithRetry(openid, templateId, templateData, page, notificationRecord, attempt + 1);
    }

    // All retries exhausted
    throw error;
  }
};

/**
 * Generate notification content text based on event type
 *
 * @private
 * @param {Object} workOrder - Work order object
 * @param {string} eventType - Event type
 * @param {Object} additionalData - Additional data
 * @returns {string} Notification content
 */
const generateNotificationContent = (workOrder, eventType, additionalData) => {
  switch (eventType) {
    case 'work_order_created':
      return `∞ÂU ${workOrder.order_number} ÚMŸ®Mn${workOrder.floor} ${workOrder.location}Hß${workOrder.priority}`;

    case 'status_changed':
      return `ÂU ${workOrder.order_number} ∂ÚÙ∞:${workOrder.status}${additionalData.notes ? `Ë${additionalData.notes}` : ''}`;

    case 'sla_warning':
      return `ÂU ${workOrder.order_number} sÖ˜=Î*bˆÙ${new Date(workOrder.sla_deadline).toLocaleString('zh-CN')}`;

    case 'escalation':
      return `ÂU ${workOrder.order_number} ÚGß${additionalData.reason || ' Å®ÑsËå'}`;

    default:
      return `ÂU ${workOrder.order_number} 	∞ÑÙ∞`;
  }
};

/**
 * Generate WeChat template data based on event type
 *
 * @private
 * @param {Object} workOrder - Work order object
 * @param {string} eventType - Event type
 * @param {Object} additionalData - Additional data
 * @returns {Object} Template data object
 */
const generateTemplateData = (workOrder, eventType, additionalData) => {
  // Base data common to all templates
  const baseData = {
    order_number: workOrder.order_number,
    location: `${workOrder.floor} ${workOrder.location}`,
    time: new Date().toLocaleString('zh-CN'),
  };

  // Event-specific data
  switch (eventType) {
    case 'work_order_created':
      return {
        ...baseData,
        priority: workOrder.priority,
        fault_type: additionalData.faultTypeName || 'ÙÓ',
        description: workOrder.description.substring(0, 50),
      };

    case 'status_changed':
      return {
        ...baseData,
        status: workOrder.status,
        notes: additionalData.notes || '',
      };

    case 'sla_warning':
      return {
        ...baseData,
        deadline: new Date(workOrder.sla_deadline).toLocaleString('zh-CN'),
        remaining_hours: additionalData.remainingHours || 'N/A',
      };

    case 'escalation':
      return {
        ...baseData,
        reason: additionalData.reason || ' ÅsË',
        escalated_by: additionalData.escalatedByName || '˚ﬂ',
      };

    default:
      return baseData;
  }
};

/**
 * Retry failed notifications (to be called by cron job)
 *
 * Finds all notifications with 'failed' status and retry_count < max retries,
 * then attempts to resend them.
 *
 * @param {number} limit - Maximum number of notifications to retry (default: 50)
 * @returns {Promise<Object>} Retry statistics
 */
const retryFailedNotifications = async (limit = 50) => {
  try {
    logger.info('Starting failed notification retry job', { limit });

    // Find failed notifications that haven't exceeded retry limit
    const failedNotifications = await Notification.findAll({
      where: {
        delivery_status: 'failed',
        retry_count: {
          [Op.lt]: MAX_NOTIFICATION_RETRIES,
        },
      },
      include: [
        {
          model: User,
          as: 'recipient',
          attributes: ['id', 'wechat_openid', 'name'],
          where: { active: true },
        },
        {
          model: WorkOrder,
          as: 'work_order',
          attributes: ['id', 'order_number', 'status'],
        },
      ],
      limit,
      order: [['created_at', 'ASC']], // Retry oldest first
    });

    if (failedNotifications.length === 0) {
      logger.info('No failed notifications to retry');
      return { retried: 0, succeeded: 0, failed: 0 };
    }

    logger.info('Found failed notifications to retry', {
      count: failedNotifications.length,
    });

    // Retry each notification
    const results = await Promise.allSettled(
      failedNotifications.map(async (notification) => {
        try {
          const templateId = TEMPLATE_IDS[notification.event_type] || TEMPLATE_IDS.status_changed;
          const page = `pages/workorder/detail?id=${notification.work_order_id}`;

          // Parse template data from content (simplified approach)
          const templateData = {
            order_number: notification.work_order.order_number,
            status: notification.work_order.status,
            time: new Date().toLocaleString('zh-CN'),
          };

          // Attempt send with retry
          const result = await sendWithRetry(
            notification.recipient.wechat_openid,
            templateId,
            templateData,
            page,
            notification,
            notification.retry_count
          );

          // Update to sent status
          await notification.update({
            delivery_status: 'sent',
            sent_at: new Date(),
          });

          return { success: true, notificationId: notification.id };
        } catch (error) {
          // Update retry count and keep as failed
          await notification.update({
            delivery_status: 'failed',
            error_message: error.message.substring(0, 500),
          });

          return { success: false, notificationId: notification.id, error: error.message };
        }
      })
    );

    // Analyze results
    const succeeded = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - succeeded;

    logger.info('Failed notification retry job completed', {
      retried: results.length,
      succeeded,
      failed,
    });

    return {
      retried: results.length,
      succeeded,
      failed,
    };
  } catch (error) {
    logger.error('Failed notification retry job error', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Get notification statistics for a work order
 *
 * @param {number} workOrderId - Work order ID
 * @returns {Promise<Object>} Notification statistics
 */
const getWorkOrderNotificationStats = async (workOrderId) => {
  try {
    if (!workOrderId) {
      throw new Error('Work order ID is required');
    }

    const notifications = await Notification.findAll({
      where: { work_order_id: workOrderId },
      attributes: ['delivery_status', 'event_type', 'retry_count'],
    });

    const stats = {
      total: notifications.length,
      sent: notifications.filter((n) => n.delivery_status === 'sent').length,
      failed: notifications.filter((n) => n.delivery_status === 'failed').length,
      pending: notifications.filter((n) => n.delivery_status === 'pending').length,
      byEventType: {},
    };

    // Group by event type
    notifications.forEach((n) => {
      if (!stats.byEventType[n.event_type]) {
        stats.byEventType[n.event_type] = {
          total: 0,
          sent: 0,
          failed: 0,
          pending: 0,
        };
      }
      stats.byEventType[n.event_type].total += 1;
      stats.byEventType[n.event_type][n.delivery_status] += 1;
    });

    return stats;
  } catch (error) {
    logger.error('Failed to get notification statistics', {
      workOrderId,
      error: error.message,
    });
    throw error;
  }
};

module.exports = {
  sendWorkOrderNotification,
  retryFailedNotifications,
  getWorkOrderNotificationStats,
};
