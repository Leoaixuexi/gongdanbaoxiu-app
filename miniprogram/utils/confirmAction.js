/**
 * 确认操作工具
 * 封装 showModal → 执行 → showToast 的常见模式
 */

/**
 * 确认后执行操作
 * @param {object} options
 * @param {string} options.title - 弹窗标题
 * @param {string} options.content - 弹窗内容
 * @param {string} [options.confirmColor] - 确认按钮颜色
 * @param {Function} options.action - 确认后执行的异步函数
 * @param {string} [options.successText='操作成功'] - 成功提示
 * @param {Function} [options.onSuccess] - 成功后回调
 * @returns {Promise<boolean>} 是否执行成功
 */
async function confirmAction(options) {
  const {
    title,
    content,
    confirmColor,
    action,
    successText = '操作成功',
    onSuccess
  } = options;

  return new Promise((resolve) => {
    const modalOptions = {
      title,
      content,
      success: async (res) => {
        if (!res.confirm) {
          resolve(false);
          return;
        }

        try {
          await action();

          wx.showToast({
            title: successText,
            icon: 'success',
            duration: 1500
          });

          if (onSuccess) {
            onSuccess();
          }

          resolve(true);
        } catch (error) {
          console.error(`[confirmAction] ${title} error:`, error);
          wx.showToast({
            title: error.message || '操作失败',
            icon: 'none',
            duration: 2000
          });
          resolve(false);
        }
      }
    };

    if (confirmColor) {
      modalOptions.confirmColor = confirmColor;
    }

    wx.showModal(modalOptions);
  });
}

module.exports = { confirmAction };
