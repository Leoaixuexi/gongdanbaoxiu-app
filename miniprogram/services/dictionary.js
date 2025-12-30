/**
 * Dictionary Service
 * 字典服务 - 获取和缓存字典数据
 */

// 缓存配置
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟

// 内存缓存
const cache = {};

// 请求去重Map - 防止同一字典的并发请求
const _pendingFetches = new Map();

// 硬编码兜底值
const FALLBACK_OPTIONS = {
  floor: ['1楼', '2楼', '3楼', '4楼', '5楼', 'B1', 'B2'],
  order_category: ['电梯维修', '水电维修', '消防维修', '空调维修', '其他'],
  responsible_party: ['信泰物业', '业主', '第三方'],
  department: ['行政部', '信泰物业', '工程总包', '供应商']
};

/**
 * 获取单个字典
 * @param {string} dictKey - 字典键
 * @returns {Promise<object|null>} 字典对象
 */
const getDictionary = async (dictKey) => {
  // 1. 检查是否有进行中的相同请求（请求去重）
  if (_pendingFetches.has(dictKey)) {
    console.log(`[Dictionary] Reusing pending request: ${dictKey}`);
    return _pendingFetches.get(dictKey);
  }

  // 2. 检查缓存
  const cached = cache[dictKey];
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`[Dictionary] Using cached: ${dictKey}`);
    return cached.data;
  }

  // 3. 发起新请求并记录
  const fetchPromise = (async () => {
    try {
      console.log(`[Dictionary] Fetching: ${dictKey}`);
      const result = await wx.cloud.callFunction({
        name: 'dictionaryManager',
        data: {
          action: 'get',
          data: { dict_key: dictKey }
        }
      });

      if (result.result && result.result.success) {
        // 更新缓存
        cache[dictKey] = {
          data: result.result.data,
          timestamp: Date.now()
        };
        return result.result.data;
      }

      console.warn(`[Dictionary] Not found: ${dictKey}`);
      return null;
    } catch (error) {
      console.error(`[Dictionary] Error fetching ${dictKey}:`, error);
      return null;
    } finally {
      // 请求完成后从去重Map中移除
      _pendingFetches.delete(dictKey);
    }
  })();

  // 将Promise存入去重Map
  _pendingFetches.set(dictKey, fetchPromise);
  return fetchPromise;
};

/**
 * 批量获取字典
 * @param {string[]} dictKeys - 字典键数组
 * @returns {Promise<object>} 字典对象映射
 */
const getDictionaries = async (dictKeys) => {
  // 检查哪些需要从服务器获取
  const needFetch = [];
  const result = {};

  for (const key of dictKeys) {
    const cached = cache[key];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      result[key] = cached.data.items.map(item => ({
        value: item.value,
        label: item.label || item.value
      }));
    } else {
      needFetch.push(key);
    }
  }

  if (needFetch.length === 0) {
    console.log('[Dictionary] All from cache');
    return result;
  }

  try {
    console.log(`[Dictionary] Fetching batch: ${needFetch.join(', ')}`);
    const res = await wx.cloud.callFunction({
      name: 'dictionaryManager',
      data: {
        action: 'getBatch',
        data: { keys: needFetch }
      }
    });

    if (res.result && res.result.success) {
      for (const key of needFetch) {
        if (res.result.data[key]) {
          result[key] = res.result.data[key];
          // 更新缓存
          cache[key] = {
            data: { items: res.result.data[key].map(item => ({ value: item.value, label: item.label })) },
            timestamp: Date.now()
          };
        }
      }
    }
  } catch (error) {
    console.error('[Dictionary] Error fetching batch:', error);
  }

  return result;
};

/**
 * 获取字典选项数组（用于picker）
 * @param {string} dictKey - 字典键
 * @returns {Promise<string[]>} 选项值数组
 */
const getOptions = async (dictKey) => {
  const dict = await getDictionary(dictKey);

  if (dict && dict.items && dict.items.length > 0) {
    return dict.items.map(item => item.value);
  }

  // 返回兜底值
  console.warn(`[Dictionary] Using fallback for: ${dictKey}`);
  return FALLBACK_OPTIONS[dictKey] || [];
};

/**
 * 获取字典选项数组（带label/value格式）
 * @param {string} dictKey - 字典键
 * @returns {Promise<Array<{value: string, label: string}>>} 选项数组
 */
const getOptionsWithLabel = async (dictKey) => {
  const dict = await getDictionary(dictKey);

  if (dict && dict.items && dict.items.length > 0) {
    return dict.items.map(item => ({
      value: item.value,
      label: item.label || item.value
    }));
  }

  // 返回兜底值
  console.warn(`[Dictionary] Using fallback for: ${dictKey}`);
  const fallback = FALLBACK_OPTIONS[dictKey] || [];
  return fallback.map(value => ({ value, label: value }));
};

/**
 * 刷新缓存
 * @param {string} [dictKey] - 可选，指定字典键。不传则清除所有缓存
 */
const refreshCache = (dictKey) => {
  if (dictKey) {
    delete cache[dictKey];
    console.log(`[Dictionary] Cache cleared: ${dictKey}`);
  } else {
    Object.keys(cache).forEach(key => delete cache[key]);
    console.log('[Dictionary] All cache cleared');
  }
};

/**
 * 获取兜底值
 * @param {string} dictKey - 字典键
 * @returns {string[]} 兜底选项数组
 */
const getFallbackOptions = (dictKey) => {
  return FALLBACK_OPTIONS[dictKey] || [];
};

module.exports = {
  getDictionary,
  getDictionaries,
  getOptions,
  getOptionsWithLabel,
  refreshCache,
  getFallbackOptions,
  FALLBACK_OPTIONS
};
