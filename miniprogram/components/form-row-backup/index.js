Component({
  options: {
    addGlobalClass: true,
    multipleSlots: true
  },
  properties: {
    label: {
      type: String,
      value: ''
    },
    value: {
      type: String,
      value: ''
    },
    field: {
      type: String,
      value: ''
    },
    type: {
      type: String,
      value: 'text'
    },
    required: {
      type: Boolean,
      value: false
    },
    placeholder: {
      type: String,
      value: ''
    },
    readOnly: {
      type: Boolean,
      value: false
    },
    suffixIcon: {
      type: Boolean,
      value: true
    },
    align: {
      type: String,
      value: 'center'
    },
    useSlot: {
      type: Boolean,
      value: false
    }
  },
  methods: {
    handleInput(e) {
      if (this.data.readOnly) return;
      this.triggerEvent('change', {
        value: e.detail.value,
        field: this.data.field
      });
    },
    handleTextarea(e) {
      if (this.data.readOnly) return;
      this.triggerEvent('change', {
        value: e.detail.value,
        field: this.data.field
      });
    },
    handleSelect() {
      if (this.data.readOnly) return;
      this.triggerEvent('select', {
        field: this.data.field
      });
    }
  }
});
