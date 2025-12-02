// pages/profile/index.js
Page({
  data: {
    // 用户资料
    profile: {
      name: "张伟",
      employeeId: "PM2024001",
      department: "阳光花园小区",
      avatar: "/images/avatar/default.png",
      phone: "138****8888",
      email: "zhangwei@property.com",
      position: "维修工程师",
      joinDate: "2022-01-15"
    },

    // 编辑表单
    editForm: {},

    // 通知设置
    notifications: {
      newAssignment: true,
      statusChange: true,
      timeoutWarning: true,
      announcements: true,
      updates: false
    },

    // 弹窗状态
    showEditSheet: false,
    showNotificationDialog: false,
    showAboutDialog: false
  },

  onLoad() {
    // 检查登录状态
    this.checkAuth();

    // 初始化编辑表单
    this.setData({
      editForm: { ...this.data.profile }
    })
  },

  onShow() {
    // 设置自定义 tabBar 选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 3
      });
    }
    // 每次显示页面时检查登录状态
    this.checkAuth();
  },

  // 检查认证状态
  checkAuth() {
    const userInfo = wx.getStorageSync('user_info');
    const token = wx.getStorageSync('auth_token');

    if (!userInfo || !token) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 1500
      });
      setTimeout(() => {
        wx.reLaunch({
          url: '/pages/login/login'
        });
      }, 1500);
      return false;
    }
    return true;
  },

  // 打开编辑资料弹窗
  openEditSheet() {
    this.setData({
      showEditSheet: true,
      editForm: { ...this.data.profile }
    })
  },

  // 关闭编辑资料弹窗
  closeEditSheet() {
    this.setData({
      showEditSheet: false
    })
  },

  // 保存资料
  saveProfile() {
    this.setData({
      profile: { ...this.data.editForm },
      showEditSheet: false
    })

    wx.showToast({
      title: '保存成功',
      icon: 'success',
      duration: 2000
    })
  },

  // 表单输入
  onNameInput(e) {
    this.setData({
      'editForm.name': e.detail.value
    })
  },

  onEmailInput(e) {
    this.setData({
      'editForm.email': e.detail.value
    })
  },

  // 打开消息通知弹窗
  openNotificationDialog() {
    this.setData({
      showNotificationDialog: true
    })
  },

  // 关闭消息通知弹窗
  closeNotificationDialog() {
    this.setData({
      showNotificationDialog: false
    })
  },

  // 通知开关变更
  onNotificationChange(e) {
    const key = e.currentTarget.dataset.key
    this.setData({
      [`notifications.${key}`]: e.detail.value
    })
  },

  // 打开关于弹窗
  openAboutDialog() {
    this.setData({
      showAboutDialog: true
    })
  },

  // 关闭关于弹窗
  closeAboutDialog() {
    this.setData({
      showAboutDialog: false
    })
  },

  // 阻止冒泡
  stopPropagation() {
    // 阻止事件冒泡,防止点击弹窗内容时关闭弹窗
  },

  // 退出登录
  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗?',
      success: (res) => {
        if (res.confirm) {
          // 清除登录状态（使用正确的storage key）
          wx.removeStorageSync('user_info');
          wx.removeStorageSync('auth_token');
          wx.removeStorageSync('user_permissions');
          wx.removeStorageSync('last_login');

          wx.showToast({
            title: '已退出登录',
            icon: 'success',
            duration: 1500
          })

          // 延迟跳转到登录页
          setTimeout(() => {
            wx.reLaunch({
              url: '/pages/login/login'
            })
          }, 1500)
        }
      }
    })
  }
})
