/**
 * New Order Page - Taro Design Style
 * Form to create new work order
 */

const app = getApp();
const workOrderService = require('../../../services/workOrder');
const auth = require('../../../services/auth');
const dictionary = require('../../../services/dictionary');

Page({
  data: {
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
    headerHeight: 0,
    // --- 通用选择器数据 ---
    isSelectorOpen: false,
    selectorOptions: [],
    selectorType: '', // 'floor', 'category', 'party'
    selectorCurrentValue: ''
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
    this.loadDictionaries();
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
   * Load dictionaries from service
   */
  loadDictionaries: async function () {
    try {
      const [floors, categories, parties] = await Promise.all([
        dictionary.getOptions('floor'),
        dictionary.getOptions('order_category'),
        dictionary.getOptions('responsible_party')
      ]);

      if (floors.length > 0) {
        this.setData({
          floorOptions: ['请选择楼层', ...floors]
        });
      }
      if (categories.length > 0) {
        this.setData({
          orderCategories: ['请选择工单类别', ...categories]
        });
      }
      if (parties.length > 0) {
        this.setData({
          responsibleParties: ['请选择责任方', ...parties]
        });
      }
    } catch (error) {
      console.error('[Submit] Load dictionaries error:', error);
      // 使用硬编码兜底值，不影响页面使用
    }
  },

  /**
   * Form Input Handlers
   */
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

        // 压缩图片
        wx.compressImage({
          src: tempFilePath,
          quality: 30,
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
    // 防止重复提交
    if (this.data.submitting) {
      return;
    }

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

              try {
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
              } finally {
                wx.hideLoading();
              }
            }

            const submitData = {
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
   * --- 通用选择器逻辑 ---
   */
  openSelector: function(e) {
    const type = e.currentTarget.dataset.type;
    let options = [];
    let currentValue = '';

    switch(type) {
      case 'floor':
        // 移除第一个占位符 "请选择..."
        options = this.data.floorOptions.slice(1);
        currentValue = this.data.floorIndex > 0 ? this.data.floorOptions[this.data.floorIndex] : '';
        break;
      case 'category':
        options = this.data.orderCategories.slice(1);
        currentValue = this.data.orderCategoryIndex > 0 ? this.data.orderCategories[this.data.orderCategoryIndex] : '';
        break;
      case 'party':
        options = this.data.responsibleParties.slice(1);
        currentValue = this.data.responsiblePartyIndex > 0 ? this.data.responsibleParties[this.data.responsiblePartyIndex] : '';
        break;
    }

    this.setData({
      isSelectorOpen: true,
      selectorOptions: options,
      selectorType: type,
      selectorCurrentValue: currentValue
    });
  },

  closeSelector: function() {
    this.setData({ isSelectorOpen: false });
  },

  onSelectorConfirm: function(e) {
    const selectedValue = e.detail.value;
    const type = this.data.selectorType;

    const updates = { isSelectorOpen: false };

    if (type === 'floor') {
      // 找到原始数组中的索引（包括占位符，所以+1）
      const index = this.data.floorOptions.indexOf(selectedValue);
      updates.floorIndex = index >= 0 ? index : 0;
    } else if (type === 'category') {
      const index = this.data.orderCategories.indexOf(selectedValue);
      updates.orderCategoryIndex = index >= 0 ? index : 0;
    } else if (type === 'party') {
      const index = this.data.responsibleParties.indexOf(selectedValue);
      updates.responsiblePartyIndex = index >= 0 ? index : 0;
    }

    this.setData(updates);
  },

  /**
   * Go Back
   */
  goBack: function () {
    wx.navigateBack();
  }
});
