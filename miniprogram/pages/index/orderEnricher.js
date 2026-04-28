/**
 * 工单数据增强
 * 从 index.js 提取的纯函数
 */

const STATUS_COLOR_MAP = {
  'Pending Repair': 'blue',
  'In Progress': 'orange',
  'Repaired': 'amber',
  'Needs Rework': 'red',
  'Completed': 'green'
};

const STATUS_TEXT_BY_ROLE = {
  manager: {
    'Pending Repair': '已提报',
    'In Progress': '维修中',
    'Repaired': '待复核',
    'Pending Review': '待复核',
    'Needs Rework': '需返工',
    'Completed': '已完成'
  },
  maintenanceWorker: {
    'Pending Repair': '待接单',
    'In Progress': '维修中',
    'Repaired': '待复核',
    'Needs Rework': '需返工',
    'Completed': '已完成'
  },
  propertyStaff: {
    'Pending Repair': '已提报',
    'In Progress': '维修中',
    'Repaired': '待复核',
    'Needs Rework': '需返工',
    'Completed': '已完成'
  }
};

const STATUS_CLASS_MAP = {
  managerOrWorker: {
    'Pending Repair': 'status-reported',
    'In Progress': 'status-maintenance',
    'Repaired': 'status-review',
    'Pending Review': 'status-review',
    'Needs Rework': 'status-rework',
    'Completed': 'status-completed'
  },
  propertyStaff: {
    'Pending Repair': 'status-reported',
    'In Progress': 'status-maintenance',
    'Repaired': 'status-review',
    'Needs Rework': 'status-rework',
    'Completed': 'status-completed'
  }
};

/**
 * 增强单个工单数据，添加显示属性
 */
function enrichOrderData(order, { isMaintenanceWorker, isManager }) {
  // 根据角色选择文本映射
  let statusTextMap;
  if (isManager) {
    statusTextMap = STATUS_TEXT_BY_ROLE.manager;
  } else if (isMaintenanceWorker) {
    statusTextMap = STATUS_TEXT_BY_ROLE.maintenanceWorker;
  } else {
    statusTextMap = STATUS_TEXT_BY_ROLE.propertyStaff;
  }

  const statusClassMap = (isManager || isMaintenanceWorker)
    ? STATUS_CLASS_MAP.managerOrWorker
    : STATUS_CLASS_MAP.propertyStaff;

  // 格式化创建时间
  let formattedTime = '未知时间';
  if (order.created_at) {
    const createdAt = order.created_at.$date ? new Date(order.created_at.$date) : new Date(order.created_at);
    const year = createdAt.getFullYear();
    const month = String(createdAt.getMonth() + 1).padStart(2, '0');
    const day = String(createdAt.getDate()).padStart(2, '0');
    const hour = String(createdAt.getHours()).padStart(2, '0');
    const minute = String(createdAt.getMinutes()).padStart(2, '0');
    formattedTime = `${year}-${month}-${day}\u2003${hour}:${minute}`;
  }

  // 过滤有效照片
  let validPhotos = [];
  if (order.photos && Array.isArray(order.photos)) {
    validPhotos = order.photos.filter(photo => {
      return photo && (photo.startsWith('http://') || photo.startsWith('https://') || photo.startsWith('cloud://'));
    });
  }

  // 初始化照片加载状态
  const photoLoaded = {};
  const photoError = {};
  validPhotos.forEach((_, idx) => {
    photoLoaded[idx] = false;
    photoError[idx] = false;
  });

  return {
    ...order,
    statusColor: STATUS_COLOR_MAP[order.status] || 'gray',
    statusText: statusTextMap[order.status] || order.status,
    statusClass: statusClassMap[order.status] || 'status-processing',
    created_at: formattedTime,
    photos: validPhotos,
    photoLoaded,
    photoError
  };
}

module.exports = { enrichOrderData };
