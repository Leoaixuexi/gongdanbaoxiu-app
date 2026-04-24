/**
 * 认证相关处理器
 * passwordLogin, login/getUserInfo, changePassword, resetUserPassword
 */

const {
  db,
  getUserByOpenId,
  getUserByUsername,
  getUserByPhone,
  hashPassword,
  verifyPassword,
  createUser,
  updateLastLogin,
  getUserPermissions,
  getRoleName,
  logAudit
} = require('../helpers');

/**
 * 账号密码登录
 */
async function handlePasswordLogin(openid, data) {
  const { username, password } = data;

  if (!username || !password) {
    return {
      success: false,
      error: '请输入用户名/手机号和密码'
    };
  }

  // 查找用户：先尝试用户名，再尝试手机号
  let user = await getUserByUsername(username);
  if (!user) {
    user = await getUserByPhone(username);
  }

  if (!user) {
    // 记录登录失败：用户不存在
    await logAudit('login_failed', {
      user_name: username,
      resource_type: 'auth',
      new_value: {
        reason: 'user_not_found',
        input_username: username
      }
    });
    return {
      success: false,
      error: '用户名或密码错误'
    };
  }

  // 验证密码
  if (!verifyPassword(password, user.password)) {
    // 记录登录失败：密码错误
    await logAudit('login_failed', {
      user_id: user.user_id,
      user_name: user.name,
      resource_type: 'auth',
      resource_id: user.user_id,
      new_value: {
        reason: 'wrong_password',
        input_username: username
      }
    });
    return {
      success: false,
      error: '用户名或密码错误'
    };
  }

  // 检查用户是否启用
  if (!user.active) {
    // 记录登录失败：账号停用
    await logAudit('login_failed', {
      user_id: user.user_id,
      user_name: user.name,
      resource_type: 'auth',
      resource_id: user.user_id,
      new_value: {
        reason: 'account_disabled',
        input_username: username
      }
    });
    return {
      success: false,
      error: '账号已被停用，请联系管理员'
    };
  }

  // 绑定当前微信 openid 到该账号（用于后续权限校验）
  if (!openid) {
    return {
      success: false,
      error: '无法获取微信身份，请在小程序内登录',
    };
  }

  // 如果该 openid 已绑定其他账号，先解绑旧账号
  const boundUser = await getUserByOpenId(openid);
  if (boundUser && boundUser.user_id !== user.user_id) {
    // 解绑旧账号的 openid
    await db.collection('users').doc(boundUser._id).update({
      data: {
        wechat_openid: '',
        updated_at: new Date(),
      },
    });
    console.log(`[UserAuth] 已解绑旧账号 ${boundUser.username || boundUser.user_id} 的 openid`);
  }

  // 如果目标账号已绑定不同 openid，清除旧绑定（允许切换设备）
  if (user.wechat_openid && user.wechat_openid !== openid) {
    console.log(`[UserAuth] 账号 ${user.username} 从旧设备切换到新设备`);
  }

  // 写入新绑定
  await db.collection('users').doc(user._id).update({
    data: {
      wechat_openid: openid,
      updated_at: new Date(),
    },
  });

  // 更新最后登录时间
  await updateLastLogin(user.user_id);

  // 获取权限和角色名称
  const permissions = await getUserPermissions(user.role_id);
  const roleName = await getRoleName(user.role_id);

  // 记录审计日志
  await logAudit('user_login', {
    user_id: user.user_id,
    user_name: user.name,
    resource_id: user.user_id,
    new_value: { username, login_time: new Date() }
  });

  return {
    success: true,
    user: {
      id: user.user_id,
      username: user.username,
      name: user.name,
      role_id: user.role_id,
      role_name: roleName,
      contact_phone: user.contact_phone,
      department: user.department,
      avatar: user.avatar,
      active: user.active
    },
    permissions,
    timestamp: Date.now()
  };
}

/**
 * 获取或创建用户（微信登录，保留用于兼容）
 */
async function handleLogin(openid, data) {
  let user = await getUserByOpenId(openid);

  const isNewUser = !user;

  if (isNewUser) {
    // 创建新用户
    user = await createUser(openid, data.userInfo);

    // 记录审计日志
    await logAudit('user_registered', {
      user_id: user.user_id,
      user_name: user.name,
      resource_id: user.user_id,
      new_value: { openid: openid, name: user.name }
    });

  } else {
    // 更新最后登录时间
    await updateLastLogin(user.user_id);
  }

  // 获取权限
  const permissions = await getUserPermissions(user.role_id);

  return {
    success: true,
    isNewUser,
    user: {
      id: user.user_id,
      openid: user.wechat_openid,
      name: user.name,
      role_id: user.role_id,
      role_name: user.role?.display_name,
      contact_phone: user.contact_phone,
      department: user.department,
      active: user.active
    },
    permissions,
    timestamp: Date.now()
  };
}

/**
 * 修改密码
 */
async function handleChangePassword(openid, data, getCurrentUser) {
  const { old_password, new_password, user_id } = data;

  if (!new_password || new_password.length < 6) {
    return {
      success: false,
      error: '新密码长度至少为6位'
    };
  }

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      success: false,
      error: '用户不存在'
    };
  }

  // 确定要修改的用户
  let targetUserId = currentUser.user_id;
  let targetUser = currentUser;

  // 管理员可以修改其他用户的密码
  if (user_id && currentUser.role_id === 1) {
    targetUserId = user_id;
    const users = db.collection('users');
    const { data: userData } = await users.where({ user_id: user_id }).get();
    if (userData.length === 0) {
      return {
        success: false,
        error: '目标用户不存在'
      };
    }
    targetUser = userData[0];
  }

  // 非管理员修改自己的密码需要验证旧密码
  if (targetUserId === currentUser.user_id && old_password) {
    if (!verifyPassword(old_password, targetUser.password)) {
      return {
        success: false,
        error: '旧密码错误'
      };
    }
  }

  // 加密新密码
  const hashedPassword = hashPassword(new_password);

  // 更新密码
  const users = db.collection('users');
  await users.where({
    user_id: targetUserId
  }).update({
    data: {
      password: hashedPassword,
      updated_at: new Date()
    }
  });

  // 记录审计日志
  await logAudit('password_changed', {
    user_id: currentUser.user_id,
    user_name: currentUser.name,
    resource_type: 'user',
    resource_id: targetUserId,
    new_value: {
      target_user: targetUser.username || targetUser.name,
      changed_by_admin: targetUserId !== currentUser.user_id
    }
  });

  return {
    success: true,
    message: '密码修改成功'
  };
}

/**
 * 重置用户密码（管理员）
 */
async function handleResetUserPassword(openid, data, getCurrentUser) {
  const currentUser = await getCurrentUser();

  if (!currentUser || currentUser.role_id !== 1) {
    return {
      success: false,
      error: '权限不足：需要系统管理员权限'
    };
  }

  const { user_id, new_password } = data;
  const defaultPassword = new_password || '123456';

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

  // 加密新密码
  const hashedPassword = hashPassword(defaultPassword);

  await users.doc(targetUsers[0]._id).update({
    data: {
      password: hashedPassword,
      updated_at: new Date()
    }
  });

  // 记录审计日志
  await logAudit('user_password_reset', {
    user_id: currentUser.user_id,
    user_name: currentUser.name,
    resource_type: 'user',
    resource_id: parseInt(user_id),
    new_value: { target_user: targetUsers[0].username || targetUsers[0].name }
  });

  return {
    success: true,
    message: '密码重置成功',
    default_password: defaultPassword
  };
}

module.exports = {
  handlePasswordLogin,
  handleLogin,
  handleChangePassword,
  handleResetUserPassword
};
