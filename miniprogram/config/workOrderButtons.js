/**
 * 工单详情页按钮权限配置
 * 从 work-order-detail/index.js 提取
 */

/**
 * 按钮权限配置表
 * 根据工单状态和用户角色决定显示哪些按钮
 */
const BUTTON_CONFIG = {
  'Pending Repair': {
    managerOrSubmitter: {
      showThreeDots: true,
      showEditBtn: true,
      showDeleteInMenu: true,
      showUrgeAcceptInMenu: true
    },
    assignedTechnician: {
      showAcceptBtn: true
    }
  },
  'In Progress': {
    assignedTechnician: {
      showThreeDots: true,
      showConfirmRepairBtn: true,
      showEmptyMenu: true
    },
    managerOrSubmitter: {
      showThreeDots: true,
      showUrgeRepairBtn: true,
      showEmptyMenu: true
    }
  },
  'Repaired': {
    assignedTechnician: {
      showThreeDots: true,
      showUrgeReviewBtn: true,
      showEmptyMenu: true
    },
    managerAndSubmitter: {
      showThreeDots: true,
      showReviewedBtn: true,
      showNeedsReworkInMenu: true
    },
    managerNotSubmitter: {
      showThreeDots: true,
      showUrgeReviewBtn: true,
      showEmptyMenu: true
    },
    staffSubmitter: {
      showThreeDots: true,
      showReviewedBtn: true,
      showNeedsReworkInMenu: true
    }
  },
  'Needs Rework': {
    assignedTechnician: {
      showThreeDots: true,
      showConfirmRepairBtn: true,
      showEmptyMenu: true
    },
    managerOrSubmitter: {
      showThreeDots: true,
      showUrgeRepairBtn: true,
      showEmptyMenu: true
    }
  },
  'Completed': {
    all: {
      showThreeDots: true,
      showEmptyMenu: true
    }
  }
};

/**
 * 状态文本映射表
 */
const STATUS_TEXT_MAP = {
  'Pending Repair': '已提报',
  'Pending Assignment': '待接单',
  'In Progress': '维修中',
  'Repaired': '待复核',
  'Completed': '已完成',
  'Needs Rework': '需返工',
  'Under Review': '待复核',
  '已提报': '已提报',
  '待接单': '待接单',
  '维修中': '维修中',
  '已修复': '待复核',
  '待复核': '待复核',
  '已完成': '已完成',
  '需返工': '需返工'
};

/**
 * 步骤条配置
 */
const STEPPER_CONFIG = {
  steps: ['已提报', '维修中', '待复核', '已完成'],
  statusStepMap: {
    'Pending Repair': 0,
    'Pending Assignment': 0,
    'In Progress': 1,
    'Repaired': 2,
    'Under Review': 2,
    'Completed': 3,
    'Needs Rework': 1
  }
};

/**
 * 根据状态和角色获取按钮配置
 */
function getButtonConfig(status, roles) {
  const { isPropertyManager, isPropertyStaff, isSubmitter, isAssignedTechnician } = roles;
  const statusConfig = BUTTON_CONFIG[status];

  if (!statusConfig) {
    return {};
  }

  if (status === 'Completed') {
    return statusConfig.all || {};
  }

  if (status === 'Repaired') {
    if (isAssignedTechnician) {
      return statusConfig.assignedTechnician || {};
    }
    if (isPropertyManager && isSubmitter) {
      return statusConfig.managerAndSubmitter || {};
    }
    if (isPropertyManager) {
      return statusConfig.managerNotSubmitter || {};
    }
    if (isPropertyStaff && isSubmitter) {
      return statusConfig.staffSubmitter || {};
    }
    return {};
  }

  if (isAssignedTechnician && statusConfig.assignedTechnician) {
    return statusConfig.assignedTechnician;
  }
  if ((isPropertyManager || (isPropertyStaff && isSubmitter)) && statusConfig.managerOrSubmitter) {
    return statusConfig.managerOrSubmitter;
  }

  return {};
}

module.exports = {
  BUTTON_CONFIG,
  STATUS_TEXT_MAP,
  STEPPER_CONFIG,
  getButtonConfig
};
