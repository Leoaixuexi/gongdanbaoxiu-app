const { Op, fn, col, literal } = require('sequelize');
const db = require('../models');
const redis = require('../config/redis');
const logger = require('../utils/logger');

const { WorkOrder, User, FaultType, sequelize } = db;

/**
 * Analytics Service
 * Provides comprehensive analytics and KPI calculations for work order monitoring
 *
 * Features:
 * - Real-time KPI calculations
 * - Response time and resolution time metrics
 * - First-time fix rate tracking
 * - Overdue rate monitoring
 * - Trend analysis
 * - Technician performance metrics
 * - Redis caching for performance optimization
 */

// Cache TTL in seconds (5 minutes)
const CACHE_TTL = 300;

// Cache key prefix
const CACHE_PREFIX = 'analytics';

/**
 * Build date range filter for queries
 * @param {Object} dateRange - Date range object
 * @param {Date} dateRange.startDate - Start date
 * @param {Date} dateRange.endDate - End date
 * @returns {Object} Sequelize where clause
 */
const buildDateRangeFilter = (dateRange = {}) => {
  const { startDate, endDate } = dateRange;
  const dateFilter = {};

  if (startDate || endDate) {
    dateFilter.created_at = {};
    if (startDate) {
      dateFilter.created_at[Op.gte] = new Date(startDate);
    }
    if (endDate) {
      dateFilter.created_at[Op.lte] = new Date(endDate);
    }
  }

  return dateFilter;
};

/**
 * Build additional filters for queries
 * @param {Object} filters - Filter options
 * @param {number} filters.department - Department ID (via technician)
 * @param {number} filters.technician - Technician ID
 * @param {number} filters.fault_type - Fault type ID
 * @returns {Object} Sequelize where clause
 */
const buildAdditionalFilters = (filters = {}) => {
  const whereClause = {};

  if (filters.technician) {
    whereClause.assigned_technician_id = filters.technician;
  }

  if (filters.fault_type) {
    whereClause.fault_type_id = filters.fault_type;
  }

  return whereClause;
};

/**
 * Calculate average response time (created_at to started_at)
 * T113 - Calculate average time between created_at and started_at
 *
 * Formula: AVG(TIMESTAMPDIFF(HOUR, created_at, started_at))
 *
 * @param {Object} options - Filter options
 * @param {Object} options.dateRange - Date range filter
 * @param {number} options.department - Department ID filter
 * @param {number} options.technician - Technician ID filter
 * @param {number} options.fault_type - Fault type ID filter
 * @returns {Promise<number>} Average response time in hours (2 decimal places)
 */
const calculateAverageResponseTime = async (options = {}) => {
  try {
    logger.info('Calculating average response time', { options });

    const { dateRange = {}, ...filters } = options;

    // Build where clause
    const whereClause = {
      ...buildDateRangeFilter(dateRange),
      ...buildAdditionalFilters(filters),
      // Only count orders that have been started (started_at is not null)
      started_at: { [Op.ne]: null },
    };

    // Calculate average using raw SQL for accuracy
    const result = await WorkOrder.findAll({
      attributes: [
        [
          fn('AVG',
            literal('TIMESTAMPDIFF(SECOND, created_at, started_at) / 3600.0')
          ),
          'avg_response_hours'
        ],
      ],
      where: whereClause,
      raw: true,
    });

    const avgResponseTime = result[0]?.avg_response_hours || 0;
    const rounded = parseFloat(avgResponseTime).toFixed(2);

    logger.info('Average response time calculated', {
      avgResponseTime: rounded,
      filters,
      dateRange,
    });

    return parseFloat(rounded);
  } catch (error) {
    logger.error('Error calculating average response time', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Calculate average resolution time (created_at to completed_at)
 * T114 - Calculate average time between created_at and completed_at
 *
 * Formula: AVG(TIMESTAMPDIFF(HOUR, created_at, completed_at))
 * Only for status = 'Completed'
 *
 * @param {Object} options - Filter options
 * @param {Object} options.dateRange - Date range filter
 * @param {number} options.department - Department ID filter
 * @param {number} options.technician - Technician ID filter
 * @param {number} options.fault_type - Fault type ID filter
 * @returns {Promise<number>} Average resolution time in hours (2 decimal places)
 */
const calculateAverageResolutionTime = async (options = {}) => {
  try {
    logger.info('Calculating average resolution time', { options });

    const { dateRange = {}, ...filters } = options;

    // Build where clause
    const whereClause = {
      ...buildDateRangeFilter(dateRange),
      ...buildAdditionalFilters(filters),
      // Only count completed orders
      status: 'Completed',
      completed_at: { [Op.ne]: null },
    };

    // Calculate average using raw SQL for accuracy
    const result = await WorkOrder.findAll({
      attributes: [
        [
          fn('AVG',
            literal('TIMESTAMPDIFF(SECOND, created_at, completed_at) / 3600.0')
          ),
          'avg_resolution_hours'
        ],
      ],
      where: whereClause,
      raw: true,
    });

    const avgResolutionTime = result[0]?.avg_resolution_hours || 0;
    const rounded = parseFloat(avgResolutionTime).toFixed(2);

    logger.info('Average resolution time calculated', {
      avgResolutionTime: rounded,
      filters,
      dateRange,
    });

    return parseFloat(rounded);
  } catch (error) {
    logger.error('Error calculating average resolution time', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Calculate first-time fix rate
 * T115 - Calculate percentage of work orders completed without rework
 *
 * Formula: (COUNT(rework_count = 0) / COUNT(status = 'Completed')) * 100
 *
 * @param {Object} options - Filter options
 * @param {Object} options.dateRange - Date range filter
 * @param {number} options.department - Department ID filter
 * @param {number} options.technician - Technician ID filter
 * @param {number} options.fault_type - Fault type ID filter
 * @returns {Promise<number>} First-time fix rate percentage (2 decimal places)
 */
const calculateFirstTimeFixRate = async (options = {}) => {
  try {
    logger.info('Calculating first-time fix rate', { options });

    const { dateRange = {}, ...filters } = options;

    // Build base where clause
    const baseWhereClause = {
      ...buildDateRangeFilter(dateRange),
      ...buildAdditionalFilters(filters),
      status: 'Completed',
    };

    // Count total completed orders
    const totalCompleted = await WorkOrder.count({
      where: baseWhereClause,
    });

    // Handle division by zero
    if (totalCompleted === 0) {
      logger.info('No completed orders found for first-time fix rate calculation');
      return 0.00;
    }

    // Count orders completed without rework
    const noReworkCount = await WorkOrder.count({
      where: {
        ...baseWhereClause,
        rework_count: 0,
      },
    });

    // Calculate percentage
    const firstTimeFixRate = (noReworkCount / totalCompleted) * 100;
    const rounded = parseFloat(firstTimeFixRate).toFixed(2);

    logger.info('First-time fix rate calculated', {
      noReworkCount,
      totalCompleted,
      firstTimeFixRate: rounded,
      filters,
      dateRange,
    });

    return parseFloat(rounded);
  } catch (error) {
    logger.error('Error calculating first-time fix rate', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Calculate overdue rate
 * T116 - Calculate percentage of overdue work orders
 *
 * Formula: (COUNT(is_overdue = true) / COUNT(status != 'Completed')) * 100
 *
 * @param {Object} options - Filter options
 * @param {Object} options.dateRange - Date range filter
 * @param {boolean} options.includeCompleted - Include completed orders (default: false)
 * @returns {Promise<number>} Overdue rate percentage (2 decimal places)
 */
const calculateOverdueRate = async (options = {}) => {
  try {
    logger.info('Calculating overdue rate', { options });

    const { dateRange = {}, includeCompleted = false, ...filters } = options;

    // Build base where clause
    const baseWhereClause = {
      ...buildDateRangeFilter(dateRange),
      ...buildAdditionalFilters(filters),
    };

    // Exclude completed orders unless specified
    if (!includeCompleted) {
      baseWhereClause.status = {
        [Op.ne]: 'Completed',
      };
    }

    // Count total active orders
    const totalOrders = await WorkOrder.count({
      where: baseWhereClause,
    });

    // Handle division by zero
    if (totalOrders === 0) {
      logger.info('No active orders found for overdue rate calculation');
      return 0.00;
    }

    // Count overdue orders
    const overdueCount = await WorkOrder.count({
      where: {
        ...baseWhereClause,
        is_overdue: true,
      },
    });

    // Calculate percentage
    const overdueRate = (overdueCount / totalOrders) * 100;
    const rounded = parseFloat(overdueRate).toFixed(2);

    logger.info('Overdue rate calculated', {
      overdueCount,
      totalOrders,
      overdueRate: rounded,
      includeCompleted,
      filters,
      dateRange,
    });

    return parseFloat(rounded);
  } catch (error) {
    logger.error('Error calculating overdue rate', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Get overview statistics (main aggregated KPIs)
 * T112 - Aggregate all KPIs into single response
 *
 * Includes:
 * - Total work orders
 * - Active work orders (not completed)
 * - Completed work orders
 * - Average response time
 * - Average resolution time
 * - First-time fix rate
 * - Overdue rate
 * - Counts by status
 * - Counts by priority
 *
 * Results are cached in Redis for 5 minutes
 *
 * @param {Object} options - Filter options
 * @param {Object} options.dateRange - Date range filter
 * @param {boolean} options.skipCache - Skip cache and force recalculation
 * @returns {Promise<Object>} Overview statistics object
 */
const getOverviewStats = async (options = {}) => {
  try {
    logger.info('Getting overview statistics', { options });

    const { dateRange = {}, skipCache = false } = options;

    // Generate cache key
    const cacheKey = `${CACHE_PREFIX}:overview:${JSON.stringify(dateRange)}`;

    // Check cache unless skipCache is true
    if (!skipCache) {
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        logger.info('Returning cached overview statistics', { cacheKey });
        return JSON.parse(cachedData);
      }
    }

    // Build date filter
    const dateFilter = buildDateRangeFilter(dateRange);

    // Execute all queries in parallel for performance
    const [
      totalOrders,
      activeOrders,
      completedOrders,
      statusCounts,
      priorityCounts,
      avgResponseTime,
      avgResolutionTime,
      firstTimeFixRate,
      overdueRate,
    ] = await Promise.all([
      // Total work orders
      WorkOrder.count({ where: dateFilter }),

      // Active work orders (not completed)
      WorkOrder.count({
        where: {
          ...dateFilter,
          status: { [Op.ne]: 'Completed' },
        },
      }),

      // Completed work orders
      WorkOrder.count({
        where: {
          ...dateFilter,
          status: 'Completed',
        },
      }),

      // Counts by status
      WorkOrder.findAll({
        attributes: [
          'status',
          [fn('COUNT', col('id')), 'count'],
        ],
        where: dateFilter,
        group: ['status'],
        raw: true,
      }),

      // Counts by priority
      WorkOrder.findAll({
        attributes: [
          'priority',
          [fn('COUNT', col('id')), 'count'],
        ],
        where: dateFilter,
        group: ['priority'],
        raw: true,
      }),

      // KPI calculations
      calculateAverageResponseTime({ dateRange }),
      calculateAverageResolutionTime({ dateRange }),
      calculateFirstTimeFixRate({ dateRange }),
      calculateOverdueRate({ dateRange }),
    ]);

    // Format status counts
    const byStatus = {
      'Pending Repair': 0,
      'In Progress': 0,
      'Repaired': 0,
      'Needs Rework': 0,
      'Completed': 0,
    };
    statusCounts.forEach(item => {
      byStatus[item.status] = parseInt(item.count);
    });

    // Format priority counts
    const byPriority = {
      'Low': 0,
      'Normal': 0,
      'High': 0,
      'Emergency': 0,
    };
    priorityCounts.forEach(item => {
      byPriority[item.priority] = parseInt(item.count);
    });

    // Build response object
    const stats = {
      summary: {
        totalOrders,
        activeOrders,
        completedOrders,
      },
      kpis: {
        averageResponseTime: avgResponseTime,
        averageResolutionTime: avgResolutionTime,
        firstTimeFixRate: firstTimeFixRate,
        overdueRate: overdueRate,
      },
      byStatus,
      byPriority,
      dateRange: {
        startDate: dateRange.startDate || null,
        endDate: dateRange.endDate || null,
      },
      generatedAt: new Date().toISOString(),
    };

    // Cache the result
    await redis.set(cacheKey, JSON.stringify(stats), CACHE_TTL);

    logger.info('Overview statistics calculated and cached', {
      cacheKey,
      stats: {
        totalOrders,
        activeOrders,
        completedOrders,
      },
    });

    return stats;
  } catch (error) {
    logger.error('Error getting overview statistics', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Get trend data for work order volume over time
 * Returns time-series data grouped by period
 *
 * @param {string} period - Time period: 'daily', 'weekly', 'monthly'
 * @param {Object} dateRange - Date range filter
 * @param {Date} dateRange.startDate - Start date
 * @param {Date} dateRange.endDate - End date
 * @returns {Promise<Array>} Array of {date, count, completed, overdue}
 */
const getTrendData = async (period = 'daily', dateRange = {}) => {
  try {
    logger.info('Getting trend data', { period, dateRange });

    // Validate period
    const validPeriods = ['daily', 'weekly', 'monthly'];
    if (!validPeriods.includes(period)) {
      throw new Error(`Invalid period. Must be one of: ${validPeriods.join(', ')}`);
    }

    // Build date filter
    const dateFilter = buildDateRangeFilter(dateRange);

    // Determine SQL date format based on period
    let dateFormat;
    switch (period) {
      case 'daily':
        dateFormat = '%Y-%m-%d';
        break;
      case 'weekly':
        dateFormat = '%Y-%U'; // Year-Week
        break;
      case 'monthly':
        dateFormat = '%Y-%m';
        break;
    }

    // Query with grouping by date
    const results = await WorkOrder.findAll({
      attributes: [
        [fn('DATE_FORMAT', col('created_at'), dateFormat), 'date'],
        [fn('COUNT', col('id')), 'count'],
        [fn('SUM', literal("CASE WHEN status = 'Completed' THEN 1 ELSE 0 END")), 'completed'],
        [fn('SUM', literal("CASE WHEN is_overdue = true THEN 1 ELSE 0 END")), 'overdue'],
      ],
      where: dateFilter,
      group: [fn('DATE_FORMAT', col('created_at'), dateFormat)],
      order: [[fn('DATE_FORMAT', col('created_at'), dateFormat), 'ASC']],
      raw: true,
    });

    // Format results
    const trendData = results.map(item => ({
      date: item.date,
      count: parseInt(item.count),
      completed: parseInt(item.completed),
      overdue: parseInt(item.overdue),
    }));

    logger.info('Trend data retrieved', {
      period,
      dataPoints: trendData.length,
      dateRange,
    });

    return trendData;
  } catch (error) {
    logger.error('Error getting trend data', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Get work orders grouped by category (fault type)
 *
 * @param {Object} dateRange - Date range filter
 * @returns {Promise<Array>} Array of {categoryId, categoryName, count}
 */
const getWorkOrdersByCategory = async (dateRange = {}) => {
  try {
    logger.info('Getting work orders by category', { dateRange });

    // Build date filter
    const dateFilter = buildDateRangeFilter(dateRange);

    // Query with fault type join
    const results = await WorkOrder.findAll({
      attributes: [
        'fault_type_id',
        [fn('COUNT', col('WorkOrder.id')), 'count'],
      ],
      include: [
        {
          model: FaultType,
          as: 'fault_type',
          attributes: ['name'],
        },
      ],
      where: dateFilter,
      group: ['fault_type_id', 'fault_type.id'],
      order: [[fn('COUNT', col('WorkOrder.id')), 'DESC']],
      raw: true,
      nest: true,
    });

    // Format results
    const categoryData = results.map(item => ({
      categoryId: item.fault_type_id,
      categoryName: item.fault_type.name,
      count: parseInt(item.count),
    }));

    logger.info('Work orders by category retrieved', {
      categories: categoryData.length,
      dateRange,
    });

    return categoryData;
  } catch (error) {
    logger.error('Error getting work orders by category', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Get work orders grouped by priority
 *
 * @param {Object} dateRange - Date range filter
 * @returns {Promise<Array>} Array of {priority, count}
 */
const getWorkOrdersByPriority = async (dateRange = {}) => {
  try {
    logger.info('Getting work orders by priority', { dateRange });

    // Build date filter
    const dateFilter = buildDateRangeFilter(dateRange);

    // Query with grouping by priority
    const results = await WorkOrder.findAll({
      attributes: [
        'priority',
        [fn('COUNT', col('id')), 'count'],
      ],
      where: dateFilter,
      group: ['priority'],
      order: [
        [literal("FIELD(priority, 'Emergency', 'High', 'Normal', 'Low')"), 'ASC'],
      ],
      raw: true,
    });

    // Format results
    const priorityData = results.map(item => ({
      priority: item.priority,
      count: parseInt(item.count),
    }));

    logger.info('Work orders by priority retrieved', {
      priorities: priorityData.length,
      dateRange,
    });

    return priorityData;
  } catch (error) {
    logger.error('Error getting work orders by priority', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Get technician performance metrics
 * Returns per-technician statistics including:
 * - Total assigned orders
 * - Completed orders
 * - Average resolution time
 * - First-time fix rate
 * - Current active orders
 *
 * @param {Object} dateRange - Date range filter
 * @returns {Promise<Array>} Array of technician performance objects
 */
const getTechnicianPerformance = async (dateRange = {}) => {
  try {
    logger.info('Getting technician performance', { dateRange });

    // Build date filter
    const dateFilter = buildDateRangeFilter(dateRange);

    // Get all technicians with assigned work orders
    const technicians = await WorkOrder.findAll({
      attributes: [
        'assigned_technician_id',
        [fn('COUNT', col('WorkOrder.id')), 'total_assigned'],
        [fn('SUM', literal("CASE WHEN status = 'Completed' THEN 1 ELSE 0 END")), 'completed'],
        [fn('SUM', literal("CASE WHEN status != 'Completed' THEN 1 ELSE 0 END")), 'active'],
        [fn('SUM', literal("CASE WHEN status = 'Completed' AND rework_count = 0 THEN 1 ELSE 0 END")), 'first_time_fixes'],
        [
          fn('AVG',
            literal("CASE WHEN status = 'Completed' AND completed_at IS NOT NULL THEN TIMESTAMPDIFF(SECOND, created_at, completed_at) / 3600.0 ELSE NULL END")
          ),
          'avg_resolution_hours'
        ],
      ],
      include: [
        {
          model: User,
          as: 'assigned_technician',
          attributes: ['id', 'name', 'department'],
        },
      ],
      where: dateFilter,
      group: ['assigned_technician_id', 'assigned_technician.id'],
      raw: true,
      nest: true,
    });

    // Format results with calculated metrics
    const performanceData = technicians.map(item => {
      const totalAssigned = parseInt(item.total_assigned);
      const completed = parseInt(item.completed);
      const active = parseInt(item.active);
      const firstTimeFixes = parseInt(item.first_time_fixes);
      const avgResolutionHours = item.avg_resolution_hours
        ? parseFloat(item.avg_resolution_hours).toFixed(2)
        : 0;

      // Calculate completion rate
      const completionRate = totalAssigned > 0
        ? ((completed / totalAssigned) * 100).toFixed(2)
        : 0;

      // Calculate first-time fix rate (only for completed orders)
      const firstTimeFixRate = completed > 0
        ? ((firstTimeFixes / completed) * 100).toFixed(2)
        : 0;

      return {
        technicianId: item.assigned_technician_id,
        technicianName: item.assigned_technician.name,
        department: item.assigned_technician.department,
        totalAssigned,
        completed,
        active,
        completionRate: parseFloat(completionRate),
        averageResolutionTime: parseFloat(avgResolutionHours),
        firstTimeFixRate: parseFloat(firstTimeFixRate),
      };
    });

    // Sort by completion rate descending
    performanceData.sort((a, b) => b.completionRate - a.completionRate);

    logger.info('Technician performance retrieved', {
      technicians: performanceData.length,
      dateRange,
    });

    return performanceData;
  } catch (error) {
    logger.error('Error getting technician performance', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Clear analytics cache
 * Utility function to invalidate cached analytics data
 *
 * @returns {Promise<void>}
 */
const clearCache = async () => {
  try {
    logger.info('Clearing analytics cache');

    // Get all keys matching the analytics cache prefix
    const keys = await redis.keys(`${CACHE_PREFIX}:*`);

    if (keys.length > 0) {
      await redis.del(keys);
      logger.info('Analytics cache cleared', { keysDeleted: keys.length });
    } else {
      logger.info('No analytics cache keys to clear');
    }
  } catch (error) {
    logger.error('Error clearing analytics cache', {
      error: error.message,
      stack: error.stack,
    });
    // Don't throw - cache clearing is not critical
  }
};

module.exports = {
  // Core KPI calculations (T112-T116)
  calculateAverageResponseTime,
  calculateAverageResolutionTime,
  calculateFirstTimeFixRate,
  calculateOverdueRate,
  getOverviewStats,

  // Additional analytics
  getTrendData,
  getWorkOrdersByCategory,
  getWorkOrdersByPriority,
  getTechnicianPerformance,

  // Utility
  clearCache,
};
