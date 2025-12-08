/**
 * 消息列表页 - 显示特定模块的消息
 * 从 xiaoxi 项目迁移并适配到当前项目
 */

const notificationService = require('../../services/notification')
const { MODULE_CONFIG, filterMessagesByModule } = require('../../utils/message-mapper.js')

Page({
  data: {
    moduleId: '',
    moduleName: '',
    messages: [],
    loading: true
  },

  onLoad(options) {
    const { moduleId } = options
    console.log('[Message List] Page load, moduleId:', moduleId)

    if (!moduleId) {
      console.error('[Message List] No moduleId provided')
      wx.navigateBack()
      return
    }

    const moduleName = MODULE_CONFIG[moduleId]?.name || '消息列表'

    this.setData({
      moduleId,
      moduleName
    })

    this.loadMessages()
  },

  onShow() {
    console.log('[Message List] Page show')
    // 每次显示时刷新数据
    this.loadMessages()
  },

  /**
   * 加载消息列表
   */
  async loadMessages() {
    try {
      this.setData({ loading: true })

      // 获取所有消息
      const result = await notificationService.getUserNotifications(false, 100)

      if (!result || !result.notifications) {
        console.warn('[Message List] No notifications data')
        this.setData({ loading: false, messages: [] })
        return
      }

      // 按模块筛选消息
      const filteredNotifications = filterMessagesByModule(result.notifications, this.data.moduleId)

      // 转换数据格式
      const messages = this.transformMessages(filteredNotifications)

      this.setData({
        messages,
        loading: false
      })

      console.log('[Message List] Loaded:', messages.length, 'messages for module:', this.data.moduleId)

    } catch (error) {
      console.error('[Message List] Load error:', error)
      this.setData({ loading: false })

      wx.showToast({
        title: '加载失败',
        icon: 'error',
        duration: 2000
      })
    }
  },

  /**
   * 转换消息数据格式
   * 从当前项目的数据结构转换为消息组件需要的数据结构
   */
  transformMessages(notifications) {
    return notifications.map(notification => {
      return {
        // 组件需要的字段
        id: notification._id,                    // _id → id
        title: notification.title || '系统通知',  // title
        content: notification.message || '',     // message → content
        timestamp: new Date(notification.created_at), // created_at → timestamp
        isRead: notification.read || false,      // read → isRead

        // 保留原始数据，用于跳转等操作
        _originalData: notification
      }
    })
  },

  /**
   * 返回上一页
   */
  handleBack() {
    wx.navigateBack()
  },

  /**
   * 标记该模块的所有消息已读
   */
  async handleMarkAllRead() {
    try {
      wx.showLoading({ title: '标记中...', mask: true })

      // 获取该模块的所有未读消息ID
      const unreadMessages = this.data.messages.filter(m => !m.isRead)

      if (unreadMessages.length === 0) {
        wx.hideLoading()
        wx.showToast({
          title: '没有未读消息',
          icon: 'none',
          duration: 1500
        })
        return
      }

      // 标记所有未读消息为已读
      for (const message of unreadMessages) {
        await notificationService.markAsRead(message.id)
      }

      wx.hideLoading()
      wx.showToast({
        title: '已全部标记为已读',
        icon: 'success',
        duration: 1500
      })

      // 刷新列表
      this.loadMessages()

    } catch (error) {
      wx.hideLoading()
      console.error('[Message List] Mark all as read error:', error)

      wx.showToast({
        title: '操作失败',
        icon: 'error',
        duration: 2000
      })
    }
  },

  /**
   * 点击消息
   */
  async handleMessageTap(e) {
    const { messageId } = e.detail

    // 查找消息
    const message = this.data.messages.find(m => m.id === messageId)
    if (!message) {
      console.error('[Message List] Message not found:', messageId)
      return
    }

    const originalData = message._originalData

    // 如果未读，标记为已读
    if (!message.isRead) {
      try {
        await notificationService.markAsRead(messageId)

        // 更新本地数据
        const messages = this.data.messages.map(m => {
          if (m.id === messageId) {
            return { ...m, isRead: true }
          }
          return m
        })

        this.setData({ messages })

      } catch (error) {
        console.error('[Message List] Mark as read error:', error)
      }
    }

    // 跳转到相关页面
    if (originalData && originalData.data && originalData.data.order_id) {
      wx.navigateTo({
        url: `/pages/work-order-detail/index?id=${originalData.data.order_id}`
      })
    } else {
      // 如果没有关联工单，显示消息详情
      wx.showModal({
        title: message.title,
        content: message.content,
        showCancel: false,
        confirmText: '知道了'
      })
    }
  },

  /**
   * 删除消息
   */
  handleDelete(e) {
    const { messageId } = e.detail

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条消息吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            // TODO: 当前项目的 notification 服务可能没有删除接口
            // 如果有删除接口，在这里调用
            // await notificationService.deleteNotification(messageId)

            // 暂时只在本地删除
            const messages = this.data.messages.filter(m => m.id !== messageId)
            this.setData({ messages })

            wx.showToast({
              title: '删除成功',
              icon: 'success',
              duration: 1500
            })

          } catch (error) {
            console.error('[Message List] Delete error:', error)

            wx.showToast({
              title: '删除失败',
              icon: 'error',
              duration: 2000
            })
          }
        }
      }
    })
  }
})
