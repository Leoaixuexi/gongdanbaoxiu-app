Component({
  properties: {
    rowId: {
      type: String,
      value: ''
    },
    label: {
      type: String,
      value: ''
    },
    hasArrow: {
      type: Boolean,
      value: false
    },
    placeholder: {
      type: String,
      value: ''
    },
    value: {
      type: String,
      value: ''
    }
  },
  methods: {
    onTap: function () {
      wx.vibrateShort({ type: 'light' });
      console.log('[FilterRow] onTap triggered, rowId:', this.properties.rowId);
      this.triggerEvent('rowtap', { id: this.properties.rowId });
    }
  }
});
