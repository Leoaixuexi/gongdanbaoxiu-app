import * as echarts from './echarts.min';

let ctx;

Component({
  properties: {
    canvasId: {
      type: String,
      value: 'ec-canvas'
    },
    ec: {
      type: Object
    },
    forceUseOldCanvas: {
      type: Boolean,
      value: false
    }
  },

  data: {
    isUseNewCanvas: false
  },

  ready() {
    if (!this.data.ec) {
      console.warn('组件需绑定 ec 变量，例：<ec-canvas id="mychart-dom-bar" canvas-id="mychart-bar" ec="{{ ec }}"></ec-canvas>');
      return;
    }

    if (!this.data.ec.lazyLoad) {
      this.init();
    }
  },

  methods: {
    init(callback) {
      const version = wx.getSystemInfoSync().SDKVersion;

      const canUseNewCanvas = compareVersion(version, '2.9.0') >= 0;
      const forceUseOldCanvas = this.data.forceUseOldCanvas;
      const isUseNewCanvas = canUseNewCanvas && !forceUseOldCanvas;
      this.setData({ isUseNewCanvas });

      if (forceUseOldCanvas && canUseNewCanvas) {
        console.warn('开发者强制使用旧canvas，建议关闭');
      }

      if (isUseNewCanvas) {
        // 新版使用type=2d
        this.initByNewWay(callback);
      } else {
        // 旧版
        const context = wx.createCanvasContext(this.data.canvasId, this);
        ctx = context;
        this.chart = echarts.init(context, null, {
          width: this.data.ec.width,
          height: this.data.ec.height,
          devicePixelRatio: wx.getSystemInfoSync().pixelRatio
        });
        this.setOption(callback);
      }
    },

    initByNewWay(callback) {
      const query = wx.createSelectorQuery().in(this);
      query
        .select('.ec-canvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (res && res[0]) {
            const canvasNode = res[0].node;
            ctx = canvasNode.getContext('2d');

            const dpr = wx.getSystemInfoSync().pixelRatio;
            canvasNode.width = res[0].width * dpr;
            canvasNode.height = res[0].height * dpr;

            ctx.scale(dpr, dpr);

            this.chart = echarts.init(canvasNode, null, {
              width: res[0].width,
              height: res[0].height,
              devicePixelRatio: dpr
            });
            this.setOption(callback);
          }
        });
    },

    setOption(callback) {
      if (!this.chart) {
        console.warn('图表尚未初始化');
        return;
      }

      const options = this.data.ec.option;
      if (!options) {
        console.warn('ec.option 为空');
        return;
      }

      this.chart.setOption(options);
      if (typeof callback === 'function') {
        callback(this.chart);
      } else if (this.data.ec && typeof this.data.ec.onInit === 'function') {
        this.data.ec.onInit(this.chart);
      }
    },

    canvasToTempFilePath(opt) {
      if (this.data.isUseNewCanvas) {
        // 新版
        const query = wx.createSelectorQuery().in(this);
        query
          .select('.ec-canvas')
          .fields({ node: true, size: true })
          .exec((res) => {
            const canvasNode = res[0].node;
            opt.canvas = canvasNode;
            wx.canvasToTempFilePath(opt);
          });
      } else {
        // 旧版
        if (!opt.canvasId) {
          opt.canvasId = this.data.canvasId;
        }
        ctx.draw(true, () => {
          wx.canvasToTempFilePath(opt, this);
        });
      }
    },

    touchStart(e) {
      if (this.chart && e.touches.length > 0) {
        const touch = e.touches[0];
        const handler = this.chart.getZr().handler;
        handler.dispatch('mousedown', {
          zrX: touch.x,
          zrY: touch.y
        });
        handler.dispatch('mousemove', {
          zrX: touch.x,
          zrY: touch.y
        });
        handler.processGesture(wrapTouch(e), 'start');
      }
    },

    touchMove(e) {
      if (this.chart && e.touches.length > 0) {
        const touch = e.touches[0];
        const handler = this.chart.getZr().handler;
        handler.dispatch('mousemove', {
          zrX: touch.x,
          zrY: touch.y
        });
        handler.processGesture(wrapTouch(e), 'change');
      }
    },

    touchEnd(e) {
      if (this.chart) {
        const touch = e.changedTouches ? e.changedTouches[0] : {};
        const handler = this.chart.getZr().handler;
        handler.dispatch('mouseup', {
          zrX: touch.x,
          zrY: touch.y
        });
        handler.dispatch('click', {
          zrX: touch.x,
          zrY: touch.y
        });
        handler.processGesture(wrapTouch(e), 'end');
      }
    }
  }
});

function wrapTouch(event) {
  for (let i = 0; i < event.touches.length; ++i) {
    const touch = event.touches[i];
    touch.offsetX = touch.x;
    touch.offsetY = touch.y;
  }
  return event;
}

function compareVersion(v1, v2) {
  v1 = v1.split('.');
  v2 = v2.split('.');
  const len = Math.max(v1.length, v2.length);

  while (v1.length < len) {
    v1.push('0');
  }
  while (v2.length < len) {
    v2.push('0');
  }

  for (let i = 0; i < len; i++) {
    const num1 = parseInt(v1[i]);
    const num2 = parseInt(v2[i]);

    if (num1 > num2) {
      return 1;
    } else if (num1 < num2) {
      return -1;
    }
  }

  return 0;
}
