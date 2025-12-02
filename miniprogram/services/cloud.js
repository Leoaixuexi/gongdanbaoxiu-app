/**
 * Cloud Development Service
 * Wrapper for WeChat cloud functions and cloud storage
 */

const config = require('../config/index');

/**
 * Call cloud function
 */
async function callFunction(name, data = {}) {
  try {
    console.log(`[Cloud] Calling function: ${name}`, data);

    const result = await wx.cloud.callFunction({
      name,
      data
    });

    console.log(`[Cloud] Function ${name} result:`, result);

    if (result.errMsg !== 'cloud.callFunction:ok') {
      throw new Error(result.errMsg);
    }

    return result.result;
  } catch (error) {
    console.error(`[Cloud] Function ${name} error:`, error);
    throw error;
  }
}

/**
 * Get user's WeChat openid
 */
async function getOpenId() {
  try {
    const result = await callFunction('login');

    if (!result.success) {
      throw new Error(result.error || 'Failed to get openid');
    }

    return result.openid;
  } catch (error) {
    console.error('[Cloud] Get openid error:', error);
    throw error;
  }
}

/**
 * Upload file to cloud storage
 */
async function uploadFile(filePath, category = 'workorder') {
  try {
    console.log('[Cloud] Uploading file:', filePath);

    // Use cloud function to handle upload
    const result = await callFunction('uploadImage', {
      tempFilePath: filePath,
      category
    });

    if (!result.success) {
      throw new Error(result.error || 'Upload failed');
    }

    return {
      fileID: result.fileID,
      tempURL: result.tempURL,
      cloudPath: result.cloudPath
    };
  } catch (error) {
    console.error('[Cloud] Upload file error:', error);
    throw error;
  }
}

/**
 * Upload multiple files
 */
async function uploadFiles(filePaths, category = 'workorder') {
  try {
    console.log('[Cloud] Uploading multiple files:', filePaths.length);

    const uploadPromises = filePaths.map(filePath => uploadFile(filePath, category));
    const results = await Promise.all(uploadPromises);

    return results;
  } catch (error) {
    console.error('[Cloud] Upload files error:', error);
    throw error;
  }
}

/**
 * Send subscription message
 */
async function sendNotification(openid, templateId, data, page) {
  try {
    console.log('[Cloud] Sending notification:', { openid, templateId, page });

    const result = await callFunction('sendNotification', {
      openid,
      templateId,
      data,
      page
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to send notification');
    }

    return result;
  } catch (error) {
    console.error('[Cloud] Send notification error:', error);
    throw error;
  }
}

/**
 * Get temporary file URL
 */
async function getTempFileURL(fileID) {
  try {
    console.log('[Cloud] Getting temp file URL:', fileID);

    const result = await wx.cloud.getTempFileURL({
      fileList: [fileID]
    });

    if (result.fileList && result.fileList.length > 0) {
      return result.fileList[0].tempFileURL;
    }

    throw new Error('Failed to get temp file URL');
  } catch (error) {
    console.error('[Cloud] Get temp file URL error:', error);
    throw error;
  }
}

/**
 * Delete file from cloud storage
 */
async function deleteFile(fileID) {
  try {
    console.log('[Cloud] Deleting file:', fileID);

    const result = await wx.cloud.deleteFile({
      fileList: [fileID]
    });

    return result;
  } catch (error) {
    console.error('[Cloud] Delete file error:', error);
    throw error;
  }
}

module.exports = {
  callFunction,
  getOpenId,
  uploadFile,
  uploadFiles,
  sendNotification,
  getTempFileURL,
  deleteFile
};
