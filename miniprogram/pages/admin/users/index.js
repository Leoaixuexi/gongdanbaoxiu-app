/**
 * 正在开发中页面
 */

Page({
  data: {},

  onLoad() {
    // 页面加载
  },

  onShow() {
    // 设置自定义 tabBar 选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 2
      });
    }
  }
});
