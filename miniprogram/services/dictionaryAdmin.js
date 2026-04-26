/**
 * 字典管理服务（管理端）
 * 封装 dictionaryManager 云函数的管理操作
 * 注意：普通字典查询请使用 services/dictionary.js
 */

const { callCloud, callCloudSilent } = require('../utils/cloudCall');

/**
 * 获取所有字典列表
 */
const listDictionaries = async () => {
  const result = await callCloudSilent('dictionaryManager', {
    action: 'list'
  });
  return result;
};

/**
 * 获取单个字典（含所有项，包括禁用的）
 */
const getDictionary = async (dictKey) => {
  const result = await callCloudSilent('dictionaryManager', {
    action: 'get',
    data: { dict_key: dictKey, include_disabled: true }
  });
  return result;
};

/**
 * 创建字典
 */
const createDictionary = async (data) => {
  const result = await callCloud('dictionaryManager', {
    action: 'create',
    data
  }, { loadingText: '创建中...' });
  return result;
};

/**
 * 更新字典（项列表）
 */
const updateDictionary = async (dictKey, items) => {
  const result = await callCloud('dictionaryManager', {
    action: 'update',
    data: { dict_key: dictKey, items }
  }, { loadingText: '保存中...' });
  return result;
};

/**
 * 删除字典
 */
const deleteDictionary = async (dictKey) => {
  const result = await callCloud('dictionaryManager', {
    action: 'delete',
    data: { dict_key: dictKey }
  }, { loadingText: '删除中...' });
  return result;
};

module.exports = {
  listDictionaries,
  getDictionary,
  createDictionary,
  updateDictionary,
  deleteDictionary
};
