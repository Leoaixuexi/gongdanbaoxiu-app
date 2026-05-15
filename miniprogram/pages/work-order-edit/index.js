// pages/work-order-edit/index.js (Cloud Database Version)
const app = getApp();
const workOrderService = require('../../services/workOrder');
const auth = require('../../services/auth');
const dictionary = require('../../services/dictionary');
const { smartCompress, COMPRESS_PRESETS } = require('../../utils/imageUtils');

Page({
  data: {
    orderId: null, // 工单ID
    headerHeight: 80, // Header 总高度，初始默认值
    loading: true,
    formData: {
      orderCode: '',
      floor: '',
      location: '',
      category: '',
      responsible: '',
      priority: '',
      reportTime: '',
      description: '',
      status: '',
      reporter: '',
      images: [],
      remarks: ''
    },
    // 照片显示数组（固定3个位置）
    photoSlots: ['', '', ''],
    // 选择器选项
    floorOptions: ['B2', 'B1', '1F', '2F', '3F', '4F', '5F', '6F', '7F', '8F', '9F', '10F'],
    categoryOptions: ['电梯维修', '水电维修', '消防维修', '空调维修', '其他'],
    responsibleOptions: ['信泰物业', '业主', '第三方'],
    priorityOptions: [
      { key: 'Normal', label: '普通', color: 'green' },
      { key: 'Emergency', label: '紧急', color: 'red' }
    ],
    selectedPriority: '',
    // 日期时间选择器
    isDateTimePickerOpen: false,
    tempDate: '',
    tempTime: '',
    displayDateTime: '',
    // 通用选择器数据
    isSelectorOpen: false,
    selectorOptions: [],
    selectorType: '',
    selectorCurrentValue: ''
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
      this.setData({ orderId: options.id });
      this.checkAuthAndLoad();
    } else {
      wx.showToast({ title: '工单ID无效', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1200);
    }
  },

  async checkAuthAndLoad() {
    try {
      const isAuth = await auth.isAuthenticated();
      if (!isAuth) {
        wx.showToast({ title: '请先登录', icon: 'none' });
        setTimeout(() => {
          wx.redirectTo({ url: '/pages/login/login' });
        }, 1200);
        return;
      }
      await this.loadDictionaries();
      await this.loadWorkOrder();
    } catch (error) {
      console.error('[Edit] Auth check error:', error);
      await this.loadWorkOrder();
    }
  },

  async loadDictionaries() {
    try {
      const [categories, parties, floors] = await Promise.all([
        dictionary.getOptions('order_category'),
        dictionary.getOptions('responsible_party'),
        dictionary.getOptions('floor')
      ]);

      if (categories.length > 0) {
        this.setData({ categoryOptions: categories });
      }
      if (parties.length > 0) {
        this.setData({ responsibleOptions: parties });
      }
      if (floors.length > 0) {
        this.setData({ floorOptions: floors });
      }
    } catch (error) {
      console.error('[Edit] Load dictionaries error:', error);
    }
  },

  formatDateTime(dateValue) {
    if (!dateValue) return '';
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  },

  async loadWorkOrder() {
    try {
      this.setData({ loading: true });
      const order = await workOrderService.getWorkOrderById(this.data.orderId);

      const statusTextMap = {
        'Pending Repair': '已提报',
        'In Progress': '维修中',
        'Repaired': '待复核',
        'Needs Rework': '需返工',
        'Completed': '已完成',
      };

      const reportTime = this.formatDateTime(order.report_time || order.created_at);
      const photos = Array.isArray(order.photos) ? order.photos.slice(0, 3) : [];

      this.setData({
        loading: false,
        formData: {
          orderCode: order.order_number || '',
          floor: order.floor || '',
          location: order.location || '',
          category: order.order_category || '',
          responsible: order.responsible_party || '',
          priority: order.priority || '',
          reportTime,
          description: order.description || '',
          status: statusTextMap[order.status] || order.status || '',
          reporter: order.submitter?.name || order.submitter_name || '',
          images: photos,
          remarks: order.remark || ''
        },
        selectedPriority: order.priority || ''
      });

      this.updatePhotoSlots();
    } catch (error) {
      console.error('[Edit] Load work order error:', error);
      this.setData({ loading: false });
      wx.showModal({
        title: '加载失败',
        content: error.message || '加载工单失败',
        showCancel: false,
        success: () => wx.navigateBack()
      });
    }
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

  // --- 通用选择器逻辑 ---
  openSelector(e) {
    const type = e.currentTarget.dataset.type;
    let options = [];
    let currentValue = '';

    switch(type) {
      case 'floor':
        options = this.data.floorOptions;
        currentValue = this.data.formData.floor || '';
        break;
      case 'category':
        options = this.data.categoryOptions;
        currentValue = this.data.formData.category || '';
        break;
      case 'party':
        options = this.data.responsibleOptions;
        currentValue = this.data.formData.responsible || '';
        break;
    }

    this.setData({
      isSelectorOpen: true,
      selectorOptions: options,
      selectorType: type,
      selectorCurrentValue: currentValue
    });
  },

  closeSelector() {
    this.setData({ isSelectorOpen: false });
  },

  onSelectorConfirm(e) {
    const selectedValue = e.detail.value;
    const type = this.data.selectorType;

    const updates = { isSelectorOpen: false };

    if (type === 'floor') {
      updates['formData.floor'] = selectedValue;
    } else if (type === 'category') {
      updates['formData.category'] = selectedValue;
    } else if (type === 'party') {
      updates['formData.responsible'] = selectedValue;
    }

    this.setData(updates);
  },

  // 优先级按钮点击
  onPrioritySelect(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({
      selectedPriority: key,
      'formData.priority': key
    });
  },

  onResponsiblePartySelect(e) {
    this.setData({ 'formData.responsible': e.currentTarget.dataset.value });
  },

  // 显示日期时间选择器
  showDateTimePicker() {
    // 解析当前报修时间
    const reportTime = this.data.formData.reportTime || '';
    let tempDate = '';
    let tempTime = '';
    if (reportTime) {
      const parts = reportTime.split(' ');
      tempDate = parts[0] || '';
      tempTime = parts[1] || '';
    }
    this.setData({
      isDateTimePickerOpen: true,
      tempDate: tempDate,
      tempTime: tempTime
    });
  },

  // 关闭日期时间选择器
  closeDateTimePicker() {
    this.setData({ isDateTimePickerOpen: false });
  },

  // 临时日期变化
  onTempDateChange(e) {
    this.setData({ tempDate: e.detail.value });
  },

  // 临时时间变化
  onTempTimeChange(e) {
    this.setData({ tempTime: e.detail.value });
  },

  // 取消日期时间选择
  cancelDateTimePicker() {
    this.setData({ isDateTimePickerOpen: false });
  },

  // 确认日期时间选择
  confirmDateTimePicker() {
    const { tempDate, tempTime } = this.data;
    if (tempDate && tempTime) {
      this.setData({
        'formData.reportTime': `${tempDate} ${tempTime}`,
        displayDateTime: tempDate,
        isDateTimePickerOpen: false
      });
    } else {
      wx.showToast({ title: '请选择完整时间', icon: 'none' });
    }
  },

  // 阻止事件冒泡
  stopPropagation() { },

  // 添加图片（使用智能压缩：50-130KB）
  handleAddImage(e) {
    const index = e.currentTarget.dataset.index;

    wx.chooseImage({
      count: 1,
      sizeType: ['original'], // 获取原图，由 smartCompress 决定是否压缩
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempFilePath = res.tempFilePaths[0];

        // 智能压缩图片（使用工单预设：50-130KB）
        const result = await smartCompress(tempFilePath, COMPRESS_PRESETS.WORKORDER);
        console.log('[Edit] Image processed:', {
          compressed: result.compressed,
          size: (result.size / 1024).toFixed(1) + 'KB'
        });

        const images = [...this.data.formData.images];

        // 如果该位置已有图片，替换；否则添加
        if (index < images.length) {
          images[index] = result.path;
        } else {
          images.push(result.path);
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
    const { formData } = this.data;

    const floor = (formData.floor || '').trim();
    const location = (formData.location || '').trim();
    const category = (formData.category || '').trim();
    const responsible = (formData.responsible || '').trim();
    const priority = (formData.priority || '').trim();
    const description = (formData.description || '').trim();
    const reportTime = (formData.reportTime || '').trim();
    const remarks = (formData.remarks || '').trim();
    const images = Array.isArray(formData.images) ? formData.images.filter(Boolean).slice(0, 3) : [];

    if (!floor) return wx.showToast({ title: '请填写楼层', icon: 'none' });
    if (!location) return wx.showToast({ title: '请填写具体位置', icon: 'none' });
    if (!category) return wx.showToast({ title: '请选择工单类别', icon: 'none' });
    if (!responsible) return wx.showToast({ title: '请选择责任方', icon: 'none' });
    if (!priority) return wx.showToast({ title: '请选择优先级', icon: 'none' });
    if (!reportTime || !reportTime.includes(' ')) return wx.showToast({ title: '请选择报修时间', icon: 'none' });
    if (!description) return wx.showToast({ title: '请填写问题描述', icon: 'none' });
    if (images.length === 0) return wx.showToast({ title: '请至少上传一张现场照片', icon: 'none' });

    wx.showModal({
      title: '确认保存',
      content: '确定保存本次修改吗？',
      success: async (res) => {
        if (!res.confirm) return;

        try {
          wx.showLoading({ title: '保存中...', mask: true });

          const uploadedPhotoUrls = [];
          for (let i = 0; i < images.length; i++) {
            const filePath = images[i];
            if (typeof filePath === 'string' && filePath.startsWith('cloud://')) {
              uploadedPhotoUrls.push(filePath);
              continue;
            }

            const cloudPath = `work-orders/${this.data.orderId}/edit-${Date.now()}-${i}.jpg`;
            const uploadResult = await wx.cloud.uploadFile({
              cloudPath,
              filePath
            });
            uploadedPhotoUrls.push(uploadResult.fileID);
          }

          const [reportDate, reportClock] = reportTime.split(' ');

          await workOrderService.updateWorkOrderDetails(parseInt(this.data.orderId, 10), {
            floor,
            location,
            order_category: category,
            responsible_party: responsible,
            priority,
            report_date: reportDate,
            report_time: reportClock,
            description,
            photos: uploadedPhotoUrls,
            remark: remarks
          });

          wx.hideLoading();
          wx.showToast({ title: '保存成功', icon: 'success' });

          setTimeout(() => {
            wx.redirectTo({
              url: `/pages/work-order-detail/index?id=${this.data.orderId}`,
              fail: () => wx.navigateBack()
            });
          }, 600);
        } catch (error) {
          wx.hideLoading();
          console.error('[Edit] Save error:', error);
          wx.showModal({
            title: '保存失败',
            content: error.message || '保存失败，请重试',
            showCancel: false
          });
        }
      }
    });
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
