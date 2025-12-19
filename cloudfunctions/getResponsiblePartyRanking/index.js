/**
 * 获取责任方已修复工单排名
 * 物业经理数据分析 - Tab1 数据统计
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
      return { success: false, error: '无法获取微信身份，请在小程序内操作', data: [] };
    }

    const { user, permissions } = await getCurrentUserAndPermissions(openid);
    if (!(user.role_id === 1 || hasModulePermission(permissions, 'view_analytics'))) {
      return { success: false, error: '无权限查看数据分析', data: [] };
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // 聚合统计各责任方已完成工单数量
    const result = await db.collection('work_orders')
      .aggregate()
      .match({
        status: _.in(['Completed', '已完成']),
        created_at: _.gte(start).and(_.lte(end))
      })
      .group({
        _id: '$responsible_party',
        count: $.sum(1)
      })
      .sort({
        count: -1  // 按数量降序
      })
      .end();

    // 计算总数用于百分比
    const total = result.list.reduce((sum, item) => sum + item.count, 0);

    // 转换为排名格式
    const rankings = result.list.map(item => ({
      responsibleParty: item._id || '未知',
      completedCount: item.count,
      percentage: total > 0 ? ((item.count / total) * 100).toFixed(1) : '0.0'
    }));

    return {
      success: true,
      data: rankings
    };

  } catch (error) {
    console.error('getResponsiblePartyRanking error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
