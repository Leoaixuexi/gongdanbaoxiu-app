/**
 * 获取位置/楼栋分布数据（用于柱状图）
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
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // 聚合统计各位置工单数量
    const result = await db.collection('workorders')
      .aggregate()
      .match({
        created_at: _.gte(start).and(_.lte(end))
      })
      .group({
        _id: '$location',
        count: _.sum(1)
      })
      .sort({
        count: -1  // 按数量降序
      })
      .end();

    // 转换为ECharts格式
    const categories = result.list.map(item => item._id || '未知位置');
    const data = result.list.map(item => item.count);

    return {
      success: true,
      data: {
        categories,
        values: data
      }
    };

  } catch (error) {
    console.error('getAnalyticsByLocation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
