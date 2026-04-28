/**
 * Cloud Function: Upload Image
 * Purpose: Handle image uploads to cloud storage with validation
 *
 * Parameters:
 * - fileID: Temporary file ID from wx.chooseImage
 * - category: Image category (workorder/avatar)
 */

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext();
    const { tempFilePath, category = 'workorder' } = event;

    // 身份验证：确保用户已登录
    if (!wxContext.OPENID) {
      return {
        success: false,
        error: '无法获取用户身份，请重新登录'
      };
    }

    if (!tempFilePath) {
      throw new Error('tempFilePath is required');
    }

    // Generate unique filename
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = tempFilePath.split('.').pop();
    const cloudPath = `${category}/${wxContext.OPENID}_${timestamp}_${random}.${ext}`;

    console.log('[Cloud Function - UploadImage] Uploading:', {
      openid: wxContext.OPENID,
      cloudPath,
      category
    });

    // Upload to cloud storage
    const uploadResult = await cloud.uploadFile({
      cloudPath,
      fileContent: tempFilePath
    });

    // Get temporary download URL (valid for 2 hours)
    const tempURL = await cloud.getTempFileURL({
      fileList: [uploadResult.fileID]
    });

    return {
      success: true,
      fileID: uploadResult.fileID,
      tempURL: tempURL.fileList[0].tempFileURL,
      cloudPath
    };
  } catch (error) {
    console.error('[Cloud Function - UploadImage] Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
