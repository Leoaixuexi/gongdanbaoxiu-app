/**
 * 扫码入库（自定义扫码页）
 * 与 stock-in 主页通过 EventChannel 通信：
 *   - 主页 wx.navigateTo 时声明 events.onScanResult
 *   - 本页拿到 code 后 emit('onScanResult', code) + navigateBack
 *
 * 相机预览仅作视觉效果；条码识别由 wx.scanCode 原生提供
 * （点击扫描框区或"上传图片"触发）。
 */
Page({
  data: {
    statusBarHeight: 20,
    cameraAuthorized: false,
  },

  onLoad() {
    this.eventChannel = this.getOpenerEventChannel();
    try {
      const sys = wx.getSystemInfoSync();
      this.setData({ statusBarHeight: sys.statusBarHeight || 20 });
    } catch (e) {
      // 忽略，使用默认值
    }
    this._requestCameraAuth();
  },

  _requestCameraAuth() {
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.camera']) {
          this.setData({ cameraAuthorized: true });
          return;
        }
        wx.authorize({
          scope: 'scope.camera',
          success: () => this.setData({ cameraAuthorized: true }),
          fail: () => this.setData({ cameraAuthorized: false }),
        });
      },
    });
  },

  onCameraError(e) {
    console.warn('[ScanPage] camera error:', e && e.detail);
    this.setData({ cameraAuthorized: false });
  },

  onBack() {
    wx.navigateBack();
  },

  // 点击扫描框中央 → 调起微信原生扫码
  async onScanFromCamera() {
    try {
      const res = await wx.scanCode({
        scanType: ['qrCode', 'barCode'],
        onlyFromCamera: true,
      });
      const code = (res.result || '').trim();
      if (code) this._emitAndBack(code);
    } catch (e) {
      // 用户取消，留在本页
    }
  },

  // "上传图片" — 从相册识别条码/二维码
  async onUploadImage() {
    try {
      const res = await wx.scanCode({
        scanType: ['qrCode', 'barCode'],
        onlyFromCamera: false,
      });
      const code = (res.result || '').trim();
      if (code) this._emitAndBack(code);
    } catch (e) {
      // 用户取消
    }
  },

  // "手动输入条码"
  onManualInput() {
    wx.showModal({
      title: '手动输入条码',
      editable: true,
      placeholderText: '请输入商品编号/条码',
      confirmText: '确认',
      success: (res) => {
        if (!res.confirm) return;
        const code = (res.content || '').trim();
        if (!code) {
          wx.showToast({ title: '请输入条码', icon: 'none' });
          return;
        }
        this._emitAndBack(code);
      },
    });
  },

  _emitAndBack(code) {
    if (this.eventChannel && typeof this.eventChannel.emit === 'function') {
      this.eventChannel.emit('onScanResult', code);
    }
    wx.navigateBack();
  },
});
