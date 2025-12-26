/**
 * Cloud Database Service
 * 云数据库服务 - 封装所有云数据库操作
 */

const { STORAGE_KEYS, CLOUD_ENV_ID } = require('../utils/constants');

// 初始化云开发
if (!wx.cloud) {
  console.error('[CloudDB] wx.cloud is not available');
}

wx.cloud.init({
  env: CLOUD_ENV_ID,
  traceUser: true
});

const db = wx.cloud.database();
const _ = db.command;

/**
 * 获取当前用户ID（用于云函数权限验证）
 */
function getCurrentUserId() {
  try {
    const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO);
    return userInfo?.user_id || null;
  } catch (e) {
    return null;
  }
}

/**
 * 云数据库服务类
 */
class CloudDatabaseService {
  constructor() {
    this.db = db;
    this._ = _;
  }

  /**
   * 用户相关操作
   */
  users = {
    /**
     * 通过用户名和密码查找用户
     */
    findByCredentials: async (username, password) => {
      try {
        const result = await wx.cloud.callFunction({
          name: 'userAuth',
          data: { action: 'passwordLogin', data: { username, password } }
        });
        if (!result.result?.success) {
          throw new Error(result.result?.error || '登录失败');
        }
        return result.result;
      } catch (error) {
        console.error('[CloudDB] Find user error:', error);
        throw error;
      }
    },

    /**
     * 通过ID获取用户
     */
    findById: async (userId) => {
      try {
        const result = await wx.cloud.callFunction({
          name: 'userAuth',
          data: { action: 'getUserById', data: { user_id: userId } }
        });
        if (!result.result?.success) {
          throw new Error(result.result?.error || '获取用户失败');
        }
        return result.result.user;
      } catch (error) {
        console.error('[CloudDB] Find user by ID error:', error);
        throw error;
      }
    },

    /**
     * 获取用户列表
     */
    list: async (filters = {}) => {
      try {
        const result = await wx.cloud.callFunction({
          name: 'userAuth',
          data: { action: 'listUsers', data: filters }
        });
        if (!result.result?.success) {
          throw new Error(result.result?.error || '获取用户列表失败');
        }
        return result.result.users || [];
      } catch (error) {
        console.error('[CloudDB] List users error:', error);
        throw error;
      }
    },

    /**
     * 启用用户
     */
    enable: async (userId) => {
      try {
        const result = await wx.cloud.callFunction({
          name: 'userAuth',
          data: { action: 'enableUser', data: { user_id: userId }, current_user_id: getCurrentUserId() }
        });
        if (!result.result.success) {
          throw new Error(result.result.error || '启用用户失败');
        }
        return result.result;
      } catch (error) {
        console.error('[CloudDB] Enable user error:', error);
        throw error;
      }
    },

    /**
     * 停用用户
     */
    disable: async (userId) => {
      try {
        const result = await wx.cloud.callFunction({
          name: 'userAuth',
          data: { action: 'disableUser', data: { user_id: userId }, current_user_id: getCurrentUserId() }
        });
        if (!result.result.success) {
          throw new Error(result.result.error || '停用用户失败');
        }
        return result.result;
      } catch (error) {
        console.error('[CloudDB] Disable user error:', error);
        throw error;
      }
    },

    /**
     * 重置用户密码
     */
    resetPassword: async (userId) => {
      try {
        const result = await wx.cloud.callFunction({
          name: 'userAuth',
          data: { action: 'resetUserPassword', data: { user_id: userId }, current_user_id: getCurrentUserId() }
        });
        if (!result.result.success) {
          throw new Error(result.result.error || '重置密码失败');
        }
        return { newPassword: result.result.default_password };
      } catch (error) {
        console.error('[CloudDB] Reset password error:', error);
        throw error;
      }
    }
  };

  /**
   * 角色相关操作
   */
  roles = {
    /**
     * 获取所有角色
     */
    list: async () => {
      try {
        const result = await wx.cloud.callFunction({
          name: 'userAuth',
          data: { action: 'listRoles' }
        });
        if (!result.result?.success) {
          throw new Error(result.result?.error || '获取角色列表失败');
        }
        return result.result.roles || [];
      } catch (error) {
        console.error('[CloudDB] List roles error:', error);
        throw error;
      }
    },

    /**
     * 通过ID获取角色
     */
    findById: async (roleId) => {
      try {
        const roles = await this.roles.list();
        const role = (roles || []).find(r => r.role_id === roleId);
        if (!role) {
          throw new Error('角色不存在');
        }
        return role;
      } catch (error) {
        console.error('[CloudDB] Find role error:', error);
        throw error;
      }
    },

    /**
     * 更新角色权限
     */
    updatePermissions: async (roleId, permissions) => {
      try {
        const result = await wx.cloud.callFunction({
          name: 'userAuth',
          data: { action: 'updateRolePermissions', data: { role_id: roleId, permissions } }
        });
        if (!result.result?.success) {
          throw new Error(result.result?.error || '更新角色权限失败');
        }
        return true;
      } catch (error) {
        console.error('[CloudDB] Update role permissions error:', error);
        throw error;
      }
    }
  };

  /**
   * 故障类型相关操作
   */
  faultTypes = {
    /**
     * 获取所有故障类型
     */
    list: async () => {
      try {
        const result = await wx.cloud.callFunction({
          name: 'workOrderManager',
          data: { action: 'getFaultTypes' }
        });
        if (!result.result?.success) {
          throw new Error(result.result?.error || '获取故障类型失败');
        }
        return result.result.fault_types || [];
      } catch (error) {
        console.error('[CloudDB] List fault types error:', error);
        throw error;
      }
    }
  };

  /**
   * 工单相关操作
   */
  workOrders = {
    /**
     * 获取工单列表
     */
    list: async (filters = {}) => {
      try {
        let query = db.collection('work_orders');

        // 应用过滤条件
        if (filters.creator_id) {
          query = query.where({ creator_id: filters.creator_id });
        }
        if (filters.assignee_id) {
          query = query.where({ assignee_id: filters.assignee_id });
        }
        if (filters.status) {
          query = query.where({ status: filters.status });
        }

        const { data } = await query
          .orderBy('created_at', 'desc')
          .get();

        return data;
      } catch (error) {
        console.error('[CloudDB] List work orders error:', error);
        throw error;
      }
    },

    /**
     * 创建工单
     */
    create: async (workOrder) => {
      try {
        const result = await db.collection('work_orders').add({
          data: {
            ...workOrder,
            created_at: new Date(),
            updated_at: new Date()
          }
        });

        return result;
      } catch (error) {
        console.error('[CloudDB] Create work order error:', error);
        throw error;
      }
    },

    /**
     * 更新工单
     */
    update: async (orderId, updates) => {
      try {
        await db.collection('work_orders')
          .doc(orderId)
          .update({
            data: {
              ...updates,
              updated_at: new Date()
            }
          });

        return true;
      } catch (error) {
        console.error('[CloudDB] Update work order error:', error);
        throw error;
      }
    }
  };

  /**
   * 公告管理相关操作
   */
  announcements = {
    /**
     * 获取公告列表
     */
    list: async (filters = {}) => {
      try {
        const result = await wx.cloud.callFunction({
          name: 'userAuth',
          data: { action: 'listAnnouncements', data: filters, current_user_id: getCurrentUserId() }
        });
        if (!result.result.success) {
          throw new Error(result.result.error || '获取公告列表失败');
        }
        return { list: result.result.announcements || [] };
      } catch (error) {
        console.error('[CloudDB] List announcements error:', error);
        throw error;
      }
    },

    /**
     * 获取公告详情
     */
    get: async (announcementId) => {
      try {
        const result = await wx.cloud.callFunction({
          name: 'userAuth',
          data: { action: 'getAnnouncement', data: { announcement_id: announcementId }, current_user_id: getCurrentUserId() }
        });
        if (!result.result.success) {
          throw new Error(result.result.error || '获取公告详情失败');
        }
        return result.result.announcement;
      } catch (error) {
        console.error('[CloudDB] Get announcement error:', error);
        throw error;
      }
    },

    /**
     * 创建公告
     */
    create: async (data) => {
      try {
        const result = await wx.cloud.callFunction({
          name: 'userAuth',
          data: { action: 'createAnnouncement', data, current_user_id: getCurrentUserId() }
        });
        if (!result.result.success) {
          throw new Error(result.result.error || '创建公告失败');
        }
        return result.result;
      } catch (error) {
        console.error('[CloudDB] Create announcement error:', error);
        throw error;
      }
    },

    /**
     * 更新公告
     */
    update: async (announcementId, updateData) => {
      try {
        const result = await wx.cloud.callFunction({
          name: 'userAuth',
          data: { action: 'updateAnnouncement', data: { announcement_id: announcementId, ...updateData }, current_user_id: getCurrentUserId() }
        });
        if (!result.result.success) {
          throw new Error(result.result.error || '更新公告失败');
        }
        return result.result;
      } catch (error) {
        console.error('[CloudDB] Update announcement error:', error);
        throw error;
      }
    },

    /**
     * 发布公告
     */
    publish: async (announcementId) => {
      try {
        const result = await wx.cloud.callFunction({
          name: 'userAuth',
          data: { action: 'publishAnnouncement', data: { announcement_id: announcementId }, current_user_id: getCurrentUserId() }
        });
        if (!result.result.success) {
          throw new Error(result.result.error || '发布公告失败');
        }
        return result.result;
      } catch (error) {
        console.error('[CloudDB] Publish announcement error:', error);
        throw error;
      }
    },

    /**
     * 下线公告
     */
    offline: async (announcementId) => {
      try {
        const result = await wx.cloud.callFunction({
          name: 'userAuth',
          data: { action: 'offlineAnnouncement', data: { announcement_id: announcementId }, current_user_id: getCurrentUserId() }
        });
        if (!result.result.success) {
          throw new Error(result.result.error || '下线公告失败');
        }
        return result.result;
      } catch (error) {
        console.error('[CloudDB] Offline announcement error:', error);
        throw error;
      }
    },

    /**
     * 删除公告
     */
    delete: async (announcementId) => {
      try {
        const result = await wx.cloud.callFunction({
          name: 'userAuth',
          data: { action: 'deleteAnnouncement', data: { announcement_id: announcementId }, current_user_id: getCurrentUserId() }
        });
        if (!result.result.success) {
          throw new Error(result.result.error || '删除公告失败');
        }
        return result.result;
      } catch (error) {
        console.error('[CloudDB] Delete announcement error:', error);
        throw error;
      }
    },

    /**
     * 获取用户可见的公告列表（普通用户使用）
     */
    listForUser: async (roleId) => {
      try {
        const result = await wx.cloud.callFunction({
          name: 'userAuth',
          data: { action: 'listAnnouncements', data: { forUser: true, roleId }, current_user_id: getCurrentUserId() }
        });
        if (!result.result.success) {
          throw new Error(result.result.error || '获取公告列表失败');
        }
        return { list: result.result.announcements || [] };
      } catch (error) {
        // 如果是集合不存在的错误，返回空列表而不是抛出错误
        if (error.message && error.message.includes('collection not exists')) {
          console.warn('[CloudDB] Announcements 集合不存在，返回空列表');
          return { list: [] };
        }
        console.error('[CloudDB] List announcements for user error:', error);
        throw error;
      }
    }
  };

  /**
   * 消息模板管理相关操作
   */
  messageTemplates = {
    /**
     * 获取消息模板列表
     */
    list: async (filters = {}) => {
      try {
        const result = await wx.cloud.callFunction({
          name: 'userAuth',
          data: { action: 'listMessageTemplates', data: filters, current_user_id: getCurrentUserId() }
        });
        if (!result.result.success) {
          throw new Error(result.result.error || '获取模板列表失败');
        }
        return { list: result.result.templates || [] };
      } catch (error) {
        console.error('[CloudDB] List message templates error:', error);
        throw error;
      }
    },

    /**
     * 获取消息模板详情
     */
    get: async (templateId) => {
      try {
        const result = await wx.cloud.callFunction({
          name: 'userAuth',
          data: { action: 'getMessageTemplate', data: { template_id: templateId }, current_user_id: getCurrentUserId() }
        });
        if (!result.result.success) {
          throw new Error(result.result.error || '获取模板详情失败');
        }
        return result.result.template;
      } catch (error) {
        console.error('[CloudDB] Get message template error:', error);
        throw error;
      }
    },

    /**
     * 创建消息模板
     */
    create: async (data) => {
      try {
        const result = await wx.cloud.callFunction({
          name: 'userAuth',
          data: { action: 'createMessageTemplate', data, current_user_id: getCurrentUserId() }
        });
        if (!result.result.success) {
          throw new Error(result.result.error || '创建模板失败');
        }
        return result.result;
      } catch (error) {
        console.error('[CloudDB] Create message template error:', error);
        throw error;
      }
    },

    /**
     * 更新消息模板
     */
    update: async (templateId, updateData) => {
      try {
        const result = await wx.cloud.callFunction({
          name: 'userAuth',
          data: { action: 'updateMessageTemplate', data: { template_id: templateId, ...updateData }, current_user_id: getCurrentUserId() }
        });
        if (!result.result.success) {
          throw new Error(result.result.error || '更新模板失败');
        }
        return result.result;
      } catch (error) {
        console.error('[CloudDB] Update message template error:', error);
        throw error;
      }
    },

    /**
     * 启用/停用消息模板
     */
    toggle: async (templateId, enabled) => {
      try {
        const result = await wx.cloud.callFunction({
          name: 'userAuth',
          data: { action: 'toggleMessageTemplate', data: { template_id: templateId, enabled }, current_user_id: getCurrentUserId() }
        });
        if (!result.result.success) {
          throw new Error(result.result.error || '切换模板状态失败');
        }
        return result.result;
      } catch (error) {
        console.error('[CloudDB] Toggle message template error:', error);
        throw error;
      }
    },

    /**
     * 删除消息模板
     */
    delete: async (templateId) => {
      try {
        const result = await wx.cloud.callFunction({
          name: 'userAuth',
          data: { action: 'deleteMessageTemplate', data: { template_id: templateId }, current_user_id: getCurrentUserId() }
        });
        if (!result.result.success) {
          throw new Error(result.result.error || '删除模板失败');
        }
        return result.result;
      } catch (error) {
        console.error('[CloudDB] Delete message template error:', error);
        throw error;
      }
    }
  };

  /**
   * 审计日志相关操作
   */
  auditLogs = {
    /**
     * 获取审计日志列表
     */
    list: async (filters = {}) => {
      try {
        const result = await wx.cloud.callFunction({
          name: 'userAuth',
          data: { action: 'listAuditLogs', data: filters, current_user_id: getCurrentUserId() }
        });
        if (!result.result.success) {
          throw new Error(result.result.error || '获取审计日志失败');
        }
        return result.result;
      } catch (error) {
        console.error('[CloudDB] List audit logs error:', error);
        throw error;
      }
    },

    /**
     * 获取审计动作类型列表
     */
    getActions: async () => {
      try {
        const result = await wx.cloud.callFunction({
          name: 'userAuth',
          data: { action: 'getAuditLogActions', current_user_id: getCurrentUserId() }
        });
        if (!result.result.success) {
          throw new Error(result.result.error || '获取动作类型失败');
        }
        return result.result.actions;
      } catch (error) {
        console.error('[CloudDB] Get audit actions error:', error);
        throw error;
      }
    }
  };

  /**
   * 系统配置相关操作
   */
  systemConfig = {
    /**
     * 获取系统配置
     */
    get: async () => {
      try {
        const result = await wx.cloud.callFunction({
          name: 'userAuth',
          data: { action: 'getSystemConfig', current_user_id: getCurrentUserId() }
        });
        if (!result.result.success) {
          throw new Error(result.result.error || '获取系统配置失败');
        }
        return result.result;
      } catch (error) {
        console.error('[CloudDB] Get system config error:', error);
        throw error;
      }
    },

    /**
     * 更新单个配置
     */
    update: async (key, value, description) => {
      try {
        const result = await wx.cloud.callFunction({
          name: 'userAuth',
          data: { action: 'updateSystemConfig', data: { key, value, description }, current_user_id: getCurrentUserId() }
        });
        if (!result.result.success) {
          throw new Error(result.result.error || '更新配置失败');
        }
        return result.result;
      } catch (error) {
        console.error('[CloudDB] Update system config error:', error);
        throw error;
      }
    },

    /**
     * 批量更新配置
     */
    batchUpdate: async (configs) => {
      try {
        const result = await wx.cloud.callFunction({
          name: 'userAuth',
          data: { action: 'batchUpdateSystemConfig', data: { configs }, current_user_id: getCurrentUserId() }
        });
        if (!result.result.success) {
          throw new Error(result.result.error || '批量更新配置失败');
        }
        return result.result;
      } catch (error) {
        console.error('[CloudDB] Batch update system config error:', error);
        throw error;
      }
    }
  };
}

// 创建单例
const cloudDB = new CloudDatabaseService();

module.exports = cloudDB;
