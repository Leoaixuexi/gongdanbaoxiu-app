// pages/avatar/avatar.js
const app = getApp()
const { STORAGE_KEYS } = require('../../utils/constants')
const cloud = require('../../services/cloud')

Page({
  data: {
    statusBarHeight: 20,
    preview: 'https://placehold.co/300x300/10b981/ffffff?text=Avatar',
    originalAvatar: '',  // 记录原始头像，用于判断是否有修改
    saving: false
  },

  onLoad() {
    // 获取状态栏高度
    const systemInfo = wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight || 20
    });

    // 加载当前头像
    const storedUserInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO)
    const avatar = storedUserInfo?.avatar || app.globalData.userInfo?.avatar
    if (avatar) {
      this.setData({
        preview: avatar,
        originalAvatar: avatar
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
        // 进一步压缩图片
        this.compressImage(tempFilePath)
      }
    })
  },

  // 压缩图片
  compressImage(filePath) {
    wx.compressImage({
      src: filePath,
      quality: 50, // 压缩质量 0-100，越小压缩越厉害
      success: (res) => {
        this.setData({
          preview: res.tempFilePath
        })
      },
      fail: () => {
        // 压缩失败则使用原图
        this.setData({
          preview: filePath
        })
      }
    })
  },

  // 保存头像
  async saveAvatar() {
    const newAvatar = this.data.preview

    // 如果头像没有变化，直接返回
    if (newAvatar === this.data.originalAvatar) {
      wx.navigateBack()
      return
    }

    // 防止重复点击
    if (this.data.saving) return
    this.setData({ saving: true })

    wx.showLoading({ title: '保存中...', mask: true })

    try {
      let cloudAvatarUrl = newAvatar

      // 如果是本地临时文件，需要上传到云存储
      if (newAvatar.startsWith('wxfile://') || newAvatar.startsWith('http://tmp')) {
        // 生成唯一文件名
        const timestamp = Date.now()
        const random = Math.floor(Math.random() * 10000)
        const ext = newAvatar.split('.').pop() || 'jpg'
        const cloudPath = `avatars/user_${timestamp}_${random}.${ext}`

        // 上传到云存储
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: newAvatar
        })
        cloudAvatarUrl = uploadRes.fileID
      }

      // 调用云函数更新数据库
      const result = await cloud.callFunction('userAuth', {
        action: 'updateProfile',
        data: { avatar: cloudAvatarUrl }
      })

      if (!result.success) {
        throw new Error(result.error || '保存失败')
      }

      // 更新全局数据
      if (app.globalData.userInfo) {
        app.globalData.userInfo.avatar = cloudAvatarUrl
      }

      // 更新 storage 中的用户信息
      const storedUserInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO)
      if (storedUserInfo) {
        storedUserInfo.avatar = cloudAvatarUrl
        wx.setStorageSync(STORAGE_KEYS.USER_INFO, storedUserInfo)
      }

      wx.hideLoading()
      wx.showToast({
        title: '保存成功',
        icon: 'success',
        duration: 1500
      })

      setTimeout(() => {
        wx.navigateBack()
      }, 1500)

    } catch (error) {
      console.error('保存头像失败:', error)
      wx.hideLoading()
      wx.showToast({
        title: error.message || '保存失败',
        icon: 'none',
        duration: 2000
      })
    } finally {
      this.setData({ saving: false })
    }
  },

  // 取消
  handleCancel() {
    wx.navigateBack()
  }
})
