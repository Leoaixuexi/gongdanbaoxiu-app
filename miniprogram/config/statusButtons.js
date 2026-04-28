/**
 * 工单列表页状态按钮配置
 * 从 index/index.js 提取
 */

/**
 * 根据角色获取状态按钮列表
 */
function getStatusButtonsByRole(isPropertyStaff, isMaintenanceWorker, isManager) {
  // 行政经理 / 办美员工 共用同一组状态按钮（含"全部"）
  if (isManager || isPropertyStaff) {
    return [
      { key: 'all', label: '全部', status: null },
      { key: 'reported', label: '已提报', status: 'Pending Repair' },
      { key: 'maintenance', label: '维修中', status: 'In Progress' },
      { key: 'review', label: '待复核', status: 'Repaired' },
      { key: 'rework', label: '需返工', status: 'Needs Rework' },
      { key: 'completed', label: '已完成', status: 'Completed' }
    ];
  } else if (isMaintenanceWorker) {
    return [
      { key: 'pending_accept', label: '待接单', status: 'Pending Repair' },
      { key: 'maintenance', label: '维修中', status: 'In Progress' },
      { key: 'review', label: '待复核', status: 'Repaired' },
      { key: 'rework', label: '需返工', status: 'Needs Rework' },
      { key: 'completed', label: '已完成', status: 'Completed' }
    ];
  }
  return [];
}

/**
 * 根据角色获取筛选行配置
 */
function getFilterRowsByRole(isManager, isMaintenanceWorker) {
  const rows = [
    { id: "floor", label: "楼层", hasArrow: true, value: '', placeholder: '' }
  ];

  if (!isMaintenanceWorker) {
    rows.push({ id: "owner", label: "责任方", hasArrow: true, value: '', placeholder: '' });
  }

  rows.push({ id: "category", label: "工单类别", hasArrow: true, value: '', placeholder: '' });
  rows.push({ id: "reporter", label: "报修人", hasArrow: true, value: '', placeholder: '' });
  rows.push({ id: "priority", label: "优先级", hasArrow: true, value: '', placeholder: '' });

  return rows;
}

module.exports = {
  getStatusButtonsByRole,
  getFilterRowsByRole
};
