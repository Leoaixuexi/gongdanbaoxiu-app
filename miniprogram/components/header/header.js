// components/header/header.js
Component({
  properties: {
    // 可选的标题属性
    title: {
      type: String,
      value: '修改工单'
    },
    // 是否显示返回按钮
    showBack: {
      type: Boolean,
      value: true
    }
  },

  data: {
    statusBarHeight: 0
  },

  lifetimes: {
    attached() {
      // 获取状态栏高度
      const systemInfo = wx.getSystemInfoSync();
      this.setData({
        statusBarHeight: systemInfo.statusBarHeight
      });
    }
  },

  methods: {
    // 返回按钮点击
    onBack() {
      this.triggerEvent('back');
      // 默认行为:返回上一页
      wx.navigateBack({
        delta: 1,
        fail: () => {
          // 如果没有上一页,跳转到首页或显示提示
          wx.switchTab({
            url: '/pages/index/index',
            fail: () => {
              wx.showToast({
                title: '无法返回',
                icon: 'none'
              });
            }
          });
        }
      });
    }
  }
})
