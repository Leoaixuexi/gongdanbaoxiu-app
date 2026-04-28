/**
 * 出入库记录详情页
 * 通过 URL 参数传入序列化的记录数据
 */
Page({
  data: {
    record: {}
  },

  onLoad(options) {
    if (options.data) {
      try {
        const record = JSON.parse(decodeURIComponent(options.data));
        // 格式化完整时间
        if (record.created_at) {
          const d = new Date(record.created_at);
          record.fullTime = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}  ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }
        this.setData({ record });
        wx.setNavigationBarTitle({
          title: record.type === 'in' ? '入库详情' : '出库详情'
        });
      } catch (e) {
        console.error('[RecordDetail] Parse error:', e);
      }
    }
  }
});
