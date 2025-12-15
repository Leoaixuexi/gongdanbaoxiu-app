/**
 * 获取工单状态分布数据（用于环形图）
 * 物业经理数据分析 - Tab2 可视化图表
 */

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { startDate, endDate } = event;

  try {
    // 转换日期字符串为Date对象
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // 使用聚合管道统计各状态工单数量
    const result = await db.collection('workorders')
      .aggregate()
      .match({
        created_at: _.gte(start).and(_.lte(end))
      })
      .group({
        _id: '$status',
        count: _.sum(1)
      })
      .end();

    // 状态映射
    const statusMap = {
      'Pending Repair': '待维修',
      'In Progress': '维修中',
      'Repaired': '已修复',
      'Completed': '已完成'
    };

    // 转换为ECharts格式
    const data = result.list.map(item => ({
      name: statusMap[item._id] || item._id,
      value: item.count
    }));

    // 确保所有状态都有数据（即使为0）
    const allStatuses = ['待维修', '维修中', '已修复', '已完成'];
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
