const { User, WorkOrder } = require('../models');
const { ROLES, MAX_CONCURRENT_ORDERS_PER_TECHNICIAN } = require('../utils/constants');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

/**
 * Work Order Assignment Service
 *
 * Implements intelligent round-robin assignment algorithm for work orders.
 * Assigns work orders to maintenance workers based on:
 * - Active status
 * - Current workload (max 5 concurrent "In Progress" orders)
 * - Fair distribution (least assigned active orders)
 *
 * Features:
 * - Round-robin load balancing
 * - Concurrent work order limit enforcement
 * - Comprehensive logging
 * - Error handling for edge cases
 */

/**
 * Assign a work order to an available maintenance worker
 *
 * Algorithm:
 * 1. Query all active maintenance workers (role_id = 5, active = true)
 * 2. For each technician, count active work orders ("In Progress")
 * 3. Filter technicians with available capacity (< 5 active orders)
 * 4. Select technician with least active work orders (round-robin)
 * 5. Return assigned technician
 *
 * @param {number} workOrderId - ID of the work order to assign
 * @param {number} faultTypeId - Fault type ID (for logging/future smart assignment)
 * @returns {Promise<Object>} Assigned technician user object
 * @throws {Error} If no available technicians or assignment fails
 */
const assignWorkOrder = async (workOrderId, faultTypeId) => {
  try {
    logger.info('Starting work order assignment', {
      workOrderId,
      faultTypeId,
    });

    // Validate input parameters
    if (!workOrderId) {
      throw new Error('Work order ID is required for assignment');
    }

    // Step 1: Query all active maintenance workers
    const maintenanceWorkers = await User.findAll({
      where: {
        role_id: ROLES.MAINTENANCE_WORKER,
        active: true,
      },
      attributes: ['id', 'name', 'contact_phone', 'department'],
      order: [['id', 'ASC']], // Consistent ordering for fair distribution
    });

    if (!maintenanceWorkers || maintenanceWorkers.length === 0) {
      logger.error('No active maintenance workers found', {
        workOrderId,
        faultTypeId,
      });
      throw new Error('No active maintenance workers available for assignment');
    }

    logger.debug('Found active maintenance workers', {
      count: maintenanceWorkers.length,
      workerIds: maintenanceWorkers.map((w) => w.id),
    });

    // Step 2 & 3: Count active work orders and find available technicians
    const techniciansWithWorkload = await Promise.all(
      maintenanceWorkers.map(async (worker) => {
        // Count "In Progress" work orders for this technician
        const activeOrderCount = await WorkOrder.count({
          where: {
            assigned_technician_id: worker.id,
            status: 'In Progress',
          },
        });

        return {
          user: worker,
          activeOrderCount,
          hasCapacity: activeOrderCount < MAX_CONCURRENT_ORDERS_PER_TECHNICIAN,
        };
      })
    );

    logger.debug('Technician workload analysis', {
      workloads: techniciansWithWorkload.map((t) => ({
        id: t.user.id,
        name: t.user.name,
        activeOrders: t.activeOrderCount,
        hasCapacity: t.hasCapacity,
      })),
    });

    // Filter technicians with available capacity
    const availableTechnicians = techniciansWithWorkload.filter((t) => t.hasCapacity);

    if (availableTechnicians.length === 0) {
      logger.error('All maintenance workers at capacity', {
        workOrderId,
        techniciansCount: maintenanceWorkers.length,
        maxCapacity: MAX_CONCURRENT_ORDERS_PER_TECHNICIAN,
      });
      throw new Error(
        `All maintenance workers are at maximum capacity (${MAX_CONCURRENT_ORDERS_PER_TECHNICIAN} concurrent orders). Please try again later or contact system administrator.`
      );
    }

    // Step 4: Select technician with least active work orders (round-robin)
    availableTechnicians.sort((a, b) => {
      // Primary: Sort by active order count (ascending)
      if (a.activeOrderCount !== b.activeOrderCount) {
        return a.activeOrderCount - b.activeOrderCount;
      }
      // Secondary: Sort by user ID for consistency
      return a.user.id - b.user.id;
    });

    const assignedTechnician = availableTechnicians[0];

    // Step 5: Log assignment decision and return
    logger.info('Work order assigned successfully', {
      workOrderId,
      faultTypeId,
      technicianId: assignedTechnician.user.id,
      technicianName: assignedTechnician.user.name,
      currentActiveOrders: assignedTechnician.activeOrderCount,
      newActiveOrders: assignedTechnician.activeOrderCount + 1,
      availableTechniciansCount: availableTechnicians.length,
    });

    return assignedTechnician.user;
  } catch (error) {
    logger.error('Work order assignment failed', {
      workOrderId,
      faultTypeId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Get current workload statistics for all maintenance workers
 * Useful for monitoring and analytics
 *
 * @returns {Promise<Array>} Array of technicians with their workload stats
 */
const getTechnicianWorkloadStats = async () => {
  try {
    logger.debug('Fetching technician workload statistics');

    const maintenanceWorkers = await User.findAll({
      where: {
        role_id: ROLES.MAINTENANCE_WORKER,
      },
      attributes: ['id', 'name', 'active', 'department'],
      order: [['name', 'ASC']],
    });

    const stats = await Promise.all(
      maintenanceWorkers.map(async (worker) => {
        // Count orders by status
        const [inProgressCount, pendingCount, totalCount] = await Promise.all([
          WorkOrder.count({
            where: {
              assigned_technician_id: worker.id,
              status: 'In Progress',
            },
          }),
          WorkOrder.count({
            where: {
              assigned_technician_id: worker.id,
              status: 'Pending Repair',
            },
          }),
          WorkOrder.count({
            where: {
              assigned_technician_id: worker.id,
              status: {
                [Op.in]: ['Pending Repair', 'In Progress', 'Repaired', 'Needs Rework'],
              },
            },
          }),
        ]);

        return {
          id: worker.id,
          name: worker.name,
          active: worker.active,
          department: worker.department,
          inProgressCount,
          pendingCount,
          totalActiveCount: totalCount,
          availableCapacity: MAX_CONCURRENT_ORDERS_PER_TECHNICIAN - inProgressCount,
          utilizationPct: Math.round(
            (inProgressCount / MAX_CONCURRENT_ORDERS_PER_TECHNICIAN) * 100
          ),
        };
      })
    );

    logger.info('Technician workload statistics retrieved', {
      totalTechnicians: stats.length,
      activeTechnicians: stats.filter((s) => s.active).length,
    });

    return stats;
  } catch (error) {
    logger.error('Failed to fetch technician workload statistics', {
      error: error.message,
      stack: error.stack,
    });
    throw new Error(`Failed to fetch workload statistics: ${error.message}`);
  }
};

/**
 * Check if a specific technician can accept more work orders
 *
 * @param {number} technicianId - Technician user ID
 * @returns {Promise<Object>} Object with hasCapacity boolean and current count
 */
const checkTechnicianCapacity = async (technicianId) => {
  try {
    if (!technicianId) {
      throw new Error('Technician ID is required');
    }

    // Verify technician exists and is a maintenance worker
    const technician = await User.findOne({
      where: {
        id: technicianId,
        role_id: ROLES.MAINTENANCE_WORKER,
      },
    });

    if (!technician) {
      throw new Error('Technician not found or invalid role');
    }

    // Count active work orders
    const activeOrderCount = await WorkOrder.count({
      where: {
        assigned_technician_id: technicianId,
        status: 'In Progress',
      },
    });

    const hasCapacity = activeOrderCount < MAX_CONCURRENT_ORDERS_PER_TECHNICIAN;

    logger.debug('Technician capacity checked', {
      technicianId,
      technicianName: technician.name,
      activeOrderCount,
      maxCapacity: MAX_CONCURRENT_ORDERS_PER_TECHNICIAN,
      hasCapacity,
    });

    return {
      hasCapacity,
      activeOrderCount,
      maxCapacity: MAX_CONCURRENT_ORDERS_PER_TECHNICIAN,
      availableSlots: MAX_CONCURRENT_ORDERS_PER_TECHNICIAN - activeOrderCount,
      isActive: technician.active,
    };
  } catch (error) {
    logger.error('Failed to check technician capacity', {
      technicianId,
      error: error.message,
    });
    throw error;
  }
};

module.exports = {
  assignWorkOrder,
  getTechnicianWorkloadStats,
  checkTechnicianCapacity,
};
