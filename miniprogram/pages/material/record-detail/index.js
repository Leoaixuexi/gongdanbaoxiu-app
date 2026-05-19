/**
 * 出入库记录详情页
 * 通过 URL 参数传入序列化的记录数据
 */
const { formatDate } = require('../../../utils/formatter');
const { getNavBarInfo } = require('../../../utils/navigation');

Page({
  data: {
    headerHeight: 0,
    record: {},
    isIn: true,
    imageUrl: '',
    specSubtitle: '',
    recordNumber: '',
    typeLabel: '',
    quantityText: '',
    purchaseNumber: '-',
    supplier: '-',
    unitPriceText: '¥-',
    totalPriceText: '¥-',
  },

  onLoad(options) {
    const { headerHeight } = getNavBarInfo();
    this.setData({ headerHeight: Math.ceil(headerHeight) });
    if (!options.data) return;
    try {
      const record = JSON.parse(decodeURIComponent(options.data));
      const isIn = record.type === 'in';

      if (record.created_at) {
        record.fullTime = formatDate(record.created_at, 'YYYY-MM-DD HH:mm');
      }

      const imageUrl = record.material_image || record.product_image || '';
      const specSubtitle = [record.spec, record.model].filter(Boolean).join(' · ');
      const idStr = record.record_id ? String(record.record_id).padStart(8, '0') : '';
      const recordNumber = idStr ? `${isIn ? 'RK' : 'CK'}${idStr}` : '-';
      const typeLabel = isIn ? '采购入库' : '领用出库';
      const quantityText = `${isIn ? '+' : '-'}${record.quantity || 0}`;

      const unitPriceText = record.unit_price != null
        ? `¥${Number(record.unit_price).toFixed(2)}${record.unit ? '/' + record.unit : ''}`
        : '¥-';
      const totalPriceText = (record.unit_price != null && record.quantity != null)
        ? `¥${(Number(record.unit_price) * Number(record.quantity)).toFixed(2)}`
        : '¥-';

      this.setData({
        record,
        isIn,
        imageUrl,
        specSubtitle,
        recordNumber,
        typeLabel,
        quantityText,
        purchaseNumber: record.purchase_number || '-',
        supplier: record.supplier || '-',
        unitPriceText,
        totalPriceText,
      });

      wx.setNavigationBarTitle({
        title: isIn ? '商品入库详情' : '商品出库详情',
      });
    } catch (e) {
      console.error('[RecordDetail] Parse error:', e);
    }
  },

  onPreviewImage() {
    const url = this.data.imageUrl;
    if (!url) return;
    wx.previewImage({ urls: [url], current: url });
  },

  onCopyValue(e) {
    const value = e.currentTarget.dataset.value;
    if (!value || value === '-') return;
    wx.setClipboardData({
      data: String(value),
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
    });
  },

  onEditTap() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  onDeleteTap() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  onShareAppMessage() {
    const { record, recordNumber, isIn } = this.data;
    return {
      title: `${isIn ? '入库' : '出库'}详情 ${recordNumber} - ${record.material_name || record.product_name || ''}`,
    };
  },
});
