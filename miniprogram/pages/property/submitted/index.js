// pages/index/index.js
const auth = require('../../../services/auth');
const { STORAGE_KEYS } = require('../../../utils/constants');
const { getNavBarInfo } = require('../../../utils/navigation');
const app = getApp()

Page({
  data: {
    userInfo: {
      name: '张伟',
      position: '办美员工',
      department: '物业管理部',
      avatar: 'https://placehold.co/200x200/10b981/ffffff?text=ZW',
      phone: '177******35'
    },
    headerHeight: 0,
    isAdmin: false
  },

  onLoad() {
    // 计算自定义导航栏高度
    const { headerHeight } = getNavBarInfo();
    this.setData({
      headerHeight: Math.ceil(headerHeight)
    });
    this.loadUserInfo();
  },

  onShow() {
    // 每次显示页面时刷新用户信息
    this.loadUserInfo();

    // 设置 tabBar 选中状态，并同步徽章数据
    const syncBadge = (tabBar, source) => {
      tabBar.setData({ selected: 2 });
      const app = getApp();
      if (app && app.globalData.unreadCounts) {
        const globalVersion = app.globalData._badgeVersion || 0;
        const globalCounts = app.globalData.unreadCounts;
        const appliedVersion = tabBar.data._appliedVersion || 0;
        const localTotal = tabBar.data.totalUnread || 0;
        const globalTotal = globalCounts.totalUnread || 0;
        if ((globalVersion > appliedVersion || localTotal !== globalTotal) && tabBar.applyBadge) {
          console.log('[Property] Manual badge sync from ' + source + ': localTotal=' + localTotal + ', globalTotal=' + globalTotal);
          tabBar.applyBadge(globalCounts, globalVersion, source);
        }
      }
    };

    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      syncBadge(this.getTabBar(), 'property-onShow');
    } else {
      // TabBar 可能还未初始化，延迟重试
      setTimeout(() => {
        if (typeof this.getTabBar === 'function' && this.getTabBar()) {
          syncBadge(this.getTabBar(), 'property-onShow-delayed');
        }
      }, 100);
    }
  },

  // 加载用户信息
  async loadUserInfo() {
    try {
      // 直接从 storage 获取用户信息
      const storedUserInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO);
      const globalUserInfo = app.globalData.userInfo;

      // 优先使用 storage 中的数据，因为它包含 role_name
      const userInfo = storedUserInfo || globalUserInfo;

      if (userInfo) {
        console.log('[Profile] User info:', userInfo);
        // 格式化用户信息
        const formattedUserInfo = {
          name: userInfo.name || userInfo.username || '用户',
          position: userInfo.role_name || userInfo.position || userInfo.role || '员工',
          department: userInfo.department || '未设置',
          avatar: userInfo.avatar || 'https://placehold.co/200x200/10b981/ffffff?text=' + (userInfo.name || 'U').charAt(0),
          phone: this.formatPhone(userInfo.contact_phone || userInfo.phone || userInfo.mobile || '')
        };

        // 判断是否为管理员（role_id = 1）
        const isAdmin = userInfo.role_id === 1;

        this.setData({
          userInfo: formattedUserInfo,
          isAdmin
        });
      } else {
        // 如果没有用户信息，尝试从 app 获取
        const fetchedUserInfo = await app.getUserInfo();
        if (fetchedUserInfo) {
          const formattedUserInfo = {
            name: fetchedUserInfo.name || fetchedUserInfo.username || '用户',
            position: fetchedUserInfo.role_name || fetchedUserInfo.position || fetchedUserInfo.role || '员工',
            department: fetchedUserInfo.department || '未设置',
            avatar: fetchedUserInfo.avatar || 'https://placehold.co/200x200/10b981/ffffff?text=' + (fetchedUserInfo.name || 'U').charAt(0),
            phone: this.formatPhone(fetchedUserInfo.contact_phone || fetchedUserInfo.phone || fetchedUserInfo.mobile || '')
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

  // 跳转到意见反馈入口页面
  goToFeedbackList() {
    wx.navigateTo({
      url: '/pages/feedback/index/index'
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

          auth.logout().catch((error) => {
            console.error('[Profile] Logout failed:', error);
            wx.showToast({
              title: '退出登录失败',
              icon: 'none',
              duration: 2000
            });
          });
        }
      }
    })
  }
})
