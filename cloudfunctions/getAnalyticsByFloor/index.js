/**
 * 获取楼层分布数据（用于柱状图）
 * 行政经理数据分析 - Tab2 可视化图表
 */

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const $ = db.command.aggregate;

async function getCurrentUserAndPermissions(openid) {
  const users = db.collection('users');
  const roles = db.collection('roles');

  const { data: userData } = await users.where({ wechat_openid: openid }).get();
  const user = userData && userData.length > 0 ? userData[0] : null;
  if (!user) throw new Error('用户不存在');
  if (user.active === false) throw new Error('账号已被停用');

  const { data: roleData } = await roles.where({ role_id: user.role_id }).get();
  const role = roleData && roleData.length > 0 ? roleData[0] : null;
  const permissions = role?.permissions || {};

  return { user, permissions };
}

function hasModulePermission(permissions, moduleKey) {
  const modules = permissions?.modules;
  if (!modules) return false;
  if (Array.isArray(modules)) return modules.includes(moduleKey);
  if (typeof modules === 'object') return modules[moduleKey] === true;
  return false;
}

exports.main = async (event, context) => {
  const { startDate, endDate } = event;

  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    if (!openid) {
      return { success: false, error: '无法获取微信身份，请在小程序内操作' };
    }

    const { user, permissions } = await getCurrentUserAndPermissions(openid);
    if (user.role_id === 3) {
      return { success: false, error: '无权限查看数据分析' };
    }
    if (!(user.role_id === 1 || user.role_id === 4 || hasModulePermission(permissions, 'view_analytics'))) {
      return { success: false, error: '无权限查看数据分析' };
    }

    // 处理日期参数 - 为空时查询所有数据
    let matchCondition = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchCondition = { created_at: _.gte(start).and(_.lte(end)) };
    }

    // 聚合统计各楼层工单数量
    const result = await db.collection('work_orders')
      .aggregate()
      .match(matchCondition)
      .group({
        _id: '$floor',
        count: $.sum(1)
      })
      .end();

    // 按楼层逻辑顺序排序：B3→B2→B1→1楼→2楼→…
    const floorSortKey = name => {
      if (!name) return 9999;
      const s = String(name).trim().toUpperCase();
      if (s.startsWith('B')) return -(parseInt(s.slice(1)) || 0);
      return parseInt(s) || 9999;
    };
    const sorted = result.list.slice().sort((a, b) => floorSortKey(a._id) - floorSortKey(b._id));

    // 转换为ECharts格式
    const categories = sorted.map(item => item._id || '未知楼层');
    const data = sorted.map(item => item.count);

    return {
      success: true,
      data: {
        categories,
        values: data
      }
    };

  } catch (error) {
    console.error('getAnalyticsByFloor error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
