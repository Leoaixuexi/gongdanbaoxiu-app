// components/work-order-stepper/index.js
Component({
  properties: {
    workOrderData: {
      type: Object,
      value: null,
      observer: function(newVal) {
        if (newVal) {
          console.log('[Stepper] Received workOrderData:', newVal);
          console.log('[Stepper] startTime:', newVal.startTime);
          console.log('[Stepper] startTime date:', new Date(newVal.startTime).toLocaleString());

          // 重置日志标志，以便新的工单可以输出日志
          this._hasLoggedTimer = false;

          // 判断是否已完成（currentStep === steps.length - 1，即最后一步）
          const isCompleted = newVal.currentStep === newVal.steps.length - 1;

          this.setData({
            steps: newVal.steps,
            currentStep: newVal.currentStep,
            startTime: newVal.startTime,
            endTime: newVal.endTime || null,
            isCompleted: isCompleted
          });

          if (isCompleted && newVal.endTime) {
            // 已完成状态：计算固定的总用时并显示完成时间
            this.calculateFinalDuration();
            this.formatCompletedTime();
          } else {
            // 其他状态：启动实时计时器
            this.startTimer();
          }
        }
      }
    }
  },

  data: {
    steps: [],
    currentStep: 0,
    startTime: 0,
    endTime: null,
    durationStr: '',
    isCompleted: false,
    completedTimeStr: ''
  },

  lifetimes: {
    attached() {
      // 组件实例被放入页面节点树时执行
    },
    detached() {
      // 组件实例被从页面节点树移除时执行
      this.stopTimer();
    }
  },

  methods: {
    /**
     * 启动计时器
     */
    startTimer() {
      // 清除之前的定时器（如果存在）
      this.stopTimer();

      // 立即更新一次
      this.updateTimer();

      // 每秒更新一次
      this.timerInterval = setInterval(() => {
        this.updateTimer();
      }, 1000);
    },

    /**
     * 停止计时器
     */
    stopTimer() {
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
    },

    /**
     * 更新计时器显示
     */
    updateTimer() {
      const now = Date.now();
      const diff = Math.max(0, now - this.data.startTime);

      // 首次更新时输出调试信息
      if (!this._hasLoggedTimer) {
        console.log('[Stepper] updateTimer - now:', now);
        console.log('[Stepper] updateTimer - startTime:', this.data.startTime);
        console.log('[Stepper] updateTimer - diff (ms):', diff);
        console.log('[Stepper] updateTimer - diff (seconds):', Math.floor(diff / 1000));
        this._hasLoggedTimer = true;
      }

      const durationStr = this.formatDuration(diff);

      this.setData({
        durationStr: durationStr
      });
    },

    /**
     * 计算已完成工单的固定总用时
     */
    calculateFinalDuration() {
      const startTime = this.data.startTime;
      const endTime = this.data.endTime;

      if (!startTime || !endTime) {
        this.setData({ durationStr: '0分钟' });
        return;
      }

      const diff = Math.max(0, endTime - startTime);
      const durationStr = this.formatDuration(diff, true); // 传递 isCompleted = true

      this.setData({
        durationStr: durationStr
      });
    },

    /**
     * 格式化时长
     * 未完成状态：自动向上叠加显示（只显示有值的单位）
     * 已完成状态：天数为0时只显示时分秒，否则显示完整格式
     */
    formatDuration(diff, isCompleted = false) {
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      // 已完成状态：天数为0时只显示时分秒，否则显示完整格式
      if (isCompleted) {
        if (days === 0) {
          return `${hours}时${minutes}分${seconds}秒`;
        }
        return `${days}天${hours}时${minutes}分${seconds}秒`;
      }

      // 未完成状态：自动向上叠加显示
      if (days > 0) {
        return `${days}天${hours}时${minutes}分${seconds}秒`;
      } else if (hours > 0) {
        return `${hours}时${minutes}分${seconds}秒`;
      } else if (minutes > 0) {
        return `${minutes}分${seconds}秒`;
      } else {
        return `${seconds}秒`;
      }
    },

    /**
     * 格式化完成时间
     */
    formatCompletedTime() {
      const endTime = this.data.endTime;
      if (!endTime) {
        this.setData({ completedTimeStr: '' });
        return;
      }

      const date = new Date(endTime);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const mins = String(date.getMinutes()).padStart(2, '0');

      const completedTimeStr = `${year}-${month}-${day} ${hours}:${mins}`;

      this.setData({
        completedTimeStr: completedTimeStr
      });
    }
  }
});
