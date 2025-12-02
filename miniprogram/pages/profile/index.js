// pages/index/index.js
const app = getApp()

Page({
  data: {
    userInfo: {}
  },

  onLoad() {
    // 获取全局用户信息
    this.setData({
      userInfo: app.globalData.userInfo
    })
  },

  // 跳转到修改头像页面
  navigateToAvatar() {
    wx.navigateTo({
      url: '/pages/avatar/avatar'
    })
  },

  // 跳转到修改密码页面
  navigateToPassword() {
    wx.navigateTo({
      url: '/pages/password/password'
    })
  },

  // 跳转到修改手机号页面
  navigateToPhone() {
    wx.navigateTo({
      url: '/pages/phone/phone'
    })
  },

  // 退出登录
  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      confirmColor: '#48b6a0',
      success: (res) => {
        if (res.confirm) {
          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          })
        }
      }
    })
  }
})
