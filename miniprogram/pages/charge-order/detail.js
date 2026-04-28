const store = require('./store')
const { getNavBarInfo } = require('../../utils/navigation')
const app = getApp()

Page({
  data: {
    headerHeight: 0,
    order: null,
    canEdit: false,
    showMoreActions: false,
  },

  onLoad(query) {
    const { headerHeight } = getNavBarInfo()
    const user = app.globalData?.userInfo || {}
    const roleId = user.role_id
    this.setData({
      headerHeight: Math.ceil(headerHeight),
      canEdit: roleId === 2 || roleId === 4,
      orderId: query.id,
    })
  },

  onShow() {
    const raw = store.getById(this.data.orderId)
    if (!raw) {
      wx.showToast({ title: '工单不存在', icon: 'none' })
      return
    }
    this.setData({ order: store.enrich(raw) })
  },

  onEdit() {
    wx.navigateTo({ url: `/pages/charge-order/edit?id=${this.data.orderId}` })
  },

  onMore() {
    this.setData({ showMoreActions: true })
  },

  onChargeMore() {
    wx.showToast({ title: '暂无可用功能', icon: 'none' })
  },

  closeMoreActions() {
    this.setData({ showMoreActions: false })
  },

  onReturnToNormal() {
    this.setData({ showMoreActions: false })
    wx.showModal({
      title: '转回常规工单',
      content: '该工单将从收费工单移除，恢复至常规工单列表。确定继续？',
      confirmText: '确定',
      cancelText: '取消',
      success: (res) => {
        if (!res.confirm) return
        store.remove(this.data.orderId)
        wx.showToast({ title: '已转回常规工单', icon: 'success' })
        setTimeout(() => {
          wx.reLaunch({ url: '/pages/index/index' })
        }, 600)
      },
    })
  },

  stopPropagation() {},

  onPreviewImage(e) {
    const { url, urls } = e.currentTarget.dataset
    if (!urls || !urls.length) return
    wx.previewImage({ current: url, urls })
  },
})
