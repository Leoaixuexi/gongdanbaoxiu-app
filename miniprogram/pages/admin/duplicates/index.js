/**
 * Duplicate Work Orders Page (T160a-T160b)
 * Find and manage duplicate work orders
 */

const api = require('../../../services/api');

Page({
  data: {
    startDate: '',
    endDate: '',
    similarityThreshold: 75,
    duplicateGroups: [],
    searching: false,
    searched: false
  },

  onLoad() {
    this.checkPermissions();
    this.initializeDates();
  },

  /**
   * Check permissions
   */
  checkPermissions() {
    const app = getApp();
    const userInfo = app.globalData.userInfo;

    if (!userInfo || !userInfo.permissions || !userInfo.permissions.includes('view_analytics')) {
      wx.showModal({
        title: '权限不足',
        content: '您没有权限访问重复工单检测',
        showCancel: false,
        success: () => {
          wx.navigateBack();
        }
      });
    }
  },

  /**
   * Initialize date range (last 30 days)
   */
  initializeDates() {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);

    this.setData({
      startDate: this.formatDate(start),
      endDate: this.formatDate(end)
    });
  },

  /**
   * Format date to YYYY-MM-DD
   */
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * Start date change handler
   */
  onStartDateChange(e) {
    this.setData({
      startDate: e.detail.value
    });
  },

  /**
   * End date change handler
   */
  onEndDateChange(e) {
    this.setData({
      endDate: e.detail.value
    });
  },

  /**
   * Similarity threshold change handler
   */
  onThresholdChange(e) {
    this.setData({
      similarityThreshold: e.detail.value
    });
  },

  /**
   * Search for duplicate work orders
   */
  async onSearch() {
    if (!this.data.startDate || !this.data.endDate) {
      wx.showToast({
        title: '请选择日期范围',
        icon: 'none'
      });
      return;
    }

    this.setData({ searching: true });

    try {
      const response = await api.get('/work-orders/duplicates', {
        start_date: this.data.startDate,
        end_date: this.data.endDate,
        similarity_threshold: this.data.similarityThreshold
      });

      // Process duplicate groups
      const duplicateGroups = response.data.map((group, index) => {
        return {
          id: index,
          primary: {
            ...group.primary,
            created_at: this.formatDateTime(group.primary.created_at)
          },
          orders: group.similar_orders.map(order => ({
            ...order,
            created_at: this.formatDateTime(order.created_at),
            similarity_level: this.getSimilarityLevel(order.similarity),
            breakdown: order.similarity_breakdown || {
              location: 0,
              fault_type: 0,
              time: 0
            }
          }))
        };
      });

      this.setData({
        duplicateGroups,
        searching: false,
        searched: true
      });

      if (duplicateGroups.length === 0) {
        wx.showToast({
          title: '未发现重复工单',
          icon: 'none'
        });
      }

    } catch (error) {
      console.error('Failed to search duplicates:', error);
      this.setData({ searching: false });

      wx.showToast({
        title: error.message || '搜索失败',
        icon: 'none'
      });
    }
  },

  /**
   * Format datetime for display
   */
  formatDateTime(timestamp) {
    const date = new Date(timestamp);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  },

  /**
   * Get similarity level for styling
   */
  getSimilarityLevel(similarity) {
    if (similarity >= 90) return 'high';
    if (similarity >= 75) return 'medium';
    return 'low';
  },

  /**
   * View work order details
   */
  onViewOrder(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/work-order-detail/index?id=${id}`
    });
  },

  /**
   * Link work orders as duplicates
   */
  async onLinkDuplicates(e) {
    const groupId = e.currentTarget.dataset.groupId;
    const group = this.data.duplicateGroups[groupId];

    wx.showModal({
      title: '确认标记为重复',
      content: `将 ${group.orders.length} 个工单标记为重复工单？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            const orderIds = [group.primary.id, ...group.orders.map(o => o.id)];

            await api.post('/work-orders/link-duplicates', {
              order_ids: orderIds,
              primary_order_id: group.primary.id
            });

            wx.showToast({
              title: '已标记为重复',
              icon: 'success'
            });

            // Remove from list
            const duplicateGroups = this.data.duplicateGroups.filter(
              (_, index) => index !== groupId
            );
            this.setData({ duplicateGroups });

          } catch (error) {
            console.error('Failed to link duplicates:', error);
            wx.showToast({
              title: '标记失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  /**
   * Dismiss duplicate group
   */
  onDismissGroup(e) {
    const groupId = e.currentTarget.dataset.groupId;

    wx.showModal({
      title: '确认非重复',
      content: '确认这些工单不是重复的？',
      success: (res) => {
        if (res.confirm) {
          // Remove from list
          const duplicateGroups = this.data.duplicateGroups.filter(
            (_, index) => index !== groupId
          );
          this.setData({ duplicateGroups });

          wx.showToast({
            title: '已标记为非重复',
            icon: 'success'
          });
        }
      }
    });
  }
});
