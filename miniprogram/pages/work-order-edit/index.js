// pages/editOrder/editOrder.js
Page({
  data: {
    orderId: null, // 工单ID
    headerHeight: 80, // Header 总高度，初始默认值
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
    // 照片显示数组（固定3个位置）
    photoSlots: ['', '', ''],
    // 选择器选项
    categoryOptions: ['照明', '水电', '空调', '电梯', '其他'],
    responsibleOptions: ['物业', '业主', '第三方', '未知'],
    priorityOptions: ['紧急', '高', '普通', '低']
  },

  onLoad(options) {
    // 获取状态栏高度
    const systemInfo = wx.getSystemInfoSync();
    const statusBarHeight = systemInfo.statusBarHeight || 20;
    // header 高度 88rpx 约等于 44px，加上状态栏高度再加上一些间距
    const headerTotalHeight = statusBarHeight + 44 + 10; // 10px 额外间距

    this.setData({
      statusBarHeight: statusBarHeight,
      headerHeight: headerTotalHeight
    });

    // 获取工单ID
    if (options.id) {
      this.setData({
        orderId: options.id,
        'formData.id': options.id
      });
    }

    // 初始化照片槽位
    this.updatePhotoSlots();
  },

  // 更新照片槽位显示
  updatePhotoSlots() {
    const images = this.data.formData.images || [];
    const photoSlots = ['', '', ''];

    // 将现有照片填充到槽位中
    images.forEach((img, index) => {
      if (index < 3) {
        photoSlots[index] = img;
      }
    });

    this.setData({
      photoSlots: photoSlots
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
  handleAddImage(e) {
    const index = e.currentTarget.dataset.index;

    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        const images = [...this.data.formData.images];

        // 如果该位置已有图片，替换；否则添加
        if (index < images.length) {
          images[index] = tempFilePath;
        } else {
          images.push(tempFilePath);
        }

        this.setData({
          'formData.images': images
        });

        // 更新照片槽位显示
        this.updatePhotoSlots();
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

    // 更新照片槽位显示
    this.updatePhotoSlots();
  },

  // 预览图片
  handlePreviewImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.formData.images.filter(img => img); // 过滤空值

    if (images.length > 0 && this.data.photoSlots[index]) {
      wx.previewImage({
        current: this.data.photoSlots[index],
        urls: images
      });
    }
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
        duration: 1500
      });

      console.log('保存的数据:', this.data.formData);

      // 保存成功后跳转到工单详情页面
      setTimeout(() => {
        const orderId = this.data.orderId || this.data.formData.id;
        if (orderId) {
          wx.redirectTo({
            url: `/pages/work-order-detail/index?id=${orderId}`,
            fail: () => {
              // 如果redirectTo失败，尝试navigateTo
              wx.navigateTo({
                url: `/pages/work-order-detail/index?id=${orderId}`,
                fail: () => {
                  // 如果都失败了，就返回上一页
                  wx.navigateBack({
                    fail: () => {
                      wx.switchTab({
                        url: '/pages/index/index'
                      });
                    }
                  });
                }
              });
            }
          });
        } else {
          // 没有工单ID，返回上一页
          wx.navigateBack({
            fail: () => {
              wx.switchTab({
                url: '/pages/index/index'
              });
            }
          });
        }
      }, 1500);
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
