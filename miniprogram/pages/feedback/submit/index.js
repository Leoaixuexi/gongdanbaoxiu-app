/**
 * 意见反馈提交页面
 */

const { smartCompress } = require('../../../utils/imageUtils');
const feedbackService = require('../../../services/feedbackService');

Page({
  data: {
    // 类型选项
    typeOptions: ['系统BUG', '新增功能建议', '现有模块优化', '个人想法'],
    typeActions: [
      { name: '系统BUG' },
      { name: '新增功能建议' },
      { name: '现有模块优化' },
      { name: '个人想法' }
    ],
    showTypeSheet: false,
    selectedType: '',
    content: '',
    contentLength: 0,
    uploadedPhotos: [],
    photoCount: 0,
    submitting: false,
    statusBarHeight: 0,
    navBarHeight: 0
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync();
    const statusBarHeight = systemInfo.statusBarHeight;
    const navBarHeight = statusBarHeight + 44;
    this.setData({
      statusBarHeight,
      navBarHeight
    });
  },

  // 显示类型选择弹窗
  showTypeSheet() {
    this.setData({ showTypeSheet: true });
  },

  // 关闭类型选择弹窗
  onTypeSheetClose() {
    this.setData({ showTypeSheet: false });
  },

  // 选择类型
  onTypeSelect(e) {
    this.setData({
      selectedType: e.detail.name,
      showTypeSheet: false
    });
  },

  // 内容输入
  onContentInput(e) {
    const content = e.detail.value;
    this.setData({
      content,
      contentLength: content.length
    });
  },

  // 选择图片
  choosePhoto() {
    const remaining = 4 - this.data.photoCount;
    if (remaining <= 0) {
      wx.showToast({ title: '最多上传4张图片', icon: 'none' });
      return;
    }

    wx.chooseImage({
      count: remaining,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempPaths = res.tempFilePaths;
        const newPhotos = [...this.data.uploadedPhotos];

        for (const tempPath of tempPaths) {
          if (newPhotos.length >= 4) break;
          try {
            const result = await smartCompress(tempPath);
            newPhotos.push(result.path);
          } catch (err) {
            console.error('[Feedback] Image compress error:', err);
            newPhotos.push(tempPath);
          }
        }

        this.setData({
          uploadedPhotos: newPhotos,
          photoCount: newPhotos.length
        });
      }
    });
  },

  // 预览图片
  previewPhoto(e) {
    const index = e.currentTarget.dataset.index;
    wx.previewImage({
      current: this.data.uploadedPhotos[index],
      urls: this.data.uploadedPhotos
    });
  },

  // 删除图片
  removePhoto(e) {
    const index = e.currentTarget.dataset.index;
    const newPhotos = [...this.data.uploadedPhotos];
    newPhotos.splice(index, 1);
    this.setData({
      uploadedPhotos: newPhotos,
      photoCount: newPhotos.length
    });
  },

  // 表单验证
  validateForm() {
    const { selectedType, content } = this.data;

    if (!selectedType) {
      wx.showToast({ title: '请选择反馈类型', icon: 'none' });
      return false;
    }

    if (!content || content.trim() === '') {
      wx.showToast({ title: '请填写内容描述', icon: 'none' });
      return false;
    }

    return true;
  },

  // 提交反馈
  async handleSubmit() {
    if (this.data.submitting) return;
    if (!this.validateForm()) return;

    try {
      this.setData({ submitting: true });

      // 上传图片到云存储
      const uploadedPhotoUrls = [];
      const localPhotos = this.data.uploadedPhotos;

      if (localPhotos.length > 0) {
        wx.showLoading({ title: '上传图片中...', mask: true });

        for (let i = 0; i < localPhotos.length; i++) {
          const tempFilePath = localPhotos[i];
          const cloudPath = `feedbacks/${Date.now()}-${i}.jpg`;

          try {
            const uploadResult = await wx.cloud.uploadFile({
              cloudPath,
              filePath: tempFilePath
            });
            uploadedPhotoUrls.push(uploadResult.fileID);
          } catch (uploadError) {
            console.error('[Feedback] Photo upload error:', uploadError);
          }
        }

        wx.hideLoading();
      }

      // 收集上下文信息
      const systemInfo = wx.getSystemInfoSync();

      await feedbackService.createFeedback({
        type: this.data.selectedType,
        content: this.data.content.trim(),
        photos: uploadedPhotoUrls,
        system_info: `${systemInfo.brand} ${systemInfo.model}`,
        user_agent: `${systemInfo.system} / 微信${systemInfo.version}`,
        app_version: systemInfo.SDKVersion
      });

      wx.showToast({
        title: '提交成功',
        icon: 'success',
        duration: 1500
      });

      setTimeout(() => {
        wx.redirectTo({
          url: '/pages/feedback/list/index'
        });
      }, 1500);
    } catch (error) {
      console.error('[Feedback] Submit error:', error);
      this.setData({ submitting: false });
    }
  },

  // 返回
  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.redirectTo({
        url: '/pages/feedback/index/index'
      });
    }
  },

  // 跳转到我的反馈
  goToMyFeedback() {
    wx.navigateTo({
      url: '/pages/feedback/list/index'
    });
  }
});
