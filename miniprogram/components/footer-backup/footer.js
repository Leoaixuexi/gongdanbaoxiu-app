// components/footer/footer.js
Component({
  data: {
    cancelActive: false,
    saveActive: false
  },

  methods: {
    // 取消按钮
    handleCancel() {
      this.triggerEvent('cancel');
    },

    handleCancelTouchStart() {
      this.setData({ cancelActive: true });
    },

    handleCancelTouchEnd() {
      setTimeout(() => {
        this.setData({ cancelActive: false });
      }, 150);
    },

    // 保存按钮
    handleSave() {
      this.triggerEvent('save');
    },

    handleSaveTouchStart() {
      this.setData({ saveActive: true });
    },

    handleSaveTouchEnd() {
      setTimeout(() => {
        this.setData({ saveActive: false });
      }, 150);
    }
  }
})
