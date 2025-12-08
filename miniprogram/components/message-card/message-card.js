// components/message-card/message-card.js
const { getTimeAgo } = require('../../utils/time-formatter.js')

Component({
  properties: {
    moduleId: {
      type: String,
      value: ''
    },
    moduleName: {
      type: String,
      value: ''
    },
    iconBgColor: {
      type: String,
      value: 'bg-gray-100'
    },
    latestMessage: {
      type: Object,
      value: null
    },
    unreadCount: {
      type: Number,
      value: 0
    }
  },

  data: {
    timeAgo: ''
  },

  observers: {
    'latestMessage': function(message) {
      if (message && message.timestamp) {
        this.setData({
          timeAgo: getTimeAgo(message.timestamp)
        })
      }
    }
  },

  methods: {
    handleTap() {
      // 触发自定义事件，传递模块 ID
      this.triggerEvent('tap', {
        moduleId: this.data.moduleId
      })
    }
  }
})
