// components/header/header.js
Component({
  properties: {
    // 可选的标题属性
    title: {
      type: String,
      value: '修改工单'
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
    },

    // 菜单按钮点击
    onMenuClick() {
      this.triggerEvent('menuclick');
      wx.showActionSheet({
        itemList: ['选项1', '选项2', '选项3'],
        success: (res) => {
          console.log('用户点击了:', res.tapIndex);
        }
      });
    }
  }
})
