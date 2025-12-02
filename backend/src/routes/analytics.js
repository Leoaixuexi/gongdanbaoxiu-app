const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * Analytics Routes (T125)
 *
 * All routes require:
 * - Authentication (authenticateToken middleware)
 * - view_analytics permission
 *
 * Endpoints:
 * - GET    /analytics/overview                - Get overview statistics with KPIs
 * - GET    /analytics/trends                  - Get trend data over time
 * - GET    /analytics/by-category             - Get work orders by fault type
 * - GET    /analytics/by-priority             - Get work orders by priority
 * - GET    /analytics/technician-performance  - Get technician performance metrics
 * - POST   /analytics/export                  - Export report (Excel/CSV)
 */

/**
 * Rate limiter for export endpoint (T123 requirement)
 * Limits: 10 requests per hour per user
 */
const exportRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
  message: {
    success: false,
    error: {
      message: 'Too many export requests. Maximum 10 exports per hour allowed.',
      code: 'RATE_LIMIT_EXCEEDED',
    },
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Use user ID as key for per-user rate limiting
  keyGenerator: (req) => {
    return req.user ? req.user.id.toString() : req.ip;
  },
  handler: (req, res) => {
    logger.warn('Export rate limit exceeded', {
      userId: req.user?.id,
      ip: req.ip,
    });
    return res.status(429).json({
      success: false,
      error: {
        message: 'Too many export requests. Maximum 10 exports per hour allowed.',
        code: 'RATE_LIMIT_EXCEEDED',
      },
    });
  },
});

// Apply authentication and permission check to all routes
router.use(authenticateToken);
router.use(requirePermission('view_analytics'));

/**
 * GET /analytics/overview
 * Get overview statistics with all KPIs (T118)
 *
 * Query parameters:
 * - startDate: string (optional, YYYY-MM-DD) - Start of date range
 * - endDate: string (optional, YYYY-MM-DD) - End of date range
 * - skipCache: boolean (optional) - Bypass Redis cache
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     summary: {
 *       totalOrders: number,
 *       activeOrders: number,
 *       completedOrders: number
 *     },
 *     kpis: {
 *       averageResponseTime: number (hours),
 *       averageResolutionTime: number (hours),
 *       firstTimeFixRate: number (percentage),
 *       overdueRate: number (percentage)
 *     },
 *     byStatus: {
 *       "Pending Repair": number,
 *       "In Progress": number,
 *       "Repaired": number,
 *       "Needs Rework": number,
 *       "Completed": number
 *     },
 *     byPriority: {
 *       "Low": number,
 *       "Normal": number,
 *       "High": number,
 *       "Emergency": number
 *     },
 *     dateRange: {
 *       startDate: string|null,
 *       endDate: string|null
 *     },
 *     generatedAt: string (ISO timestamp)
 *   }
 * }
 *
 * Error responses:
 * - 400: Invalid date format
 * - 503: Service unavailable
 */
router.get('/overview', analyticsController.getOverview);

/**
 * GET /analytics/trends
 * Get trend data for work order volume over time (T119)
 *
 * Query parameters:
 * - period: string (required, 'daily'|'weekly'|'monthly') - Time period for grouping
 * - startDate: string (optional, YYYY-MM-DD) - Start of date range
 * - endDate: string (optional, YYYY-MM-DD) - End of date range
 * - skipCache: boolean (optional) - Bypass Redis cache
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     period: string,
 *     trends: [
 *       {
 *         date: string,
 *         count: number (total work orders),
 *         completed: number,
 *         overdue: number
 *       },
 *       ...
 *     ]
 *   }
 * }
 *
 * Error responses:
 * - 400: Missing or invalid period, invalid date format
 * - 503: Service unavailable
 */
router.get('/trends', analyticsController.getTrends);

/**
 * GET /analytics/by-category
 * Get work orders grouped by fault type category (T120)
 *
 * Query parameters:
 * - startDate: string (optional, YYYY-MM-DD) - Start of date range
 * - endDate: string (optional, YYYY-MM-DD) - End of date range
 * - skipCache: boolean (optional) - Bypass Redis cache
 *
 * Response:
 * {
 *   success: true,
 *   data: [
 *     {
 *       categoryId: number,
 *       categoryName: string,
 *       count: number
 *     },
 *     ...
 *   ]
 * }
 *
 * Error responses:
 * - 400: Invalid date format
 * - 503: Service unavailable
 */
router.get('/by-category', analyticsController.getByCategory);

/**
 * GET /analytics/by-priority
 * Get work orders grouped by priority level (T121)
 *
 * Query parameters:
 * - startDate: string (optional, YYYY-MM-DD) - Start of date range
 * - endDate: string (optional, YYYY-MM-DD) - End of date range
 * - skipCache: boolean (optional) - Bypass Redis cache
 *
 * Response:
 * {
 *   success: true,
 *   data: [
 *     {
 *       priority: string,
 *       count: number
 *     },
 *     ...
 *   ]
 * }
 *
 * Data is sorted by priority: Emergency > High > Normal > Low
 *
 * Error responses:
 * - 400: Invalid date format
 * - 503: Service unavailable
 */
router.get('/by-priority', analyticsController.getByPriority);

/**
 * GET /analytics/technician-performance
 * Get per-technician performance metrics (T122)
 *
 * Query parameters:
 * - startDate: string (optional, YYYY-MM-DD) - Start of date range
 * - endDate: string (optional, YYYY-MM-DD) - End of date range
 * - skipCache: boolean (optional) - Bypass Redis cache
 *
 * Response:
 * {
 *   success: true,
 *   data: [
 *     {
 *       technicianId: number,
 *       technicianName: string,
 *       department: string,
 *       totalAssigned: number,
 *       completed: number,
 *       active: number,
 *       completionRate: number (percentage),
 *       averageResolutionTime: number (hours),
 *       firstTimeFixRate: number (percentage)
 *     },
 *     ...
 *   ]
 * }
 *
 * Data is sorted by completion rate (descending)
 *
 * Error responses:
 * - 400: Invalid date format
 * - 503: Service unavailable
 */
router.get('/technician-performance', analyticsController.getTechnicianPerformance);

/**
 * POST /analytics/export
 * Export analytics report in various formats (T124)
 *
 * Rate limited: 10 requests per hour per user (T123 requirement)
 *
 * Request body:
 * {
 *   format: string (required, 'excel'|'csv') - Export format
 *   reportType: string (required, 'overview'|'trends'|'by-category'|'technician-performance')
 *   period: string (optional, for trends: 'daily'|'weekly'|'monthly', default: 'daily')
 *   startDate: string (optional, YYYY-MM-DD) - Start of date range
 *   endDate: string (optional, YYYY-MM-DD) - End of date range
 * }
 *
 * Response: File download
 * - Excel: Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
 * - CSV: Content-Type: text/csv
 *
 * Excel report format (for 'overview'):
 * - Sheet 1: Summary KPIs
 * - Sheet 2: By Status breakdown
 * - Sheet 3: By Priority breakdown
 *
 * File naming: {reportType}_report_{timestamp}.{ext}
 *
 * Error responses:
 * - 400: Missing or invalid parameters
 * - 429: Rate limit exceeded (max 10 per hour)
 * - 503: Service unavailable
 */
router.post('/export', exportRateLimiter, analyticsController.exportReport);

module.exports = router;
