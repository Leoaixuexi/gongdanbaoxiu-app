/**
 * 导航栏高度工具
 * 统一计算 statusBarHeight / navBarHeight / headerHeight
 */

let _cache = null;

/**
 * 获取导航栏相关高度
 * @returns {{ statusBarHeight: number, navBarHeight: number, headerHeight: number }}
 */
function getNavBarInfo() {
  if (_cache) return _cache;

  const systemInfo = wx.getSystemInfoSync();
  const statusBarHeight = systemInfo.statusBarHeight || 20;
  const navBarHeight = 88 * systemInfo.windowWidth / 750;
  const headerHeight = statusBarHeight + navBarHeight;

  _cache = { statusBarHeight, navBarHeight, headerHeight };
  return _cache;
}

module.exports = { getNavBarInfo };
