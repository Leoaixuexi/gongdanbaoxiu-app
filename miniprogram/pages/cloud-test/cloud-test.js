/**
 * 云开发功能测试页面
 * 独立测试云函数和云存储，无需后端
 */

const cloud = require('../../services/cloud');
const cloudStorage = require('../../services/cloudStorage');

Page({
  data: {
    loginLoading: false,
    loginResult: '',
    uploadLoading: false,
    uploadResult: '',
    uploadedImageUrl: '',
    functionLoading: false,
    functionResult: ''
  },

  onLoad() {
    // Safety: do not expose test utilities in release builds
    try {
      const accountInfo = wx.getAccountInfoSync?.();
      const envVersion = accountInfo?.miniProgram?.envVersion || 'develop';
      if (envVersion === 'release') {
        wx.showModal({
          title: '不可用',
          content: '该页面仅用于开发/测试环境',
          showCancel: false,
          success: () => {
            wx.switchTab({ url: '/pages/index/index' });
          }
        });
      }
    } catch (e) {
      // ignore
    }
  },

  /**
   * 测试云登录（获取openid）
   */
  async testCloudLogin() {
    this.setData({
      loginLoading: true,
      loginResult: ''
    });

    try {
      const openid = await cloud.getOpenId();

      this.setData({
        loginResult: `✅ 成功！\nopenid: ${openid}\n\n这证明云函数工作正常！`
      });

      wx.showToast({
        title: '获取openid成功',
        icon: 'success'
      });

    } catch (error) {
      console.error('[CloudTest] Login error:', error);
      this.setData({
        loginResult: `❌ 失败\n错误: ${error.message}`
      });

      wx.showToast({
        title: '获取失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loginLoading: false });
    }
  },

  /**
   * 测试云存储上传
   */
  async testCloudStorage() {
    this.setData({
      uploadLoading: true,
      uploadResult: '',
      uploadedImageUrl: ''
    });

    try {
      // 选择图片
      const res = await new Promise((resolve, reject) => {
        wx.chooseImage({
          count: 1,
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
          success: resolve,
          fail: reject
        });
      });

      const filePath = res.tempFilePaths[0];

      // 上传到云存储
      const imageUrl = await cloudStorage.uploadImageWithProgress(filePath, 'test', 1, 1);

      this.setData({
        uploadResult: `✅ 上传成功！\n图片URL: ${imageUrl.substring(0, 50)}...\n\n云存储工作正常！`,
        uploadedImageUrl: imageUrl
      });

      wx.showToast({
        title: '上传成功',
        icon: 'success'
      });

    } catch (error) {
      console.error('[CloudTest] Upload error:', error);

      if (error.errMsg && error.errMsg.includes('cancel')) {
        this.setData({
          uploadResult: '已取消选择图片'
        });
      } else {
        this.setData({
          uploadResult: `❌ 上传失败\n错误: ${error.message || error.errMsg}`
        });

        wx.showToast({
          title: '上传失败',
          icon: 'none'
        });
      }
    } finally {
      this.setData({ uploadLoading: false });
    }
  },

  /**
   * 直接测试云函数调用
   */
  async testCloudFunction() {
    this.setData({
      functionLoading: true,
      functionResult: ''
    });

    try {
      const result = await cloud.callFunction('login', {});

      this.setData({
        functionResult: `✅ 云函数调用成功！\n\n返回数据:\n${JSON.stringify(result, null, 2)}`
      });

      wx.showToast({
        title: '调用成功',
        icon: 'success'
      });

    } catch (error) {
      console.error('[CloudTest] Function error:', error);
      this.setData({
        functionResult: `❌ 调用失败\n错误: ${error.message}`
      });

      wx.showToast({
        title: '调用失败',
        icon: 'none'
      });
    } finally {
      this.setData({ functionLoading: false });
    }
  }
});
