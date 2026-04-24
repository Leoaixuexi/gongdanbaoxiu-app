/**
 * 数据分析服务
 * 封装所有分析类云函数调用
 */

const { callCloudSilent } = require('../utils/cloudCall');

/**
 * 获取总览数据
 */
const getOverview = async (startDate, endDate) => {
  const result = await callCloudSilent('getAnalyticsOverview', {
    startDate,
    endDate
  });
  return result;
};

/**
 * 获取员工排名
 */
const getEmployeeRanking = async (startDate, endDate) => {
  const result = await callCloudSilent('getEmployeeRanking', {
    startDate,
    endDate
  });
  return result;
};

/**
 * 获取按状态分布
 */
const getByStatus = async (startDate, endDate) => {
  const result = await callCloudSilent('getAnalyticsByStatus', {
    startDate,
    endDate
  });
  return result;
};

/**
 * 获取趋势数据
 */
const getTrends = async (startDate, endDate) => {
  const result = await callCloudSilent('getAnalyticsTrends', {
    startDate,
    endDate
  });
  return result;
};

/**
 * 获取按类别分布
 */
const getByCategory = async (startDate, endDate) => {
  const result = await callCloudSilent('getAnalyticsByCategory', {
    startDate,
    endDate
  });
  return result;
};

/**
 * 获取按责任方分布
 */
const getByResponsible = async (startDate, endDate) => {
  const result = await callCloudSilent('getAnalyticsByResponsible', {
    startDate,
    endDate
  });
  return result;
};

/**
 * 获取按楼层分布
 */
const getByFloor = async (startDate, endDate) => {
  const result = await callCloudSilent('getAnalyticsByFloor', {
    startDate,
    endDate
  });
  return result;
};

/**
 * 批量获取管理端所有分析数据
 */
const fetchAllManagerData = async (startDate, endDate) => {
  const [overview, ranking, statusData, trends, categoryData, responsibleData, floorData] = await Promise.all([
    getOverview(startDate, endDate),
    getEmployeeRanking(startDate, endDate),
    getByStatus(startDate, endDate),
    getTrends(startDate, endDate),
    getByCategory(startDate, endDate),
    getByResponsible(startDate, endDate),
    getByFloor(startDate, endDate)
  ]);

  return {
    overview,
    ranking,
    statusData,
    trends,
    categoryData,
    responsibleData,
    floorData
  };
};

module.exports = {
  getOverview,
  getEmployeeRanking,
  getByStatus,
  getTrends,
  getByCategory,
  getByResponsible,
  getByFloor,
  fetchAllManagerData
};
