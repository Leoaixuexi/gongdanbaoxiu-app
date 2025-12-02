/**
 * 图片上传组件
 * 支持多图上传到微信云存储（Cloud Storage）
 * 流程说明:
 * 1. wx.chooseImage - 微信原生选择图片
 * 2. 上传到云存储
 * 3. 获取临时URL
 */

const { MAX_PHOTOS_PER_ORDER, MAX_PHOTO_SIZE_MB, IMAGE_QUALITY } = require('../../utils/constants');
const cloudStorage = require('../../services/cloudStorage');

Component({
  /**
   * 组件属性
   */
  properties: {
    // 图片URL数组
    photos: {
      type: Array,
      value: [],
      observer: 'initPhotoList'
    },

    // 最多图片数量
    maxCount: {
      type: Number,
      value: MAX_PHOTOS_PER_ORDER
    },

    // 是否禁用
    disabled: {
      type: Boolean,
      value: false
    }
  },

  /**
   * 组件数据
   */
  data: {
    photoList: [] // 图片列表,包含url、uploading、progress、failed等状态
  },

  /**
   * 组件方法
   */
  methods: {
    /**
     * 初始化图片列表
     * 将props传入的photos转换为内部photoList格式
     */
    initPhotoList() {
      const photos = this.data.photos || [];
      const photoList = photos.map(url => ({
        url: url,
        uploading: false,
        progress: 0,
        failed: false
      }));

      this.setData({
        photoList
      });
    },

    /**
     * 选择图片
     * 调用wx.chooseImage API选择图片
     */
    handleChooseImage() {
      if (this.data.disabled) {
        return;
      }

      const remainingCount = this.data.maxCount - this.data.photoList.length;

      if (remainingCount <= 0) {
        wx.showToast({
          title: `最多上传${this.data.maxCount}张图片`,
          icon: 'none',
          duration: 2000
        });
        return;
      }

      wx.chooseImage({
        count: remainingCount,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          this.uploadImages(res.tempFilePaths);
        },
        fail: (error) => {
          console.error('[ImageUploader] Choose image failed:', error);
          wx.showToast({
            title: '选择图片失败',
            icon: 'none',
            duration: 2000
          });
        }
      });
    },

    /**
     * 上传多张图片
     * @param {Array} tempFilePaths - 临时文件路径数组
     */
    async uploadImages(tempFilePaths) {
      for (const filePath of tempFilePaths) {
        await this.uploadSingleImage(filePath);
      }
    },

    /**
     * 上传单张图片
     * 使用云存储上传
     * @param {string} filePath - 临时文件路径
     */
    async uploadSingleImage(filePath) {
      try {
        // 步骤1: 检查文件大小
        const fileInfo = await this.getFileInfo(filePath);
        const fileSizeMB = fileInfo.size / (1024 * 1024);

        if (fileSizeMB > MAX_PHOTO_SIZE_MB) {
          wx.showToast({
            title: `图片大小不能超过${MAX_PHOTO_SIZE_MB}MB`,
            icon: 'none',
            duration: 2000
          });
          return;
        }

        // 添加到图片列表,显示上传中
        const newPhotoIndex = this.data.photoList.length;
        const newPhotoList = [...this.data.photoList, {
          url: filePath,
          uploading: true,
          progress: 0,
          failed: false,
          tempPath: filePath
        }];

        this.setData({
          photoList: newPhotoList
        });

        // 步骤2: 上传到云存储
        console.log('[ImageUploader] Uploading to cloud storage:', filePath);
        const result = await cloudStorage.uploadImageWithProgress(filePath, 'workorder', newPhotoIndex + 1, 1);

        console.log('[ImageUploader] Upload success:', result);

        // 更新图片URL
        this.updatePhotoStatus(newPhotoIndex, {
          url: result,
          uploading: false,
          progress: 100,
          failed: false
        });

        // 触发change事件
        this.emitChange();

        wx.showToast({
          title: '上传成功',
          icon: 'success',
          duration: 1500
        });

      } catch (error) {
        console.error('[ImageUploader] Upload failed:', error);

        // 标记上传失败
        const photoIndex = this.data.photoList.findIndex(p => p.tempPath === filePath);
        if (photoIndex >= 0) {
          this.updatePhotoStatus(photoIndex, {
            uploading: false,
            failed: true
          });
        }

        wx.showToast({
          title: '上传失败,请重试',
          icon: 'none',
          duration: 2000
        });
      }
    },

    /**
     * 获取文件信息
     * @param {string} filePath - 文件路径
     */
    getFileInfo(filePath) {
      return new Promise((resolve, reject) => {
        wx.getFileInfo({
          filePath,
          success: resolve,
          fail: reject
        });
      });
    },

    /**
     * 更新图片状态
     * @param {number} index - 图片索引
     * @param {object} updates - 更新的属性
     */
    updatePhotoStatus(index, updates) {
      const photoList = [...this.data.photoList];
      photoList[index] = {
        ...photoList[index],
        ...updates
      };

      this.setData({
        photoList
      });
    },

    /**
     * 删除图片
     */
    handleDelete(e) {
      const index = e.currentTarget.dataset.index;

      wx.showModal({
        title: '确认删除',
        content: '确定要删除这张图片吗?',
        success: (res) => {
          if (res.confirm) {
            const photoList = [...this.data.photoList];
            photoList.splice(index, 1);

            this.setData({
              photoList
            });

            // 触发change事件
            this.emitChange();

            wx.showToast({
              title: '已删除',
              icon: 'success',
              duration: 1500
            });
          }
        }
      });
    },

    /**
     * 重新上传
     */
    handleRetry(e) {
      const index = e.currentTarget.dataset.index;
      const photo = this.data.photoList[index];

      if (photo.tempPath) {
        // 删除失败的图片
        const photoList = [...this.data.photoList];
        photoList.splice(index, 1);
        this.setData({
          photoList
        });

        // 重新上传
        this.uploadSingleImage(photo.tempPath);
      }
    },

    /**
     * 预览图片
     */
    handlePreview(e) {
      const index = e.currentTarget.dataset.index;
      const urls = this.data.photoList
        .filter(p => !p.uploading && !p.failed)
        .map(p => p.url);

      wx.previewImage({
        urls: urls,
        current: urls[index]
      });
    },

    /**
     * 触发change事件
     * 返回已上传成功的图片URL数组
     */
    emitChange() {
      const photoUrls = this.data.photoList
        .filter(p => !p.uploading && !p.failed)
        .map(p => p.url);

      this.triggerEvent('change', {
        photos: photoUrls,
        count: photoUrls.length
      });
    }
  },

  /**
   * 组件生命周期
   */
  lifetimes: {
    attached() {
      // 初始化图片列表
      this.initPhotoList();
    }
  }
});
