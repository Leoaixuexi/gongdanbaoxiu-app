// pages/phone/phone.js
const app = getApp()

Page({
  data: {
    statusBarHeight: 20,
    currentPhone: '177******35',
    newPhone: '',
    verifyCode: '',
    countdown: 0,
    error: ''
  },

  onLoad() {
    // 获取状态栏高度
    const systemInfo = wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight || 20
    });

    // 获取用户手机号
    if (app.globalData.userInfo && app.globalData.userInfo.phone) {
      this.setData({
        currentPhone: app.globalData.userInfo.phone
      });
    }
  },

  onUnload() {
    // 清理定时器，防止内存泄漏
    if (this._countdownTimer) {
      clearInterval(this._countdownTimer);
      this._countdownTimer = null;
    }
  },

  // 输入新手机号
  onPhoneInput(e) {
    const value = e.detail.value.replace(/\D/g, '').slice(0, 11)
    this.setData({
      newPhone: value,
      error: ''
    })
  },

  // 输入验证码
  onCodeInput(e) {
    const value = e.detail.value.replace(/\D/g, '').slice(0, 6)
    this.setData({
      verifyCode: value,
      error: ''
    })
  },

  // 发送验证码
  sendCode() {
    const { newPhone, countdown } = this.data

    if (countdown > 0) return

    if (!newPhone || newPhone.length !== 11) {
      this.setData({ error: '请输入正确的11位手机号' })
      return
    }

    this.setData({
      error: '',
      countdown: 60
    })

    // 将定时器存储到实例上，以便在onUnload中清理
    this._countdownTimer = setInterval(() => {
      const count = this.data.countdown - 1
      if (count <= 0) {
        clearInterval(this._countdownTimer)
        this._countdownTimer = null
        this.setData({ countdown: 0 })
      } else {
        this.setData({ countdown: count })
      }
    }, 1000)

    wx.showToast({
      title: '验证码已发送',
      icon: 'success'
    })
  },

  // 提交
  handleSubmit() {
    const { newPhone, verifyCode } = this.data

    if (!newPhone || newPhone.length !== 11) {
      this.setData({ error: '请输入正确的11位手机号' })
      return
    }

    if (!verifyCode || verifyCode.length !== 6) {
      this.setData({ error: '请输入6位验证码' })
      return
    }

    // 更新全局数据
    app.globalData.userInfo.phone = newPhone.replace(/(\d{3})\d{6}(\d{2})/, '$1******$2')

    wx.showToast({
      title: '修改成功',
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
