/**
 * ECharts Canvas Component
 * Simplified version for WeChat Mini Program
 * Note: In production, use the official echarts-for-weixin library
 * https://github.com/ecomfe/echarts-for-weixin
 */

Component({
  properties: {
    canvasId: {
      type: String,
      value: 'ec-canvas'
    },
    ec: {
      type: Object
    },
    disableScroll: {
      type: Boolean,
      value: false
    }
  },

  data: {
    isReady: false
  },

  ready() {
    console.log('[EcCanvas] Component ready');

    if (!this.data.ec) {
      console.warn('[EcCanvas] ec property is required');
      return;
    }

    if (typeof this.data.ec.lazyLoad === 'undefined' || !this.data.ec.lazyLoad) {
      this.init();
    }
  },

  methods: {
    init(callback) {
      const { canvasId, ec } = this.data;

      if (!ec.onInit) {
        console.warn('[EcCanvas] ec.onInit is required');
        return;
      }

      this.setData({ isReady: true });

      // In production, initialize ECharts instance here
      // For now, just call the onInit callback
      const canvas = {
        setOption: (option) => {
          console.log('[EcCanvas] Chart option:', option);
        }
      };

      ec.onInit(canvas, callback);
    },

    canvasToTempFilePath(opt) {
      const { canvasId } = this.data;

      return new Promise((resolve, reject) => {
        wx.canvasToTempFilePath({
          canvasId,
          ...opt,
          success: resolve,
          fail: reject
        }, this);
      });
    }
  }
});
