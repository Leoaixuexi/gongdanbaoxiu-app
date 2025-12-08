/**
 * 消息首页 - 显示3个消息模块
 * 从 xiaoxi 项目迁移并适配到当前项目
 */

const notificationService = require('../../services/notification')
const { MODULE_CONFIG, getModuleStats } = require('../../utils/message-mapper.js')

Page({
  data: {
    modules: MODULE_CONFIG,
    latestMessages: {
      announcements: null,
      tasks: null,
      reminders: null
    },
    unreadCounts: {
      announcements: 0,
      tasks: 0,
      reminders: 0
    },
    loading: true
  },

  onLoad() {
    console.log('[Notifications Index] Page load')
    this.loadData()
  },

  onShow() {
    console.log('[Notifications Index] Page show')
    // 每次显示页面时刷新数据（从其他页面返回时）
    this.loadData()
  },

  /**
   * 加载数据
   */
  async loadData() {
    try {
      this.setData({ loading: true })

      // 获取所有消息
      const result = await notificationService.getUserNotifications(false, 100)

      if (!result || !result.notifications) {
        console.warn('[Notifications Index] No notifications data')
        this.setData({ loading: false })
        return
      }

      // 按模块分组并统计
      const stats = getModuleStats(result.notifications)

      // 转换数据格式以供 message-card 组件使用
      const latestMessages = {
        announcements: stats.announcements.latestMessage ? this.transformMessage(stats.announcements.latestMessage) : null,
        tasks: stats.tasks.latestMessage ? this.transformMessage(stats.tasks.latestMessage) : null,
        reminders: stats.reminders.latestMessage ? this.transformMessage(stats.reminders.latestMessage) : null
      }

      const unreadCounts = {
        announcements: stats.announcements.unreadCount,
        tasks: stats.tasks.unreadCount,
        reminders: stats.reminders.unreadCount
      }

      this.setData({
        latestMessages,
        unreadCounts,
        loading: false
      })

      console.log('[Notifications Index] Data loaded:', { latestMessages, unreadCounts })

    } catch (error) {
      console.error('[Notifications Index] Load error:', error)
      this.setData({ loading: false })

      wx.showToast({
        title: '加载失败',
        icon: 'error',
        duration: 2000
      })
    }
  },

  /**
   * 转换消息格式
   * 从后端格式转换为组件需要的格式
   */
  transformMessage(notification) {
    return {
      title: notification.title || '系统通知',
      content: notification.message || '',
      timestamp: new Date(notification.created_at)
    }
  },

  /**
   * 点击卡片
   */
  handleCardTap(e) {
    const { moduleId } = e.detail
    console.log('[Notifications Index] Card tapped:', moduleId)

    wx.navigateTo({
      url: `/pages/message-list/index?moduleId=${moduleId}`
    })
  }
})
