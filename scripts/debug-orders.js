/**
 * 调试脚本 - 检查工单显示问题
 *
 * 使用方法:
 * 1. 在微信开发者工具的控制台中运行此脚本
 * 2. 或者将代码复制到 pages/index/index.js 的 onLoad 中临时调试
 */

// 步骤1: 检查当前用户信息
async function checkCurrentUser() {
  const storage = require('../miniprogram/services/storage');
  const { STORAGE_KEYS } = require('../miniprogram/utils/constants');

  const userInfo = await storage.get(STORAGE_KEYS.USER_INFO);
  console.log('=== 当前用户信息 ===');
  console.log('User ID:', userInfo?.user_id || userInfo?.id);
  console.log('Role ID:', userInfo?.role_id);
  console.log('Name:', userInfo?.name);
  console.log('完整信息:', userInfo);

  return userInfo;
}

// 步骤2: 直接查询数据库中的工单
async function checkDatabaseOrders() {
  console.log('\n=== 查询云数据库中的工单 ===');

  try {
    const db = wx.cloud.database();
    const result = await db.collection('work_orders')
      .orderBy('created_at', 'desc')
      .get();

    console.log('数据库中共有工单数:', result.data.length);

    result.data.forEach((order, index) => {
      console.log(`\n工单 ${index + 1}:`);
      console.log('  Order ID:', order.order_id);
      console.log('  Order Number:', order.order_number);
      console.log('  Status:', order.status);
      console.log('  Location:', order.floor, order.location);
      console.log('  Submitter User ID:', order.submitter?.user_id);
      console.log('  Submitter Name:', order.submitter?.name);
      console.log('  Created At:', order.created_at);
    });

    return result.data;
  } catch (error) {
    console.error('查询数据库失败:', error);
    return [];
  }
}

// 步骤3: 测试云函数调用
async function testCloudFunction(userId) {
  console.log('\n=== 测试云函数获取工单 ===');
  console.log('使用 User ID:', userId);

  try {
    const result = await wx.cloud.callFunction({
      name: 'workOrderManager',
      data: {
        action: 'list',
        data: {
          user_id: userId,
          filters: {}
        }
      }
    });

    console.log('云函数返回结果:');
    console.log('  Success:', result.result?.success);
    console.log('  Total:', result.result?.total);
    console.log('  Orders:', result.result?.orders?.length);

    if (result.result?.orders) {
      result.result.orders.forEach((order, index) => {
        console.log(`\n  工单 ${index + 1}:`);
        console.log('    Order Number:', order.order_number);
        console.log('    Status:', order.status);
        console.log('    Location:', order.location);
      });
    }

    return result.result;
  } catch (error) {
    console.error('云函数调用失败:', error);
    return null;
  }
}

// 主函数
async function main() {
  console.log('开始调试工单显示问题...\n');

  const userInfo = await checkCurrentUser();
  const allOrders = await checkDatabaseOrders();

  if (userInfo) {
    const userId = userInfo.user_id || userInfo.id;
    await testCloudFunction(userId);
  }

  console.log('\n=== 调试完成 ===');
  console.log('\n如果数据库中有工单但云函数返回为空,可能原因:');
  console.log('1. 角色过滤: role_id=4的用户只能看到自己提交的工单');
  console.log('2. 测试工单的submitter.user_id与当前用户不匹配');
  console.log('\n建议解决方案:');
  console.log('1. 创建与当前用户ID匹配的测试工单');
  console.log('2. 或者临时使用管理员账号登录(role_id=1或2)');
}

// 导出供外部调用
module.exports = {
  checkCurrentUser,
  checkDatabaseOrders,
  testCloudFunction,
  main
};

// 如果在浏览器控制台直接运行
if (typeof wx !== 'undefined') {
  main();
}
