// pages/editOrder/editOrder.js
Page({
  data: {
    formData: {
      id: '1',
      orderCode: 'WO20251120005',
      floor: 'B1',
      location: '地下停车场C区',
      category: '未知',
      responsible: '未知',
      priority: '普通',
      reportTime: '2023-10-27 14:30',
      description: '地下停车场C区多盏照明灯不亮,光线昏暗',
      status: 'Pending Repair',
      reporter: '测试员工',
      images: [
        'https://placehold.co/352x352/f1f5f9/94a3b8?text=Image+1',
        'https://placehold.co/352x352/f1f5f9/94a3b8?text=Image+2'
      ],
      remarks: ''
    },
    // 选择器选项
    categoryOptions: ['照明', '水电', '空调', '电梯', '其他'],
    responsibleOptions: ['物业', '业主', '第三方', '未知'],
    priorityOptions: ['紧急', '高', '普通', '低']
  },

  onLoad(options) {
    // 获取状态栏高度
    const systemInfo = wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight
    });
  },

  // 楼层变化
  handleFloorChange(e) {
    this.setData({
      'formData.floor': e.detail.value
    });
  },

  // 具体位置变化
  handleLocationChange(e) {
    this.setData({
      'formData.location': e.detail.value
    });
  },

  // 问题描述变化
  handleDescriptionChange(e) {
    this.setData({
      'formData.description': e.detail.value
    });
  },

  // 备注变化
  handleRemarksChange(e) {
    this.setData({
      'formData.remarks': e.detail.value
    });
  },

  // 工单类别选择
  handleCategorySelect() {
    wx.showActionSheet({
      itemList: this.data.categoryOptions,
      success: (res) => {
        this.setData({
          'formData.category': this.data.categoryOptions[res.tapIndex]
        });
      }
    });
  },

  // 责任方选择
  handleResponsibleSelect() {
    wx.showActionSheet({
      itemList: this.data.responsibleOptions,
      success: (res) => {
        this.setData({
          'formData.responsible': this.data.responsibleOptions[res.tapIndex]
        });
      }
    });
  },

  // 优先级选择
  handlePrioritySelect() {
    wx.showActionSheet({
      itemList: this.data.priorityOptions,
      success: (res) => {
        this.setData({
          'formData.priority': this.data.priorityOptions[res.tapIndex]
        });
      }
    });
  },

  // 添加图片
  handleAddImage() {
    if (this.data.formData.images.length >= 3) {
      wx.showToast({
        title: '最多上传3张图片',
        icon: 'none'
      });
      return;
    }

    wx.chooseImage({
      count: 3 - this.data.formData.images.length,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePaths = res.tempFilePaths;
        const images = [...this.data.formData.images, ...tempFilePaths];
        this.setData({
          'formData.images': images.slice(0, 3)
        });
      }
    });
  },

  // 删除图片
  handleRemoveImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = [...this.data.formData.images];
    images.splice(index, 1);
    this.setData({
      'formData.images': images
    });
  },

  // 预览图片
  handlePreviewImage(e) {
    const index = e.currentTarget.dataset.index;
    wx.previewImage({
      current: this.data.formData.images[index],
      urls: this.data.formData.images
    });
  },

  // 保存
  handleSave() {
    // 验证必填项
    if (this.data.formData.images.length === 0) {
      wx.showToast({
        title: '请上传现场照片',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '保存中...'
    });

    // 模拟保存
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({
        title: '保存成功',
        icon: 'success',
        duration: 2000,
        success: () => {
          // 保存成功后可以返回上一页或其他操作
          setTimeout(() => {
            // wx.navigateBack();
          }, 2000);
        }
      });

      console.log('保存的数据:', this.data.formData);
    }, 1000);
  },

  // 取消
  handleCancel() {
    wx.showModal({
      title: '提示',
      content: '确定要取消编辑吗?',
      success: (res) => {
        if (res.confirm) {
          wx.navigateBack({
            fail: () => {
              wx.switchTab({
                url: '/pages/index/index',
                fail: () => {
                  wx.showToast({
                    title: '无法返回',
                    icon: 'none'
                  });
                }
              });
            }
          });
        }
      }
    });
  }
})
