// components/swipeable-message/swipeable-message.js
// 临时引用，将在步骤2中更新
const { getTimeAgo } = require('../../utils/time-formatter.js')

Component({
  properties: {
    message: {
      type: Object,
      value: {}
    },
    moduleId: {
      type: String,
      value: ''
    }
  },

  data: {
    translateX: 0,
    timeAgo: '',
    showDelete: false
  },

  observers: {
    'message': function(message) {
      if (message && message.timestamp) {
        this.setData({
          timeAgo: getTimeAgo(message.timestamp)
        })
      }
    }
  },

  methods: {
    // 滑动过程中
    handleMove(e) {
      const x = e.detail.x
      // 限制滑动范围：不能向右滑动，最多向左滑动 80rpx
      if (x > 0) {
        this.setData({ translateX: 0 })
      } else if (x < -80) {
        this.setData({ translateX: -80 })
      }
    },

    // 滑动结束
    handleTouchEnd() {
      const { translateX } = this.data
      // 如果滑动超过 40rpx，则显示删除按钮
      if (translateX < -40) {
        this.setData({
          translateX: -80,
          showDelete: true
        })
      } else {
        this.setData({
          translateX: 0,
          showDelete: false
        })
      }
    },

    // 点击消息
    handleTap() {
      const { showDelete, message, moduleId } = this.data

      // 如果删除按钮显示，则收起
      if (showDelete) {
        this.setData({
          translateX: 0,
          showDelete: false
        })
        return
      }

      // 否则跳转到详情页
      this.triggerEvent('tap', {
        messageId: message.id,
        moduleId: moduleId
      })
    },

    // 删除消息
    handleDelete() {
      this.triggerEvent('delete', {
        messageId: this.data.message.id
      })
    }
  }
})
