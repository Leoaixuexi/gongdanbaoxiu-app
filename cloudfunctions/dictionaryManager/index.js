/**
 * 字典管理云函数
 * 提供字典的 CRUD 操作
 */

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 获取当前用户信息
 */
async function getCurrentUser(openid) {
  if (!openid) return null;

  const { data } = await db.collection('users').where({
    wechat_openid: openid
  }).get();

  return data.length > 0 ? data[0] : null;
}

/**
 * 获取字典列表
 */
async function listDictionaries() {
  const { data } = await db.collection('dictionaries')
    .orderBy('dict_key', 'asc')
    .get();

  return data.map(dict => ({
    _id: dict._id,
    dict_key: dict.dict_key,
    dict_name: dict.dict_name,
    description: dict.description,
    is_system: dict.is_system,
    item_count: dict.items ? dict.items.filter(i => i.enabled !== false).length : 0,
    created_at: dict.created_at,
    updated_at: dict.updated_at
  }));
}

/**
 * 获取单个字典
 */
async function getDictionary(dictKey, includeDisabled = false) {
  const { data } = await db.collection('dictionaries').where({
    dict_key: dictKey
  }).get();

  if (data.length === 0) {
    return null;
  }

  const dict = data[0];

  // 过滤并排序字典项
  let items = dict.items || [];
  if (!includeDisabled) {
    items = items.filter(item => item.enabled !== false);
  }
  items.sort((a, b) => (a.sort || 0) - (b.sort || 0));

  return {
    ...dict,
    items
  };
}

/**
 * 批量获取字典
 */
async function getBatchDictionaries(keys) {
  const result = {};

  for (const key of keys) {
    const dict = await getDictionary(key);
    if (dict) {
      result[key] = dict.items.map(item => ({
        value: item.value,
        label: item.label || item.value
      }));
    }
  }

  return result;
}

/**
 * 创建字典
 */
async function createDictionary(data) {
  const { dict_key, dict_name, description, items = [] } = data;

  // 检查是否已存在
  const existing = await getDictionary(dict_key, true);
  if (existing) {
    throw new Error(`字典 ${dict_key} 已存在`);
  }

  // 处理字典项
  const processedItems = items.map((item, index) => ({
    value: item.value,
    label: item.label || item.value,
    sort: item.sort !== undefined ? item.sort : index * 10,
    enabled: item.enabled !== false,
    extra: item.extra || {}
  }));

  const now = new Date();
  const result = await db.collection('dictionaries').add({
    data: {
      dict_key,
      dict_name,
      description: description || '',
      items: processedItems,
      is_system: false,
      created_at: now,
      updated_at: now
    }
  });

  return { _id: result._id };
}

/**
 * 更新字典
 */
async function updateDictionary(dictKey, data) {
  const existing = await getDictionary(dictKey, true);
  if (!existing) {
    throw new Error(`字典 ${dictKey} 不存在`);
  }

  const updateData = {
    updated_at: new Date()
  };

  if (data.dict_name !== undefined) {
    updateData.dict_name = data.dict_name;
  }

  if (data.description !== undefined) {
    updateData.description = data.description;
  }

  if (data.items !== undefined) {
    updateData.items = data.items.map((item, index) => ({
      value: item.value,
      label: item.label || item.value,
      sort: item.sort !== undefined ? item.sort : index * 10,
      enabled: item.enabled !== false,
      extra: item.extra || {}
    }));
  }

  await db.collection('dictionaries').where({
    dict_key: dictKey
  }).update({
    data: updateData
  });

  return { success: true };
}

/**
 * 删除字典
 */
async function deleteDictionary(dictKey) {
  const existing = await getDictionary(dictKey, true);
  if (!existing) {
    throw new Error(`字典 ${dictKey} 不存在`);
  }

  if (existing.is_system) {
    throw new Error('系统字典不可删除');
  }

  await db.collection('dictionaries').where({
    dict_key: dictKey
  }).remove();

  return { success: true };
}

/**
 * 主函数
 */
exports.main = async (event, context) => {
  const { action, data = {} } = event;
  const { OPENID } = cloud.getWXContext();

  console.log(`[DictionaryManager] Action: ${action}, OpenID: ${OPENID}`);

  try {
    // 身份验证：确保用户已登录
    if (!OPENID) {
      return {
        success: false,
        error: '请先登录后再操作'
      };
    }

    // 需要写权限的操作
    const adminActions = ['create', 'update', 'delete'];
    if (adminActions.includes(action)) {
      const user = await getCurrentUser(OPENID);
      // 物料相关字典：放给 canManageMaterial（管理员/行政经理/办美员工）写
      const MANAGE_MATERIAL_DICTS = ['material_category', 'material_location'];
      const isManageMaterialDict = data && MANAGE_MATERIAL_DICTS.includes(data.dict_key);
      const canManageMaterial = user && [1, 2, 4].includes(user.role_id) && user.active !== false;
      const isAdminUser = user && user.role_id === 1 && user.active !== false;

      const allowed = isAdminUser || (isManageMaterialDict && canManageMaterial);
      if (!allowed) {
        return {
          success: false,
          error: '无权限：只有管理员可以执行此操作'
        };
      }
    }

    switch (action) {
      case 'list':
        const list = await listDictionaries();
        return {
          success: true,
          data: list
        };

      case 'get':
        const dict = await getDictionary(data.dict_key, data.include_disabled);
        if (!dict) {
          return {
            success: false,
            error: `字典 ${data.dict_key} 不存在`
          };
        }
        return {
          success: true,
          data: dict
        };

      case 'getBatch':
        const batch = await getBatchDictionaries(data.keys || []);
        return {
          success: true,
          data: batch
        };

      case 'create':
        const created = await createDictionary(data);
        return {
          success: true,
          data: created
        };

      case 'update':
        await updateDictionary(data.dict_key, data);
        return {
          success: true
        };

      case 'delete':
        await deleteDictionary(data.dict_key);
        return {
          success: true
        };

      default:
        return {
          success: false,
          error: `未知操作: ${action}`,
          available_actions: ['list', 'get', 'getBatch', 'create', 'update', 'delete']
        };
    }

  } catch (error) {
    console.error('[DictionaryManager] Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
