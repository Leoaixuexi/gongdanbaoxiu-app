// pages/password/password.js
Page({
  data: {
    statusBarHeight: 20,
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
    error: '',
    showOld: false,
    showNew: false,
    showConfirm: false
  },

  onLoad() {
    // 获取状态栏高度
    const systemInfo = wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight || 20
    });
  },

  // 输入原密码
  onOldPasswordInput(e) {
    this.setData({
      oldPassword: e.detail.value,
      error: ''
    })
  },

  // 输入新密码
  onNewPasswordInput(e) {
    this.setData({
      newPassword: e.detail.value,
      error: ''
    })
  },

  // 输入确认密码
  onConfirmPasswordInput(e) {
    this.setData({
      confirmPassword: e.detail.value,
      error: ''
    })
  },

  // 切换原密码显示
  toggleShowOld() {
    this.setData({
      showOld: !this.data.showOld
    })
  },

  // 切换新密码显示
  toggleShowNew() {
    this.setData({
      showNew: !this.data.showNew
    })
  },

  // 切换确认密码显示
  toggleShowConfirm() {
    this.setData({
      showConfirm: !this.data.showConfirm
    })
  },

  // 提交
  handleSubmit() {
    const { oldPassword, newPassword, confirmPassword } = this.data

    if (!oldPassword || !newPassword || !confirmPassword) {
      this.setData({ error: '请填写所有字段' })
      return
    }

    if (newPassword !== confirmPassword) {
      this.setData({ error: '两次输入的新密码不一致' })
      return
    }

    if (newPassword.length < 6) {
      this.setData({ error: '新密码至少需要6位字符' })
      return
    }

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
