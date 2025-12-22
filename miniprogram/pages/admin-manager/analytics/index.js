/**
 * Analytics Page - Data Visualization
 * T128, T132-T137: Charts, export, auto-refresh
 */

const api = require('../../../services/api');
const { PRIORITY_DISPLAY_NAMES, PRIORITY_COLORS } = require('../../../utils/constants');
const { formatDate } = require('../../../utils/formatter');
const dateUtils = require('../../../utils/dateUtils');

Page({
  data: {
    // Active tab
    activeTab: 0,

    // 时间过滤
    timeFilter: 'all',  // 'all' | 'yesterday' | 'today' | 'week' | 'month' | 'custom'

    // Date range filter
    dateRange: {
      startDate: '',
      endDate: ''
    },

    // 自定义日期选择器
    showDatePicker: false,
    customStartDate: '',
    customEndDate: '',

    // Chart data
    categoryData: [],          // T132: Bar chart data
    maxCategoryCount: 0,
    priorityData: [],          // T133: Pie chart data
    trendData: [],             // T134: Line chart data
    trendPeriod: 'daily',
    technicianData: [],        // T135: Performance table data

    // Table sorting
    sortField: 'completionRate',
    sortOrder: 'desc',

    // Export modal
    showExport: false,
    exporting: false,
    exportReportTypes: [
      { label: '�ȥh', value: 'overview' },
      { label: '���h', value: 'trends' },
      { label: '{+�h', value: 'by_category' },
      { label: '�/X�H', value: 'technician_performance' }
    ],
    exportFormats: [
      { label: 'Excel (.xlsx)', value: 'excel' },
      { label: 'CSV (.csv)', value: 'csv' }
    ],
    exportConfig: {
      reportTypeIndex: 0,
      formatIndex: 0,
      startDate: '',
      endDate: ''
    },

    // Loading states
    loading: {
      category: false,
      priority: false,
      trend: false,
      technician: false
    }
  },

  /**
   * Page lifecycle - Load initial data
   */
  onLoad() {
    console.log('[Analytics] Page loaded');
    this.initializeDateRange();
    this.loadAllData();
  },

  /**
   * Initialize default date range (全部)
   */
  initializeDateRange() {
    // 默认为"全部"，不限制日期
    this.setData({
      dateRange: { startDate: '', endDate: '' },
      timeFilter: 'all',
      'exportConfig.startDate': '',
      'exportConfig.endDate': ''
    });
  },

  /**
   * Load all analytics data
   */
  async loadAllData() {
    try {
      await Promise.all([
        this.loadCategoryData(),
        this.loadPriorityData(),
        this.loadTrendData(),
        this.loadTechnicianData()
      ]);

      console.log('[Analytics] All data loaded');
    } catch (error) {
      console.error('[Analytics] Error loading data:', error);
      wx.showToast({
        title: '�}pn1%',
        icon: 'none'
      });
    }
  },

  /**
   * T132: Load work orders by category (Bar Chart)
   */
  async loadCategoryData() {
    try {
      this.setData({ 'loading.category': true });

      const { startDate, endDate } = this.data.dateRange;
      const params = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const response = await api.get('/analytics/by-category', params, { hideLoading: true });

      if (response && response.data) {
        // Calculate max count for bar height scaling
        const maxCount = Math.max(...response.data.map(item => item.count), 1);

        this.setData({
          categoryData: response.data,
          maxCategoryCount: maxCount
        });

        console.log('[Analytics] Category data loaded:', response.data.length);
      }
    } catch (error) {
      console.error('[Analytics] Error loading category data:', error);
    } finally {
      this.setData({ 'loading.category': false });
    }
  },

  /**
   * T133: Load work orders by priority (Pie Chart)
   */
  async loadPriorityData() {
    try {
      this.setData({ 'loading.priority': true });

      const { startDate, endDate } = this.data.dateRange;
      const params = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const response = await api.get('/analytics/by-priority', params, { hideLoading: true });

      if (response && response.data) {
        // Calculate total for percentages
        const total = response.data.reduce((sum, item) => sum + item.count, 0);

        // Add display names, colors, and percentages
        const priorityData = response.data.map(item => ({
          ...item,
          priorityDisplay: PRIORITY_DISPLAY_NAMES[item.priority] || item.priority,
          color: PRIORITY_COLORS[item.priority] || '#999999',
          percentage: total > 0 ? ((item.count / total) * 100).toFixed(1) : 0
        }));

        this.setData({ priorityData });
        console.log('[Analytics] Priority data loaded:', response.data.length);
      }
    } catch (error) {
      console.error('[Analytics] Error loading priority data:', error);
    } finally {
      this.setData({ 'loading.priority': false });
    }
  },

  /**
   * T134: Load trend data over time (Line Chart)
   */
  async loadTrendData() {
    try {
      this.setData({ 'loading.trend': true });

      const { startDate, endDate } = this.data.dateRange;
      const { trendPeriod } = this.data;

      const params = { period: trendPeriod };
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const response = await api.get('/analytics/trends', params, { hideLoading: true });

      if (response && response.data) {
        // Format dates for display
        const trendData = response.data.map(item => ({
          ...item,
          date: this.formatTrendDate(item.date, trendPeriod)
        }));

        this.setData({ trendData });
        console.log('[Analytics] Trend data loaded:', response.data.length);
      }
    } catch (error) {
      console.error('[Analytics] Error loading trend data:', error);
    } finally {
      this.setData({ 'loading.trend': false });
    }
  },

  /**
   * T135: Load technician performance data (Table)
   */
  async loadTechnicianData() {
    try {
      this.setData({ 'loading.technician': true });

      const { startDate, endDate } = this.data.dateRange;
      const params = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const response = await api.get('/analytics/technician-performance', params, { hideLoading: true });

      if (response && response.data) {
        // Sort by completion rate by default
        const sortedData = this.sortData(response.data, 'completionRate', 'desc');

        this.setData({ technicianData: sortedData });
        console.log('[Analytics] Technician data loaded:', response.data.length);
      }
    } catch (error) {
      console.error('[Analytics] Error loading technician data:', error);
    } finally {
      this.setData({ 'loading.technician': false });
    }
  },

  /**
   * Format trend date based on period
   */
  formatTrendDate(dateStr, period) {
    const date = new Date(dateStr);

    if (period === 'monthly') {
      return formatDate(date, 'YYYY-MM');
    } else if (period === 'weekly') {
      return formatDate(date, 'MM-DD');
    } else {
      return formatDate(date, 'MM-DD');
    }
  },

  /**
   * Switch between chart tabs
   */
  switchTab(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    this.setData({ activeTab: index });
  },

  /**
   * T134: Change trend period
   */
  async changePeriod(e) {
    const period = e.currentTarget.dataset.period;

    if (period === this.data.trendPeriod) return;

    this.setData({ trendPeriod: period });
    await this.loadTrendData();
  },

  /**
   * Date range change handlers
   */
  handleStartDateChange(e) {
    this.setData({
      'dateRange.startDate': e.detail.value
    });
  },

  handleEndDateChange(e) {
    this.setData({
      'dateRange.endDate': e.detail.value
    });
  },

  /**
   * 时间过滤器切换
   */
  onTimeFilterChange(e) {
    const filter = e.currentTarget.dataset.filter;

    if (filter === 'custom') {
      // 显示日期选择器
      this.setData({
        showDatePicker: true,
        timeFilter: 'custom'
      });
    } else if (filter === 'all') {
      // 全部：不限制日期
      this.setData({
        timeFilter: 'all',
        dateRange: { startDate: '', endDate: '' },
        'exportConfig.startDate': '',
        'exportConfig.endDate': ''
      });
      this.loadAllData();
    } else {
      const { startDate, endDate } = dateUtils.getDateRange(filter);
      const formattedStartDate = startDate ? dateUtils.formatDate(startDate) : '';
      const formattedEndDate = endDate ? dateUtils.formatDate(endDate) : '';
      this.setData({
        timeFilter: filter,
        dateRange: { startDate: formattedStartDate, endDate: formattedEndDate },
        'exportConfig.startDate': formattedStartDate,
        'exportConfig.endDate': formattedEndDate
      });
      this.loadAllData();
    }
  },

  /**
   * 自定义日期选择 - 开始日期变化
   */
  onCustomStartDateChange(e) {
    this.setData({
      customStartDate: e.detail.value
    });
  },

  /**
   * 自定义日期选择 - 结束日期变化
   */
  onCustomEndDateChange(e) {
    this.setData({
      customEndDate: e.detail.value
    });
  },

  /**
   * 确认自定义日期
   */
  confirmDatePicker() {
    const { customStartDate, customEndDate } = this.data;
    if (!customStartDate || !customEndDate) {
      wx.showToast({ title: '请选择开始和结束日期', icon: 'none' });
      return;
    }
    this.setData({
      timeFilter: 'custom',
      dateRange: { startDate: customStartDate, endDate: customEndDate },
      'exportConfig.startDate': customStartDate,
      'exportConfig.endDate': customEndDate,
      showDatePicker: false
    });
    this.loadAllData();
  },

  /**
   * 取消日期选择器
   */
  cancelDatePicker() {
    this.setData({
      showDatePicker: false,
      timeFilter: this.data.dateRange.startDate ? 'custom' : 'all'
    });
  },

  /**
   * 关闭日期选择器
   */
  closeDatePicker() {
    this.cancelDatePicker();
  },

  /**
   * 阻止冒泡
   */
  stopPropagation() {
    // Prevent event bubbling
  },

  /**
   * Apply date range filter
   */
  async handleApplyDateRange() {
    console.log('[Analytics] Applying date range:', this.data.dateRange);

    // Update export config with new dates
    this.setData({
      'exportConfig.startDate': this.data.dateRange.startDate,
      'exportConfig.endDate': this.data.dateRange.endDate
    });

    // Reload all data with new date range
    await this.loadAllData();

    wx.showToast({
      title: '�����',
      icon: 'success',
      duration: 1500
    });
  },

  /**
   * T135: Sort table by field
   */
  sortTable(e) {
    const field = e.currentTarget.dataset.field;
    let { sortField, sortOrder, technicianData } = this.data;

    // Toggle sort order if same field, otherwise default to desc
    if (field === sortField) {
      sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      sortField = field;
      sortOrder = 'desc';
    }

    // Sort data
    const sortedData = this.sortData(technicianData, sortField, sortOrder);

    this.setData({
      sortField,
      sortOrder,
      technicianData: sortedData
    });
  },

  /**
   * Sort array by field and order
   */
  sortData(data, field, order) {
    return [...data].sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];

      if (typeof aVal === 'string') {
        return order === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      } else {
        return order === 'asc'
          ? aVal - bVal
          : bVal - aVal;
      }
    });
  },

  /**
   * T136: Show export modal
   */
  showExportModal() {
    this.setData({ showExport: true });
  },

  /**
   * T136: Hide export modal
   */
  hideExportModal() {
    this.setData({ showExport: false });
  },

  /**
   * Prevent modal close when clicking inside
   */
  preventClose() {
    // Do nothing - prevents event bubbling
  },

  /**
   * Export modal - Report type change
   */
  handleReportTypeChange(e) {
    this.setData({
      'exportConfig.reportTypeIndex': parseInt(e.detail.value)
    });
  },

  /**
   * Export modal - Format change
   */
  handleFormatChange(e) {
    this.setData({
      'exportConfig.formatIndex': parseInt(e.detail.value)
    });
  },

  /**
   * T136: Handle export
   */
  async handleExport() {
    try {
      this.setData({ exporting: true });

      const { exportConfig, exportReportTypes, exportFormats } = this.data;

      // Build export parameters
      const reportType = exportReportTypes[exportConfig.reportTypeIndex].value;
      const format = exportFormats[exportConfig.formatIndex].value;

      const params = {
        report_type: reportType,
        format: format
      };

      if (exportConfig.startDate) params.start_date = exportConfig.startDate;
      if (exportConfig.endDate) params.end_date = exportConfig.endDate;

      console.log('[Analytics] Exporting report:', params);

      // Call export API
      const response = await api.post('/analytics/export', params);

      if (response && response.data && response.data.fileUrl) {
        wx.showToast({
          title: '���',
          icon: 'success',
          duration: 2000
        });

        // Download file
        wx.downloadFile({
          url: response.data.fileUrl,
          success: (res) => {
            if (res.statusCode === 200) {
              wx.saveFile({
                tempFilePath: res.tempFilePath,
                success: (saveRes) => {
                  console.log('[Analytics] File saved:', saveRes.savedFilePath);
                  wx.showToast({
                    title: '����X',
                    icon: 'success'
                  });
                }
              });
            }
          }
        });

        this.hideExportModal();
      } else {
        throw new Error('��1%');
      }
    } catch (error) {
      console.error('[Analytics] Export error:', error);
      wx.showToast({
        title: error.message || '��1%',
        icon: 'none'
      });
    } finally {
      this.setData({ exporting: false });
    }
  }
});
