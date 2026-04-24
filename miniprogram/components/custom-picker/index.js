/**
 * 可复用的下拉选项组件
 * 基于 Vant Weapp van-picker 封装
 *
 * 使用方法：
 * <custom-picker
 *   show="{{ showPicker }}"
 *   columns="{{ options }}"
 *   value="{{ selectedValue }}"
 *   bind:confirm="onPickerConfirm"
 *   bind:cancel="onPickerCancel"
 * />
 */
Component({
  options: {
    styleIsolation: 'shared',
    addGlobalClass: true
  },

  properties: {
    // 是否显示弹窗
    show: {
      type: Boolean,
      value: false
    },
    // 选项列表（字符串数组）
    columns: {
      type: Array,
      value: []
    },
    // 当前选中的值
    value: {
      type: String,
      value: ''
    },
    // 最大可见行数
    maxVisibleCount: {
      type: Number,
      value: 5
    },
    // 最小可见行数
    minVisibleCount: {
      type: Number,
      value: 3
    }
  },

  data: {
    defaultIndex: 0,
    visibleCount: 5
  },

  observers: {
    'columns, value': function(columns, value) {
      if (!columns || columns.length === 0) return;

      // 计算默认索引
      let defaultIndex = 0;
      if (value) {
        const index = columns.indexOf(value);
        if (index >= 0) {
          defaultIndex = index;
        }
      }

      // 动态计算可见行数
      const minCount = this.properties.minVisibleCount;
      const maxCount = this.properties.maxVisibleCount;
      const visibleCount = Math.min(Math.max(columns.length, minCount), maxCount);

      this.setData({
        defaultIndex,
        visibleCount
      });
    }
  },

  methods: {
    // 确认选择
    onConfirm: function(e) {
      const selectedValue = e.detail.value;
      const selectedIndex = e.detail.index;

      this.triggerEvent('confirm', {
        value: selectedValue,
        index: selectedIndex
      });
    },

    // 关闭弹窗
    onClose: function() {
      this.triggerEvent('cancel');
    },

    // 滚动切换选项时触感反馈
    onPickerChange: function() {
      wx.vibrateShort({ type: 'light' });
    },

    // 阻止滚动穿透
    noop: function() {}
  }
});
