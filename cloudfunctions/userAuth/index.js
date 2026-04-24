/**
 * 用户认证云函数 - 路由入口
 * 处理用户登录、注册、信息更新
 */

const { cloud, getUserByOpenId } = require('./helpers');

// 处理器模块
const {
  handlePasswordLogin,
  handleLogin,
  handleChangePassword,
  handleResetUserPassword
} = require('./handlers/auth');

const {
  handleListUsers,
  handleCreateUser,
  handleUpdateUser,
  handleDeleteUser,
  handleEnableUser,
  handleDisableUser,
  handleGetUserById,
  handleUpdateProfile,
  handleGetSupervisors,
  handleGetPropertyStaffList
} = require('./handlers/users');

const {
  handleListAnnouncements,
  handleGetAnnouncement,
  handleCreateAnnouncement,
  handleUpdateAnnouncement,
  handlePublishAnnouncement,
  handleOfflineAnnouncement,
  handleDeleteAnnouncement
} = require('./handlers/announcements');

const {
  handleListRoles,
  handleUpdateRolePermissions,
  handleListAuditLogs,
  handleGetAuditLogActions,
  handleGetSystemConfig,
  handleUpdateSystemConfig,
  handleBatchUpdateSystemConfig
} = require('./handlers/system');

/**
 * 主函数
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { action, data = {}, test_openid, adminToken } = event;

  // 测试模式：允许在控制台测试时指定 openid
  // 安全措施：需同时满足以下条件：
  // 1. 传入 test_openid
  // 2. 环境变量 ALLOW_TEST_OPENID 设为 'true'（生产环境应删除此变量）
  // 3. adminToken 匹配环境变量 ADMIN_TOKEN
  const requiredAdminToken = process.env.ADMIN_TOKEN;
  const canUseTestOpenid = !!(
    test_openid &&
    process.env.ALLOW_TEST_OPENID === 'true' &&
    requiredAdminToken &&
    adminToken === requiredAdminToken
  );
  const openid = canUseTestOpenid ? test_openid : wxContext.OPENID;

  console.log(
    `[UserAuth] Action: ${action}, OpenID: ${openid || 'N/A'}${canUseTestOpenid ? ' (TEST MODE)' : ''}`
  );

  // 获取当前用户的辅助函数（只信任云函数上下文的 openid）
  const getCurrentUser = async () => {
    if (openid) {
      return await getUserByOpenId(openid);
    }
    return null;
  };

  try {
    switch (action) {
      // ============ 认证 ============
      case 'passwordLogin':
        return await handlePasswordLogin(openid, data);

      case 'login':
      case 'getUserInfo':
        return await handleLogin(openid, data);

      case 'changePassword':
        return await handleChangePassword(openid, data, getCurrentUser);

      case 'resetUserPassword':
        return await handleResetUserPassword(openid, data, getCurrentUser);

      // ============ 用户管理 ============
      case 'listUsers':
        return await handleListUsers(openid, data, getCurrentUser);

      case 'createUser':
        return await handleCreateUser(openid, data, getCurrentUser);

      case 'updateUser':
        return await handleUpdateUser(openid, data, getCurrentUser);

      case 'deleteUser':
        return await handleDeleteUser(openid, data, getCurrentUser);

      case 'enableUser':
        return await handleEnableUser(openid, data, getCurrentUser);

      case 'disableUser':
        return await handleDisableUser(openid, data, getCurrentUser);

      case 'getUserById':
        return await handleGetUserById(openid, data);

      case 'updateProfile':
        return await handleUpdateProfile(openid, data);

      case 'getSupervisors':
        return await handleGetSupervisors(openid, data);

      case 'getPropertyStaffList':
        return await handleGetPropertyStaffList(openid, data);

      // ============ 公告管理 ============
      case 'listAnnouncements':
        return await handleListAnnouncements(openid, data, getCurrentUser);

      case 'getAnnouncement':
        return await handleGetAnnouncement(openid, data);

      case 'createAnnouncement':
        return await handleCreateAnnouncement(openid, data, getCurrentUser);

      case 'updateAnnouncement':
        return await handleUpdateAnnouncement(openid, data, getCurrentUser);

      case 'publishAnnouncement':
        return await handlePublishAnnouncement(openid, data, getCurrentUser);

      case 'offlineAnnouncement':
        return await handleOfflineAnnouncement(openid, data, getCurrentUser);

      case 'deleteAnnouncement':
        return await handleDeleteAnnouncement(openid, data, getCurrentUser);

      // ============ 系统管理 ============
      case 'listRoles':
        return await handleListRoles(openid, data, getCurrentUser);

      case 'updateRolePermissions':
        return await handleUpdateRolePermissions(openid, data, getCurrentUser);

      case 'listAuditLogs':
        return await handleListAuditLogs(openid, data, getCurrentUser);

      case 'getAuditLogActions':
        return await handleGetAuditLogActions(openid, data);

      case 'getSystemConfig':
        return await handleGetSystemConfig(openid, data);

      case 'updateSystemConfig':
        return await handleUpdateSystemConfig(openid, data, getCurrentUser);

      case 'batchUpdateSystemConfig':
        return await handleBatchUpdateSystemConfig(openid, data, getCurrentUser);

      default:
        return {
          success: false,
          error: `未知操作: ${action}`,
          available_actions: [
            'login', 'passwordLogin', 'getUserInfo', 'updateProfile', 'getUserById',
            'listUsers', 'listRoles', 'updateRolePermissions', 'changePassword',
            'createUser', 'updateUser', 'deleteUser', 'getSupervisors', 'getPropertyStaffList',
            'enableUser', 'disableUser', 'resetUserPassword',
            'listAnnouncements', 'getAnnouncement', 'createAnnouncement', 'updateAnnouncement',
            'publishAnnouncement', 'offlineAnnouncement', 'deleteAnnouncement',
            'listAuditLogs', 'getAuditLogActions',
            'getSystemConfig', 'updateSystemConfig', 'batchUpdateSystemConfig'
          ]
        };
    }

  } catch (error) {
    console.error('[UserAuth] Error:', error);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
};
