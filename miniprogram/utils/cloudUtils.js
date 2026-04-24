/**
 * 云存储工具函数
 * 提供 cloud:// URL 转换等功能
 */

/**
 * 批量转换 cloud:// URL 为临时访问URL
 * @param {Array} items - 包含 cloud:// URL 的对象数组
 * @param {string} urlField - URL 字段名，默认 'avatar'
 * @returns {Promise<Array>} 转换后的数组（原地修改）
 */
async function convertCloudUrls(items, urlField = 'avatar') {
  if (!items || items.length === 0) {
    return items;
  }

  // 收集需要转换的 cloud:// URL
  const cloudItems = items
    .map((item, index) => ({ url: item[urlField], index }))
    .filter(item => item.url && item.url.startsWith('cloud://'));

  if (cloudItems.length === 0) {
    return items;
  }

  try {
    const { fileList } = await wx.cloud.getTempFileURL({
      fileList: cloudItems.map(item => item.url)
    });

    fileList.forEach((file, i) => {
      // 使用宽松比较，因为微信API可能返回字符串"0"或数字0
      if (file.tempFileURL && file.status == 0) {
        items[cloudItems[i].index][urlField] = file.tempFileURL;
      }
    });
  } catch (error) {
    console.error('[CloudUtils] Convert URLs error:', error);
  }

  return items;
}

/**
 * 转换单个 cloud:// URL 为临时访问URL
 * @param {string} cloudUrl - cloud:// 格式的URL
 * @returns {Promise<string>} 临时访问URL，失败时返回原URL
 */
async function convertSingleCloudUrl(cloudUrl) {
  if (!cloudUrl || !cloudUrl.startsWith('cloud://')) {
    return cloudUrl;
  }

  try {
    const { fileList } = await wx.cloud.getTempFileURL({
      fileList: [cloudUrl]
    });

    if (fileList[0] && fileList[0].tempFileURL && fileList[0].status == 0) {
      return fileList[0].tempFileURL;
    }
  } catch (error) {
    console.error('[CloudUtils] Convert single URL error:', error);
  }

  return cloudUrl;
}

module.exports = {
  convertCloudUrls,
  convertSingleCloudUrl
};
