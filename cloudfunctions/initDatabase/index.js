/**
 * 云数据库初始化函数
 * 创建基础数据：角色、故障类型、SLA规则
 *
 * 使用方法：
 * 1. 在云开发控制台手动创建集合：roles, fault_types, users, work_orders, notifications, audit_logs
 * 2. 上传并部署此云函数
 * 3. 在云函数控制台测试运行（传入 {"action": "init"} 或 {"action": "reset"}）
 */

const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 加密密码
 * 使用 PBKDF2 算法进行密码加密
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(
    password,
    salt,
    10000,
    64,
    'sha512'
  ).toString('hex');
  return `${salt}:${hash}`;
}

// 角色初始数据（4个角色：系统管理员、物业经理、维修员、物业员工）
const ROLES_DATA = [
  {
    role_id: 1,
    name: 'System Admin',
    display_name: '系统管理员',
    permissions: {
      modules: {
        submit_work_orders: true,
        review_work_orders: true,
        view_analytics: true,
        manage_users: true,
        configure_system: true
      }
    },
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    role_id: 2,
    name: 'Property Manager',
    display_name: '物业经理',
    permissions: {
      modules: {
        submit_work_orders: true,
        review_work_orders: true,
        view_analytics: true,
        manage_users: false,
        configure_system: false
      }
    },
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    role_id: 3,
    name: 'Maintenance Worker',
    display_name: '维修员',
    permissions: {
      modules: {
        submit_work_orders: false,
        review_work_orders: false,
        view_analytics: false,
        manage_users: false,
        configure_system: false
      }
    },
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    role_id: 4,
    name: 'Property Staff',
    display_name: '物业员工',
    permissions: {
      modules: {
        submit_work_orders: true,
        review_work_orders: true,
        view_analytics: false,
        manage_users: false,
        configure_system: false
      }
    },
    created_at: new Date(),
    updated_at: new Date()
  }
];

// 故障类型初始数据（层级结构）
const FAULT_TYPES_DATA = [
  // 主分类
  { type_id: 1, name: '水电维修', parent_id: null, active: true },
  { type_id: 2, name: '门窗维修', parent_id: null, active: true },
  { type_id: 3, name: '空调维修', parent_id: null, active: true },
  { type_id: 4, name: '电梯维修', parent_id: null, active: true },
  { type_id: 5, name: '消防设施', parent_id: null, active: true },
  { type_id: 6, name: '公共区域', parent_id: null, active: true },
  { type_id: 7, name: '其他', parent_id: null, active: true },

  // 水电维修子分类
  { type_id: 11, name: '水管漏水', parent_id: 1, active: true },
  { type_id: 12, name: '水管堵塞', parent_id: 1, active: true },
  { type_id: 13, name: '电路故障', parent_id: 1, active: true },
  { type_id: 14, name: '灯具维修', parent_id: 1, active: true },
  { type_id: 15, name: '开关插座', parent_id: 1, active: true },

  // 门窗维修子分类
  { type_id: 21, name: '门锁损坏', parent_id: 2, active: true },
  { type_id: 22, name: '门框变形', parent_id: 2, active: true },
  { type_id: 23, name: '窗户漏风', parent_id: 2, active: true },
  { type_id: 24, name: '玻璃破损', parent_id: 2, active: true },

  // 空调维修子分类
  { type_id: 31, name: '空调不制冷', parent_id: 3, active: true },
  { type_id: 32, name: '空调漏水', parent_id: 3, active: true },
  { type_id: 33, name: '空调噪音', parent_id: 3, active: true },

  // 电梯维修子分类
  { type_id: 41, name: '电梯故障', parent_id: 4, active: true },
  { type_id: 42, name: '电梯异响', parent_id: 4, active: true },
  { type_id: 43, name: '电梯门故障', parent_id: 4, active: true },

  // 消防设施子分类
  { type_id: 51, name: '消防栓损坏', parent_id: 5, active: true },
  { type_id: 52, name: '烟雾报警器', parent_id: 5, active: true },
  { type_id: 53, name: '灭火器检修', parent_id: 5, active: true },

  // 公共区域子分类
  { type_id: 61, name: '走廊照明', parent_id: 6, active: true },
  { type_id: 62, name: '地面损坏', parent_id: 6, active: true },
  { type_id: 63, name: '墙面污损', parent_id: 6, active: true }
];

// SLA规则数据
const SLA_RULES = {
  'Emergency': { hours: 2, description: '紧急故障，2小时内处理' },
  'High': { hours: 24, description: '高优先级，24小时内处理' },
  'Normal': { hours: 72, description: '普通优先级，3天内处理' },
  'Low': { hours: 168, description: '低优先级，7天内处理' }
};

/**
 * 初始化角色数据
 */
async function initRoles() {
  const roles = db.collection('roles');

  // 检查是否已有数据
  const existing = await roles.count();
  if (existing.total > 0) {
    console.log(`角色数据已存在 (${existing.total} 条)，跳过初始化`);
    return { skip: true, count: existing.total };
  }

  // 批量插入
  const tasks = ROLES_DATA.map(role => roles.add({ data: role }));
  const results = await Promise.all(tasks);

  console.log(`成功初始化 ${results.length} 个角色`);
  return { success: true, count: results.length };
}

/**
 * 初始化故障类型数据
 */
async function initFaultTypes() {
  const faultTypes = db.collection('fault_types');

  // 检查是否已有数据
  const existing = await faultTypes.count();
  if (existing.total > 0) {
    console.log(`故障类型已存在 (${existing.total} 条)，跳过初始化`);
    return { skip: true, count: existing.total };
  }

  // 添加时间戳
  const dataWithTimestamps = FAULT_TYPES_DATA.map(type => ({
    ...type,
    created_at: new Date(),
    updated_at: new Date()
  }));

  // 批量插入
  const tasks = dataWithTimestamps.map(type => faultTypes.add({ data: type }));
  const results = await Promise.all(tasks);

  console.log(`成功初始化 ${results.length} 个故障类型`);
  return { success: true, count: results.length };
}

/**
 * 重置数据库（危险操作）
 */
async function resetDatabase() {
  console.warn('⚠️ 开始重置数据库...');

  const collections = ['roles', 'fault_types', 'users', 'work_orders', 'notifications', 'audit_logs'];
  const results = {};

  for (const collectionName of collections) {
    try {
      const collection = db.collection(collectionName);

      // 获取所有文档
      const { data } = await collection.get();

      if (data.length === 0) {
        results[collectionName] = { deleted: 0 };
        continue;
      }

      // 批量删除
      const deleteTasks = data.map(doc => collection.doc(doc._id).remove());
      await Promise.all(deleteTasks);

      results[collectionName] = { deleted: data.length };
      console.log(`已清空 ${collectionName}: ${data.length} 条`);

    } catch (error) {
      results[collectionName] = { error: error.message };
      console.error(`清空 ${collectionName} 失败:`, error);
    }
  }

  return results;
}

/**
 * 创建测试用户
 */
async function createTestUsers() {
  const users = db.collection('users');

  // 检查是否已有测试用户
  const existing = await users.where({
    name: '测试管理员'
  }).count();

  if (existing.total > 0) {
    console.log('测试用户已存在，跳过创建');
    return { skip: true };
  }

  const testUsers = [
    {
      user_id: 1,
      username: 'admin',
      password: hashPassword('admin123'),  // 加密密码
      wechat_openid: 'test_admin_openid',
      name: '测试管理员',
      role_id: 1,
      role: { name: 'admin', display_name: '系统管理员' },
      contact_phone: '13800138001',
      department: '管理部',
      supervisor_id: null,
      active: true,
      created_at: new Date(),
      updated_at: new Date(),
      last_login_at: new Date()
    },
    {
      user_id: 2,
      username: 'manager',
      password: hashPassword('manager123'),  // 加密密码
      wechat_openid: 'test_manager_openid',
      name: '测试经理',
      role_id: 2,
      role: { name: 'property_manager', display_name: '物业经理' },
      contact_phone: '13800138002',
      department: '物业部',
      supervisor_id: 1,
      active: true,
      created_at: new Date(),
      updated_at: new Date(),
      last_login_at: new Date()
    },
    {
      user_id: 3,
      username: 'technician',
      password: hashPassword('tech123'),  // 加密密码
      wechat_openid: 'test_technician_openid',
      name: '测试维修员',
      role_id: 3,
      role: { name: 'maintenance_staff', display_name: '维修员' },
      contact_phone: '13800138003',
      department: '维修部',
      supervisor_id: 2,
      active: true,
      created_at: new Date(),
      updated_at: new Date(),
      last_login_at: new Date()
    },
    {
      user_id: 4,
      username: 'staff',
      password: hashPassword('staff123'),  // 加密密码
      wechat_openid: 'test_staff_openid',
      name: '测试员工',
      role_id: 4,
      role: { name: 'property_staff', display_name: '物业员工' },
      contact_phone: '13800138004',
      department: '物业部',
      supervisor_id: 2,
      active: true,
      created_at: new Date(),
      updated_at: new Date(),
      last_login_at: new Date()
    }
  ];

  const tasks = testUsers.map(user => users.add({ data: user }));
  const results = await Promise.all(tasks);

  console.log(`成功创建 ${results.length} 个测试用户`);
  return { success: true, count: results.length };
}

/**
 * 获取数据库统计信息
 */
async function getStats() {
  const collections = ['roles', 'fault_types', 'users', 'work_orders', 'notifications', 'audit_logs'];
  const stats = {};

  for (const collectionName of collections) {
    try {
      const collection = db.collection(collectionName);
      const count = await collection.count();
      stats[collectionName] = count.total;
    } catch (error) {
      stats[collectionName] = { error: error.message };
    }
  }

  return stats;
}

/**
 * 主函数
 */
exports.main = async (event, context) => {
  const { action = 'init' } = event;

  console.log(`[InitDatabase] Action: ${action}`);

  try {
    switch (action) {
      case 'init':
        // 初始化基础数据
        const rolesResult = await initRoles();
        const faultTypesResult = await initFaultTypes();
        const usersResult = await createTestUsers();

        return {
          success: true,
          action: 'init',
          results: {
            roles: rolesResult,
            fault_types: faultTypesResult,
            test_users: usersResult
          },
          message: '数据库初始化完成',
          sla_rules: SLA_RULES
        };

      case 'reset':
        // 重置所有数据（危险）
        const resetResult = await resetDatabase();
        return {
          success: true,
          action: 'reset',
          results: resetResult,
          message: '⚠️ 数据库已重置，所有数据已清空'
        };

      case 'stats':
        // 获取统计信息
        const stats = await getStats();
        return {
          success: true,
          action: 'stats',
          stats,
          message: '数据库统计信息'
        };

      case 'reset_and_init':
        // 重置并初始化
        await resetDatabase();
        const r1 = await initRoles();
        const r2 = await initFaultTypes();
        const r3 = await createTestUsers();

        return {
          success: true,
          action: 'reset_and_init',
          results: {
            roles: r1,
            fault_types: r2,
            test_users: r3
          },
          message: '数据库已重置并重新初始化'
        };

      default:
        return {
          success: false,
          error: `未知操作: ${action}`,
          available_actions: ['init', 'reset', 'stats', 'reset_and_init']
        };
    }

  } catch (error) {
    console.error('[InitDatabase] Error:', error);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
};
