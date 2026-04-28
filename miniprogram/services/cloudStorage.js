/**
 * 云存储服务
 * 封装微信云存储相关操作（上传、下载、删除文件）
 */

const { callCloudSilent } = require('../utils/cloudCall');

/**
 * 上传文件到云存储
 */
async function uploadFile(filePath, category = 'workorder') {
  try {
    console.log('[CloudStorage] Uploading file:', filePath);

    const result = await callCloudSilent('uploadImage', {
      tempFilePath: filePath,
      category
    });

    return {
      fileID: result.fileID,
      tempURL: result.tempURL,
      cloudPath: result.cloudPath
    };
  } catch (error) {
    console.error('[CloudStorage] Upload file error:', error);
    throw error;
  }
}

/**
 * 上传多个文件
 */
async function uploadFiles(filePaths, category = 'workorder') {
  try {
    console.log('[CloudStorage] Uploading multiple files:', filePaths.length);
    const uploadPromises = filePaths.map(filePath => uploadFile(filePath, category));
    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error('[CloudStorage] Upload files error:', error);
    throw error;
  }
}

/**
 * 获取临时文件URL
 */
async function getTempFileURL(fileID) {
  try {
    const result = await wx.cloud.getTempFileURL({
      fileList: [fileID]
    });

    if (result.fileList && result.fileList.length > 0) {
      return result.fileList[0].tempFileURL;
    }

    throw new Error('Failed to get temp file URL');
  } catch (error) {
    console.error('[CloudStorage] Get temp file URL error:', error);
    throw error;
  }
}

/**
 * 删除云存储文件
 */
async function deleteFile(fileID) {
  try {
    return await wx.cloud.deleteFile({
      fileList: [fileID]
    });
  } catch (error) {
    console.error('[CloudStorage] Delete file error:', error);
    throw error;
  }
}

module.exports = {
  uploadFile,
  uploadFiles,
  getTempFileURL,
  deleteFile
};
