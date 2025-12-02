/**
 * System Tools Page
 * Administrator tools for system management
 */

const app = getApp();
const auth = require('../../../services/auth');

Page({
  data: {
    userInfo: null,
    envId: '',
    migrationStatus: {
      completed: false,
      message: '',
      stats: null
    },
    migrationLoading: false,
    dbStats: null,
    statsLoading: false
  },

  /**
   * Lifecycle - Page Load
   */
  onLoad: function (options) {
    console.log('[SystemTools] Page load');
    this.checkPermission();
    this.loadUserInfo();
    this.loadDatabaseStats();
  },

  /**
   * Check Permission
   */
  checkPermission: async function () {
    try {
      const userInfo = await auth.getCurrentUser();

      // Only admin can access this page
      if (!userInfo || userInfo.role_id !== 1) {
        wx.showModal({
          title: '权限不足',
          content: '只有系统管理员可以访问此页面',
          showCancel: false,
          success: () => {
            wx.navigateBack();
          }
        });
        return;
      }

    } catch (error) {
      console.error('[SystemTools] Check permission error:', error);
      wx.showModal({
        title: '错误',
        content: '权限验证失败',
        showCancel: false,
        success: () => {
          wx.navigateBack();
        }
      });
    }
  },

  /**
   * Load User Info
   */
  loadUserInfo: async function () {
    try {
      const userInfo = await auth.getCurrentUser();

      // Get cloud environment ID
      const envId = wx.cloud.config.env || 'unknown';

      this.setData({
        userInfo,
        envId
      });

    } catch (error) {
      console.error('[SystemTools] Load user info error:', error);
    }
  },

  /**
   * Handle Password Migration
   */
  handlePasswordMigration: async function () {
    const self = this;

    wx.showModal({
      title: '确认迁移',
      content: '确定要执行密码加密迁移吗？此操作将把所有明文密码转换为PBKDF2加密格式。已加密的密码会被跳过。',
      confirmText: '开始迁移',
      confirmColor: '#007AFF',
      success: async (res) => {
        if (!res.confirm) return;

        try {
          self.setData({ migrationLoading: true });

          wx.showLoading({
            title: '迁移中...',
            mask: true
          });

          console.log('[SystemTools] Starting password migration...');

          // Call cloud function
          const result = await wx.cloud.callFunction({
            name: 'userAuth',
            data: {
              action: 'migratePasswords'
            }
          });

          wx.hideLoading();

          console.log('[SystemTools] Migration result:', result);

          if (result.result && result.result.success) {
            const stats = result.result.stats;

            self.setData({
              migrationStatus: {
                completed: true,
                message: '迁移完成',
                stats
              },
              migrationLoading: false
            });

            // Show success message
            const message = `迁移完成！\n总用户数：${stats.total_users}\n已迁移：${stats.migrated}\n已跳过：${stats.skipped}\n错误数：${stats.errors}`;

            wx.showModal({
              title: '迁移成功',
              content: message,
              showCancel: false,
              confirmColor: '#34C759'
            });

          } else {
            throw new Error(result.result?.error || '迁移失败');
          }

        } catch (error) {
          wx.hideLoading();
          console.error('[SystemTools] Password migration error:', error);

          self.setData({
            migrationStatus: {
              completed: false,
              message: '迁移失败',
              stats: null
            },
            migrationLoading: false
          });

          wx.showModal({
            title: '迁移失败',
            content: error.message || '密码迁移失败，请查看日志',
            showCancel: false,
            confirmColor: '#FF3B30'
          });
        }
      }
    });
  },

  /**
   * Load Database Stats
   */
  loadDatabaseStats: async function () {
    try {
      this.setData({ statsLoading: true });

      wx.showLoading({
        title: '加载中...',
        mask: true
      });

      const db = wx.cloud.database();

      // Count users
      const usersCount = await db.collection('users').count();

      // Count work orders
      const workOrdersCount = await db.collection('work_orders').count();

      // Count notifications
      const notificationsCount = await db.collection('notifications').count();

      // Count audit logs
      const auditLogsCount = await db.collection('audit_logs').count();

      wx.hideLoading();

      this.setData({
        dbStats: {
          users: usersCount.total,
          workOrders: workOrdersCount.total,
          notifications: notificationsCount.total,
          auditLogs: auditLogsCount.total
        },
        statsLoading: false
      });

      console.log('[SystemTools] Database stats loaded:', this.data.dbStats);

    } catch (error) {
      wx.hideLoading();
      console.error('[SystemTools] Load database stats error:', error);

      this.setData({ statsLoading: false });

      wx.showToast({
        title: '加载统计失败',
        icon: 'none'
      });
    }
  },

  /**
   * View Subscription Guide
   */
  viewSubscriptionGuide: function () {
    wx.showModal({
      title: '订阅消息配置指南',
      content: '1. 登录微信公众平台\n2. 进入"订阅消息"→"公共模板库"\n3. 搜索并添加工单通知模板\n4. 获取模板ID\n5. 更新云函数sendNotification中的NOTIFICATION_TEMPLATES\n6. 重新部署云函数\n\n详细文档请查看NOTIFICATION_SYSTEM_IMPLEMENTATION.md',
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#007AFF'
    });
  }
});
