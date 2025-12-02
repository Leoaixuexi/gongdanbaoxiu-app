// components/form-row/form-row.js
Component({
  options: {
    multipleSlots: true
  },

  properties: {
    // 标签文本
    label: {
      type: String,
      value: ''
    },
    // 值
    value: {
      type: String,
      value: ''
    },
    // 类型: text, number, select, display, textarea
    type: {
      type: String,
      value: 'text'
    },
    // 是否必填
    required: {
      type: Boolean,
      value: false
    },
    // 占位符
    placeholder: {
      type: String,
      value: ''
    },
    // 是否只读
    readOnly: {
      type: Boolean,
      value: false
    },
    // 对齐方式: center, start
    align: {
      type: String,
      value: 'center'
    },
    // 是否有自定义插槽内容
    hasSlot: {
      type: Boolean,
      value: false
    }
  },

  data: {
    activeClass: ''
  },

  methods: {
    // 输入事件
    handleInput(e) {
      const value = e.detail.value;
      this.triggerEvent('change', { value });
    },

    // 选择器点击
    handleSelectClick() {
      if (this.data.readOnly) return;
      this.triggerEvent('selectclick', { label: this.data.label });
    },

    // 触摸开始
    handleTouchStart() {
      this.setData({ activeClass: 'active' });
    },

    // 触摸结束
    handleTouchEnd() {
      setTimeout(() => {
        this.setData({ activeClass: '' });
      }, 150);
    }
  }
})
