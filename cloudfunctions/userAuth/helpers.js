/**
 * userAuth 共享工具函数和常量
 */

const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// 默认头像配置（云存储路径）
const DEFAULT_AVATARS = {
  male: [
    'cloud://cloud1-7glfhm4r06e030bd.636c-cloud1-7glfhm4r06e030bd-1386591973/avatars/male/man1.png',
    'cloud://cloud1-7glfhm4r06e030bd.636c-cloud1-7glfhm4r06e030bd-1386591973/avatars/male/man2.png',
    'cloud://cloud1-7glfhm4r06e030bd.636c-cloud1-7glfhm4r06e030bd-1386591973/avatars/male/man3.png'
  ],
  female: [
    'cloud://cloud1-7glfhm4r06e030bd.636c-cloud1-7glfhm4r06e030bd-1386591973/avatars/female/wowen1.png',
    'cloud://cloud1-7glfhm4r06e030bd.636c-cloud1-7glfhm4r06e030bd-1386591973/avatars/female/women2.png',
    'cloud://cloud1-7glfhm4r06e030bd.636c-cloud1-7glfhm4r06e030bd-1386591973/avatars/female/women3.png'
  ]
};

/**
 * 根据性别随机获取默认头像
 * @param {number} gender - 1=男, 2=女
 * @returns {string} 头像路径
 */
function getRandomAvatar(gender) {
  const avatars = gender === 1 ? DEFAULT_AVATARS.male : DEFAULT_AVATARS.female;
  return avatars[Math.floor(Math.random() * avatars.length)];
}

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
 * 获取用户信息（通过手机号）
 */
async function getUserByPhone(phone) {
  const users = db.collection('users');

  const { data } = await users.where({
    contact_phone: phone
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
 * 获取角色名称
 * 使用固定映射，与账号管理页面保持一致
 */
function getRoleName(roleId) {
  const roleNames = {
    1: '系统管理员',
    2: '行政经理',
    3: '维修员',
    4: '办美员工'
  };
  return roleNames[roleId] || '员工';
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

module.exports = {
  cloud,
  db,
  _,
  DEFAULT_AVATARS,
  getRandomAvatar,
  getUserByOpenId,
  getUserByUserId,
  getUserByUsername,
  getUserByPhone,
  hashPassword,
  verifyPassword,
  createUser,
  updateLastLogin,
  getUserPermissions,
  getRoleName,
  logAudit
};
