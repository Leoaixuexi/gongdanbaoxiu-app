/**
 * Audit Logs Page
 * 审计日志页面
 */

const cloudDB = require('../../../services/cloudDatabase');
const { ROLES, STORAGE_KEYS } = require('../../../utils/constants');

Page({
  data: {
    logs: [],
    loading: true,
    loadingMore: false,
    hasMore: true,

    // 分页
    page: 1,
    pageSize: 20,
    total: 0,

    // 筛选
    showFilter: false,
    actions: [],
    selectedAction: '',
    selectedActionLabel: '全部操作'
  },

  onLoad() {
    this.checkAdminPermission();
    this.loadActions();
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
   * 检查管理员权限
   */
  checkAdminPermission() {
    const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO);
    if (!userInfo || userInfo.role_id !== ROLES.ADMIN) {
      wx.showToast({
        title: '无权限访问',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  /**
   * 加载操作类型列表
   */
  async loadActions() {
    try {
      const actions = await cloudDB.auditLogs.getActions();
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
   * 加载审计日志
   */
  async loadLogs() {
    try {
      const { page, pageSize, selectedAction } = this.data;

      const filters = {
        page,
        pageSize
      };

      if (selectedAction) {
        filters.action = selectedAction;
      }

      const result = await cloudDB.auditLogs.list(filters);

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
      'message_template_created': '创建模板',
      'message_template_updated': '更新模板',
      'message_template_toggled': '切换模板状态',
      'message_template_deleted': '删除模板',
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
  stopPropagation() {}
});
