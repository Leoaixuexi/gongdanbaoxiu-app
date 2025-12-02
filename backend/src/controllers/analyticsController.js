const analyticsService = require('../services/analyticsService');
const redis = require('../config/redis');
const logger = require('../utils/logger');
const ExcelJS = require('exceljs');

/**
 * Analytics Controller (T117-T124)
 * Handles analytics and reporting endpoints for work order monitoring
 *
 * Features:
 * - Overview statistics (KPIs)
 * - Trend analysis
 * - Category and priority breakdowns
 * - Technician performance metrics
 * - Report export (Excel, CSV)
 * - Redis caching with configurable TTL
 */

// Cache TTL in seconds (5 minutes)
const CACHE_TTL = 300;

// Cache key prefix
const CACHE_PREFIX = 'analytics';

/**
 * Validate date format (YYYY-MM-DD)
 * @param {string} dateString - Date string to validate
 * @returns {boolean} True if valid
 */
const isValidDate = (dateString) => {
  if (!dateString) return true; // Optional parameter
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
};

/**
 * Parse date range from query parameters
 * @param {Object} query - Express query object
 * @returns {Object} Date range object
 */
const parseDateRange = (query) => {
  const dateRange = {};

  if (query.startDate) {
    if (!isValidDate(query.startDate)) {
      throw new Error('Invalid startDate format. Use YYYY-MM-DD');
    }
    dateRange.startDate = query.startDate;
  }

  if (query.endDate) {
    if (!isValidDate(query.endDate)) {
      throw new Error('Invalid endDate format. Use YYYY-MM-DD');
    }
    dateRange.endDate = query.endDate;
  }

  return dateRange;
};

/**
 * Get cache key from request parameters
 * @param {string} endpoint - Endpoint name
 * @param {Object} params - Parameters object
 * @returns {string} Cache key
 */
const getCacheKey = (endpoint, params) => {
  const paramsJSON = JSON.stringify(params);
  return `${CACHE_PREFIX}:${endpoint}:${paramsJSON}`;
};

/**
 * Get cached data or fetch from service
 * @param {string} cacheKey - Cache key
 * @param {boolean} skipCache - Skip cache flag
 * @param {Function} fetchFunction - Function to fetch data
 * @returns {Promise<Object>} Data
 */
const getCachedOrFetch = async (cacheKey, skipCache, fetchFunction) => {
  // Check cache unless skipCache is true
  if (!skipCache) {
    try {
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        logger.info('Returning cached analytics data', { cacheKey });
        return JSON.parse(cachedData);
      }
    } catch (error) {
      logger.warn('Redis cache read failed, continuing without cache', {
        error: error.message,
        cacheKey,
      });
    }
  }

  // Fetch fresh data
  const data = await fetchFunction();

  // Cache the result
  try {
    await redis.set(cacheKey, JSON.stringify(data), CACHE_TTL);
    logger.debug('Analytics data cached', { cacheKey, ttl: CACHE_TTL });
  } catch (error) {
    logger.warn('Redis cache write failed, continuing without cache', {
      error: error.message,
      cacheKey,
    });
  }

  return data;
};

/**
 * GET /analytics/overview (T118)
 * Get overview statistics with all KPIs
 *
 * Query parameters:
 * - startDate: string (optional, YYYY-MM-DD)
 * - endDate: string (optional, YYYY-MM-DD)
 * - skipCache: boolean (optional)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     summary: { totalOrders, activeOrders, completedOrders },
 *     kpis: { averageResponseTime, averageResolutionTime, firstTimeFixRate, overdueRate },
 *     byStatus: { ... },
 *     byPriority: { ... },
 *     dateRange: { startDate, endDate },
 *     generatedAt: string
 *   }
 * }
 */
const getOverview = async (req, res) => {
  try {
    logger.info('GET /analytics/overview', {
      userId: req.user.id,
      query: req.query,
    });

    // Parse date range
    const dateRange = parseDateRange(req.query);
    const skipCache = req.query.skipCache === 'true';

    // Generate cache key
    const cacheKey = getCacheKey('overview', { dateRange });

    // Get data (cached or fresh)
    const stats = await getCachedOrFetch(
      cacheKey,
      skipCache,
      () => analyticsService.getOverviewStats({ dateRange, skipCache })
    );

    logger.info('Overview statistics retrieved', {
      userId: req.user.id,
      totalOrders: stats.summary.totalOrders,
      cached: !skipCache,
    });

    return res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error getting overview statistics', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      query: req.query,
    });

    if (error.message.includes('Invalid')) {
      return res.status(400).json({
        success: false,
        error: {
          message: error.message,
          code: 'INVALID_PARAMETER',
        },
      });
    }

    return res.status(503).json({
      success: false,
      error: {
        message: 'Unable to retrieve analytics data. Please try again later.',
        code: 'SERVICE_UNAVAILABLE',
      },
    });
  }
};

/**
 * GET /analytics/trends (T119)
 * Get trend data for work order volume over time
 *
 * Query parameters:
 * - period: string (required, 'daily', 'weekly', 'monthly')
 * - startDate: string (optional, YYYY-MM-DD)
 * - endDate: string (optional, YYYY-MM-DD)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     period: string,
 *     trends: [{ date, count, completed, overdue }, ...]
 *   }
 * }
 */
const getTrends = async (req, res) => {
  try {
    logger.info('GET /analytics/trends', {
      userId: req.user.id,
      query: req.query,
    });

    // Validate period parameter
    const period = req.query.period;
    const validPeriods = ['daily', 'weekly', 'monthly'];

    if (!period) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Period parameter is required. Valid values: daily, weekly, monthly',
          code: 'MISSING_PARAMETER',
        },
      });
    }

    if (!validPeriods.includes(period)) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Invalid period. Must be one of: ${validPeriods.join(', ')}`,
          code: 'INVALID_PARAMETER',
        },
      });
    }

    // Parse date range
    const dateRange = parseDateRange(req.query);

    // Generate cache key
    const cacheKey = getCacheKey('trends', { period, dateRange });
    const skipCache = req.query.skipCache === 'true';

    // Get data (cached or fresh)
    const trends = await getCachedOrFetch(
      cacheKey,
      skipCache,
      () => analyticsService.getTrendData(period, dateRange)
    );

    logger.info('Trend data retrieved', {
      userId: req.user.id,
      period,
      dataPoints: trends.length,
    });

    return res.json({
      success: true,
      data: {
        period,
        trends,
      },
    });
  } catch (error) {
    logger.error('Error getting trend data', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      query: req.query,
    });

    if (error.message.includes('Invalid')) {
      return res.status(400).json({
        success: false,
        error: {
          message: error.message,
          code: 'INVALID_PARAMETER',
        },
      });
    }

    return res.status(503).json({
      success: false,
      error: {
        message: 'Unable to retrieve trend data. Please try again later.',
        code: 'SERVICE_UNAVAILABLE',
      },
    });
  }
};

/**
 * GET /analytics/by-category (T120)
 * Get work orders grouped by fault type
 *
 * Query parameters:
 * - startDate: string (optional, YYYY-MM-DD)
 * - endDate: string (optional, YYYY-MM-DD)
 *
 * Response:
 * {
 *   success: true,
 *   data: [
 *     { categoryId, categoryName, count },
 *     ...
 *   ]
 * }
 */
const getByCategory = async (req, res) => {
  try {
    logger.info('GET /analytics/by-category', {
      userId: req.user.id,
      query: req.query,
    });

    // Parse date range
    const dateRange = parseDateRange(req.query);

    // Generate cache key
    const cacheKey = getCacheKey('by-category', { dateRange });
    const skipCache = req.query.skipCache === 'true';

    // Get data (cached or fresh)
    const categories = await getCachedOrFetch(
      cacheKey,
      skipCache,
      () => analyticsService.getWorkOrdersByCategory(dateRange)
    );

    logger.info('Category breakdown retrieved', {
      userId: req.user.id,
      categories: categories.length,
    });

    return res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    logger.error('Error getting category breakdown', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      query: req.query,
    });

    if (error.message.includes('Invalid')) {
      return res.status(400).json({
        success: false,
        error: {
          message: error.message,
          code: 'INVALID_PARAMETER',
        },
      });
    }

    return res.status(503).json({
      success: false,
      error: {
        message: 'Unable to retrieve category data. Please try again later.',
        code: 'SERVICE_UNAVAILABLE',
      },
    });
  }
};

/**
 * GET /analytics/by-priority (T121)
 * Get work orders grouped by priority
 *
 * Query parameters:
 * - startDate: string (optional, YYYY-MM-DD)
 * - endDate: string (optional, YYYY-MM-DD)
 *
 * Response:
 * {
 *   success: true,
 *   data: [
 *     { priority, count },
 *     ...
 *   ]
 * }
 */
const getByPriority = async (req, res) => {
  try {
    logger.info('GET /analytics/by-priority', {
      userId: req.user.id,
      query: req.query,
    });

    // Parse date range
    const dateRange = parseDateRange(req.query);

    // Generate cache key
    const cacheKey = getCacheKey('by-priority', { dateRange });
    const skipCache = req.query.skipCache === 'true';

    // Get data (cached or fresh)
    const priorities = await getCachedOrFetch(
      cacheKey,
      skipCache,
      () => analyticsService.getWorkOrdersByPriority(dateRange)
    );

    logger.info('Priority breakdown retrieved', {
      userId: req.user.id,
      priorities: priorities.length,
    });

    return res.json({
      success: true,
      data: priorities,
    });
  } catch (error) {
    logger.error('Error getting priority breakdown', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      query: req.query,
    });

    if (error.message.includes('Invalid')) {
      return res.status(400).json({
        success: false,
        error: {
          message: error.message,
          code: 'INVALID_PARAMETER',
        },
      });
    }

    return res.status(503).json({
      success: false,
      error: {
        message: 'Unable to retrieve priority data. Please try again later.',
        code: 'SERVICE_UNAVAILABLE',
      },
    });
  }
};

/**
 * GET /analytics/technician-performance (T122)
 * Get per-technician performance metrics
 *
 * Query parameters:
 * - startDate: string (optional, YYYY-MM-DD)
 * - endDate: string (optional, YYYY-MM-DD)
 *
 * Response:
 * {
 *   success: true,
 *   data: [
 *     {
 *       technicianId, technicianName, department,
 *       totalAssigned, completed, active,
 *       completionRate, averageResolutionTime, firstTimeFixRate
 *     },
 *     ...
 *   ]
 * }
 */
const getTechnicianPerformance = async (req, res) => {
  try {
    logger.info('GET /analytics/technician-performance', {
      userId: req.user.id,
      query: req.query,
    });

    // Parse date range
    const dateRange = parseDateRange(req.query);

    // Generate cache key
    const cacheKey = getCacheKey('technician-performance', { dateRange });
    const skipCache = req.query.skipCache === 'true';

    // Get data (cached or fresh)
    const performance = await getCachedOrFetch(
      cacheKey,
      skipCache,
      () => analyticsService.getTechnicianPerformance(dateRange)
    );

    logger.info('Technician performance retrieved', {
      userId: req.user.id,
      technicians: performance.length,
    });

    return res.json({
      success: true,
      data: performance,
    });
  } catch (error) {
    logger.error('Error getting technician performance', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      query: req.query,
    });

    if (error.message.includes('Invalid')) {
      return res.status(400).json({
        success: false,
        error: {
          message: error.message,
          code: 'INVALID_PARAMETER',
        },
      });
    }

    return res.status(503).json({
      success: false,
      error: {
        message: 'Unable to retrieve performance data. Please try again later.',
        code: 'SERVICE_UNAVAILABLE',
      },
    });
  }
};

/**
 * Generate Excel report (T124)
 * @param {Object} data - Report data
 * @param {string} reportType - Report type
 * @returns {Promise<Buffer>} Excel file buffer
 */
const generateExcelReport = async (data, reportType) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Work Order Management System';
  workbook.created = new Date();

  // Set workbook properties
  workbook.properties.date1904 = true;

  const sanitizeFileName = (name) => {
    return name.replace(/[^a-zA-Z0-9_\- ]/g, '_');
  };

  if (reportType === 'overview') {
    // Sheet 1: Summary KPIs
    const summarySheet = workbook.addWorksheet('Summary KPIs');

    // Header styling
    const headerStyle = {
      font: { bold: true, size: 12 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    };

    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 },
    ];

    // Apply header style
    summarySheet.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    // Add summary data
    summarySheet.addRows([
      { metric: 'Total Work Orders', value: data.summary.totalOrders },
      { metric: 'Active Orders', value: data.summary.activeOrders },
      { metric: 'Completed Orders', value: data.summary.completedOrders },
      { metric: '', value: '' }, // Spacer
      { metric: 'Average Response Time (hours)', value: data.kpis.averageResponseTime },
      { metric: 'Average Resolution Time (hours)', value: data.kpis.averageResolutionTime },
      { metric: 'First-Time Fix Rate (%)', value: data.kpis.firstTimeFixRate },
      { metric: 'Overdue Rate (%)', value: data.kpis.overdueRate },
    ]);

    // Sheet 2: By Status
    const statusSheet = workbook.addWorksheet('By Status');
    statusSheet.columns = [
      { header: 'Status', key: 'status', width: 20 },
      { header: 'Count', key: 'count', width: 15 },
    ];

    statusSheet.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    Object.entries(data.byStatus).forEach(([status, count]) => {
      statusSheet.addRow({ status, count });
    });

    // Sheet 3: By Priority
    const prioritySheet = workbook.addWorksheet('By Priority');
    prioritySheet.columns = [
      { header: 'Priority', key: 'priority', width: 20 },
      { header: 'Count', key: 'count', width: 15 },
    ];

    prioritySheet.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    Object.entries(data.byPriority).forEach(([priority, count]) => {
      prioritySheet.addRow({ priority, count });
    });
  } else if (reportType === 'trends') {
    const sheet = workbook.addWorksheet('Trends');
    sheet.columns = [
      { header: 'Date', key: 'date', width: 20 },
      { header: 'Total Count', key: 'count', width: 15 },
      { header: 'Completed', key: 'completed', width: 15 },
      { header: 'Overdue', key: 'overdue', width: 15 },
    ];

    const headerStyle = {
      font: { bold: true, size: 12 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    };

    sheet.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    data.trends.forEach((item) => {
      sheet.addRow(item);
    });
  } else if (reportType === 'by-category') {
    const sheet = workbook.addWorksheet('By Category');
    sheet.columns = [
      { header: 'Category ID', key: 'categoryId', width: 15 },
      { header: 'Category Name', key: 'categoryName', width: 30 },
      { header: 'Count', key: 'count', width: 15 },
    ];

    const headerStyle = {
      font: { bold: true, size: 12 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    };

    sheet.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    data.forEach((item) => {
      sheet.addRow(item);
    });
  } else if (reportType === 'technician-performance') {
    const sheet = workbook.addWorksheet('Technician Performance');
    sheet.columns = [
      { header: 'Technician ID', key: 'technicianId', width: 15 },
      { header: 'Technician Name', key: 'technicianName', width: 25 },
      { header: 'Department', key: 'department', width: 25 },
      { header: 'Total Assigned', key: 'totalAssigned', width: 15 },
      { header: 'Completed', key: 'completed', width: 15 },
      { header: 'Active', key: 'active', width: 15 },
      { header: 'Completion Rate (%)', key: 'completionRate', width: 20 },
      { header: 'Avg Resolution Time (hrs)', key: 'averageResolutionTime', width: 25 },
      { header: 'First-Time Fix Rate (%)', key: 'firstTimeFixRate', width: 25 },
    ];

    const headerStyle = {
      font: { bold: true, size: 12 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    };

    sheet.getRow(1).eachCell((cell) => {
      cell.style = headerStyle;
    });

    data.forEach((item) => {
      sheet.addRow(item);
    });
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

/**
 * Generate CSV report
 * @param {Object|Array} data - Report data
 * @param {string} reportType - Report type
 * @returns {string} CSV string
 */
const generateCSVReport = (data, reportType) => {
  const escapeCSV = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const arrayToCSV = (rows) => {
    return rows.map(row =>
      row.map(cell => escapeCSV(cell)).join(',')
    ).join('\n');
  };

  if (reportType === 'overview') {
    const rows = [
      ['Metric', 'Value'],
      ['Total Work Orders', data.summary.totalOrders],
      ['Active Orders', data.summary.activeOrders],
      ['Completed Orders', data.summary.completedOrders],
      [''],
      ['Average Response Time (hours)', data.kpis.averageResponseTime],
      ['Average Resolution Time (hours)', data.kpis.averageResolutionTime],
      ['First-Time Fix Rate (%)', data.kpis.firstTimeFixRate],
      ['Overdue Rate (%)', data.kpis.overdueRate],
      [''],
      ['Status Breakdown'],
      ...Object.entries(data.byStatus).map(([status, count]) => [status, count]),
      [''],
      ['Priority Breakdown'],
      ...Object.entries(data.byPriority).map(([priority, count]) => [priority, count]),
    ];
    return arrayToCSV(rows);
  } else if (reportType === 'trends') {
    const rows = [
      ['Date', 'Total Count', 'Completed', 'Overdue'],
      ...data.trends.map(item => [item.date, item.count, item.completed, item.overdue]),
    ];
    return arrayToCSV(rows);
  } else if (reportType === 'by-category') {
    const rows = [
      ['Category ID', 'Category Name', 'Count'],
      ...data.map(item => [item.categoryId, item.categoryName, item.count]),
    ];
    return arrayToCSV(rows);
  } else if (reportType === 'technician-performance') {
    const rows = [
      ['Technician ID', 'Technician Name', 'Department', 'Total Assigned', 'Completed', 'Active', 'Completion Rate (%)', 'Avg Resolution Time (hrs)', 'First-Time Fix Rate (%)'],
      ...data.map(item => [
        item.technicianId,
        item.technicianName,
        item.department,
        item.totalAssigned,
        item.completed,
        item.active,
        item.completionRate,
        item.averageResolutionTime,
        item.firstTimeFixRate,
      ]),
    ];
    return arrayToCSV(rows);
  }

  throw new Error('Unsupported report type for CSV export');
};

/**
 * POST /analytics/export (T124)
 * Export analytics report in various formats
 *
 * Request body:
 * {
 *   format: string (required, 'excel', 'pdf', 'csv')
 *   reportType: string (required, 'overview', 'trends', 'by-category', 'technician-performance')
 *   startDate: string (optional, YYYY-MM-DD)
 *   endDate: string (optional, YYYY-MM-DD)
 * }
 *
 * Response: File download with appropriate content-type
 */
const exportReport = async (req, res) => {
  try {
    logger.info('POST /analytics/export', {
      userId: req.user.id,
      body: req.body,
    });

    const { format, reportType, startDate, endDate } = req.body;

    // Validate format
    const validFormats = ['excel', 'csv'];
    if (!format) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Format parameter is required. Valid values: excel, csv',
          code: 'MISSING_PARAMETER',
        },
      });
    }

    if (!validFormats.includes(format)) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Invalid format. Must be one of: ${validFormats.join(', ')}`,
          code: 'INVALID_PARAMETER',
        },
      });
    }

    // Validate reportType
    const validReportTypes = ['overview', 'trends', 'by-category', 'technician-performance'];
    if (!reportType) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Report type parameter is required. Valid values: ${validReportTypes.join(', ')}`,
          code: 'MISSING_PARAMETER',
        },
      });
    }

    if (!validReportTypes.includes(reportType)) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Invalid report type. Must be one of: ${validReportTypes.join(', ')}`,
          code: 'INVALID_PARAMETER',
        },
      });
    }

    // Parse date range
    const dateRange = {};
    if (startDate) {
      if (!isValidDate(startDate)) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid startDate format. Use YYYY-MM-DD',
            code: 'INVALID_PARAMETER',
          },
        });
      }
      dateRange.startDate = startDate;
    }

    if (endDate) {
      if (!isValidDate(endDate)) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid endDate format. Use YYYY-MM-DD',
            code: 'INVALID_PARAMETER',
          },
        });
      }
      dateRange.endDate = endDate;
    }

    // Fetch data based on report type
    let data;
    if (reportType === 'overview') {
      data = await analyticsService.getOverviewStats({ dateRange });
    } else if (reportType === 'trends') {
      const period = req.body.period || 'daily';
      data = { trends: await analyticsService.getTrendData(period, dateRange) };
    } else if (reportType === 'by-category') {
      data = await analyticsService.getWorkOrdersByCategory(dateRange);
    } else if (reportType === 'technician-performance') {
      data = await analyticsService.getTechnicianPerformance(dateRange);
    }

    // Generate file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sanitizeFileName = (name) => {
      return name.replace(/[^a-zA-Z0-9_\-]/g, '_');
    };
    const fileName = sanitizeFileName(`${reportType}_report_${timestamp}`);

    if (format === 'excel') {
      const buffer = await generateExcelReport(data, reportType);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}.xlsx"`);
      res.setHeader('Content-Length', buffer.length);

      logger.info('Excel report generated', {
        userId: req.user.id,
        reportType,
        fileName: `${fileName}.xlsx`,
        size: buffer.length,
      });

      return res.send(buffer);
    } else if (format === 'csv') {
      const csv = generateCSVReport(data, reportType);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}.csv"`);

      logger.info('CSV report generated', {
        userId: req.user.id,
        reportType,
        fileName: `${fileName}.csv`,
        size: csv.length,
      });

      return res.send(csv);
    }
  } catch (error) {
    logger.error('Error exporting report', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      body: req.body,
    });

    if (error.message.includes('Invalid')) {
      return res.status(400).json({
        success: false,
        error: {
          message: error.message,
          code: 'INVALID_PARAMETER',
        },
      });
    }

    return res.status(503).json({
      success: false,
      error: {
        message: 'Unable to generate report. Please try again later.',
        code: 'SERVICE_UNAVAILABLE',
      },
    });
  }
};

module.exports = {
  getOverview,
  getTrends,
  getByCategory,
  getByPriority,
  getTechnicianPerformance,
  exportReport,
};
