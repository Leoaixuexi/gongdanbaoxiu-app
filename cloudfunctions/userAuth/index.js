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
 * 获取用户信息（通过 user_id）
 */
async function getUserByUserId(userId) {
  const users = db.collection('users');

  const { data } = await users.where({
    user_id: parseInt(userId)
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

  // 获取默认角色（办美员工）
  const { data: roleData } = await roles.where({
    role_id: 4
  }).get();

  const defaultRole = roleData[0];

  // 生成新的 user_id（避免 count+1 的并发冲突）
  // Generate a numeric ID with low collision probability (ms + random)
  const newUserId = (Date.now() * 1000) + Math.floor(Math.random() * 1000);

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
  const { action, data = {}, test_openid, adminToken } = event;

  // 测试模式：允许在控制台测试时指定 openid
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
        const currentUser = await getCurrentUser();

        if (!currentUser || ![1, 2].includes(currentUser.role_id)) {
          return {
            success: false,
            error: '权限不足'
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

        return {
          success: true,
          users: allUsers,
          total,
          page,
          limit,
          totalPages: total > 0 ? Math.ceil(total / limit) : 0,
        };
      }

      case 'listRoles': {
        // 获取所有角色
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

      case 'updateRolePermissions': {
        // 更新角色权限（管理员操作）
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

      case 'migratePasswords': {
        // 迁移明文密码到加密格式（管理员操作）
        const currentUser = await getCurrentUser();

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

      case 'createUser': {
        // 创建新用户（管理员操作）
        const currentUser = await getCurrentUser();

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
        const currentUser = await getCurrentUser();

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

      // ============ 公告管理 ============

      case 'listAnnouncements': {
        // 获取公告列表
        const currentUser = await getCurrentUser();
        const announcements = db.collection('announcements');

        let query = announcements;

        // 管理员可以看所有公告，普通用户只能看已发布且对其角色可见的公告
        if (!currentUser || currentUser.role_id !== 1) {
          query = query.where({
            status: 'published',
            visible_roles: _.elemMatch(_.eq(currentUser?.role_id || 0))
          });
        }

        const { data } = await query.orderBy('created_at', 'desc').get();

        return {
          success: true,
          announcements: data
        };
      }

      case 'getAnnouncement': {
        // 获取单个公告详情
        const { announcement_id } = data;
        const announcements = db.collection('announcements');

        const { data: result } = await announcements.doc(announcement_id).get();

        return {
          success: true,
          announcement: result
        };
      }

      case 'createAnnouncement': {
        // 创建公告（管理员）
        const currentUser = await getCurrentUser();

        if (!currentUser || currentUser.role_id !== 1) {
          return {
            success: false,
            error: '权限不足：需要系统管理员权限'
          };
        }

        const { title, content, visible_roles, expire_time } = data;

        if (!title || !content) {
          return {
            success: false,
            error: '标题和内容不能为空'
          };
        }

        const announcements = db.collection('announcements');

        const result = await announcements.add({
          data: {
            title,
            content,
            status: 'draft',
            visible_roles: visible_roles || [1, 2, 3, 4],
            expire_time: expire_time ? new Date(expire_time) : null,
            publish_time: null,
            created_by: currentUser.user_id,
            created_at: new Date(),
            updated_at: new Date()
          }
        });

        // 记录审计日志
        await logAudit('announcement_created', {
          user_id: currentUser.user_id,
          user_name: currentUser.name,
          resource_type: 'announcement',
          resource_id: result._id,
          new_value: { title }
        });

        return {
          success: true,
          message: '公告创建成功',
          announcement_id: result._id
        };
      }

      case 'updateAnnouncement': {
        // 更新公告（管理员）
        const currentUser = await getCurrentUser();

        if (!currentUser || currentUser.role_id !== 1) {
          return {
            success: false,
            error: '权限不足：需要系统管理员权限'
          };
        }

        const { announcement_id, title, content, visible_roles, expire_time } = data;

        if (!announcement_id) {
          return {
            success: false,
            error: '缺少公告ID'
          };
        }

        const announcements = db.collection('announcements');

        const updateData = {
          updated_at: new Date()
        };

        if (title !== undefined) updateData.title = title;
        if (content !== undefined) updateData.content = content;
        if (visible_roles !== undefined) updateData.visible_roles = visible_roles;
        if (expire_time !== undefined) updateData.expire_time = expire_time ? new Date(expire_time) : null;

        await announcements.doc(announcement_id).update({
          data: updateData
        });

        // 记录审计日志
        await logAudit('announcement_updated', {
          user_id: currentUser.user_id,
          user_name: currentUser.name,
          resource_type: 'announcement',
          resource_id: announcement_id,
          new_value: updateData
        });

        return {
          success: true,
          message: '公告更新成功'
        };
      }

      case 'publishAnnouncement': {
        // 发布公告（管理员）
        const currentUser = await getCurrentUser();

        if (!currentUser || currentUser.role_id !== 1) {
          return {
            success: false,
            error: '权限不足：需要系统管理员权限'
          };
        }

        const { announcement_id } = data;

        const announcements = db.collection('announcements');

        await announcements.doc(announcement_id).update({
          data: {
            status: 'published',
            publish_time: new Date(),
            updated_at: new Date()
          }
        });

        // 记录审计日志
        await logAudit('announcement_published', {
          user_id: currentUser.user_id,
          user_name: currentUser.name,
          resource_type: 'announcement',
          resource_id: announcement_id
        });

        return {
          success: true,
          message: '公告发布成功'
        };
      }

      case 'offlineAnnouncement': {
        // 下线公告（管理员）
        const currentUser = await getCurrentUser();

        if (!currentUser || currentUser.role_id !== 1) {
          return {
            success: false,
            error: '权限不足：需要系统管理员权限'
          };
        }

        const { announcement_id } = data;

        const announcements = db.collection('announcements');

        await announcements.doc(announcement_id).update({
          data: {
            status: 'offline',
            updated_at: new Date()
          }
        });

        // 记录审计日志
        await logAudit('announcement_offline', {
          user_id: currentUser.user_id,
          user_name: currentUser.name,
          resource_type: 'announcement',
          resource_id: announcement_id
        });

        return {
          success: true,
          message: '公告已下线'
        };
      }

      case 'deleteAnnouncement': {
        // 删除公告（管理员）
        const currentUser = await getCurrentUser();

        if (!currentUser || currentUser.role_id !== 1) {
          return {
            success: false,
            error: '权限不足：需要系统管理员权限'
          };
        }

        const { announcement_id } = data;

        const announcements = db.collection('announcements');

        // 获取公告信息用于审计
        const { data: announcementData } = await announcements.doc(announcement_id).get();

        await announcements.doc(announcement_id).remove();

        // 记录审计日志
        await logAudit('announcement_deleted', {
          user_id: currentUser.user_id,
          user_name: currentUser.name,
          resource_type: 'announcement',
          resource_id: announcement_id,
          old_value: { title: announcementData?.title }
        });

        return {
          success: true,
          message: '公告删除成功'
        };
      }

      // ============ 消息模板管理 ============

      case 'listMessageTemplates': {
        // 获取消息模板列表（管理员）
        const currentUser = await getCurrentUser();

        if (!currentUser || currentUser.role_id !== 1) {
          return {
            success: false,
            error: '权限不足：需要系统管理员权限'
          };
        }

        const templates = db.collection('message_templates');
        const { data } = await templates.orderBy('scene', 'asc').get();

        return {
          success: true,
          templates: data
        };
      }

      case 'getMessageTemplate': {
        // 获取单个消息模板
        const { template_id } = data;
        const templates = db.collection('message_templates');

        const { data: result } = await templates.doc(template_id).get();

        return {
          success: true,
          template: result
        };
      }

      case 'createMessageTemplate': {
        // 创建消息模板（管理员）
        const currentUser = await getCurrentUser();

        if (!currentUser || currentUser.role_id !== 1) {
          return {
            success: false,
            error: '权限不足：需要系统管理员权限'
          };
        }

        const { scene, scene_name, title, content, variables } = data;

        if (!scene || !title || !content) {
          return {
            success: false,
            error: '场景、标题和内容不能为空'
          };
        }

        const templates = db.collection('message_templates');

        const result = await templates.add({
          data: {
            scene,
            scene_name: scene_name || scene,
            title,
            content,
            variables: variables || [],
            enabled: true,
            created_at: new Date(),
            updated_at: new Date()
          }
        });

        // 记录审计日志
        await logAudit('message_template_created', {
          user_id: currentUser.user_id,
          user_name: currentUser.name,
          resource_type: 'message_template',
          resource_id: result._id,
          new_value: { scene, title }
        });

        return {
          success: true,
          message: '消息模板创建成功',
          template_id: result._id
        };
      }

      case 'updateMessageTemplate': {
        // 更新消息模板（管理员）
        const currentUser = await getCurrentUser();

        if (!currentUser || currentUser.role_id !== 1) {
          return {
            success: false,
            error: '权限不足：需要系统管理员权限'
          };
        }

        const { template_id, title, content, variables } = data;

        if (!template_id) {
          return {
            success: false,
            error: '缺少模板ID'
          };
        }

        const templates = db.collection('message_templates');

        const updateData = {
          updated_at: new Date()
        };

        if (title !== undefined) updateData.title = title;
        if (content !== undefined) updateData.content = content;
        if (variables !== undefined) updateData.variables = variables;

        await templates.doc(template_id).update({
          data: updateData
        });

        // 记录审计日志
        await logAudit('message_template_updated', {
          user_id: currentUser.user_id,
          user_name: currentUser.name,
          resource_type: 'message_template',
          resource_id: template_id,
          new_value: updateData
        });

        return {
          success: true,
          message: '消息模板更新成功'
        };
      }

      case 'toggleMessageTemplate': {
        // 启用/停用消息模板（管理员）
        const currentUser = await getCurrentUser();

        if (!currentUser || currentUser.role_id !== 1) {
          return {
            success: false,
            error: '权限不足：需要系统管理员权限'
          };
        }

        const { template_id, enabled } = data;

        const templates = db.collection('message_templates');

        await templates.doc(template_id).update({
          data: {
            enabled: enabled,
            updated_at: new Date()
          }
        });

        // 记录审计日志
        await logAudit('message_template_toggled', {
          user_id: currentUser.user_id,
          user_name: currentUser.name,
          resource_type: 'message_template',
          resource_id: template_id,
          new_value: { enabled }
        });

        return {
          success: true,
          message: enabled ? '消息模板已启用' : '消息模板已停用'
        };
      }

      case 'deleteMessageTemplate': {
        // 删除消息模板（管理员）
        const currentUser = await getCurrentUser();

        if (!currentUser || currentUser.role_id !== 1) {
          return {
            success: false,
            error: '权限不足：需要系统管理员权限'
          };
        }

        const { template_id } = data;

        const templates = db.collection('message_templates');

        // 获取模板信息用于审计
        const { data: templateData } = await templates.doc(template_id).get();

        await templates.doc(template_id).remove();

        // 记录审计日志
        await logAudit('message_template_deleted', {
          user_id: currentUser.user_id,
          user_name: currentUser.name,
          resource_type: 'message_template',
          resource_id: template_id,
          old_value: { scene: templateData?.scene, title: templateData?.title }
        });

        return {
          success: true,
          message: '消息模板删除成功'
        };
      }

      // ============ 用户管理增强 ============

      case 'enableUser': {
        // 启用用户（管理员）
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

      case 'disableUser': {
        // 停用用户（管理员）
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

      case 'resetUserPassword': {
        // 重置用户密码（管理员）
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

      // ============ 审计日志查询 ============

      case 'listAuditLogs': {
        // 获取审计日志列表（管理员）
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

      case 'getAuditLogActions': {
        // 获取所有审计动作类型（用于筛选）
        return {
          success: true,
          actions: [
            { value: 'user_login', label: '用户登录' },
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
            { value: 'announcement_deleted', label: '删除公告' },
            { value: 'message_template_created', label: '创建模板' },
            { value: 'message_template_updated', label: '更新模板' },
            { value: 'message_template_toggled', label: '切换模板状态' },
            { value: 'message_template_deleted', label: '删除模板' }
          ]
        };
      }

      // ============ 系统配置管理 ============

      case 'getSystemConfig': {
        // 获取系统配置
        const configs = db.collection('system_config');
        const { data } = await configs.get();

        // 将配置数组转换为对象
        const configMap = {};
        data.forEach(item => {
          configMap[item.key] = item.value;
        });

        return {
          success: true,
          config: configMap,
          rawConfig: data
        };
      }

      case 'updateSystemConfig': {
        // 更新系统配置（管理员）
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

      case 'batchUpdateSystemConfig': {
        // 批量更新系统配置（管理员）
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

      default:
        return {
          success: false,
          error: `未知操作: ${action}`,
          available_actions: [
            'login', 'passwordLogin', 'getUserInfo', 'updateProfile', 'getUserById',
            'listUsers', 'listRoles', 'updateRolePermissions', 'migratePasswords', 'changePassword',
            'createUser', 'updateUser', 'deleteUser', 'getSupervisors',
            'enableUser', 'disableUser', 'resetUserPassword',
            'listAnnouncements', 'getAnnouncement', 'createAnnouncement', 'updateAnnouncement',
            'publishAnnouncement', 'offlineAnnouncement', 'deleteAnnouncement',
            'listMessageTemplates', 'getMessageTemplate', 'createMessageTemplate',
            'updateMessageTemplate', 'toggleMessageTemplate', 'deleteMessageTemplate'
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
