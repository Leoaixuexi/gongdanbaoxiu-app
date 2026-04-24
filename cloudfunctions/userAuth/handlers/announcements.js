/**
 * 公告管理处理器
 * listAnnouncements, getAnnouncement, createAnnouncement, updateAnnouncement,
 * publishAnnouncement, offlineAnnouncement, deleteAnnouncement
 */

const {
  db,
  _,
  logAudit
} = require('../helpers');

/**
 * 获取公告列表
 */
async function handleListAnnouncements(openid, data, getCurrentUser) {
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

  const { data: allAnnouncements } = await query.orderBy('created_at', 'desc').get();

  // 过滤掉用户已隐藏的公告
  let filteredAnnouncements = allAnnouncements;
  if (currentUser) {
    try {
      const hiddenCollection = db.collection('user_hidden_announcements');
      const { data: hiddenRecords } = await hiddenCollection.where({
        user_id: currentUser.user_id
      }).get();
      const hiddenIds = hiddenRecords.map(r => r.announcement_id);
      if (hiddenIds.length > 0) {
        filteredAnnouncements = allAnnouncements.filter(a => !hiddenIds.includes(a._id));
      }
    } catch (e) {
      // 集合不存在时忽略错误
      console.log('[listAnnouncements] user_hidden_announcements collection may not exist:', e.message);
    }
  }

  return {
    success: true,
    announcements: filteredAnnouncements
  };
}

/**
 * 获取单个公告详情
 */
async function handleGetAnnouncement(openid, data) {
  const { announcement_id } = data;
  const announcements = db.collection('announcements');

  const { data: result } = await announcements.doc(announcement_id).get();

  return {
    success: true,
    announcement: result
  };
}

/**
 * 创建公告（管理员）
 */
async function handleCreateAnnouncement(openid, data, getCurrentUser) {
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

/**
 * 更新公告（管理员）
 */
async function handleUpdateAnnouncement(openid, data, getCurrentUser) {
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

/**
 * 发布公告（管理员）
 */
async function handlePublishAnnouncement(openid, data, getCurrentUser) {
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

/**
 * 下线公告（管理员）
 */
async function handleOfflineAnnouncement(openid, data, getCurrentUser) {
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

/**
 * 删除公告（管理员）
 */
async function handleDeleteAnnouncement(openid, data, getCurrentUser) {
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

module.exports = {
  handleListAnnouncements,
  handleGetAnnouncement,
  handleCreateAnnouncement,
  handleUpdateAnnouncement,
  handlePublishAnnouncement,
  handleOfflineAnnouncement,
  handleDeleteAnnouncement
};
