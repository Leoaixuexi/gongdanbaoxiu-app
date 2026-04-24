/**
 * Audit Logs Page
 * 审计日志页面 - 支持多维度筛选和CSV导出
 */

const auditService = require('../../../services/auditService');
const userService = require('../../../services/userService');

Page({
  behaviors: [require('../../../behaviors/adminPage')],

  data: {
    logs: [],
    loading: true,
    loadingMore: false,
    hasMore: true,

    // 分页
    page: 1,
    pageSize: 20,
    total: 0,

    // 操作类型筛选
    showFilter: false,
    actions: [],
    selectedAction: '',
    selectedActionLabel: '全部操作',

    // 日期筛选
    showStartDate: false,
    showEndDate: false,
    startDate: '',
    endDate: '',
    startDateText: '',
    endDateText: '',
    startDateValue: Date.now(),
    endDateValue: Date.now(),
    minDate: new Date(2024, 0, 1).getTime(),
    maxDate: Date.now(),

    // 操作人筛选
    showUserSelect: false,
    users: [],
    userColumns: ['全部'],
    selectedUserId: '',
    selectedUserLabel: '全部'
  },

  onLoad() {
    if (!this.checkAdminPermission()) return;
    this.loadActions();
    this.loadUsers();
  },

  onShow() {
    this.resetAndLoad();
  },

  onPullDownRefresh() {
    this.resetAndLoad().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore) {
      this.loadMore();
    }
  },

  /**
   * 加载操作类型列表
   */
  async loadActions() {
    try {
      const actions = await auditService.getAuditActions();
      this.setData({
        actions: [{ value: '', label: '全部操作' }, ...actions]
      });
    } catch (error) {
      console.error('[AuditLogs] Load actions error:', error);
    }
  },

  /**
   * 重置并加载
   */
  async resetAndLoad() {
    this.setData({
      logs: [],
      page: 1,
      hasMore: true,
      loading: true
    });
    await this.loadLogs();
  },

  /**
   * 加载用户列表（用于操作人筛选）
   */
  async loadUsers() {
    try {
      const users = await userService.listUsers({ limit: 100 });
      const userColumns = ['全部', ...users.map(u => u.name || u.username || `用户${u.user_id}`)];
      this.setData({
        users: [{ user_id: '', name: '全部' }, ...users],
        userColumns
      });
    } catch (error) {
      console.error('[AuditLogs] Load users error:', error);
    }
  },

  /**
   * 加载审计日志
   */
  async loadLogs() {
    try {
      const { page, pageSize, selectedAction, startDate, endDate, selectedUserId } = this.data;

      const filters = {
        page,
        pageSize
      };

      if (selectedAction) {
        filters.action = selectedAction;
      }
      if (startDate) {
        filters.startDate = startDate;
      }
      if (endDate) {
        filters.endDate = endDate;
      }
      if (selectedUserId) {
        filters.user_id = selectedUserId;
      }

      const result = await auditService.listAuditLogs(filters);

      const formattedLogs = (result.logs || []).map(log => ({
        ...log,
        timeText: this.formatTime(log.created_at),
        actionLabel: this.getActionLabel(log.action)
      }));

      this.setData({
        logs: page === 1 ? formattedLogs : [...this.data.logs, ...formattedLogs],
        total: result.pagination?.total || 0,
        hasMore: page < (result.pagination?.totalPages || 1),
        loading: false,
        loadingMore: false
      });
    } catch (error) {
      console.error('[AuditLogs] Load logs error:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({
        loading: false,
        loadingMore: false
      });
    }
  },

  /**
   * 加载更多
   */
  async loadMore() {
    if (this.data.loadingMore || !this.data.hasMore) return;

    this.setData({
      loadingMore: true,
      page: this.data.page + 1
    });

    await this.loadLogs();
  },

  /**
   * 格式化时间
   */
  formatTime(timestamp) {
    if (!timestamp) return '';

    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    // 1分钟内
    if (diff < 60 * 1000) {
      return '刚刚';
    }

    // 1小时内
    if (diff < 60 * 60 * 1000) {
      return Math.floor(diff / (60 * 1000)) + '分钟前';
    }

    // 今天
    if (date.toDateString() === now.toDateString()) {
      return this.padZero(date.getHours()) + ':' + this.padZero(date.getMinutes());
    }

    // 昨天
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return '昨天 ' + this.padZero(date.getHours()) + ':' + this.padZero(date.getMinutes());
    }

    // 今年
    if (date.getFullYear() === now.getFullYear()) {
      return (date.getMonth() + 1) + '月' + date.getDate() + '日';
    }

    // 其他
    return date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate();
  },

  padZero(num) {
    return num < 10 ? '0' + num : num;
  },

  /**
   * 获取操作标签
   */
  getActionLabel(action) {
    const actionMap = {
      'user_login': '用户登录',
      'login_failed': '登录失败',
      'user_registered': '用户注册',
      'user_created': '创建用户',
      'user_updated': '更新用户',
      'user_deleted': '删除用户',
      'user_enabled': '启用用户',
      'user_disabled': '停用用户',
      'user_password_reset': '重置密码',
      'password_changed': '修改密码',
      'announcement_created': '创建公告',
      'announcement_updated': '更新公告',
      'announcement_published': '发布公告',
      'announcement_offline': '下线公告',
      'announcement_deleted': '删除公告',
      'passwords_migrated': '密码迁移'
    };
    return actionMap[action] || action;
  },

  /**
   * 获取操作图标类型
   */
  getActionType(action) {
    if (action.includes('login') || action.includes('registered')) return 'login';
    if (action.includes('user')) return 'user';
    if (action.includes('announcement')) return 'announcement';
    if (action.includes('template')) return 'template';
    if (action.includes('password')) return 'password';
    return 'other';
  },

  /**
   * 切换筛选面板
   */
  toggleFilter() {
    this.setData({
      showFilter: !this.data.showFilter
    });
  },

  /**
   * 选择操作类型
   */
  selectAction(e) {
    const { value, label } = e.currentTarget.dataset;
    this.setData({
      selectedAction: value,
      selectedActionLabel: label,
      showFilter: false
    });
    this.resetAndLoad();
  },

  /**
   * 清除筛选
   */
  clearFilter() {
    this.setData({
      selectedAction: '',
      selectedActionLabel: '全部操作',
      showFilter: false
    });
    this.resetAndLoad();
  },

  /**
   * 查看日志详情
   */
  viewDetail(e) {
    const log = e.currentTarget.dataset.log;
    const detail = [];

    detail.push(`操作: ${this.getActionLabel(log.action)}`);
    detail.push(`操作人: ${log.user_name || '系统'}`);
    detail.push(`时间: ${this.formatDetailTime(log.created_at)}`);

    if (log.resource_type) {
      detail.push(`资源类型: ${log.resource_type}`);
    }
    if (log.resource_id) {
      detail.push(`资源ID: ${log.resource_id}`);
    }

    if (log.old_value) {
      detail.push(`\n旧值:\n${JSON.stringify(log.old_value, null, 2)}`);
    }
    if (log.new_value) {
      detail.push(`\n新值:\n${JSON.stringify(log.new_value, null, 2)}`);
    }

    wx.showModal({
      title: '日志详情',
      content: detail.join('\n'),
      showCancel: false,
      confirmText: '关闭'
    });
  },

  formatDetailTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${this.padZero(date.getMonth() + 1)}-${this.padZero(date.getDate())} ${this.padZero(date.getHours())}:${this.padZero(date.getMinutes())}:${this.padZero(date.getSeconds())}`;
  },

  /**
   * 阻止事件冒泡
   */
  stopPropagation() {},

  // ==================== 日期选择器 ====================

  showStartDatePicker() {
    this.setData({ showStartDate: true });
  },

  hideStartDatePicker() {
    this.setData({ showStartDate: false });
  },

  onStartDateConfirm(e) {
    const date = new Date(e.detail);
    const dateStr = this.formatDateStr(date);
    this.setData({
      showStartDate: false,
      startDate: dateStr,
      startDateText: dateStr,
      startDateValue: date.getTime()
    });
  },

  showEndDatePicker() {
    this.setData({ showEndDate: true });
  },

  hideEndDatePicker() {
    this.setData({ showEndDate: false });
  },

  onEndDateConfirm(e) {
    const date = new Date(e.detail);
    const dateStr = this.formatDateStr(date);
    this.setData({
      showEndDate: false,
      endDate: dateStr,
      endDateText: dateStr,
      endDateValue: date.getTime()
    });
  },

  formatDateStr(date) {
    const y = date.getFullYear();
    const m = this.padZero(date.getMonth() + 1);
    const d = this.padZero(date.getDate());
    return `${y}-${m}-${d}`;
  },

  // ==================== 用户选择器 ====================

  showUserPicker() {
    this.setData({ showUserSelect: true });
  },

  hideUserPicker() {
    this.setData({ showUserSelect: false });
  },

  onUserConfirm(e) {
    const { index } = e.detail;
    const user = this.data.users[index];
    this.setData({
      showUserSelect: false,
      selectedUserId: user ? user.user_id : '',
      selectedUserLabel: user ? user.name : '全部'
    });
  },

  // ==================== 筛选操作 ====================

  /**
   * 执行搜索
   */
  doSearch() {
    this.resetAndLoad();
  },

  /**
   * 重置所有筛选条件
   */
  resetFilters() {
    this.setData({
      selectedAction: '',
      selectedActionLabel: '全部操作',
      startDate: '',
      endDate: '',
      startDateText: '',
      endDateText: '',
      selectedUserId: '',
      selectedUserLabel: '全部'
    });
    this.resetAndLoad();
  },

  // ==================== CSV导出 ====================

  /**
   * 导出CSV
   */
  async exportCSV() {
    const { logs, total } = this.data;

    if (total === 0) {
      wx.showToast({ title: '暂无数据可导出', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '正在导出...' });

    try {
      // 如果当前加载的数据不完整，先加载全部数据
      let allLogs = logs;
      if (logs.length < total && total <= 500) {
        const result = await auditService.listAuditLogs({
          page: 1,
          pageSize: 500,
          action: this.data.selectedAction || undefined,
          startDate: this.data.startDate || undefined,
          endDate: this.data.endDate || undefined,
          user_id: this.data.selectedUserId || undefined
        });
        allLogs = result.logs || [];
      }

      // 生成CSV内容
      const csvContent = this.generateCSV(allLogs);

      // 写入文件
      const fs = wx.getFileSystemManager();
      const fileName = `审计日志_${this.formatDateStr(new Date())}.csv`;
      const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;

      // 添加BOM以支持Excel正确显示中文
      const bom = '\uFEFF';
      fs.writeFileSync(filePath, bom + csvContent, 'utf8');

      wx.hideLoading();

      // 分享文件
      wx.shareFileMessage({
        filePath: filePath,
        fileName: fileName,
        success: () => {
          wx.showToast({ title: '导出成功', icon: 'success' });
        },
        fail: (err) => {
          console.error('[AuditLogs] Share file error:', err);
          // 如果分享失败，尝试打开文件
          wx.openDocument({
            filePath: filePath,
            showMenu: true,
            fail: () => {
              wx.showToast({ title: '导出失败', icon: 'none' });
            }
          });
        }
      });
    } catch (error) {
      wx.hideLoading();
      console.error('[AuditLogs] Export error:', error);
      wx.showToast({ title: '导出失败', icon: 'none' });
    }
  },

  /**
   * 生成CSV内容
   */
  generateCSV(logs) {
    const headers = ['时间', '操作人', '操作类型', '资源类型', '资源ID', '详情'];
    const rows = [headers.join(',')];

    for (const log of logs) {
      const time = this.formatDetailTime(log.created_at);
      const userName = log.user_name || '系统';
      const actionLabel = this.getActionLabel(log.action);
      const resourceType = log.resource_type || '';
      const resourceId = log.resource_id || '';

      // 处理详情，避免CSV格式问题
      let detail = '';
      if (log.new_value) {
        detail = JSON.stringify(log.new_value).replace(/"/g, '""');
      }

      const row = [
        time,
        userName,
        actionLabel,
        resourceType,
        resourceId,
        `"${detail}"`
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }
});
