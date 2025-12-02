/**
 * Audit Log Viewer Page (T159-T160)
 */

const api = require('../../../services/api');

const ACTION_NAMES = {
  'create': '创建',
  'update': '更新',
  'delete': '删除',
  'login': '登录',
  'logout': '登出'
};

const RESOURCE_NAMES = {
  'work_order': '工单',
  'user': '用户',
  'role': '角色',
  'fault_type': '故障类型'
};

Page({
  data: {
    logs: [],
    loading: false,
    loadingMore: false,
    hasMore: true,
    page: 1,
    pageSize: 50,

    // Filters
    selectedUser: '',
    selectedUserName: '',
    selectedAction: '',
    selectedActionName: '',
    selectedResource: '',
    selectedResourceName: '',
    dateRangeText: '',
    startDate: '',
    endDate: '',

    // Filter options
    userOptions: [{ label: '全部', value: '' }],
    showUserFilter: false,
    showActionFilter: false,
    showResourceFilter: false
  },

  onLoad() {
    this.checkPermissions();
    this.loadUsers();
    this.loadLogs();
  },

  checkPermissions() {
    const app = getApp();
    const userInfo = app.globalData.userInfo;

    if (!userInfo || !userInfo.permissions || !userInfo.permissions.includes('manage_users')) {
      wx.showModal({
        title: '权限不足',
        content: '您没有权限访问审计日志',
        showCancel: false,
        success: () => wx.navigateBack()
      });
    }
  },

  async loadUsers() {
    try {
      const response = await api.get('/users', { hideLoading: true });
      this.setData({
        userOptions: [
          { label: '全部', value: '' },
          ...response.data.map(u => ({ label: u.name, value: u.id }))
        ]
      });
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  },

  async loadLogs(append = false) {
    if (this.data.loading || this.data.loadingMore) return;

    this.setData({
      [append ? 'loadingMore' : 'loading']: true
    });

    try {
      const params = {
        page: this.data.page,
        limit: this.data.pageSize
      };

      if (this.data.selectedUser) params.user_id = this.data.selectedUser;
      if (this.data.selectedAction) params.action = this.data.selectedAction;
      if (this.data.selectedResource) params.resource_type = this.data.selectedResource;
      if (this.data.startDate) params.start_date = this.data.startDate;
      if (this.data.endDate) params.end_date = this.data.endDate;

      const response = await api.get('/audit-logs', params);

      const logs = response.data.map(log => ({
        ...log,
        action_name: ACTION_NAMES[log.action] || log.action,
        resource_type: RESOURCE_NAMES[log.resource_type] || log.resource_type,
        time: this.formatTime(log.created_at),
        before_state: JSON.stringify(log.before_state, null, 2),
        after_state: JSON.stringify(log.after_state, null, 2),
        expanded: false
      }));

      this.setData({
        logs: append ? [...this.data.logs, ...logs] : logs,
        hasMore: logs.length >= this.data.pageSize,
        loading: false,
        loadingMore: false
      });

    } catch (error) {
      console.error('Failed to load logs:', error);
      this.setData({
        loading: false,
        loadingMore: false
      });
    }
  },

  formatTime(timestamp) {
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  },

  onSearch() {
    this.setData({ page: 1 });
    this.loadLogs(false);
  },

  onLoadMore() {
    if (!this.data.hasMore || this.data.loadingMore) return;
    this.setData({ page: this.data.page + 1 });
    this.loadLogs(true);
  },

  onToggleExpand(e) {
    const id = e.currentTarget.dataset.id;
    const logs = this.data.logs.map(log => {
      if (log.id === id) {
        return { ...log, expanded: !log.expanded };
      }
      return log;
    });
    this.setData({ logs });
  },

  onShowUserFilter() {
    this.setData({ showUserFilter: true });
  },

  onCloseUserFilter() {
    this.setData({ showUserFilter: false });
  },

  onSelectUser(e) {
    const { value, name } = e.currentTarget.dataset;
    this.setData({
      selectedUser: value,
      selectedUserName: name,
      showUserFilter: false
    });
  },

  onModalStopPropagation() {},

  async onExport() {
    wx.showToast({
      title: '导出功能开发中',
      icon: 'none'
    });
  }
});
