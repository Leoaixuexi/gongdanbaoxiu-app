/**
 * 意见反馈系统入口页
 */

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 0
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync();
    const statusBarHeight = systemInfo.statusBarHeight;
    const navBarHeight = statusBarHeight + 44;
    this.setData({
      statusBarHeight,
      navBarHeight
    });
  },

  // 返回上一页
  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      // 没有上一页时，跳转到首页
      wx.switchTab({
        url: '/pages/property/submitted/index'
      });
    }
  },

  // 跳转到提交反馈页
  goToSubmit() {
    wx.navigateTo({
      url: '/pages/feedback/submit/index'
    });
  },

  // 跳转到我的反馈列表
  goToList() {
    wx.navigateTo({
      url: '/pages/feedback/list/index'
    });
  }
});
