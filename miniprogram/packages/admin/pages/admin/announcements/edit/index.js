/**
 * Announcement Edit Page
 * 公告编辑页面 - 支持富文本编辑
 */

const cloudDB = require('../../../../services/cloudDatabase');
const { ROLES, ROLE_DISPLAY_NAMES, STORAGE_KEYS } = require('../../../../utils/constants');

Page({
  data: {
    isEdit: false,
    announcementId: null,
    saving: false,
    formData: {
      title: '',
      content: '',
      visible_roles: [1, 2, 3, 4],
      expire_date: ''
    },
    roleOptions: [
      { value: 1, label: '系统管理员', checked: true },
      { value: 2, label: '物业经理', checked: true },
      { value: 3, label: '维修员', checked: true },
      { value: 4, label: '物业员工', checked: true }
    ]
  },

  editorCtx: null,

  onLoad(options) {
    this.checkAdminPermission();

    if (options.id) {
      this.setData({
        isEdit: true,
        announcementId: options.id
      });
      wx.setNavigationBarTitle({ title: '编辑公告' });
      this.loadAnnouncement(options.id);
    } else {
      wx.setNavigationBarTitle({ title: '新建公告' });
    }
  },

  /**
   * 检查管理员权限
   */
  checkAdminPermission() {
    const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO);
    if (!userInfo || userInfo.role_id !== ROLES.ADMIN) {
      wx.showToast({
        title: '无权限访问',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  /**
   * 加载公告详情
   */
  async loadAnnouncement(id) {
    try {
      wx.showLoading({ title: '加载中...' });
      const result = await cloudDB.announcements.get(id);

      if (result) {
        // 更新表单数据
        const formData = {
          title: result.title || '',
          content: result.content || '',
          visible_roles: result.visible_roles || [1, 2, 3, 4],
          expire_date: result.expire_date ? this.formatDate(result.expire_date) : ''
        };

        // 更新角色选中状态
        const roleOptions = this.data.roleOptions.map(role => ({
          ...role,
          checked: formData.visible_roles.includes(role.value)
        }));

        this.setData({ formData, roleOptions });

        // 设置编辑器内容
        if (this.editorCtx && formData.content) {
          this.editorCtx.setContents({
            html: formData.content
          });
        }
      }

      wx.hideLoading();
    } catch (error) {
      wx.hideLoading();
      console.error('[AnnouncementEdit] Load error:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  /**
   * 格式化日期
   */
  formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  /**
   * 编辑器准备就绪
   */
  onEditorReady() {
    this.createSelectorQuery()
      .select('#editor')
      .context(res => {
        this.editorCtx = res.context;

        // 如果是编辑模式且已有内容，设置内容
        if (this.data.isEdit && this.data.formData.content) {
          this.editorCtx.setContents({
            html: this.data.formData.content
          });
        }
      })
      .exec();
  },

  /**
   * 编辑器内容变化
   */
  onEditorInput(e) {
    this.setData({
      'formData.content': e.detail.html
    });
  },

  /**
   * 格式化文本
   */
  formatText(e) {
    const type = e.currentTarget.dataset.type;
    if (this.editorCtx) {
      this.editorCtx.format(type);
    }
  },

  /**
   * 插入有序列表
   */
  insertOrderedList() {
    if (this.editorCtx) {
      this.editorCtx.format('list', 'ordered');
    }
  },

  /**
   * 插入无序列表
   */
  insertUnorderedList() {
    if (this.editorCtx) {
      this.editorCtx.format('list', 'bullet');
    }
  },

  /**
   * 撤销
   */
  undo() {
    if (this.editorCtx) {
      this.editorCtx.undo();
    }
  },

  /**
   * 重做
   */
  redo() {
    if (this.editorCtx) {
      this.editorCtx.redo();
    }
  },

  /**
   * 标题输入
   */
  onTitleInput(e) {
    this.setData({
      'formData.title': e.detail.value
    });
  },

  /**
   * 切换角色选中状态
   */
  toggleRole(e) {
    const value = e.currentTarget.dataset.value;
    const roleOptions = this.data.roleOptions.map(role => {
      if (role.value === value) {
        return { ...role, checked: !role.checked };
      }
      return role;
    });

    const visible_roles = roleOptions
      .filter(role => role.checked)
      .map(role => role.value);

    this.setData({
      roleOptions,
      'formData.visible_roles': visible_roles
    });
  },

  /**
   * 选择过期日期
   */
  onExpireDateChange(e) {
    this.setData({
      'formData.expire_date': e.detail.value
    });
  },

  /**
   * 清除过期日期
   */
  clearExpireDate() {
    this.setData({
      'formData.expire_date': ''
    });
  },

  /**
   * 保存公告
   */
  async saveAnnouncement() {
    const { formData, isEdit, announcementId } = this.data;

    // 验证
    if (!formData.title.trim()) {
      wx.showToast({
        title: '请输入公告标题',
        icon: 'none'
      });
      return;
    }

    if (!formData.content.trim()) {
      wx.showToast({
        title: '请输入公告内容',
        icon: 'none'
      });
      return;
    }

    if (formData.visible_roles.length === 0) {
      wx.showToast({
        title: '请选择可见角色',
        icon: 'none'
      });
      return;
    }

    this.setData({ saving: true });

    try {
      const data = {
        title: formData.title.trim(),
        content: formData.content,
        visible_roles: formData.visible_roles,
        expire_date: formData.expire_date || null
      };

      if (isEdit) {
        await cloudDB.announcements.update(announcementId, data);
      } else {
        await cloudDB.announcements.create(data);
      }

      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);

    } catch (error) {
      console.error('[AnnouncementEdit] Save error:', error);
      wx.showToast({
        title: error.message || '保存失败',
        icon: 'none'
      });
    } finally {
      this.setData({ saving: false });
    }
  }
});
