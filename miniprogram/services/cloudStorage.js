/**
 * Cloud Storage Service
 * Handles image uploads using WeChat Cloud Storage
 * Alternative to backend COS upload
 */

const cloud = require('./cloud');
const { MAX_PHOTOS_PER_ORDER, MAX_PHOTO_SIZE_MB } = require('../utils/constants');

/**
 * Choose and upload images
 * @param {object} options - Upload options
 * @param {number} options.count - Maximum number of images to select (default: 9)
 * @param {string} options.category - Image category (default: 'workorder')
 * @param {boolean} options.compress - Whether to compress images (default: true)
 * @returns {Promise<Array>} Array of uploaded image URLs
 */
async function chooseAndUploadImages(options = {}) {
  const {
    count = MAX_PHOTOS_PER_ORDER,
    category = 'workorder',
    compress = true
  } = options;

  try {
    wx.showLoading({
      title: '选择图片中...',
      mask: true
    });

    // Choose images
    const chooseResult = await new Promise((resolve, reject) => {
      wx.chooseImage({
        count,
        sizeType: compress ? ['compressed'] : ['original'],
        sourceType: ['album', 'camera'],
        success: resolve,
        fail: reject
      });
    });

    wx.hideLoading();

    const tempFilePaths = chooseResult.tempFilePaths;
    console.log('[CloudStorage] Selected images:', tempFilePaths.length);

    if (tempFilePaths.length === 0) {
      return [];
    }

    // Upload images
    wx.showLoading({
      title: `上传中 0/${tempFilePaths.length}`,
      mask: true
    });

    const uploadPromises = tempFilePaths.map((filePath, index) => {
      return uploadImageWithProgress(filePath, category, index + 1, tempFilePaths.length);
    });

    const results = await Promise.all(uploadPromises);

    wx.hideLoading();

    wx.showToast({
      title: `成功上传${results.length}张图片`,
      icon: 'success',
      duration: 1500
    });

    return results;

  } catch (error) {
    wx.hideLoading();
    console.error('[CloudStorage] Choose and upload error:', error);

    wx.showToast({
      title: error.errMsg || '上传失败',
      icon: 'none',
      duration: 2000
    });

    throw error;
  }
}

/**
 * Upload single image with progress
 * @param {string} filePath - Temporary file path
 * @param {string} category - Image category
 * @param {number} current - Current image number
 * @param {number} total - Total images
 * @returns {Promise<string>} Uploaded image URL
 */
async function uploadImageWithProgress(filePath, category, current, total) {
  try {
    console.log(`[CloudStorage] Uploading ${current}/${total}:`, filePath);

    // Update loading text
    wx.showLoading({
      title: `上传中 ${current}/${total}`,
      mask: true
    });

    // Validate file size
    const fileInfo = await getFileInfo(filePath);
    const fileSizeMB = fileInfo.size / (1024 * 1024);

    if (fileSizeMB > MAX_PHOTO_SIZE_MB) {
      throw new Error(`图片大小超过${MAX_PHOTO_SIZE_MB}MB限制`);
    }

    // Upload to cloud storage
    const result = await cloud.uploadFile(filePath, category);

    console.log(`[CloudStorage] Upload ${current}/${total} success:`, result.fileID);

    return result.tempURL; // Return temporary URL for immediate display

  } catch (error) {
    console.error(`[CloudStorage] Upload ${current}/${total} error:`, error);
    throw error;
  }
}

/**
 * Get file information
 * @param {string} filePath - File path
 * @returns {Promise<object>} File info
 */
async function getFileInfo(filePath) {
  return new Promise((resolve, reject) => {
    wx.getFileInfo({
      filePath,
      success: resolve,
      fail: reject
    });
  });
}

/**
 * Delete image from cloud storage
 * @param {string} fileID - Cloud file ID
 * @returns {Promise<void>}
 */
async function deleteImage(fileID) {
  try {
    console.log('[CloudStorage] Deleting image:', fileID);

    await cloud.deleteFile(fileID);

    console.log('[CloudStorage] Delete success');

  } catch (error) {
    console.error('[CloudStorage] Delete error:', error);
    throw error;
  }
}

/**
 * Delete multiple images
 * @param {Array<string>} fileIDs - Array of cloud file IDs
 * @returns {Promise<void>}
 */
async function deleteImages(fileIDs) {
  try {
    console.log('[CloudStorage] Deleting images:', fileIDs.length);

    const deletePromises = fileIDs.map(fileID => cloud.deleteFile(fileID));
    await Promise.all(deletePromises);

    console.log('[CloudStorage] Batch delete success');

  } catch (error) {
    console.error('[CloudStorage] Batch delete error:', error);
    throw error;
  }
}

/**
 * Preview images
 * @param {string} currentUrl - Current image URL
 * @param {Array<string>} urls - All image URLs
 */
function previewImages(currentUrl, urls) {
  wx.previewImage({
    current: currentUrl,
    urls: urls
  });
}

/**
 * Save image to phone album
 * @param {string} url - Image URL
 * @returns {Promise<void>}
 */
async function saveImageToAlbum(url) {
  try {
    // Request authorization
    const authResult = await new Promise((resolve, reject) => {
      wx.authorize({
        scope: 'scope.writePhotosAlbum',
        success: resolve,
        fail: reject
      });
    });

    // Download image
    wx.showLoading({
      title: '保存中...',
      mask: true
    });

    const downloadResult = await new Promise((resolve, reject) => {
      wx.downloadFile({
        url,
        success: resolve,
        fail: reject
      });
    });

    // Save to album
    await new Promise((resolve, reject) => {
      wx.saveImageToPhotosAlbum({
        filePath: downloadResult.tempFilePath,
        success: resolve,
        fail: reject
      });
    });

    wx.hideLoading();

    wx.showToast({
      title: '已保存到相册',
      icon: 'success',
      duration: 1500
    });

  } catch (error) {
    wx.hideLoading();
    console.error('[CloudStorage] Save to album error:', error);

    if (error.errMsg && error.errMsg.includes('auth deny')) {
      wx.showModal({
        title: '需要授权',
        content: '请授权保存图片到相册',
        confirmText: '去设置',
        success: (res) => {
          if (res.confirm) {
            wx.openSetting();
          }
        }
      });
    } else {
      wx.showToast({
        title: '保存失败',
        icon: 'none',
        duration: 2000
      });
    }

    throw error;
  }
}

module.exports = {
  chooseAndUploadImages,
  uploadImageWithProgress,
  deleteImage,
  deleteImages,
  previewImages,
  saveImageToAlbum,
  getFileInfo
};
