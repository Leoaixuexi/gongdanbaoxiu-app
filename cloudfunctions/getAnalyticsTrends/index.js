/**
 * 云函数：getAnalyticsTrends
 * 功能：获取工单趋势数据（折线图）
 * 返回：每日已提报和已完成工单数量
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

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
  try {
    const { startDate, endDate } = event;

    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    if (!openid) {
      return { success: false, error: '无法获取微信身份，请在小程序内操作', data: { categories: [], reported: [], completed: [] } };
    }

    const { user, permissions } = await getCurrentUserAndPermissions(openid);
    if (user.role_id === 3) {
      return { success: false, error: '无权限查看数据分析' };
    }
    if (!(user.role_id === 1 || user.role_id === 4 || hasModulePermission(permissions, 'view_analytics'))) {
      return { success: false, error: '无权限查看数据分析', data: { categories: [], reported: [], completed: [] } };
    }

    // 处理日期参数 - 为空时查询所有数据
    let whereCondition = {};
    let start, end;
    if (startDate && endDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      whereCondition = { created_at: _.gte(start).and(_.lte(end)) };
    }

    // 获取工单数据
    const { data: orders } = await db.collection('work_orders')
      .where(whereCondition)
      .field({
        created_at: true,
        completed_at: true,
        status: true
      })
      .limit(1000)
      .get();

    // 如果没有指定日期范围，从数据中获取日期范围
    if (!startDate || !endDate) {
      if (orders.length === 0) {
        return {
          success: true,
          data: { categories: [], reported: [], completed: [] }
        };
      }
      // 找出最早和最晚的日期
      const dates = orders.map(o => new Date(o.created_at));
      start = new Date(Math.min(...dates));
      end = new Date(Math.max(...dates));
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }

    // 生成日期列表
    const dates = [];
    const currentDate = new Date(start);
    while (currentDate <= end) {
      dates.push(formatDate(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // 统计每日数据
    const reportedByDate = {};
    const completedByDate = {};

    dates.forEach(date => {
      reportedByDate[date] = 0;
      completedByDate[date] = 0;
    });

    orders.forEach(order => {
      // 统计提报数量
      const createdDate = formatDate(new Date(order.created_at));
      if (reportedByDate[createdDate] !== undefined) {
        reportedByDate[createdDate]++;
      }

      // 统计完成数量
      if (['Completed', '已完成'].includes(order.status) && order.completed_at) {
        const completedDate = formatDate(new Date(order.completed_at));
        if (completedByDate[completedDate] !== undefined) {
          completedByDate[completedDate]++;
        }
      }
    });

    // 格式化返回数据
    const categories = dates.map(d => d.substring(5)); // MM-DD格式
    const reportedValues = dates.map(d => reportedByDate[d]);
    const completedValues = dates.map(d => completedByDate[d]);

    return {
      success: true,
      data: {
        categories,
        reported: reportedValues,
        completed: completedValues
      }
    };
  } catch (error) {
    console.error('getAnalyticsTrends error:', error);
    return {
      success: false,
      error: error.message,
      data: { categories: [], reported: [], completed: [] }
    };
  }
};

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
