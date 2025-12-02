/**
 * Report Export Service
 * 报表导出服务 - 导出各类报表
 */

/**
 * Export work orders report
 * @param {Object} filters - 筛选条件
 * @returns {Promise}
 */
async function exportWorkOrders(filters = {}) {
  try {
    wx.showLoading({
      title: '生成中...',
      mask: true
    });

    const result = await wx.cloud.callFunction({
      name: 'exportReport',
      data: {
        action: 'exportWorkOrders',
        filters
      }
    });

    wx.hideLoading();

    if (result.result.success === false) {
      throw new Error(result.result.error || '导出失败');
    }

    // Download CSV file
    await downloadCSV(result.result.csv, result.result.filename);

    wx.showToast({
      title: `已导出${result.result.count}条记录`,
      icon: 'success'
    });

    return result.result;

  } catch (error) {
    wx.hideLoading();
    console.error('[Export] Work orders export error:', error);

    wx.showModal({
      title: '导出失败',
      content: error.message || '网络错误',
      showCancel: false
    });

    throw error;
  }
}

/**
 * Export SLA report
 * @param {Object} filters - 筛选条件
 * @returns {Promise}
 */
async function exportSLAReport(filters = {}) {
  try {
    wx.showLoading({
      title: '生成中...',
      mask: true
    });

    const result = await wx.cloud.callFunction({
      name: 'exportReport',
      data: {
        action: 'exportSLAReport',
        filters
      }
    });

    wx.hideLoading();

    if (result.result.success === false) {
      throw new Error(result.result.error || '导出失败');
    }

    // Download CSV file
    await downloadCSV(result.result.csv, result.result.filename);

    wx.showToast({
      title: `已导出${result.result.count}条记录`,
      icon: 'success'
    });

    return result.result;

  } catch (error) {
    wx.hideLoading();
    console.error('[Export] SLA report export error:', error);

    wx.showModal({
      title: '导出失败',
      content: error.message || '网络错误',
      showCancel: false
    });

    throw error;
  }
}

/**
 * Export user report
 * @returns {Promise}
 */
async function exportUserReport() {
  try {
    wx.showLoading({
      title: '生成中...',
      mask: true
    });

    const result = await wx.cloud.callFunction({
      name: 'exportReport',
      data: {
        action: 'exportUserReport'
      }
    });

    wx.hideLoading();

    if (result.result.success === false) {
      throw new Error(result.result.error || '导出失败');
    }

    // Download CSV file
    await downloadCSV(result.result.csv, result.result.filename);

    wx.showToast({
      title: `已导出${result.result.count}条记录`,
      icon: 'success'
    });

    return result.result;

  } catch (error) {
    wx.hideLoading();
    console.error('[Export] User report export error:', error);

    wx.showModal({
      title: '导出失败',
      content: error.message || '网络错误',
      showCancel: false
    });

    throw error;
  }
}

/**
 * Download CSV file
 * 微信小程序中保存CSV文件的方法
 *
 * @param {string} csvContent - CSV内容
 * @param {string} filename - 文件名
 * @returns {Promise}
 */
async function downloadCSV(csvContent, filename) {
  return new Promise((resolve, reject) => {
    // Convert CSV to base64
    const base64 = wx.arrayBufferToBase64(stringToArrayBuffer(csvContent));

    // Save to temporary file
    const fs = wx.getFileSystemManager();
    const filePath = `${wx.env.USER_DATA_PATH}/${filename}`;

    fs.writeFile({
      filePath,
      data: csvContent,
      encoding: 'utf8',
      success: () => {
        console.log('[Export] File saved:', filePath);

        // Show share sheet to let user save the file
        wx.showModal({
          title: '报表已生成',
          content: `报表已保存到临时目录。\n\n由于微信小程序限制，请通过以下方式保存：\n1. 点击"查看文件"打开文件\n2. 使用系统分享功能保存到本地`,
          confirmText: '查看文件',
          success: (res) => {
            if (res.confirm) {
              // Open the file
              wx.openDocument({
                filePath,
                fileType: 'csv',
                showMenu: true,
                success: () => {
                  console.log('[Export] File opened');
                  resolve(filePath);
                },
                fail: (err) => {
                  console.error('[Export] Open file error:', err);

                  // Fallback: try to share
                  wx.shareFileMessage({
                    filePath,
                    success: () => {
                      console.log('[Export] File shared');
                      resolve(filePath);
                    },
                    fail: (shareErr) => {
                      console.error('[Export] Share error:', shareErr);
                      reject(shareErr);
                    }
                  });
                }
              });
            } else {
              resolve(filePath);
            }
          }
        });
      },
      fail: (err) => {
        console.error('[Export] Write file error:', err);
        reject(err);
      }
    });
  });
}

/**
 * Convert string to ArrayBuffer
 * @param {string} str
 * @returns {ArrayBuffer}
 */
function stringToArrayBuffer(str) {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

/**
 * Export with date range picker
 * 显示日期选择器并导出
 */
async function exportWithDateRangePicker(exportType = 'workOrders') {
  return new Promise((resolve, reject) => {
    // Show date range picker modal (需要在页面中实现)
    // 这里提供一个简单的示例

    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1); // 本月第一天
    const endDate = now;

    const filters = {
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString()
    };

    // Call corresponding export function
    switch (exportType) {
      case 'workOrders':
        exportWorkOrders(filters).then(resolve).catch(reject);
        break;
      case 'sla':
        exportSLAReport(filters).then(resolve).catch(reject);
        break;
      case 'users':
        exportUserReport().then(resolve).catch(reject);
        break;
      default:
        reject(new Error(`Unknown export type: ${exportType}`));
    }
  });
}

module.exports = {
  exportWorkOrders,
  exportSLAReport,
  exportUserReport,
  exportWithDateRangePicker,
  downloadCSV
};
