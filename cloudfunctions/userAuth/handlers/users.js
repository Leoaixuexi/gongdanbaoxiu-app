/**
 * 用户管理处理器
 * listUsers, createUser, updateUser, deleteUser, enableUser, disableUser,
 * getUserById, updateProfile, getSupervisors, getPropertyStaffList
 */

const {
  cloud,
  db,
  _,
  getRandomAvatar,
  getUserByOpenId,
  getUserByUsername,
  hashPassword,
  logAudit
} = require('../helpers');


/**
 * 获取用户列表（需要管理员权限）
 */
async function handleListUsers(openid, data, getCurrentUser) {
  const currentUser = await getCurrentUser();

  if (!currentUser || currentUser.role_id !== 1) {
    return {
      success: false,
      error: '权限不足：需要系统管理员权限'
    };
  }

  const users = db.collection('users');
  const filters = data || {};

  const page = Math.max(parseInt(filters.page || 1, 10), 1);
  const limit = Math.min(Math.max(parseInt(filters.limit || 100, 10), 1), 100);
  const offset = (page - 1) * limit;

  const conditions = {};

  if (filters.role_id) {
    const roleId = parseInt(filters.role_id, 10);
    if (!Number.isNaN(roleId)) {
      conditions.role_id = roleId;
    }
  }

  if (filters.department) {
    conditions.department = filters.department;
  }

  if (filters.is_active !== undefined) {
    if (filters.is_active === true || filters.is_active === 'true') {
      conditions.active = true;
    } else if (filters.is_active === false || filters.is_active === 'false') {
      conditions.active = false;
    }
  }

  if (filters.search) {
    conditions.name = db.RegExp({
      regexp: String(filters.search),
      options: 'i'
    });
  }

  const [{ total }, { data: allUsers }] = await Promise.all([
    users.where(conditions).count(),
    users
      .where(conditions)
      .orderBy('created_at', 'desc')
      .skip(offset)
      .limit(limit)
      .get(),
  ]);

  // 转换头像URL：将 cloud:// 格式转换为临时可访问URL
  const cloudAvatars = allUsers
    .map((user, index) => ({ url: user.avatar, index }))
    .filter(item => item.url && item.url.startsWith('cloud://'));
  if (cloudAvatars.length > 0) {
    try {
      const { fileList } = await cloud.getTempFileURL({
        fileList: cloudAvatars.map(item => item.url)
      });
      fileList.forEach((file, i) => {
        // 使用宽松比较，因为微信API可能返回字符串"0"或数字0
        if (file.tempFileURL && file.status == 0) {
          allUsers[cloudAvatars[i].index].avatar = file.tempFileURL;
        }
      });
    } catch (e) {
      console.error('[listUsers] Convert avatar URLs error:', e);
    }
  }

  return {
    success: true,
    users: allUsers,
    total,
    page,
    limit,
    totalPages: total > 0 ? Math.ceil(total / limit) : 0,
  };
}

/**
 * 创建新用户（管理员操作）
 */
async function handleCreateUser(openid, data, getCurrentUser) {
  const currentUser = await getCurrentUser();

  if (!currentUser || currentUser.role_id !== 1) {
    return {
      success: false,
      error: '权限不足：需要系统管理员权限'
    };
  }

  const { username, password, name, gender, role_id, contact_phone, department, supervisor_id } = data;

  // 验证必填字段
  if (!username || !password || !name || !gender || !role_id) {
    return {
      success: false,
      error: '缺少必填字段：用户名、密码、姓名、性别、角色'
    };
  }

  // 检查用户名是否已存在
  const existingUser = await getUserByUsername(username);
  if (existingUser) {
    return {
      success: false,
      error: '用户名已存在'
    };
  }

  // 加密密码
  const hashedPassword = hashPassword(password);

  // 生成新的 user_id
  const users = db.collection('users');
  const { data: allUsers } = await users.orderBy('user_id', 'desc').limit(1).get();
  const newUserId = allUsers.length > 0 ? allUsers[0].user_id + 1 : 1;

  // 根据性别随机分配默认头像
  const avatar = getRandomAvatar(parseInt(gender));

  // 创建用户数据
  const newUser = {
    user_id: newUserId,
    username: username,
    password: hashedPassword,
    name: name,
    gender: parseInt(gender),  // 1=男, 2=女
    avatar: avatar,            // 默认头像
    role_id: parseInt(role_id),
    contact_phone: contact_phone || '',
    department: department || '',
    supervisor_id: supervisor_id || null,
    wechat_openid: '',
    active: true,
    created_at: new Date(),
    updated_at: new Date()
  };

  // 插入用户
  await users.add({
    data: newUser
  });

  // 记录审计日志
  await logAudit('user_created', {
    user_id: currentUser.user_id,
    user_name: currentUser.name,
    resource_type: 'user',
    resource_id: newUserId,
    new_value: {
      username: username,
      name: name,
      role_id: role_id
    }
  });

  return {
    success: true,
    message: '用户创建成功',
    user_id: newUserId
  };
}

/**
 * 更新用户信息（管理员操作）
 */
async function handleUpdateUser(openid, data, getCurrentUser) {
  const currentUser = await getCurrentUser();

  if (!currentUser || currentUser.role_id !== 1) {
    return {
      success: false,
      error: '权限不足：需要系统管理员权限'
    };
  }

  const { user_id, name, gender, role_id, contact_phone, department, supervisor_id, is_active } = data;

  if (!user_id) {
    return {
      success: false,
      error: '缺少用户ID'
    };
  }

  // 获取目标用户
  const users = db.collection('users');
  const { data: targetUsers } = await users.where({
    user_id: parseInt(user_id)
  }).get();

  if (targetUsers.length === 0) {
    return {
      success: false,
      error: '用户不存在'
    };
  }

  const targetUser = targetUsers[0];

  // 防止管理员降级自己
  if (currentUser.user_id === parseInt(user_id) && role_id && parseInt(role_id) > currentUser.role_id) {
    return {
      success: false,
      error: '不能降低自己的权限'
    };
  }

  // 构建更新数据
  const updateData = {
    updated_at: new Date()
  };

  if (name !== undefined) updateData.name = name;
  if (gender !== undefined) updateData.gender = parseInt(gender);
  if (role_id !== undefined) updateData.role_id = parseInt(role_id);
  if (contact_phone !== undefined) updateData.contact_phone = contact_phone;
  if (department !== undefined) updateData.department = department;
  if (supervisor_id !== undefined) updateData.supervisor_id = supervisor_id;
  if (is_active !== undefined) updateData.active = is_active;

  // 更新用户
  await users.doc(targetUsers[0]._id).update({
    data: updateData
  });

  // 记录审计日志
  await logAudit('user_updated', {
    user_id: currentUser.user_id,
    user_name: currentUser.name,
    resource_type: 'user',
    resource_id: parseInt(user_id),
    old_value: {
      name: targetUser.name,
      role_id: targetUser.role_id,
      contact_phone: targetUser.contact_phone,
      department: targetUser.department,
      active: targetUser.active
    },
    new_value: updateData
  });

  return {
    success: true,
    message: '用户更新成功'
  };
}

/**
 * 删除用户（软删除，实际是停用）
 */
async function handleDeleteUser(openid, data, getCurrentUser) {
  const currentUser = await getCurrentUser();

  if (!currentUser || currentUser.role_id !== 1) {
    return {
      success: false,
      error: '权限不足：需要系统管理员权限'
    };
  }

  const { user_id } = data;

  if (!user_id) {
    return {
      success: false,
      error: '缺少用户ID'
    };
  }

  // 防止删除自己
  if (currentUser.user_id === parseInt(user_id)) {
    return {
      success: false,
      error: '不能删除自己'
    };
  }

  // 获取目标用户
  const users = db.collection('users');
  const { data: targetUsers } = await users.where({
    user_id: parseInt(user_id)
  }).get();

  if (targetUsers.length === 0) {
    return {
      success: false,
      error: '用户不存在'
    };
  }

  const targetUser = targetUsers[0];

  // 软删除：设置为停用状态
  await users.doc(targetUsers[0]._id).update({
    data: {
      active: false,
      updated_at: new Date()
    }
  });

  // 记录审计日志
  await logAudit('user_deleted', {
    user_id: currentUser.user_id,
    user_name: currentUser.name,
    resource_type: 'user',
    resource_id: parseInt(user_id),
    old_value: {
      username: targetUser.username,
      name: targetUser.name,
      active: targetUser.active
    }
  });

  return {
    success: true,
    message: '用户已停用'
  };
}

/**
 * 启用用户（管理员）
 */
async function handleEnableUser(openid, data, getCurrentUser) {
  const currentUser = await getCurrentUser();

  if (!currentUser || currentUser.role_id !== 1) {
    return {
      success: false,
      error: '权限不足：需要系统管理员权限'
    };
  }

  const { user_id } = data;

  const users = db.collection('users');
  const { data: targetUsers } = await users.where({
    user_id: parseInt(user_id)
  }).get();

  if (targetUsers.length === 0) {
    return {
      success: false,
      error: '用户不存在'
    };
  }

  await users.doc(targetUsers[0]._id).update({
    data: {
      active: true,
      updated_at: new Date()
    }
  });

  // 记录审计日志
  await logAudit('user_enabled', {
    user_id: currentUser.user_id,
    user_name: currentUser.name,
    resource_type: 'user',
    resource_id: parseInt(user_id),
    new_value: { active: true }
  });

  return {
    success: true,
    message: '用户已启用'
  };
}

/**
 * 停用用户（管理员）
 */
async function handleDisableUser(openid, data, getCurrentUser) {
  const currentUser = await getCurrentUser();

  if (!currentUser || currentUser.role_id !== 1) {
    return {
      success: false,
      error: '权限不足：需要系统管理员权限'
    };
  }

  const { user_id } = data;

  // 防止停用自己
  if (currentUser.user_id === parseInt(user_id)) {
    return {
      success: false,
      error: '不能停用自己'
    };
  }

  const users = db.collection('users');
  const { data: targetUsers } = await users.where({
    user_id: parseInt(user_id)
  }).get();

  if (targetUsers.length === 0) {
    return {
      success: false,
      error: '用户不存在'
    };
  }

  await users.doc(targetUsers[0]._id).update({
    data: {
      active: false,
      updated_at: new Date()
    }
  });

  // 记录审计日志
  await logAudit('user_disabled', {
    user_id: currentUser.user_id,
    user_name: currentUser.name,
    resource_type: 'user',
    resource_id: parseInt(user_id),
    new_value: { active: false }
  });

  return {
    success: true,
    message: '用户已停用'
  };
}

/**
 * 通过 user_id 获取用户信息
 */
async function handleGetUserById(openid, data) {
  const users = db.collection('users');

  const { data: userData } = await users.where({
    user_id: data.user_id
  }).get();

  if (userData.length === 0) {
    return {
      success: false,
      error: '用户不存在'
    };
  }

  const user = userData[0];
  // 转换头像URL：将 cloud:// 格式转换为临时可访问URL
  if (user.avatar && user.avatar.startsWith('cloud://')) {
    try {
      const { fileList } = await cloud.getTempFileURL({
        fileList: [user.avatar]
      });
      // 使用宽松比较，因为微信API可能返回字符串"0"或数字0
      if (fileList[0] && fileList[0].tempFileURL && fileList[0].status == 0) {
        user.avatar = fileList[0].tempFileURL;
      }
    } catch (e) {
      console.error('[getUserById] Convert avatar URL error:', e);
    }
  }

  return {
    success: true,
    user: user
  };
}

/**
 * 更新用户个人信息
 */
async function handleUpdateProfile(openid, data) {
  const user = await getUserByOpenId(openid);

  if (!user) {
    return {
      success: false,
      error: '用户不存在'
    };
  }

  const users = db.collection('users');
  const updateData = {};

  if (data.name) updateData.name = data.name;
  if (data.contact_phone) updateData.contact_phone = data.contact_phone;
  if (data.department) updateData.department = data.department;
  if (data.avatar) updateData.avatar = data.avatar;

  updateData.updated_at = new Date();

  await users.where({
    user_id: user.user_id
  }).update({
    data: updateData
  });

  // 记录审计日志
  await logAudit('user_updated', {
    user_id: user.user_id,
    user_name: user.name,
    resource_id: user.user_id,
    old_value: {
      name: user.name,
      contact_phone: user.contact_phone,
      department: user.department
    },
    new_value: updateData
  });

  return {
    success: true,
    message: '个人信息更新成功'
  };
}

/**
 * 获取可用的上级列表
 */
async function handleGetSupervisors(openid, data) {
  const users = db.collection('users');

  // 获取管理员和经理（role_id <= 3）
  const { data: supervisors } = await users.where({
    role_id: _.lte(3),
    active: true
  }).get();

  return {
    success: true,
    supervisors: supervisors.map(user => ({
      user_id: user.user_id,
      name: user.name,
      role_id: user.role_id,
      department: user.department || '未设置'
    }))
  };
}

/**
 * 获取办美员工列表（用于筛选下拉）- 无需管理员权限
 */
async function handleGetPropertyStaffList(openid, data) {
  const users = db.collection('users');

  const { data: staffList } = await users.where({
    role_id: 4,  // 办美员工
    active: true
  }).field({
    name: true
  }).get();

  // 提取姓名列表并排序
  const names = staffList
    .map(u => u.name)
    .filter(Boolean)
    .sort();

  return {
    success: true,
    data: names
  };
}

module.exports = {
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
};
