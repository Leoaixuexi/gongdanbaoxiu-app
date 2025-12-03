// pages/index/index.js
const app = getApp()

Page({
  data: {
    userInfo: {
      name: '张伟',
      position: '物业员工',
      department: '物业管理部',
      avatar: 'https://placehold.co/200x200/10b981/ffffff?text=ZW',
      phone: '177******35'
    }
  },

  onLoad() {
    this.loadUserInfo();
  },

  onShow() {
    // 每次显示页面时刷新用户信息
    this.loadUserInfo();

    // 设置 tabBar 选中状态（"我的"是第4个tab，索引为3）
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 3
      });
    }
  },

  // 加载用户信息
  async loadUserInfo() {
    try {
      // 尝试从全局获取用户信息
      const globalUserInfo = app.globalData.userInfo;

      if (globalUserInfo) {
        // 格式化用户信息
        const formattedUserInfo = {
          name: globalUserInfo.name || globalUserInfo.username || '用户',
          position: globalUserInfo.position || globalUserInfo.role || '员工',
          department: globalUserInfo.department || '未设置',
          avatar: globalUserInfo.avatar || 'https://placehold.co/200x200/10b981/ffffff?text=' + (globalUserInfo.name || 'U').charAt(0),
          phone: this.formatPhone(globalUserInfo.phone || globalUserInfo.mobile || '')
        };

        this.setData({
          userInfo: formattedUserInfo
        });
      } else {
        // 如果没有全局用户信息，尝试获取
        const userInfo = await app.getUserInfo();
        if (userInfo) {
          const formattedUserInfo = {
            name: userInfo.name || userInfo.username || '用户',
            position: userInfo.position || userInfo.role || '员工',
            department: userInfo.department || '未设置',
            avatar: userInfo.avatar || 'https://placehold.co/200x200/10b981/ffffff?text=' + (userInfo.name || 'U').charAt(0),
            phone: this.formatPhone(userInfo.phone || userInfo.mobile || '')
          };

          this.setData({
            userInfo: formattedUserInfo
          });
        }
      }
    } catch (error) {
      console.error('加载用户信息失败:', error);
      // 保留默认数据
    }
  },

  // 格式化手机号
  formatPhone(phone) {
    if (!phone) return '未设置';
    if (phone.length === 11) {
      return phone.substr(0, 3) + '******' + phone.substr(9);
    }
    return phone;
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
      confirmColor: '#10b981',
      success: (res) => {
        if (res.confirm) {
          // 清除全局用户信息
          app.globalData.userInfo = null;
          app.globalData.isLoggedIn = false;

          wx.showToast({
            title: '已退出登录',
            icon: 'success',
            duration: 1500
          });

          // 跳转到登录页
          setTimeout(() => {
            wx.reLaunch({
              url: '/pages/login/login'
            });
          }, 1500);
        }
      }
    })
  }
})
