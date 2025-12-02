/**
 * 用户认证云函数
 * 处理用户登录、注册、信息更新
 */

const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 获取用户信息（通过 openid）
 */
async function getUserByOpenId(openid) {
  const users = db.collection('users');

  const { data } = await users.where({
    wechat_openid: openid
  }).get();

  return data.length > 0 ? data[0] : null;
}

/**
 * 获取用户信息（通过用户名）
 */
async function getUserByUsername(username) {
  const users = db.collection('users');

  const { data } = await users.where({
    username: username
  }).get();

  return data.length > 0 ? data[0] : null;
}

/**
 * 加密密码
 * 使用 PBKDF2 算法进行密码加密
 */
function hashPassword(password, salt = null) {
  // 如果没有提供 salt，生成一个新的
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }

  // 使用 PBKDF2 进行密码哈希
  const hash = crypto.pbkdf2Sync(
    password,
    salt,
    10000,        // 迭代次数
    64,           // 密钥长度
    'sha512'      // 摘要算法
  ).toString('hex');

  // 返回 salt 和 hash 组合的字符串
  return `${salt}:${hash}`;
}

/**
 * 验证密码
 * 支持明文密码（向后兼容）和加密密码
 */
function verifyPassword(inputPassword, storedPassword) {
  // 检查是否是加密密码（格式：salt:hash）
  if (storedPassword && storedPassword.includes(':')) {
    const [salt, hash] = storedPassword.split(':');
    const inputHash = crypto.pbkdf2Sync(
      inputPassword,
      salt,
      10000,
      64,
      'sha512'
    ).toString('hex');
    return hash === inputHash;
  }

  // 向后兼容：明文密码比对
  return inputPassword === storedPassword;
}

/**
 * 创建新用户
 */
async function createUser(openid, userInfo = {}) {
  const users = db.collection('users');
  const roles = db.collection('roles');

  // 获取默认角色（物业员工）
  const { data: roleData } = await roles.where({
    role_id: 4
  }).get();

  const defaultRole = roleData[0];

  // 生成新的 user_id
  const { total } = await users.count();
  const newUserId = total + 1;

  const newUser = {
    user_id: newUserId,
    wechat_openid: openid,
    name: userInfo.nickName || '微信用户',
    role_id: 4,
    role: {
      name: defaultRole.name,
      display_name: defaultRole.display_name
    },
    contact_phone: null,
    department: null,
    supervisor_id: null,
    active: true,
    created_at: new Date(),
    updated_at: new Date(),
    last_login_at: new Date()
  };

  const result = await users.add({
    data: newUser
  });

  return {
    ...newUser,
    _id: result._id
  };
}

/**
 * 更新用户最后登录时间
 */
async function updateLastLogin(userId) {
  const users = db.collection('users');

  await users.where({
    user_id: userId
  }).update({
    data: {
      last_login_at: new Date(),
      updated_at: new Date()
    }
  });
}

/**
 * 获取用户权限
 */
async function getUserPermissions(roleId) {
  const roles = db.collection('roles');

  const { data } = await roles.where({
    role_id: roleId
  }).get();

  return data.length > 0 ? data[0].permissions : {};
}

/**
 * 记录审计日志
 */
async function logAudit(action, details) {
  const auditLogs = db.collection('audit_logs');

  try {
    await auditLogs.add({
      data: {
        user_id: details.user_id || null,
        user_name: details.user_name || 'System',
        action,
        resource_type: details.resource_type || 'user',
        resource_id: details.resource_id || null,
        old_value: details.old_value || null,
        new_value: details.new_value || null,
        ip_address: details.ip_address || null,
        user_agent: details.user_agent || null,
        created_at: new Date()
      }
    });
  } catch (error) {
    console.error('[LogAudit] Error:', error);
  }
}

/**
 * 主函数
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { action, data = {}, test_openid } = event;

  // 测试模式：允许在控制台测试时指定 openid
  const openid = test_openid || wxContext.OPENID;

  console.log(`[UserAuth] Action: ${action}, OpenID: ${openid}${test_openid ? ' (TEST MODE)' : ''}`);

  try {
    switch (action) {
      case 'passwordLogin': {
        // 账号密码登录
        const { username, password } = data;

        if (!username || !password) {
          return {
            success: false,
            error: '请输入用户名和密码'
          };
        }

        // 查找用户
        const user = await getUserByUsername(username);

        if (!user) {
          return {
            success: false,
            error: '用户名或密码错误'
          };
        }

        // 验证密码
        if (!verifyPassword(password, user.password)) {
          return {
            success: false,
            error: '用户名或密码错误'
          };
        }

        // 检查用户是否启用
        if (!user.active) {
          return {
            success: false,
            error: '账号已被停用，请联系管理员'
          };
        }

        // 更新最后登录时间
        await updateLastLogin(user.user_id);

        // 获取权限
        const permissions = await getUserPermissions(user.role_id);

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
            role_name: user.role?.display_name,
            contact_phone: user.contact_phone,
            department: user.department,
            active: user.active
          },
          permissions,
          timestamp: Date.now()
        };
      }

      case 'login':
      case 'getUserInfo': {
        // 获取或创建用户（微信登录，保留用于兼容）
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

      case 'updateProfile': {
        // 更新用户信息
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

      case 'getUserById': {
        // 通过 user_id 获取用户信息
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

        return {
          success: true,
          user: userData[0]
        };
      }

      case 'listUsers': {
        // 获取用户列表（需要管理员权限）
        const currentUser = await getUserByOpenId(openid);

        if (!currentUser || ![1, 2].includes(currentUser.role_id)) {
          return {
            success: false,
            error: '权限不足'
          };
        }

        const users = db.collection('users');
        const { data: allUsers } = await users.orderBy('created_at', 'desc').get();

        return {
          success: true,
          users: allUsers,
          total: allUsers.length
        };
      }

      case 'listRoles': {
        // 获取所有角色
        const roles = db.collection('roles');
        const { data: allRoles } = await roles.get();

        return {
          success: true,
          roles: allRoles
        };
      }

      case 'migratePasswords': {
        // 迁移明文密码到加密格式（管理员操作）
        const currentUser = await getUserByOpenId(openid);

        if (!currentUser || currentUser.role_id !== 1) {
          return {
            success: false,
            error: '权限不足：需要系统管理员权限'
          };
        }

        const users = db.collection('users');
        const { data: allUsers } = await users.get();

        let migratedCount = 0;
        let skippedCount = 0;
        const errors = [];

        for (const user of allUsers) {
          try {
            // 跳过没有密码字段的用户
            if (!user.password) {
              skippedCount++;
              continue;
            }

            // 跳过已经加密的密码
            if (user.password.includes(':')) {
              skippedCount++;
              continue;
            }

            // 加密明文密码
            const hashedPassword = hashPassword(user.password);

            // 更新数据库
            await users.doc(user._id).update({
              data: {
                password: hashedPassword,
                updated_at: new Date()
              }
            });

            migratedCount++;
            console.log(`[MigratePasswords] Migrated password for user: ${user.username || user.user_id}`);

          } catch (error) {
            errors.push({
              user_id: user.user_id,
              username: user.username,
              error: error.message
            });
            console.error(`[MigratePasswords] Error migrating user ${user.user_id}:`, error);
          }
        }

        // 记录审计日志
        await logAudit('passwords_migrated', {
          user_id: currentUser.user_id,
          user_name: currentUser.name,
          resource_type: 'system',
          new_value: {
            total_users: allUsers.length,
            migrated: migratedCount,
            skipped: skippedCount,
            errors: errors.length
          }
        });

        return {
          success: true,
          message: '密码迁移完成',
          stats: {
            total_users: allUsers.length,
            migrated: migratedCount,
            skipped: skippedCount,
            errors: errors.length
          },
          errors: errors.length > 0 ? errors : undefined
        };
      }

      case 'changePassword': {
        // 修改密码
        const { old_password, new_password, user_id } = data;

        if (!new_password || new_password.length < 6) {
          return {
            success: false,
            error: '新密码长度至少为6位'
          };
        }

        const currentUser = await getUserByOpenId(openid);

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

      case 'createUser': {
        // 创建新用户（管理员操作）
        const currentUser = await getUserByOpenId(openid);

        if (!currentUser || ![1, 2].includes(currentUser.role_id)) {
          return {
            success: false,
            error: '权限不足：需要管理员权限'
          };
        }

        const { username, password, name, role_id, contact_phone, department, supervisor_id } = data;

        // 验证必填字段
        if (!username || !password || !name || !role_id) {
          return {
            success: false,
            error: '缺少必填字段：用户名、密码、姓名、角色'
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

        // 创建用户数据
        const newUser = {
          user_id: newUserId,
          username: username,
          password: hashedPassword,
          name: name,
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

      case 'updateUser': {
        // 更新用户信息（管理员操作）
        const currentUser = await getUserByOpenId(openid);

        if (!currentUser || ![1, 2].includes(currentUser.role_id)) {
          return {
            success: false,
            error: '权限不足：需要管理员权限'
          };
        }

        const { user_id, name, role_id, contact_phone, department, supervisor_id, is_active } = data;

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

      case 'deleteUser': {
        // 删除用户（软删除，实际是停用）
        const currentUser = await getUserByOpenId(openid);

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

      case 'getSupervisors': {
        // 获取可用的上级列表
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

      default:
        return {
          success: false,
          error: `未知操作: ${action}`,
          available_actions: ['login', 'passwordLogin', 'getUserInfo', 'updateProfile', 'getUserById', 'listUsers', 'listRoles', 'migratePasswords', 'changePassword', 'createUser', 'updateUser', 'deleteUser', 'getSupervisors']
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
