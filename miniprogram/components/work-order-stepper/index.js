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

          this.setData({
            steps: newVal.steps,
            currentStep: newVal.currentStep,
            startTime: newVal.startTime
          });
          this.startTimer();
        }
      }
    }
  },

  data: {
    steps: [],
    currentStep: 0,
    startTime: 0,
    durationStr: ''
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

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const durationStr = `${days}天${hours}时${minutes}分${seconds}秒`;

      this.setData({
        durationStr: durationStr
      });
    }
  }
});
