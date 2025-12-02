/**
 * Password Migration Script
 * 密码迁移脚本：将明文密码迁移到加密格式
 *
 * 使用方法：
 * 1. 在微信开发者工具中打开项目
 * 2. 打开云开发控制台
 * 3. 找到 userAuth 云函数
 * 4. 点击"测试"，输入以下参数：
 *
 * {
 *   "action": "migratePasswords",
 *   "test_openid": "YOUR_ADMIN_OPENID"
 * }
 *
 * 注意：
 * - 需要使用系统管理员的 openid (role_id = 1)
 * - 此操作会更新所有明文密码为加密格式
 * - 已加密的密码会自动跳过
 */

// 如果在小程序中调用，可以使用以下代码
// 确保当前登录用户是系统管理员

async function migratePasswords() {
  try {
    wx.showLoading({
      title: '迁移中...',
      mask: true
    });

    const result = await wx.cloud.callFunction({
      name: 'userAuth',
      data: {
        action: 'migratePasswords'
      }
    });

    wx.hideLoading();

    if (result.result.success) {
      const stats = result.result.stats;
      wx.showModal({
        title: '迁移成功',
        content: `总用户数：${stats.total_users}\n迁移成功：${stats.migrated}\n跳过（已加密）：${stats.skipped}\n失败：${stats.errors}`,
        showCancel: false
      });

      console.log('[Migration] Stats:', stats);
      if (result.result.failed_users && result.result.failed_users.length > 0) {
        console.error('[Migration] Failed users:', result.result.failed_users);
      }
    } else {
      wx.showModal({
        title: '迁移失败',
        content: result.result.error || '未知错误',
        showCancel: false
      });
    }
  } catch (error) {
    wx.hideLoading();
    wx.showModal({
      title: '执行失败',
      content: error.message || '网络错误',
      showCancel: false
    });
    console.error('[Migration] Error:', error);
  }
}

// 导出函数供其他模块使用
module.exports = {
  migratePasswords
};
