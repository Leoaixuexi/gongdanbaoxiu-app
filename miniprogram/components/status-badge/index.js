/**
 * 状态徽章组件
 * 用于显示工单状态标签
 * 根据状态自动匹配颜色
 */

const { STATUS_DISPLAY_NAMES, STATUS_COLORS } = require('../../utils/constants');

Component({
  /**
   * 组件属性
   */
  properties: {
    // 工单状态值
    status: {
      type: String,
      value: '',
      observer: 'updateDisplay'
    },

    // 尺寸: small, medium, large
    size: {
      type: String,
      value: 'medium'
    },

    // 自定义CSS类
    customClass: {
      type: String,
      value: ''
    }
  },

  /**
   * 组件数据
   */
  data: {
    displayText: '',  // 显示的中文文本
    bgColor: '',      // 背景颜色
    textColor: '#ffffff' // 文字颜色,默认白色
  },

  /**
   * 组件方法
   */
  methods: {
    /**
     * 更新显示内容
     * 根据状态更新显示文本和颜色
     */
    updateDisplay() {
      const status = this.data.status;

      // 获取中文显示名
      const displayText = STATUS_DISPLAY_NAMES[status] || status || '未知';

      // 获取背景颜色
      const bgColor = STATUS_COLORS[status] || '#9e9e9e';

      // 计算文字颜色,根据背景亮度
      // 确保有足够的对比度,文字清晰
      const textColor = this.getContrastColor(bgColor);

      this.setData({
        displayText,
        bgColor,
        textColor
      });
    },

    /**
     * 根据背景色计算文字颜色
     * 遵循WCAG 2.0 AA标准的可读性
     * @param {string} bgColor - 背景颜色(十六进制)
     * @returns {string} 文字颜色
     */
    getContrastColor(bgColor) {
      // 去除#号
      const hex = bgColor.replace('#', '');

      // 转换为RGB
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);

      // 计算亮度(YIQ公式)
      const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;

      // 根据背景亮度返回深色或浅色文字
      return yiq >= 128 ? '#333333' : '#ffffff';
    }
  },

  /**
   * 组件生命周期
   */
  lifetimes: {
    attached() {
      // 初始化显示
      this.updateDisplay();
    }
  }
});
