/**
 * 获取工单状态分布数据（用于环形图）
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

    const normalizeStatus = (status) => {
      const map = {
        '已提报': 'Pending Repair',
        '待接单': 'Pending Repair',
        'Pending Repair': 'Pending Repair',
        '维修中': 'In Progress',
        'In Progress': 'In Progress',
        '已修复': 'Repaired',
        '已维修': 'Repaired',
        'Repaired': 'Repaired',
        '需返工': 'Needs Rework',
        'Needs Rework': 'Needs Rework',
        '已完成': 'Completed',
        'Completed': 'Completed'
      };
      return map[status] || status;
    };

    // 使用聚合管道统计各状态工单数量
    const result = await db.collection('work_orders')
      .aggregate()
      .match(matchCondition)
      .group({
        _id: '$status',
        count: $.sum(1)
      })
      .end();

    // 聚合结果可能包含老数据中文状态，先归一化再汇总
    const countsByNormalizedStatus = {};
    result.list.forEach((item) => {
      const normalized = normalizeStatus(item._id);
      countsByNormalizedStatus[normalized] = (countsByNormalizedStatus[normalized] || 0) + item.count;
    });

    // 状态映射（用于图表显示）
    const statusMap = {
      'Pending Repair': '已提报',
      'In Progress': '维修中',
      // 云端没有单独的“待复核”状态：Repaired 即待复核
      'Repaired': '待复核',
      'Needs Rework': '需返工',
      'Completed': '已完成'
    };

    // 转换为ECharts格式
    const data = Object.keys(countsByNormalizedStatus).map(status => ({
      name: statusMap[status] || status,
      value: countsByNormalizedStatus[status]
    }));

    // 确保所有状态都有数据（即使为0）
    const allStatuses = ['已提报', '维修中', '待复核', '需返工', '已完成'];
    const filledData = allStatuses.map(status => {
      const found = data.find(d => d.name === status);
      return found || { name: status, value: 0 };
    });

    return {
      success: true,
      data: filledData
    };

  } catch (error) {
    console.error('getAnalyticsByStatus error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
