Page({
  data: {
    materialId: 0,
    detail: null,
    loading: true,
    canAdjust: false,
  },
  onLoad(options) {
    const id = Number(options.id) || 0;
    this.setData({ materialId: id });
  },
  onShow() {},
});
