/**
 * Cloud Database Service
 * 云数据库服务 - 封装所有云数据库操作
 */

const config = require('../config/index');

// 初始化云开发
if (!wx.cloud) {
  console.error('[CloudDB] wx.cloud is not available');
}

wx.cloud.init({
  env: 'cloud1-7glfhm4r06e030bd', // 替换为您的云环境ID
  traceUser: true
});

const db = wx.cloud.database();
const _ = db.command;

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
        const { data } = await db.collection('users')
          .where({
            username: username
          })
          .get();

        if (data.length === 0) {
          throw new Error('用户不存在');
        }

        const user = data[0];

        // 简单密码验证 (实际项目应使用云函数验证)
        if (user.password !== password) {
          throw new Error('密码错误');
        }

        // 获取角色信息
        const { data: roles } = await db.collection('roles')
          .where({ role_id: user.role_id })
          .get();

        return {
          ...user,
          role: roles[0] || null
        };
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
        const { data } = await db.collection('users')
          .where({ user_id: userId })
          .get();

        if (data.length === 0) {
          throw new Error('用户不存在');
        }

        return data[0];
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
        let query = db.collection('users');

        // 应用过滤条件
        if (filters.role_id) {
          query = query.where({ role_id: parseInt(filters.role_id) });
        }
        if (filters.department) {
          query = query.where({ department: filters.department });
        }
        if (filters.is_active !== undefined) {
          query = query.where({ active: filters.is_active === 'true' });
        }
        if (filters.search) {
          // 云数据库不支持模糊查询,这里简化处理
          query = query.where({
            name: db.RegExp({
              regexp: filters.search,
              options: 'i'
            })
          });
        }

        const { data } = await query.get();
        return data;
      } catch (error) {
        console.error('[CloudDB] List users error:', error);
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
        console.log('[CloudDB] Fetching roles from cloud database...');
        const { data } = await db.collection('roles').get();
        console.log('[CloudDB] Got roles:', data.length);
        return data;
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
        const { data } = await db.collection('roles')
          .where({ role_id: roleId })
          .get();

        if (data.length === 0) {
          throw new Error('角色不存在');
        }

        return data[0];
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
        const { data } = await db.collection('roles')
          .where({ role_id: roleId })
          .get();

        if (data.length === 0) {
          throw new Error('角色不存在');
        }

        await db.collection('roles')
          .doc(data[0]._id)
          .update({
            data: {
              permissions: {
                modules: permissions
              },
              updated_at: new Date()
            }
          });

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
        const { data } = await db.collection('fault_types')
          .where({ active: true })
          .get();
        return data;
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
}

// 创建单例
const cloudDB = new CloudDatabaseService();

module.exports = cloudDB;
