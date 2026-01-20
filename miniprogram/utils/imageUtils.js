/**
 * 图片工具函数
 * 提供智能压缩等功能
 */

// 压缩预设配置
const COMPRESS_PRESETS = {
  // 工单照片预设：50-130KB
  WORKORDER: {
    targetSize: 90 * 1024,   // 目标 90KB（中间值）
    maxSize: 130 * 1024,     // 最大 130KB
    minSize: 50 * 1024,      // 最小 50KB
    minQuality: 40,          // 最低质量
    startQuality: 80         // 起始质量
  },
  // 头像预设：50-100KB
  AVATAR: {
    targetSize: 75 * 1024,   // 目标 75KB（中间值）
    maxSize: 100 * 1024,     // 最大 100KB
    minSize: 50 * 1024,      // 最小 50KB
    minQuality: 40,          // 最低质量
    startQuality: 80         // 起始质量
  }
};

// 默认预设（兼容旧代码）
const DEFAULT_PRESET = COMPRESS_PRESETS.WORKORDER;

// 旧常量（保留兼容性）
const TARGET_SIZE = DEFAULT_PRESET.targetSize;
const MAX_SIZE = DEFAULT_PRESET.maxSize;
const MIN_QUALITY = DEFAULT_PRESET.minQuality;
const START_QUALITY = DEFAULT_PRESET.startQuality;

/**
 * 获取文件大小
 * @param {string} filePath - 文件路径
 * @returns {Promise<number>} 文件大小（字节）
 */
function getFileSize(filePath) {
  return new Promise((resolve, reject) => {
    wx.getFileInfo({
      filePath,
      success: (res) => resolve(res.size),
      fail: (err) => reject(err)
    });
  });
}

/**
 * 压缩图片（单次）
 * @param {string} src - 源文件路径
 * @param {number} quality - 压缩质量 (0-100)
 * @returns {Promise<string>} 压缩后的文件路径
 */
function compressOnce(src, quality) {
  return new Promise((resolve, reject) => {
    wx.compressImage({
      src,
      quality,
      success: (res) => resolve(res.tempFilePath),
      fail: (err) => reject(err)
    });
  });
}

/**
 * 智能压缩图片
 * - 原图在目标范围内：不压缩
 * - 原图小于最小值：不压缩（避免放大）
 * - 原图大于最大值：逐步压缩到目标范围
 *
 * @param {string} filePath - 原始文件路径
 * @param {Object} preset - 压缩预设配置（可选，默认使用工单预设）
 * @returns {Promise<{path: string, size: number, compressed: boolean}>}
 */
async function smartCompress(filePath, preset = DEFAULT_PRESET) {
  const { maxSize, minSize, minQuality, startQuality } = preset;

  try {
    // 1. 获取原始文件大小
    const originalSize = await getFileSize(filePath);
    console.log('[ImageUtils] Original size:', (originalSize / 1024).toFixed(1), 'KB');

    // 2. 如果已经在目标范围内（minSize ~ maxSize），不需要压缩
    if (originalSize >= minSize && originalSize <= maxSize) {
      console.log('[ImageUtils] Already in target range, no compression needed');
      return {
        path: filePath,
        size: originalSize,
        compressed: false
      };
    }

    // 3. 如果小于最小值，也不压缩（避免放大）
    if (originalSize < minSize) {
      console.log('[ImageUtils] Below min size, no compression needed');
      return {
        path: filePath,
        size: originalSize,
        compressed: false
      };
    }

    // 4. 逐步压缩：从 startQuality 开始，每次降低 10，直到达到目标或最低质量
    let quality = startQuality;
    let compressedPath = filePath;
    let compressedSize = originalSize;

    while (compressedSize > maxSize && quality >= minQuality) {
      console.log('[ImageUtils] Trying quality:', quality);
      try {
        compressedPath = await compressOnce(filePath, quality);
        compressedSize = await getFileSize(compressedPath);
        console.log('[ImageUtils] After quality', quality + ':', (compressedSize / 1024).toFixed(1), 'KB');

        if (compressedSize <= maxSize) {
          break;
        }
      } catch (err) {
        console.error('[ImageUtils] Compression failed at quality', quality + ':', err);
      }
      quality -= 10;
    }

    // 5. 返回结果（即使超过目标大小也接受，保证清晰度）
    return {
      path: compressedPath,
      size: compressedSize,
      compressed: compressedSize !== originalSize
    };

  } catch (err) {
    console.error('[ImageUtils] Smart compress error:', err);
    // 出错时返回原图
    return {
      path: filePath,
      size: 0,
      compressed: false,
      error: err.message
    };
  }
}

module.exports = {
  smartCompress,
  getFileSize,
  COMPRESS_PRESETS,
  TARGET_SIZE,
  MAX_SIZE,
  MIN_QUALITY
};
