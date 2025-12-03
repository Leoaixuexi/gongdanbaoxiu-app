// pages/avatar/avatar.js
const app = getApp()

Page({
  data: {
    statusBarHeight: 20,
    preview: 'https://placehold.co/320x320/10b981/ffffff?text=Avatar'
  },

  onLoad() {
    // 获取状态栏高度
    const systemInfo = wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight || 20
    });

    // 加载当前头像
    if (app.globalData.userInfo && app.globalData.userInfo.avatar) {
      this.setData({
        preview: app.globalData.userInfo.avatar
      });
    }
  },

  // 选择图片
  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath
        this.setData({
          preview: tempFilePath
        })
      }
    })
  },

  // 保存头像
  saveAvatar() {
    // 更新全局数据
    app.globalData.userInfo.avatar = this.data.preview

    wx.showToast({
      title: '保存成功',
      icon: 'success',
      duration: 1500,
      success: () => {
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      }
    })
  },

  // 取消
  handleCancel() {
    wx.navigateBack()
  }
})
