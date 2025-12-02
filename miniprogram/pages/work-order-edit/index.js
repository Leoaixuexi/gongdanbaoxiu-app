/**
 * Work Order Edit Page
 * 工单修改页面
 */

const workOrderService = require('../../services/workOrder');

Page({
  data: {
    orderId: null,
    workOrder: null,
    editForm: {
      floor: '',
      location: '',
      orderCategory: '',
      responsibleParty: '',
      priority: '',
      description: '',
      remark: ''
    },
    floorOptions: ['请选择楼层', '1楼', '2楼', '3楼', '4楼', '5楼', 'B1', 'B2'],
    floorIndex: 0,
    orderCategories: ['请选择工单类别', '电梯维修', '水电维修', '消防维修', '空调维修', '其他'],
    orderCategoryIndex: 0,
    responsibleParties: ['请选择责任方', '物业公司', '业主', '第三方'],
    responsiblePartyIndex: 0,
    priorityOptions: [
      { key: 'Low', label: '低', color: 'green' },
      { key: 'Normal', label: '中', color: 'yellow' },
      { key: 'High', label: '高', color: 'orange' },
      { key: 'Emergency', label: '紧急', color: 'red' }
    ],
    editPhotos: ['', '', ''],
    uploadingPhotos: false,
    submitting: false
  },

  /**
   * Lifecycle - Page Load
   */
  onLoad: function (options) {
    console.log('[Edit] Page load with options:', options);
    if (options.id) {
      this.setData({ orderId: options.id });
      this.loadWorkOrder();
    } else {
      wx.showToast({
        title: '工单ID无效',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  /**
   * Load Work Order Data
   */
  loadWorkOrder: async function () {
    try {
      wx.showLoading({ title: '加载中...' });

      const workOrder = await workOrderService.getWorkOrderById(this.data.orderId);

      if (!workOrder) {
        throw new Error('工单不存在');
      }

      console.log('[Edit] Work order loaded:', workOrder);

      // Find index for floor
      const floorIndex = this.data.floorOptions.indexOf(workOrder.floor);

      // Find index for order category
      const orderCategoryIndex = this.data.orderCategories.indexOf(workOrder.order_category);

      // Find index for responsible party
      const responsiblePartyIndex = this.data.responsibleParties.indexOf(workOrder.responsible_party);

      // Prepare photos array
      const editPhotos = ['', '', ''];
      if (workOrder.photos && Array.isArray(workOrder.photos)) {
        workOrder.photos.forEach((photo, index) => {
          if (index < 3) {
            editPhotos[index] = photo;
          }
        });
      }

      this.setData({
        workOrder: workOrder,
        floorIndex: floorIndex > 0 ? floorIndex : 0,
        orderCategoryIndex: orderCategoryIndex > 0 ? orderCategoryIndex : 0,
        responsiblePartyIndex: responsiblePartyIndex > 0 ? responsiblePartyIndex : 0,
        'editForm.floor': workOrder.floor || '',
        'editForm.location': workOrder.location || '',
        'editForm.orderCategory': workOrder.order_category || '',
        'editForm.responsibleParty': workOrder.responsible_party || '',
        'editForm.priority': workOrder.priority || '',
        'editForm.description': workOrder.description || '',
        'editForm.remark': workOrder.remark || '',
        editPhotos: editPhotos
      });

      wx.hideLoading();

    } catch (error) {
      console.error('[Edit] Load work order error:', error);
      wx.hideLoading();
      wx.showModal({
        title: '加载失败',
        content: error.message || '加载工单数据失败',
        showCancel: false,
        success: () => {
          wx.navigateBack();
        }
      });
    }
  },

  /**
   * Form Input Handlers
   */
  onFloorChange: function (e) {
    const index = parseInt(e.detail.value);
    this.setData({
      floorIndex: index,
      'editForm.floor': this.data.floorOptions[index]
    });
  },

  onLocationInput: function (e) {
    this.setData({ 'editForm.location': e.detail.value });
  },

  onOrderCategoryChange: function (e) {
    const index = parseInt(e.detail.value);
    this.setData({
      orderCategoryIndex: index,
      'editForm.orderCategory': this.data.orderCategories[index]
    });
  },

  onResponsiblePartyChange: function (e) {
    const index = parseInt(e.detail.value);
    this.setData({
      responsiblePartyIndex: index,
      'editForm.responsibleParty': this.data.responsibleParties[index]
    });
  },

  onPrioritySelect: function (e) {
    const priority = e.currentTarget.dataset.key;
    this.setData({ 'editForm.priority': priority });
  },

  onDescriptionInput: function (e) {
    this.setData({ 'editForm.description': e.detail.value });
  },

  onRemarkInput: function (e) {
    this.setData({ 'editForm.remark': e.detail.value });
  },

  /**
   * Photo Upload Handler
   */
  handlePhotoUpload: async function (e) {
    const index = e.currentTarget.dataset.index;
    try {
      const res = await wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      });

      if (res.tempFilePaths && res.tempFilePaths.length > 0) {
        this.setData({ uploadingPhotos: true });

        const tempFilePath = res.tempFilePaths[0];
        const cloudPath = `work-orders/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;

        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: tempFilePath
        });

        const fileID = uploadRes.fileID;
        const tempFileURL = await wx.cloud.getTempFileURL({
          fileList: [fileID]
        });

        const photoUrl = tempFileURL.fileList[0].tempFileURL;
        const editPhotos = this.data.editPhotos;
        editPhotos[index] = photoUrl;

        this.setData({
          editPhotos: editPhotos,
          uploadingPhotos: false
        });

        wx.showToast({
          title: '上传成功',
          icon: 'success'
        });
      }
    } catch (error) {
      console.error('[Edit] Photo upload error:', error);
      this.setData({ uploadingPhotos: false });
      wx.showToast({
        title: '上传失败',
        icon: 'none'
      });
    }
  },

  /**
   * Remove Photo
   */
  handleRemovePhoto: function (e) {
    const index = e.currentTarget.dataset.index;
    const editPhotos = this.data.editPhotos;
    editPhotos[index] = '';
    this.setData({ editPhotos: editPhotos });
  },

  /**
   * Preview Photo
   */
  handlePhotoPreview: function (e) {
    const index = e.currentTarget.dataset.index;
    const photos = this.data.editPhotos.filter(p => p);
    wx.previewImage({
      current: photos[index],
      urls: photos
    });
  },

  /**
   * Submit Edit Form
   */
  submitEdit: async function () {
    const { editForm, floorIndex, orderCategoryIndex, responsiblePartyIndex, editPhotos } = this.data;

    // Validation
    if (floorIndex === 0) {
      wx.showToast({ title: '请选择楼层', icon: 'none' });
      return;
    }
    if (!editForm.location.trim()) {
      wx.showToast({ title: '请填写具体位置', icon: 'none' });
      return;
    }
    if (orderCategoryIndex === 0) {
      wx.showToast({ title: '请选择工单类别', icon: 'none' });
      return;
    }
    if (responsiblePartyIndex === 0) {
      wx.showToast({ title: '请选择责任方', icon: 'none' });
      return;
    }
    if (!editForm.priority) {
      wx.showToast({ title: '请选择优先级', icon: 'none' });
      return;
    }
    if (!editForm.description.trim()) {
      wx.showToast({ title: '请填写问题描述', icon: 'none' });
      return;
    }

    const validPhotos = editPhotos.filter(p => p);
    if (validPhotos.length === 0) {
      wx.showToast({ title: '请上传至少一张现场照片', icon: 'none' });
      return;
    }

    try {
      this.setData({ submitting: true });

      const updateData = {
        floor: editForm.floor,
        location: editForm.location,
        order_category: editForm.orderCategory,
        responsible_party: editForm.responsibleParty,
        priority: editForm.priority,
        description: editForm.description,
        remark: editForm.remark,
        photos: validPhotos
      };

      await workOrderService.updateWorkOrder(this.data.orderId, updateData);

      wx.showToast({
        title: '修改成功',
        icon: 'success',
        duration: 2000
      });

      this.setData({ submitting: false });

      // 延迟返回
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);

    } catch (error) {
      console.error('[Edit] Submit edit error:', error);
      this.setData({ submitting: false });
      wx.showModal({
        title: '修改失败',
        content: error.message || '修改工单失败，请重试',
        showCancel: false
      });
    }
  },

  /**
   * Navigate Back
   */
  navigateBack: function () {
    wx.navigateBack({
      fail: () => {
        wx.redirectTo({
          url: '/pages/index/index'
        });
      }
    });
  }
});
