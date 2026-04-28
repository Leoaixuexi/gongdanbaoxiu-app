/**
 * 系统配置、审计日志、角色处理器
 * listRoles, updateRolePermissions, listAuditLogs, getAuditLogActions,
 * getSystemConfig, updateSystemConfig, batchUpdateSystemConfig
 */

const {
  db,
  _,
  logAudit
} = require('../helpers');

// ============ 角色管理 ============

/**
 * 获取所有角色
 */
async function handleListRoles(openid, data, getCurrentUser) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role_id !== 1) {
    return { success: false, error: '权限不足：需要系统管理员权限' };
  }

  const roles = db.collection('roles');
  const { data: allRoles } = await roles.get();

  return {
    success: true,
    roles: allRoles
  };
}

/**
 * 更新角色权限（管理员操作）
 */
async function handleUpdateRolePermissions(openid, data, getCurrentUser) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role_id !== 1) {
    return { success: false, error: '权限不足：需要系统管理员权限' };
  }

  const roleId = parseInt(data.role_id, 10);
  if (Number.isNaN(roleId)) {
    return { success: false, error: 'role_id 不正确' };
  }

  const permissions = data.permissions;
  if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
    return { success: false, error: 'permissions 格式不正确' };
  }

  const roles = db.collection('roles');
  const { data: roleData } = await roles.where({ role_id: roleId }).get();
  if (!roleData || roleData.length === 0) {
    return { success: false, error: '角色不存在' };
  }

  const oldValue = roleData[0].permissions || null;
  await roles.doc(roleData[0]._id).update({
    data: {
      permissions: { modules: permissions },
      updated_at: new Date(),
    }
  });

  await logAudit('update_role_permissions', {
    user_id: currentUser.user_id,
    user_name: currentUser.name,
    resource_type: 'role',
    resource_id: String(roleId),
    old_value: oldValue,
    new_value: { modules: permissions },
  });

  return { success: true };
}

// ============ 审计日志查询 ============

/**
 * 获取审计日志列表（管理员）
 */
async function handleListAuditLogs(openid, data, getCurrentUser) {
  const currentUser = await getCurrentUser();

  if (!currentUser || currentUser.role_id !== 1) {
    return {
      success: false,
      error: '权限不足：需要系统管理员权限'
    };
  }

  const { page = 1, pageSize = 20, action, user_id: filterUserId, startDate, endDate } = data;
  const auditLogs = db.collection('audit_logs');

  // 构建查询条件
  let query = auditLogs;
  const conditions = {};

  if (action) {
    conditions.action = action;
  }

  if (filterUserId) {
    conditions.user_id = parseInt(filterUserId);
  }

  if (startDate || endDate) {
    conditions.created_at = {};
    if (startDate) {
      conditions.created_at = _.gte(new Date(startDate));
    }
    if (endDate) {
      conditions.created_at = _.and(conditions.created_at, _.lte(new Date(endDate)));
    }
  }

  if (Object.keys(conditions).length > 0) {
    query = query.where(conditions);
  }

  // 获取总数
  const { total } = await query.count();

  // 分页查询
  const skip = (page - 1) * pageSize;
  const { data: logs } = await query
    .orderBy('created_at', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get();

  return {
    success: true,
    logs,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  };
}

/**
 * 获取所有审计动作类型（用于筛选）
 */
async function handleGetAuditLogActions(openid, data) {
  return {
    success: true,
    actions: [
      { value: 'user_login', label: '用户登录' },
      { value: 'login_failed', label: '登录失败' },
      { value: 'user_registered', label: '用户注册' },
      { value: 'user_created', label: '创建用户' },
      { value: 'user_updated', label: '更新用户' },
      { value: 'user_deleted', label: '删除用户' },
      { value: 'user_enabled', label: '启用用户' },
      { value: 'user_disabled', label: '停用用户' },
      { value: 'user_password_reset', label: '重置密码' },
      { value: 'password_changed', label: '修改密码' },
      { value: 'announcement_created', label: '创建公告' },
      { value: 'announcement_updated', label: '更新公告' },
      { value: 'announcement_published', label: '发布公告' },
      { value: 'announcement_offline', label: '下线公告' },
      { value: 'announcement_deleted', label: '删除公告' }
    ]
  };
}

// ============ 系统配置管理 ============

/**
 * 获取系统配置
 */
async function handleGetSystemConfig(openid, data) {
  const configs = db.collection('system_config');
  const { data: configData } = await configs.get();

  // 将配置数组转换为对象
  const configMap = {};
  configData.forEach(item => {
    configMap[item.key] = item.value;
  });

  return {
    success: true,
    config: configMap,
    rawConfig: configData
  };
}

/**
 * 更新系统配置（管理员）
 */
async function handleUpdateSystemConfig(openid, data, getCurrentUser) {
  const currentUser = await getCurrentUser();

  if (!currentUser || currentUser.role_id !== 1) {
    return {
      success: false,
      error: '权限不足：需要系统管理员权限'
    };
  }

  const { key, value, description } = data;

  if (!key) {
    return {
      success: false,
      error: '配置键不能为空'
    };
  }

  const configs = db.collection('system_config');

  // 查找是否已存在
  const { data: existing } = await configs.where({ key }).get();

  if (existing.length > 0) {
    // 更新现有配置
    const oldValue = existing[0].value;
    await configs.doc(existing[0]._id).update({
      data: {
        value,
        description: description || existing[0].description,
        updated_at: new Date()
      }
    });

    // 记录审计日志
    await logAudit('system_config_updated', {
      user_id: currentUser.user_id,
      user_name: currentUser.name,
      resource_type: 'system_config',
      resource_id: key,
      old_value: { [key]: oldValue },
      new_value: { [key]: value }
    });
  } else {
    // 创建新配置
    await configs.add({
      data: {
        key,
        value,
        description: description || '',
        created_at: new Date(),
        updated_at: new Date()
      }
    });

    // 记录审计日志
    await logAudit('system_config_created', {
      user_id: currentUser.user_id,
      user_name: currentUser.name,
      resource_type: 'system_config',
      resource_id: key,
      new_value: { [key]: value }
    });
  }

  return {
    success: true,
    message: '配置保存成功'
  };
}

/**
 * 批量更新系统配置（管理员）
 */
async function handleBatchUpdateSystemConfig(openid, data, getCurrentUser) {
  const currentUser = await getCurrentUser();

  if (!currentUser || currentUser.role_id !== 1) {
    return {
      success: false,
      error: '权限不足：需要系统管理员权限'
    };
  }

  const { configs: configList } = data;

  if (!configList || !Array.isArray(configList)) {
    return {
      success: false,
      error: '配置列表格式错误'
    };
  }

  const configsCollection = db.collection('system_config');
  const results = [];

  for (const item of configList) {
    const { key, value, description } = item;

    if (!key) continue;

    const { data: existing } = await configsCollection.where({ key }).get();

    if (existing.length > 0) {
      await configsCollection.doc(existing[0]._id).update({
        data: {
          value,
          description: description || existing[0].description,
          updated_at: new Date()
        }
      });
    } else {
      await configsCollection.add({
        data: {
          key,
          value,
          description: description || '',
          created_at: new Date(),
          updated_at: new Date()
        }
      });
    }

    results.push({ key, success: true });
  }

  // 记录审计日志
  await logAudit('system_config_batch_updated', {
    user_id: currentUser.user_id,
    user_name: currentUser.name,
    resource_type: 'system_config',
    new_value: { updated_keys: results.map(r => r.key) }
  });

  return {
    success: true,
    message: '批量配置保存成功',
    results
  };
}

module.exports = {
  handleListRoles,
  handleUpdateRolePermissions,
  handleListAuditLogs,
  handleGetAuditLogActions,
  handleGetSystemConfig,
  handleUpdateSystemConfig,
  handleBatchUpdateSystemConfig
};
