// pages/avatar/avatar.js
const app = getApp()

Page({
  data: {
    preview: '/images/image.png'
  },

  onLoad() {
    // 加载当前头像
    this.setData({
      preview: app.globalData.userInfo.avatar
    })
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
