/**
 * New Order Page - Taro Design Style
 * Form to create new work order
 */

const app = getApp();
const workOrderService = require('../../../services/workOrder');
const auth = require('../../../services/auth');

Page({
  data: {
    orderNumber: '',
    floorOptions: ['请选择楼层', '1楼', '2楼', '3楼', '4楼', '5楼', 'B1', 'B2'],
    floorIndex: 0,
    location: '',
    description: '',
    priorityOptions: [
      { key: 'Normal', label: '普通', color: 'green' },
      { key: 'Emergency', label: '紧急', color: 'red' }
    ],
    selectedPriority: '',
    responsibleParties: ['请选择责任方', '信泰物业', '业主', '第三方'],
    responsiblePartyIndex: 0,
    orderCategories: ['请选择工单类别', '电梯维修', '水电维修', '消防维修', '空调维修', '其他'],
    orderCategoryIndex: 0,
    faultTypes: [],
    faultTypeIndex: -1,
    safetyHazard: false,
    reportDate: '',
    reportTime: '',
    displayDateTime: '',
    uploadedPhotos: ['', '', ''],
    remark: '',
    submitting: false,
    isDateTimePickerOpen: false,
    tempDate: '',
    tempTime: '',
    headerHeight: 0
  },

  /**
   * Lifecycle - Page Load
   */
  onLoad: function (options) {
    console.log('[Submit] Page load');
    // 计算自定义导航栏高度
    const systemInfo = wx.getSystemInfoSync();
    const statusBarHeight = systemInfo.statusBarHeight;
    const navBarHeight = 88 * systemInfo.windowWidth / 750;
    this.setData({
      headerHeight: statusBarHeight + navBarHeight
    });
    this.checkAuth();
    // Set default date and time to now
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const displayDateTime = dateStr.replace(/-/g, '/');
    this.setData({
      reportDate: dateStr,
      reportTime: timeStr,
      displayDateTime: displayDateTime
    });
  },

  /**
   * Check Authentication
   */
  checkAuth: async function () {
    try {
      const isAuth = await auth.isAuthenticated();
      if (!isAuth) {
        wx.showToast({
          title: '请先登录',
          icon: 'none',
          duration: 2000
        });
        setTimeout(() => {
          wx.redirectTo({
            url: '/pages/login/login'
          });
        }, 2000);
      }
    } catch (error) {
      console.error('[Submit] Check auth error:', error);
    }
  },


  /**
   * Form Input Handlers
   */
  onOrderNumberInput: function (e) {
    this.setData({ orderNumber: e.detail.value });
  },

  onFloorChange: function (e) {
    this.setData({ floorIndex: parseInt(e.detail.value) });
  },

  onLocationInput: function (e) {
    this.setData({ location: e.detail.value });
  },

  onDescriptionInput: function (e) {
    this.setData({ description: e.detail.value });
  },

  onRemarkInput: function (e) {
    this.setData({ remark: e.detail.value });
  },

  onPrioritySelect: function (e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ selectedPriority: key });
  },

  onResponsiblePartyChange: function (e) {
    this.setData({ responsiblePartyIndex: parseInt(e.detail.value) });
  },

  onOrderCategoryChange: function (e) {
    this.setData({ orderCategoryIndex: parseInt(e.detail.value) });
  },


  /**
   * Handle Scan QR Code
   */
  handleScan: function () {
    wx.scanCode({
      success: async (res) => {
        console.log('[Submit] Scan result:', res);
        // 使用扫描到的二维码内容
        const scannedCode = res.result || '';
        if (scannedCode) {
          // 检查工单编号是否已存在
          try {
            wx.showLoading({ title: '检查中...', mask: true });
            const existingOrder = await workOrderService.getWorkOrderByNumber(scannedCode);
            wx.hideLoading();

            if (existingOrder) {
              // 工单编号已存在，弹窗警告
              wx.showModal({
                title: '编号重复',
                content: `工单编号 "${scannedCode}" 已被使用，请更换二维码重新扫描。`,
                showCancel: false,
                confirmText: '知道了'
              });
              return;
            }
          } catch (error) {
            wx.hideLoading();
            // 如果查询出错（如工单不存在），继续使用该编号
            console.log('[Submit] Order number check:', error.message);
          }

          this.setData({ orderNumber: scannedCode });
          wx.showToast({
            title: '扫码成功',
            icon: 'success'
          });
        } else {
          wx.showToast({
            title: '未识别到内容',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.log('[Submit] Scan failed:', err);
        wx.showToast({
          title: '扫码取消',
          icon: 'none'
        });
      }
    });
  },

  /**
   * Handle Photo Upload
   */
  handlePhotoUpload: function (e) {
    const index = e.currentTarget.dataset.index;
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];

        // 压缩图片到150KB
        wx.compressImage({
          src: tempFilePath,
          quality: 50,
          success: (compressRes) => {
            // 检查压缩后的文件大小
            wx.getFileInfo({
              filePath: compressRes.tempFilePath,
              success: (fileInfo) => {
                console.log('[Submit] Compressed image size:', fileInfo.size);
                const newPhotos = [...this.data.uploadedPhotos];
                newPhotos[index] = compressRes.tempFilePath;
                this.setData({ uploadedPhotos: newPhotos });
              },
              fail: () => {
                const newPhotos = [...this.data.uploadedPhotos];
                newPhotos[index] = compressRes.tempFilePath;
                this.setData({ uploadedPhotos: newPhotos });
              }
            });
          },
          fail: () => {
            // 压缩失败时使用原图
            const newPhotos = [...this.data.uploadedPhotos];
            newPhotos[index] = tempFilePath;
            this.setData({ uploadedPhotos: newPhotos });
          }
        });
      }
    });
  },

  /**
   * Handle Photo Preview
   */
  handlePhotoPreview: function (e) {
    const index = e.currentTarget.dataset.index;
    const photos = this.data.uploadedPhotos.filter(p => p);
    const currentPhoto = this.data.uploadedPhotos[index];

    if (currentPhoto) {
      wx.previewImage({
        current: currentPhoto,
        urls: photos
      });
    }
  },

  /**
   * Handle Remove Photo
   */
  handleRemovePhoto: function (e) {
    const index = e.currentTarget.dataset.index;
    const newPhotos = [...this.data.uploadedPhotos];
    newPhotos[index] = '';
    this.setData({ uploadedPhotos: newPhotos });
  },

  /**
   * Validate Form
   */
  validateForm: function () {
    const {
      orderNumber,
      floorIndex,
      location,
      description,
      selectedPriority,
      orderCategoryIndex,
      responsiblePartyIndex,
      reportDate,
      reportTime,
      uploadedPhotos
    } = this.data;

    if (!orderNumber || orderNumber.trim() === '') {
      wx.showToast({ title: '请扫码生成工单编号', icon: 'none' });
      return false;
    }

    if (floorIndex === 0) {
      wx.showToast({ title: '请选择楼层', icon: 'none' });
      return false;
    }

    if (!location || location.trim() === '') {
      wx.showToast({ title: '请输入具体位置', icon: 'none' });
      return false;
    }

    if (orderCategoryIndex === 0) {
      wx.showToast({ title: '请选择工单类别', icon: 'none' });
      return false;
    }

    if (responsiblePartyIndex === 0) {
      wx.showToast({ title: '请选择责任方', icon: 'none' });
      return false;
    }

    if (!selectedPriority) {
      wx.showToast({ title: '请选择优先级', icon: 'none' });
      return false;
    }

    if (!reportDate || !reportTime) {
      wx.showToast({ title: '请选择日期时间', icon: 'none' });
      return false;
    }

    if (!description || description.trim() === '') {
      wx.showToast({ title: '请输入问题描述', icon: 'none' });
      return false;
    }

    // 检查是否至少上传一张照片
    const hasPhotos = uploadedPhotos.some(photo => photo);
    if (!hasPhotos) {
      wx.showToast({ title: '请至少上传一张现场照片', icon: 'none' });
      return false;
    }

    return true;
  },

  /**
   * Handle Submit
   */
  handleSubmit: async function () {
    if (!this.validateForm()) {
      return;
    }

    wx.showModal({
      title: '提示',
      content: '确认提交工单吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            this.setData({ submitting: true });

            // 上传照片到云存储
            const uploadedPhotoUrls = [];
            const localPhotos = this.data.uploadedPhotos.filter(p => p);

            if (localPhotos.length > 0) {
              wx.showLoading({
                title: '上传照片中...',
                mask: true
              });

              for (let i = 0; i < localPhotos.length; i++) {
                const tempFilePath = localPhotos[i];
                const cloudPath = `work-orders/${Date.now()}-${i}.jpg`;

                try {
                  const uploadResult = await wx.cloud.uploadFile({
                    cloudPath: cloudPath,
                    filePath: tempFilePath
                  });
                  uploadedPhotoUrls.push(uploadResult.fileID);
                  console.log('[Submit] Photo uploaded:', uploadResult.fileID);
                } catch (uploadError) {
                  console.error('[Submit] Photo upload error:', uploadError);
                }
              }

              wx.hideLoading();
            }

            const submitData = {
              order_number: this.data.orderNumber.trim(),
              floor: this.data.floorOptions[this.data.floorIndex],
              location: this.data.location.trim(),
              order_category: this.data.orderCategories[this.data.orderCategoryIndex],
              responsible_party: this.data.responsibleParties[this.data.responsiblePartyIndex],
              priority: this.data.selectedPriority,
              report_date: this.data.reportDate,
              report_time: this.data.reportTime,
              description: this.data.description.trim(),
              photos: uploadedPhotoUrls,
              remark: this.data.remark ? this.data.remark.trim() : ''
            };

            console.log('[Submit] Submitting work order:', submitData);

            const order = await workOrderService.createWorkOrder(submitData);

            console.log('[Submit] Work order created:', order);

            wx.showToast({
              title: '提交成功',
              icon: 'success',
              duration: 1500
            });

            setTimeout(() => {
              wx.navigateBack();
            }, 1500);

          } catch (error) {
            console.error('[Submit] Submit error:', error);
            this.setData({ submitting: false });

            const errorMessage = error.message || '提交失败,请重试';
            wx.showToast({
              title: errorMessage,
              icon: 'none',
              duration: 2000
            });
          }
        }
      }
    });
  },

  /**
   * Show Date Time Picker
   */
  showDateTimePicker: function () {
    this.setData({
      isDateTimePickerOpen: true,
      tempDate: this.data.reportDate,
      tempTime: this.data.reportTime
    });
  },

  /**
   * Close Date Time Picker
   */
  closeDateTimePicker: function () {
    this.setData({
      isDateTimePickerOpen: false
    });
  },

  /**
   * Stop Propagation
   */
  stopPropagation: function () {
    // Prevent event bubbling
  },

  /**
   * On Temp Date Change
   */
  onTempDateChange: function (e) {
    this.setData({
      tempDate: e.detail.value
    });
  },

  /**
   * On Temp Time Change
   */
  onTempTimeChange: function (e) {
    this.setData({
      tempTime: e.detail.value
    });
  },

  /**
   * Cancel Date Time Picker
   */
  cancelDateTimePicker: function () {
    this.setData({
      isDateTimePickerOpen: false
    });
  },

  /**
   * Confirm Date Time Picker
   */
  confirmDateTimePicker: function () {
    if (!this.data.tempDate || !this.data.tempTime) {
      wx.showToast({
        title: '请选择日期和时间',
        icon: 'none'
      });
      return;
    }

    const displayDateTime = this.data.tempDate.replace(/-/g, '/');
    this.setData({
      reportDate: this.data.tempDate,
      reportTime: this.data.tempTime,
      displayDateTime: displayDateTime,
      isDateTimePickerOpen: false
    });
  },

  /**
   * Go Back
   */
  goBack: function () {
    wx.navigateBack();
  }
});
