/**
 * 新增/编辑分类 — 独立页（替换原 wx.showModal）
 *
 * 路由参数：
 *   mode  - 'create' | 'edit'（默认 create）
 *   value - 编辑模式下定位的分类 value
 *
 * 入参（EventChannel）：传入完整分类列表，避免重复请求
 *   acceptItems: { items: Array }
 *
 * 出参（EventChannel）：保存成功后通知上游刷新
 *   onSaved: { items: Array }
 *
 * 数据落盘：将 parent / icon 写入 item.extra（不破坏 dictionaryManager schema）
 */

const dictionaryAdmin = require('../../../../services/dictionaryAdmin');
const dictionary = require('../../../../services/dictionary');
const { getNavBarInfo } = require('../../../../utils/navigation');

const ICON_OPTIONS = [
  { key: 'folder',  name: 'orders-o',  tone: 'blue',   color: '#2563EB' },
  { key: 'shop',    name: 'shop-o',    tone: 'green',  color: '#16A34A' },
  { key: 'bag',     name: 'bag-o',     tone: 'orange', color: '#EA580C' },
  { key: 'flag',    name: 'flag-o',    tone: 'purple', color: '#7C3AED' },
  { key: 'printer', name: 'after-sale',tone: 'teal',   color: '#0D9488' },
  { key: 'cart',    name: 'cart-o',    tone: 'pink',   color: '#DB2777' },
  { key: 'gift',    name: 'gift-o',    tone: 'yellow', color: '#D97706' },
  { key: 'fire',    name: 'fire-o',    tone: 'red',    color: '#DC2626' },
  { key: 'star',    name: 'star-o',    tone: 'indigo', color: '#4F46E5' },
  { key: 'setting', name: 'setting-o', tone: 'blue',   color: '#2563EB' },
  { key: 'apps',    name: 'apps-o',    tone: 'green',  color: '#16A34A' },
  { key: 'bulb',    name: 'bulb-o',    tone: 'orange', color: '#EA580C' },
];

const DEFAULT_VISIBLE = 5;

Page({
  data: {
    headerHeight: 0,
    pageTitle: '新增分类',
    mode: 'create',
    editingValue: '',          // 编辑模式下的目标分类 value
    name: '',
    nameLen: 0,
    parentValue: '',
    parentLabel: '',
    selectedIcon: 'folder',

    visibleIcons: ICON_OPTIONS.slice(0, DEFAULT_VISIBLE),
    allIcons: ICON_OPTIONS,

    parentPopupVisible: false,
    moreIconsVisible: false,

    items: [],                 // 上游传入的完整分类列表
    parentOptions: [],         // 可选上级（一级分类，且非自身）

    saving: false,
  },

  onLoad(query) {
    const { headerHeight } = getNavBarInfo();
    const mode = query && query.mode === 'edit' ? 'edit' : 'create';
    const editingValue = query && query.value ? decodeURIComponent(query.value) : '';
    const pageTitle = mode === 'edit' ? '编辑分类' : '新增分类';

    this.setData({
      headerHeight: Math.ceil(headerHeight),
      pageTitle,
      mode,
      editingValue,
    });

    // 通过 EventChannel 接收上游已加载的分类列表
    const eventChannel = this.getOpenerEventChannel && this.getOpenerEventChannel();
    if (eventChannel && typeof eventChannel.on === 'function') {
      eventChannel.on('acceptItems', ({ items }) => {
        this._applyItems(items || [], { mode, editingValue });
      });
    } else {
      // Fallback：自行加载
      this._loadCategoriesFallback({ mode, editingValue });
    }
  },

  async _loadCategoriesFallback({ mode, editingValue }) {
    try {
      const res = await dictionaryAdmin.getDictionary('product_category');
      if (res && res.success && res.data) {
        const items = (res.data.items || []).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0));
        this._applyItems(items, { mode, editingValue });
      }
    } catch (e) {
      console.error('[CategoryEdit] fallback load error:', e);
    }
  },

  _applyItems(items, { mode, editingValue }) {
    const enabledItems = items.filter(i => i.enabled !== false);
    const parentOptions = enabledItems
      .filter(i => !(i.extra && i.extra.parent))   // 仅一级可作为上级
      .filter(i => !editingValue || i.value !== editingValue) // 不能选自身
      .map(i => ({ value: i.value, label: i.label || i.value }));

    let patch = { items, parentOptions };

    if (mode === 'edit' && editingValue) {
      const target = items.find(i => i.value === editingValue);
      if (target) {
        const parent = (target.extra && target.extra.parent) || '';
        const parentItem = parent ? items.find(i => i.value === parent) : null;
        patch.name = target.label || '';
        patch.nameLen = (target.label || '').length;
        patch.parentValue = parent;
        patch.parentLabel = parentItem ? (parentItem.label || parentItem.value) : '';
        patch.selectedIcon = (target.extra && target.extra.icon) || 'folder';
      }
    }

    this.setData(patch);
  },

  // ===== 输入 =====
  onNameInput(e) {
    const v = (e.detail.value || '').slice(0, 20);
    this.setData({ name: v, nameLen: v.length });
  },

  // ===== 上级分类 =====
  onPickParent() {
    this.setData({ parentPopupVisible: true });
  },

  onParentPopupClose() {
    this.setData({ parentPopupVisible: false });
  },

  onParentPick(e) {
    const { value, label } = e.currentTarget.dataset;
    this.setData({
      parentValue: value,
      parentLabel: label,
      parentPopupVisible: false,
    });
  },

  onParentClear() {
    this.setData({
      parentValue: '',
      parentLabel: '',
      parentPopupVisible: false,
    });
  },

  // ===== 图标 =====
  onIconTap(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ selectedIcon: key });
  },

  onShowMoreIcons() {
    this.setData({ moreIconsVisible: true });
  },

  onMoreIconsClose() {
    this.setData({ moreIconsVisible: false });
  },

  // ===== 底部操作 =====
  onCancel() {
    wx.navigateBack();
  },

  async onSave() {
    if (this.data.saving) return;

    const name = (this.data.name || '').trim();
    if (!name) {
      wx.showToast({ title: '请输入分类名称', icon: 'none' });
      return;
    }

    const items = this.data.items.slice();
    const isEdit = this.data.mode === 'edit' && !!this.data.editingValue;

    // 重名校验（启用项，排除自身）
    const dup = items.some(i =>
      i.enabled !== false &&
      i.label === name &&
      (!isEdit || i.value !== this.data.editingValue)
    );
    if (dup) {
      wx.showToast({ title: '该分类已存在', icon: 'none' });
      return;
    }

    const isFirstLevel = !this.data.parentValue;
    if (isFirstLevel && !this.data.selectedIcon) {
      wx.showToast({ title: '请选择分类图标', icon: 'none' });
      return;
    }

    const extra = {
      ...(this.data.parentValue ? { parent: this.data.parentValue } : {}),
      ...(isFirstLevel ? { icon: this.data.selectedIcon } : {}),
    };

    let nextItems;
    if (isEdit) {
      nextItems = items.map(i =>
        i.value === this.data.editingValue
          ? { ...i, label: name, value: name, extra: { ...(i.extra || {}), ...extra } }
          : i
      );
    } else {
      nextItems = [
        ...items,
        {
          value: name,
          label: name,
          sort: items.length,
          enabled: true,
          extra,
        },
      ];
    }

    this.setData({ saving: true });
    try {
      const result = await dictionaryAdmin.updateDictionary('product_category', nextItems);
      if (result && result.success) {
        dictionary.refreshCache('product_category');
        // 通知上游刷新
        const eventChannel = this.getOpenerEventChannel && this.getOpenerEventChannel();
        if (eventChannel && typeof eventChannel.emit === 'function') {
          eventChannel.emit('onSaved', { items: nextItems });
        }
        wx.showToast({ title: '保存成功', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 600);
      } else {
        this.setData({ saving: false });
        wx.showToast({ title: (result && result.error) || '保存失败', icon: 'none' });
      }
    } catch (e) {
      console.error('[CategoryEdit] save error:', e);
      this.setData({ saving: false });
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },
});
