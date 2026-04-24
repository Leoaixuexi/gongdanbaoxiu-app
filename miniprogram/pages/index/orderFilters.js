/**
 * 工单列表筛选逻辑
 * 从 index.js 提取的纯函数
 */

/**
 * 按用户角色筛选工单
 */
function filterByUserRole(orders, { isPropertyStaff, isMaintenanceWorker, isManager, userDepartment, userId }) {
  if (isManager) {
    return orders;
  } else if (isPropertyStaff) {
    return orders.filter(order => {
      if (order.status !== 'Completed') {
        return true;
      }
      return order.submitter?.user_id === userId;
    });
  } else if (isMaintenanceWorker && userDepartment) {
    return orders.filter(order => {
      return order.responsible_party === userDepartment;
    });
  }
  return orders;
}

/**
 * 按时间范围筛选工单
 */
function filterByTimeRange(orders, { activeTab, startDate, endDate }) {
  const now = new Date();

  if (!activeTab || activeTab === '') {
    return orders;
  }

  const parseOrderDate = (order) => {
    const createdAt = order.created_at;
    if (!createdAt) return null;
    return createdAt.$date ? new Date(createdAt.$date) : new Date(createdAt);
  };

  if (activeTab === 'today') {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return orders.filter(order => {
      const orderDate = parseOrderDate(order);
      return orderDate && orderDate >= today;
    });
  } else if (activeTab === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return orders.filter(order => {
      const orderDate = parseOrderDate(order);
      return orderDate && orderDate >= weekAgo;
    });
  } else if (activeTab === 'month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return orders.filter(order => {
      const orderDate = parseOrderDate(order);
      return orderDate && orderDate >= monthStart;
    });
  } else if (activeTab === 'date' && startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    return orders.filter(order => {
      const orderDate = parseOrderDate(order);
      return orderDate && orderDate >= start && orderDate <= end;
    });
  }

  return orders;
}

/**
 * 按状态筛选工单
 */
function filterByStatus(orders, { activeStatus, statusButtons }) {
  if (!activeStatus || activeStatus === 'all') {
    return orders;
  }

  const statusButton = statusButtons.find(btn => btn.key === activeStatus);
  if (statusButton && statusButton.status) {
    const targetStatus = statusButton.status;
    return orders.filter(order => order.status === targetStatus);
  }

  return orders;
}

/**
 * 按高级条件筛选工单
 */
function filterByAdvancedCriteria(orders, filterRows) {
  const floorFilter = filterRows.find(r => r.id === 'floor')?.value;
  const ownerFilter = filterRows.find(r => r.id === 'owner')?.value;
  const categoryFilter = filterRows.find(r => r.id === 'category')?.value;
  const reporterFilter = filterRows.find(r => r.id === 'reporter')?.value;
  const priorityFilter = filterRows.find(r => r.id === 'priority')?.value;

  if (!floorFilter && !ownerFilter && !categoryFilter && !reporterFilter && !priorityFilter) {
    return orders;
  }

  return orders.filter(order => {
    if (floorFilter && order.floor !== floorFilter) return false;
    if (ownerFilter && order.responsible_party !== ownerFilter) return false;
    if (categoryFilter && order.order_category !== categoryFilter) return false;
    if (reporterFilter && order.submitter?.name !== reporterFilter) return false;
    if (priorityFilter) {
      const isEmergency = order.priority === 'Emergency';
      if (priorityFilter === '紧急' && !isEmergency) return false;
      if (priorityFilter === '普通' && isEmergency) return false;
    }
    return true;
  });
}

module.exports = {
  filterByUserRole,
  filterByTimeRange,
  filterByStatus,
  filterByAdvancedCriteria
};
