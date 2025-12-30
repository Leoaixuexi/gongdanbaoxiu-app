/**
 * 云函数调用统一封装
 * 提供：Loading管理、错误处理、请求去重、重试机制
 */

// 请求去重Map
const pendingRequests = new Map();

/**
 * 统一云函数调用
 * @param {string} name - 云函数名称
 * @param {object} data - 调用参数
 * @param {object} options - 配置选项
 * @param {boolean} options.loading - 是否显示Loading（默认true）
 * @param {string} options.loadingText - Loading文字（默认"加载中..."）
 * @param {boolean} options.showError - 是否显示错误提示（默认true）
 * @param {boolean} options.dedupe - 是否请求去重（默认false）
 * @param {number} options.retry - 重试次数（默认0）
 * @param {number} options.retryDelay - 重试间隔ms（默认1000）
 * @returns {Promise<object>} 云函数返回结果
 */
async function callCloud(name, data, options = {}) {
  const {
    loading = true,
    loadingText = '加载中...',
    showError = true,
    dedupe = false,
    retry = 0,
    retryDelay = 1000
  } = options;

  // 请求去重：相同参数的请求复用
  const dedupeKey = dedupe ? `${name}:${JSON.stringify(data)}` : null;
  if (dedupeKey && pendingRequests.has(dedupeKey)) {
    console.log(`[CloudCall] Reusing pending request: ${name}`);
    return pendingRequests.get(dedupeKey);
  }

  // 执行函数（支持重试）
  const execute = async (attempt = 0) => {
    try {
      if (loading) {
        wx.showLoading({ title: loadingText, mask: true });
      }

      const result = await wx.cloud.callFunction({ name, data });

      if (loading) {
        wx.hideLoading();
      }

      // 检查业务层成功
      if (!result.result?.success) {
        throw new Error(result.result?.error || '操作失败');
      }

      return result.result;
    } catch (error) {
      if (loading) {
        wx.hideLoading();
      }

      // 重试逻辑
      if (attempt < retry) {
        console.log(`[CloudCall] Retry ${attempt + 1}/${retry}: ${name}`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return execute(attempt + 1);
      }

      // 显示错误提示
      if (showError) {
        const errorMsg = error.message || '网络错误，请重试';
        wx.showToast({
          title: errorMsg.length > 20 ? errorMsg.slice(0, 20) + '...' : errorMsg,
          icon: 'none',
          duration: 2000
        });
      }

      console.error(`[CloudCall] Error in ${name}:`, error);
      throw error;
    }
  };

  // 创建Promise并处理去重
  const promise = execute();

  if (dedupeKey) {
    pendingRequests.set(dedupeKey, promise);
    promise.finally(() => {
      pendingRequests.delete(dedupeKey);
    });
  }

  return promise;
}

/**
 * 静默调用（不显示Loading和错误）
 */
async function callCloudSilent(name, data, options = {}) {
  return callCloud(name, data, {
    loading: false,
    showError: false,
    ...options
  });
}

/**
 * 带重试的调用
 */
async function callCloudWithRetry(name, data, retryCount = 1, options = {}) {
  return callCloud(name, data, {
    retry: retryCount,
    ...options
  });
}

module.exports = {
  callCloud,
  callCloudSilent,
  callCloudWithRetry
};
