/**
 * SLA Countdown Component
 * 显示工单SLA倒计时
 */

const slaCalculator = require('../../utils/slaCalculator');

Component({
  properties: {
    // 工单创建时间
    createdAt: {
      type: String,
      value: ''
    },
    // 优先级
    priority: {
      type: String,
      value: 'Normal'
    },
    // 完成时间（可选，完成后传入）
    completedAt: {
      type: String,
      value: null
    },
    // 是否显示组件
    visible: {
      type: Boolean,
      value: true
    },
    // 是否自动更新倒计时
    autoUpdate: {
      type: Boolean,
      value: true
    }
  },

  data: {
    sla: {
      slaLimit: 8,
      elapsedHours: 0,
      remainingHours: 0,
      remainingMs: 0,
      percentage: 0,
      remainingPercentage: 100,
      status: 'normal',
      deadline: null,
      isOverdue: false,
      countdown: '0分钟',
      deadlineText: '',
      statusText: '正常',
      statusColor: '#34C759',
      statusIcon: '✅'
    }
  },

  lifetimes: {
    attached() {
      this.calculateSLA();
      if (this.properties.autoUpdate) {
        this.startTimer();
      }
    },

    detached() {
      this.stopTimer();
    }
  },

  observers: {
    'createdAt, priority, completedAt': function() {
      this.calculateSLA();
    }
  },

  methods: {
    /**
     * 计算SLA
     */
    calculateSLA() {
      if (!this.properties.createdAt) return;

      const slaData = slaCalculator.calculateSLA(
        this.properties.createdAt,
        this.properties.priority,
        this.properties.completedAt
      );

      this.setData({
        sla: {
          ...slaData,
          countdown: slaCalculator.formatCountdown(slaData.remainingMs),
          deadlineText: slaCalculator.formatDeadline(slaData.deadline),
          statusText: slaCalculator.getSLAStatusText(slaData.status),
          statusColor: slaCalculator.getSLAColor(slaData.status),
          statusIcon: slaCalculator.getSLAIcon(slaData.status)
        }
      });

      // 触发SLA状态变化事件
      this.triggerEvent('slachange', {
        status: slaData.status,
        isOverdue: slaData.isOverdue,
        remainingHours: slaData.remainingHours
      });
    },

    /**
     * 启动定时器（每分钟更新一次）
     */
    startTimer() {
      if (this.timer) {
        clearInterval(this.timer);
      }

      // 每分钟更新一次倒计时
      this.timer = setInterval(() => {
        this.calculateSLA();
      }, 60000); // 60秒
    },

    /**
     * 停止定时器
     */
    stopTimer() {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }
  }
});
