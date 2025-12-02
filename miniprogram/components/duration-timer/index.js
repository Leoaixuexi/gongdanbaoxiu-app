/**
 * Duration Timer Component
 * 实时显示工单总用时，带读秒效果
 */

Component({
  /**
   * Component properties
   */
  properties: {
    // 工单创建时间
    startTime: {
      type: String,
      value: '',
      observer: 'updateTimer'
    },

    // 工单完成时间（如果已完成）
    endTime: {
      type: String,
      value: null
    },

    // 是否已完成（停止读秒）
    isCompleted: {
      type: Boolean,
      value: false,
      observer: 'handleCompletedChange'
    },

    // 已存储的总用时（秒）- 优先使用
    storedDurationSeconds: {
      type: Number,
      value: null,
      observer: 'updateTimer'
    },

    // 是否显示图标
    showIcon: {
      type: Boolean,
      value: true
    },

    // 大小（small, medium, large）
    size: {
      type: String,
      value: 'medium'
    },

    // 自定义类名
    className: {
      type: String,
      value: ''
    }
  },

  /**
   * Component data
   */
  data: {
    displayText: '0秒',
    sizeClass: 'size-medium',
    timerInterval: null,
    currentSeconds: 0
  },

  /**
   * Component lifetimes
   */
  lifetimes: {
    attached() {
      this.updateSizeClass();
      this.updateTimer();
      this.startTimer();
    },

    detached() {
      this.stopTimer();
    }
  },

  /**
   * Page lifetimes
   */
  pageLifetimes: {
    show() {
      // 页面显示时重新启动定时器
      if (!this.data.isCompleted) {
        this.startTimer();
      }
    },

    hide() {
      // 页面隐藏时停止定时器节省资源
      this.stopTimer();
    }
  },

  /**
   * Component methods
   */
  methods: {
    /**
     * 更新尺寸类名
     */
    updateSizeClass() {
      const sizeMap = {
        'small': 'size-small',
        'medium': 'size-medium',
        'large': 'size-large'
      };
      this.setData({
        sizeClass: sizeMap[this.data.size] || 'size-medium'
      });
    },

    /**
     * 更新定时器显示
     */
    updateTimer() {
      const { startTime, endTime, storedDurationSeconds, isCompleted } = this.data;

      // 优先使用已存储的总用时
      if (isCompleted && storedDurationSeconds !== null) {
        const formatted = this.formatDuration(storedDurationSeconds);
        this.setData({
          displayText: formatted,
          currentSeconds: storedDurationSeconds
        });
        this.stopTimer();
        return;
      }

      // 计算实时用时
      if (!startTime) {
        this.setData({ displayText: '0秒', currentSeconds: 0 });
        return;
      }

      const start = new Date(startTime);
      const end = endTime ? new Date(endTime) : new Date();
      const totalSeconds = Math.floor((end - start) / 1000);

      if (totalSeconds < 0) {
        this.setData({ displayText: '0秒', currentSeconds: 0 });
        return;
      }

      const formatted = this.formatDuration(totalSeconds);
      this.setData({
        displayText: formatted,
        currentSeconds: totalSeconds
      });

      // 如果已完成，停止定时器
      if (isCompleted) {
        this.stopTimer();
      }
    },

    /**
     * 格式化时长
     * @param {Number} totalSeconds - 总秒数
     * @returns {String} 格式化字符串
     */
    formatDuration(totalSeconds) {
      if (totalSeconds < 0) return '0秒';

      const days = Math.floor(totalSeconds / (24 * 60 * 60));
      const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
      const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
      const seconds = totalSeconds % 60;

      const parts = [];

      if (days > 0) {
        parts.push(`${days}天`);
      }
      if (hours > 0) {
        parts.push(`${hours}小时`);
      }
      if (minutes > 0) {
        parts.push(`${minutes}分钟`);
      }

      // 如果总时长小于1分钟，显示秒数
      if (parts.length === 0) {
        return `${seconds}秒`;
      }

      // 如果总时长小于1小时，也显示秒数
      if (days === 0 && hours === 0 && minutes < 10) {
        parts.push(`${seconds}秒`);
      }

      return parts.join('');
    },

    /**
     * 启动定时器
     */
    startTimer() {
      // 如果已完成，不启动定时器
      if (this.data.isCompleted) {
        return;
      }

      // 清除旧定时器
      this.stopTimer();

      // 每秒更新一次
      const interval = setInterval(() => {
        const { currentSeconds } = this.data;
        const newSeconds = currentSeconds + 1;
        const formatted = this.formatDuration(newSeconds);

        this.setData({
          currentSeconds: newSeconds,
          displayText: formatted
        });
      }, 1000);

      this.setData({ timerInterval: interval });
    },

    /**
     * 停止定时器
     */
    stopTimer() {
      if (this.data.timerInterval) {
        clearInterval(this.data.timerInterval);
        this.setData({ timerInterval: null });
      }
    },

    /**
     * 处理完成状态变化
     */
    handleCompletedChange(newVal) {
      if (newVal) {
        // 工单完成，停止读秒
        this.stopTimer();
        this.updateTimer();
      } else {
        // 工单未完成，启动读秒
        this.updateTimer();
        this.startTimer();
      }
    }
  }
});
