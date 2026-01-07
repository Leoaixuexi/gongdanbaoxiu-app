/**
 * 意见反馈系统入口页
 */

Page({
  data: {},

  onLoad() {},

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
