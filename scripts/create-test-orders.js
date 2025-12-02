/**
 * 创建测试工单脚本
 * 直接向云数据库插入6条测试工单
 */

// 测试工单数据
const testOrders = [
  {
    order_number: 'WO20251120001',
    floor: '3楼',
    location: '办公区A区301室',
    fault_type: {
      type_id: 1,
      name: '电路故障',
      parent_name: '电气系统'
    },
    priority: 'High',
    description: '办公室灯光频繁闪烁,影响正常办公,需尽快处理',
    photos: [],
    status: 'Pending Repair',
    submitter: {
      user_id: 1,
      name: '张三',
      phone: '13800138000'
    },
    assigned_technician: {
      user_id: 2,
      name: '维修员李四',
      phone: '13900139000'
    },
    created_at: new Date('2025-01-20T09:30:00'),
    assigned_at: new Date('2025-01-20T09:30:00'),
    started_at: null,
    repaired_at: null,
    reviewed_at: null,
    completed_at: null,
    sla_deadline: new Date('2025-01-21T09:30:00'), // 24小时
    is_overdue: false,
    rework_count: 0,
    completion_notes: null,
    review_notes: null,
    updated_at: new Date('2025-01-20T09:30:00'),
    status_history: [
      {
        from_status: null,
        to_status: 'Pending Repair',
        changed_by: { user_id: 1, name: '张三' },
        changed_at: new Date('2025-01-20T09:30:00'),
        notes: '工单创建'
      }
    ]
  },
  {
    order_number: 'WO20251120002',
    floor: '2楼',
    location: '会议室B202',
    fault_type: {
      type_id: 2,
      name: '空调故障',
      parent_name: '空调系统'
    },
    priority: 'Normal',
    description: '会议室空调制冷效果不佳,温度降不下来',
    photos: [],
    status: 'In Progress',
    submitter: {
      user_id: 1,
      name: '张三',
      phone: '13800138000'
    },
    assigned_technician: {
      user_id: 2,
      name: '维修员李四',
      phone: '13900139000'
    },
    created_at: new Date('2025-01-19T14:20:00'),
    assigned_at: new Date('2025-01-19T14:20:00'),
    started_at: new Date('2025-01-20T08:00:00'),
    repaired_at: null,
    reviewed_at: null,
    completed_at: null,
    sla_deadline: new Date('2025-01-22T14:20:00'), // 72小时
    is_overdue: false,
    rework_count: 0,
    completion_notes: null,
    review_notes: null,
    updated_at: new Date('2025-01-20T08:00:00'),
    status_history: [
      {
        from_status: null,
        to_status: 'Pending Repair',
        changed_by: { user_id: 1, name: '张三' },
        changed_at: new Date('2025-01-19T14:20:00'),
        notes: '工单创建'
      },
      {
        from_status: 'Pending Repair',
        to_status: 'In Progress',
        changed_by: { user_id: 2, name: '维修员李四' },
        changed_at: new Date('2025-01-20T08:00:00'),
        notes: '开始维修'
      }
    ]
  },
  {
    order_number: 'WO20251120003',
    floor: '1楼',
    location: '大厅主入口',
    fault_type: {
      type_id: 3,
      name: '门禁故障',
      parent_name: '安防系统'
    },
    priority: 'Emergency',
    description: '大厅主入口门禁系统完全失效,无法刷卡进出,存在安全隐患',
    photos: [],
    status: 'Repaired',
    submitter: {
      user_id: 1,
      name: '张三',
      phone: '13800138000'
    },
    assigned_technician: {
      user_id: 2,
      name: '维修员李四',
      phone: '13900139000'
    },
    created_at: new Date('2025-01-20T07:00:00'),
    assigned_at: new Date('2025-01-20T07:00:00'),
    started_at: new Date('2025-01-20T07:10:00'),
    repaired_at: new Date('2025-01-20T09:00:00'),
    reviewed_at: null,
    completed_at: null,
    sla_deadline: new Date('2025-01-20T09:00:00'), // 2小时
    is_overdue: false,
    rework_count: 0,
    completion_notes: '已更换门禁控制器,系统恢复正常',
    review_notes: null,
    updated_at: new Date('2025-01-20T09:00:00'),
    status_history: [
      {
        from_status: null,
        to_status: 'Pending Repair',
        changed_by: { user_id: 1, name: '张三' },
        changed_at: new Date('2025-01-20T07:00:00'),
        notes: '工单创建'
      },
      {
        from_status: 'Pending Repair',
        to_status: 'In Progress',
        changed_by: { user_id: 2, name: '维修员李四' },
        changed_at: new Date('2025-01-20T07:10:00'),
        notes: '开始紧急维修'
      },
      {
        from_status: 'In Progress',
        to_status: 'Repaired',
        changed_by: { user_id: 2, name: '维修员李四' },
        changed_at: new Date('2025-01-20T09:00:00'),
        notes: '已更换门禁控制器,系统恢复正常'
      }
    ]
  },
  {
    order_number: 'WO20251120004',
    floor: '4楼',
    location: '卫生间401',
    fault_type: {
      type_id: 4,
      name: '水管漏水',
      parent_name: '给排水系统'
    },
    priority: 'High',
    description: '卫生间洗手盆下方水管漏水,地面积水严重',
    photos: [],
    status: 'Completed',
    submitter: {
      user_id: 1,
      name: '张三',
      phone: '13800138000'
    },
    assigned_technician: {
      user_id: 2,
      name: '维修员李四',
      phone: '13900139000'
    },
    created_at: new Date('2025-01-18T15:30:00'),
    assigned_at: new Date('2025-01-18T15:30:00'),
    started_at: new Date('2025-01-18T16:00:00'),
    repaired_at: new Date('2025-01-18T17:30:00'),
    reviewed_at: new Date('2025-01-19T09:00:00'),
    completed_at: new Date('2025-01-19T09:00:00'),
    sla_deadline: new Date('2025-01-19T15:30:00'), // 24小时
    is_overdue: false,
    rework_count: 0,
    completion_notes: '已更换漏水管道接头,测试无渗漏',
    review_notes: '维修质量良好,验收通过',
    updated_at: new Date('2025-01-19T09:00:00'),
    status_history: [
      {
        from_status: null,
        to_status: 'Pending Repair',
        changed_by: { user_id: 1, name: '张三' },
        changed_at: new Date('2025-01-18T15:30:00'),
        notes: '工单创建'
      },
      {
        from_status: 'Pending Repair',
        to_status: 'In Progress',
        changed_by: { user_id: 2, name: '维修员李四' },
        changed_at: new Date('2025-01-18T16:00:00'),
        notes: '开始维修'
      },
      {
        from_status: 'In Progress',
        to_status: 'Repaired',
        changed_by: { user_id: 2, name: '维修员李四' },
        changed_at: new Date('2025-01-18T17:30:00'),
        notes: '已更换漏水管道接头,测试无渗漏'
      },
      {
        from_status: 'Repaired',
        to_status: 'Completed',
        changed_by: { user_id: 1, name: '张三' },
        changed_at: new Date('2025-01-19T09:00:00'),
        notes: '维修质量良好,验收通过'
      }
    ]
  },
  {
    order_number: 'WO20251120005',
    floor: 'B1',
    location: '地下停车场C区',
    fault_type: {
      type_id: 5,
      name: '照明故障',
      parent_name: '电气系统'
    },
    priority: 'Normal',
    description: '地下停车场C区多盏照明灯不亮,光线昏暗',
    photos: [],
    status: 'Pending Repair',
    submitter: {
      user_id: 1,
      name: '张三',
      phone: '13800138000'
    },
    assigned_technician: {
      user_id: 2,
      name: '维修员李四',
      phone: '13900139000'
    },
    created_at: new Date('2025-01-20T11:00:00'),
    assigned_at: new Date('2025-01-20T11:00:00'),
    started_at: null,
    repaired_at: null,
    reviewed_at: null,
    completed_at: null,
    sla_deadline: new Date('2025-01-23T11:00:00'), // 72小时
    is_overdue: false,
    rework_count: 0,
    completion_notes: null,
    review_notes: null,
    updated_at: new Date('2025-01-20T11:00:00'),
    status_history: [
      {
        from_status: null,
        to_status: 'Pending Repair',
        changed_by: { user_id: 1, name: '张三' },
        changed_at: new Date('2025-01-20T11:00:00'),
        notes: '工单创建'
      }
    ]
  },
  {
    order_number: 'WO20251120006',
    floor: '5楼',
    location: '电梯3号',
    fault_type: {
      type_id: 6,
      name: '电梯故障',
      parent_name: '电梯系统'
    },
    priority: 'Emergency',
    description: '3号电梯运行异常,发出异响,已紧急停用',
    photos: [],
    status: 'In Progress',
    submitter: {
      user_id: 1,
      name: '张三',
      phone: '13800138000'
    },
    assigned_technician: {
      user_id: 2,
      name: '维修员李四',
      phone: '13900139000'
    },
    created_at: new Date('2025-01-20T10:00:00'),
    assigned_at: new Date('2025-01-20T10:00:00'),
    started_at: new Date('2025-01-20T10:15:00'),
    repaired_at: null,
    reviewed_at: null,
    completed_at: null,
    sla_deadline: new Date('2025-01-20T12:00:00'), // 2小时
    is_overdue: false,
    rework_count: 0,
    completion_notes: null,
    review_notes: null,
    updated_at: new Date('2025-01-20T10:15:00'),
    status_history: [
      {
        from_status: null,
        to_status: 'Pending Repair',
        changed_by: { user_id: 1, name: '张三' },
        changed_at: new Date('2025-01-20T10:00:00'),
        notes: '工单创建'
      },
      {
        from_status: 'Pending Repair',
        to_status: 'In Progress',
        changed_by: { user_id: 2, name: '维修员李四' },
        changed_at: new Date('2025-01-20T10:15:00'),
        notes: '紧急处理中'
      }
    ]
  }
];

console.log('测试工单数据已准备完成!');
console.log('共创建', testOrders.length, '条测试工单');
console.log('\n工单概览:');
testOrders.forEach((order, index) => {
  console.log(`${index + 1}. ${order.order_number} - ${order.location} - ${order.fault_type.name} - ${order.status} - 优先级:${order.priority}`);
});

console.log('\n请在微信开发者工具的云开发控制台中,选择 work_orders 集合,');
console.log('然后点击"导入",选择包含以上数据的 JSON 文件进行导入。');

// 导出数据供导入使用
module.exports = testOrders;
