Component({
  data: {
    selected: 0,
    color: "#7A7E83",
    selectedColor: "#0CA77D",
    hidden: false,
    list: [
      {
        pagePath: "/pages/index/index",
        text: "工作台",
        iconPath: "/images/tabbar/home.png",
        selectedIconPath: "/images/tabbar/home-active.png"
      },
      {
        pagePath: "/pages/data/index",
        text: "数据",
        iconPath: "/images/tabbar/baobiaohui.png",
        selectedIconPath: "/images/tabbar/baobiaolv.png"
      },
      {
        pagePath: "/pages/admin/users/index",
        text: "消息",
        iconPath: "/images/tabbar/message.png",
        selectedIconPath: "/images/tabbar/message-active.png"
      },
      {
        pagePath: "/pages/property/submitted/index",
        text: "我的",
        iconPath: "/images/tabbar/profile.png",
        selectedIconPath: "/images/tabbar/profile-active.png"
      }
    ]
  },

  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset;
      const url = data.path;
      wx.switchTab({ url });
    }
  }
});
