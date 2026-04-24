// 收费工单 mock 数据仓库（单例），供 index/detail/edit 三页共享
// 页面间通过 getAll / getById / update 操作同一份数组

const STATUS_BG = {
  'Pending Repair': '#fed7aa',
  'Completed': '#dcfce7',
}
const STATUS_COLOR = {
  'Pending Repair': '#c2410c',
  'Completed': '#16a34a',
}
const STATUS_TEXT = {
  'Pending Repair': '待维修',
  'Completed': '已完成',
}
const PAY_BG = { '已付': '#dcfce7', '待付': '#fef3c7', '未付': '#f5f5f5' }
const PAY_COLOR = { '已付': '#16a34a', '待付': '#d97706', '未付': '#a3a3a3' }

let ORDERS = [
  {
    id: 'WO-2026-0412',
    order_number: 'WO-2026-0412',
    status: 'Completed',
    priority: 'Normal',
    customer: '华润科技',
    device: '中央空调 MC-200',
    floor: '8楼',
    location: '会议中心A区',
    order_category: '中央空调',
    responsible_party: '华润科技',
    description: '制冷效果差，压缩机异响，需检查冷媒管路和压缩机',
    submitter: { name: '李晓', phone: '138-0012-3456' },
    created_at: '2026-04-12 09:30',
    photos: [],
    // 已维修补录
    confirmNo: 'RC-2026-0412',
    repairVendor: '上海格力售后',
    repairer: '张明',
    follower: '陈刚',
    startTime: '04-12 10:00',
    endTime: '04-12 14:30',
    duration: '4.5h',
    laborFee: 900,
    partsChanged: true,
    parts: [
      { name: '冷媒管路密封圈', qty: 4, price: 80 },
      { name: '压缩机轴承组件', qty: 1, price: 680 },
      { name: 'R410a冷媒 (2kg)', qty: 2, price: 100 },
    ],
    partsFee: 1200,
    discount: 0,
    totalAmount: 2100,
    payStatus: '已付',
    photosBefore: [],
    photosAfter: [
      'https://picsum.photos/seed/after-0412-a/400',
      'https://picsum.photos/seed/after-0412-b/400',
    ],
    photosConfirm: [
      'https://picsum.photos/seed/confirm-0412/400',
    ],
    remark: '会议期间请勿使用电钻',
    chargeRemark: '客户对维修结果满意，已签字确认。配件费用已与客户沟通并确认。',
  },
  {
    id: 'WO-2026-0411',
    order_number: 'WO-2026-0411',
    status: 'Completed',
    priority: 'Emergency',
    customer: '中建信达',
    device: '电梯系统',
    floor: '1楼',
    location: '主楼大厅',
    order_category: '电梯',
    responsible_party: '中建信达',
    description: '电梯运行中有异响，偶有卡顿',
    submitter: { name: '王芳', phone: '139-8888-1234' },
    created_at: '2026-04-11 08:15',
    photos: [],
    confirmNo: 'RC-2026-0411',
    repairVendor: '日立电梯维保',
    repairer: '李强',
    follower: '张敏',
    startTime: '04-11 09:00',
    endTime: '04-11 15:00',
    duration: '6.0h',
    laborFee: 720,
    partsChanged: false,
    parts: [],
    partsFee: 0,
    discount: 0,
    totalAmount: 720,
    payStatus: '待付',
    photosBefore: [],
    photosAfter: [
      'https://picsum.photos/seed/after-0411-a/400',
      'https://picsum.photos/seed/after-0411-b/400',
    ],
    photosConfirm: [
      'https://picsum.photos/seed/confirm-0411/400',
    ],
    remark: '',
    chargeRemark: '',
  },
  {
    id: 'WO-2026-0410',
    order_number: 'WO-2026-0410',
    status: 'Pending Repair',
    priority: 'Normal',
    customer: '万达物业',
    device: '消防水泵',
    floor: 'B1',
    location: '消防泵房',
    order_category: '消防系统',
    responsible_party: '万达物业',
    description: '消防水泵启动时有异常噪音，压力不稳',
    submitter: { name: '王磊', phone: '137-6666-5555' },
    created_at: '2026-04-10 14:20',
    photos: [
      'https://picsum.photos/seed/wo-0410-a/400',
      'https://picsum.photos/seed/wo-0410-b/400',
      'https://picsum.photos/seed/wo-0410-c/400',
    ],
    totalAmount: 0,
    payStatus: '未付',
    partsChanged: false,
    parts: [],
  },
  {
    id: 'WO-2026-0409',
    order_number: 'WO-2026-0409',
    status: 'Pending Repair',
    priority: 'Normal',
    customer: '绿地集团',
    device: '给排水管道',
    floor: '5楼',
    location: '男卫生间',
    order_category: '给排水',
    responsible_party: '绿地集团',
    description: '水管漏水，影响正常使用',
    submitter: { name: '陈伟', phone: '135-2222-3333' },
    created_at: '2026-04-09 11:45',
    photos: [
      'https://picsum.photos/seed/wo-0409-a/400',
      'https://picsum.photos/seed/wo-0409-b/400',
    ],
    totalAmount: 0,
    payStatus: '未付',
    partsChanged: false,
    parts: [],
  },
  {
    id: 'WO-2026-0408',
    order_number: 'WO-2026-0408',
    status: 'Completed',
    priority: 'Normal',
    customer: '保利地产',
    device: '新风系统',
    floor: '12楼',
    location: '办公区',
    order_category: '新风',
    responsible_party: '保利地产',
    description: '新风系统风量小，过滤器堵塞',
    submitter: { name: '刘洋', phone: '134-1111-2222' },
    created_at: '2026-04-08 10:00',
    photos: [],
    confirmNo: 'RC-2026-0408',
    repairVendor: '美的制冷服务',
    repairer: '刘洋',
    follower: '周敏',
    startTime: '04-08 10:30',
    endTime: '04-08 15:30',
    duration: '5.0h',
    laborFee: 1000,
    partsChanged: true,
    parts: [{ name: 'HEPA过滤器', qty: 4, price: 550 }],
    partsFee: 2200,
    discount: 0,
    totalAmount: 3200,
    payStatus: '已付',
    photosBefore: [],
    photosAfter: [
      'https://picsum.photos/seed/after-0408-a/400',
      'https://picsum.photos/seed/after-0408-b/400',
    ],
    photosConfirm: [
      'https://picsum.photos/seed/confirm-0408/400',
    ],
    remark: '',
    chargeRemark: '',
  },
  {
    id: 'WO-2026-0407',
    order_number: 'WO-2026-0407',
    status: 'Completed',
    priority: 'Emergency',
    customer: '龙湖物业',
    device: '配电柜',
    floor: 'B2',
    location: '动力配电室',
    order_category: '强电',
    responsible_party: '龙湖物业',
    description: '配电柜有烧焦味，断路器频繁跳闸',
    submitter: { name: '赵飞', phone: '136-7777-8888' },
    created_at: '2026-04-07 16:00',
    photos: [],
    confirmNo: 'RC-2026-0407',
    repairVendor: '上海电力服务',
    repairer: '赵飞',
    follower: '吴强',
    startTime: '04-07 16:30',
    endTime: '04-07 18:00',
    duration: '1.5h',
    laborFee: 500,
    partsChanged: false,
    parts: [],
    partsFee: 0,
    discount: 0,
    totalAmount: 500,
    payStatus: '未付',
    photosBefore: [],
    photosAfter: [
      'https://picsum.photos/seed/after-0407-a/400',
      'https://picsum.photos/seed/after-0407-b/400',
    ],
    photosConfirm: [
      'https://picsum.photos/seed/confirm-0407/400',
    ],
    remark: '',
    chargeRemark: '需进一步检修，已申请专家支持',
  },
  { id: 'WO-2025-0512', order_number: 'WO-2025-0512', status: 'Completed', priority: 'Normal', customer: '华润科技', order_category: '中央空调', floor: '8楼', location: '会议中心A区', created_at: '2025-05-12 09:30', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 900, partsFee: 0, discount: 0, totalAmount: 900, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
  { id: 'WO-2025-0525', order_number: 'WO-2025-0525', status: 'Completed', priority: 'Normal', customer: '万达物业', order_category: '电梯', floor: '1楼', location: '主楼大厅', created_at: '2025-05-25 14:20', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 1500, partsFee: 0, discount: 0, totalAmount: 1500, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
  { id: 'WO-2025-0610', order_number: 'WO-2025-0610', status: 'Completed', priority: 'Normal', customer: '华润科技', order_category: '消防系统', floor: 'B1', location: '消防泵房', created_at: '2025-06-10 10:00', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 800, partsFee: 0, discount: 0, totalAmount: 800, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
  { id: 'WO-2025-0622', order_number: 'WO-2025-0622', status: 'Completed', priority: 'Emergency', customer: '龙湖物业', order_category: '强电', floor: 'B2', location: '配电室', created_at: '2025-06-22 11:30', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 2100, partsFee: 0, discount: 0, totalAmount: 2100, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
  { id: 'WO-2025-0708', order_number: 'WO-2025-0708', status: 'Completed', priority: 'Normal', customer: '中建信达', order_category: '中央空调', floor: '12楼', location: '办公区', created_at: '2025-07-08 09:00', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 1200, partsFee: 0, discount: 0, totalAmount: 1200, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
  { id: 'WO-2025-0720', order_number: 'WO-2025-0720', status: 'Completed', priority: 'Normal', customer: '万达物业', order_category: '给排水', floor: '3楼', location: '卫生间', created_at: '2025-07-20 15:00', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 600, partsFee: 0, discount: 0, totalAmount: 600, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
  { id: 'WO-2025-0805', order_number: 'WO-2025-0805', status: 'Completed', priority: 'Normal', customer: '华润科技', order_category: '中央空调', floor: '8楼', location: '会议中心A区', created_at: '2025-08-05 10:20', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 1800, partsFee: 0, discount: 0, totalAmount: 1800, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
  { id: 'WO-2025-0818', order_number: 'WO-2025-0818', status: 'Completed', priority: 'Normal', customer: '龙湖物业', order_category: '电梯', floor: '1楼', location: '主楼大厅', created_at: '2025-08-18 13:10', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 900, partsFee: 0, discount: 0, totalAmount: 900, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
  { id: 'WO-2025-0830', order_number: 'WO-2025-0830', status: 'Completed', priority: 'Normal', customer: '万达物业', order_category: '消防系统', floor: 'B1', location: '消防泵房', created_at: '2025-08-30 09:45', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 700, partsFee: 0, discount: 0, totalAmount: 700, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
  { id: 'WO-2025-0912', order_number: 'WO-2025-0912', status: 'Completed', priority: 'Emergency', customer: '中建信达', order_category: '中央空调', floor: '12楼', location: '办公区', created_at: '2025-09-12 08:30', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 2400, partsFee: 0, discount: 0, totalAmount: 2400, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
  { id: 'WO-2025-0925', order_number: 'WO-2025-0925', status: 'Completed', priority: 'Normal', customer: '华润科技', order_category: '强电', floor: 'B2', location: '配电室', created_at: '2025-09-25 14:00', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 1100, partsFee: 0, discount: 0, totalAmount: 1100, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
  { id: 'WO-2025-1008', order_number: 'WO-2025-1008', status: 'Completed', priority: 'Normal', customer: '龙湖物业', order_category: '电梯', floor: '1楼', location: '主楼大厅', created_at: '2025-10-08 11:00', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 1600, partsFee: 0, discount: 0, totalAmount: 1600, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
  { id: 'WO-2025-1019', order_number: 'WO-2025-1019', status: 'Completed', priority: 'Normal', customer: '万达物业', order_category: '中央空调', floor: '8楼', location: '会议中心A区', created_at: '2025-10-19 16:30', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 1300, partsFee: 0, discount: 0, totalAmount: 1300, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
  { id: 'WO-2025-1105', order_number: 'WO-2025-1105', status: 'Completed', priority: 'Normal', customer: '华润科技', order_category: '给排水', floor: '3楼', location: '卫生间', created_at: '2025-11-05 09:20', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 500, partsFee: 0, discount: 0, totalAmount: 500, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
  { id: 'WO-2025-1118', order_number: 'WO-2025-1118', status: 'Completed', priority: 'Normal', customer: '中建信达', order_category: '消防系统', floor: 'B1', location: '消防泵房', created_at: '2025-11-18 10:50', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 900, partsFee: 0, discount: 0, totalAmount: 900, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
  { id: 'WO-2025-1210', order_number: 'WO-2025-1210', status: 'Completed', priority: 'Emergency', customer: '龙湖物业', order_category: '电梯', floor: '1楼', location: '主楼大厅', created_at: '2025-12-10 14:00', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 2800, partsFee: 0, discount: 0, totalAmount: 2800, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
  { id: 'WO-2025-1222', order_number: 'WO-2025-1222', status: 'Completed', priority: 'Normal', customer: '万达物业', order_category: '中央空调', floor: '12楼', location: '办公区', created_at: '2025-12-22 15:30', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 1400, partsFee: 0, discount: 0, totalAmount: 1400, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
  { id: 'WO-2026-0108', order_number: 'WO-2026-0108', status: 'Completed', priority: 'Normal', customer: '华润科技', order_category: '强电', floor: 'B2', location: '配电室', created_at: '2026-01-08 09:00', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 1200, partsFee: 0, discount: 0, totalAmount: 1200, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
  { id: 'WO-2026-0120', order_number: 'WO-2026-0120', status: 'Completed', priority: 'Normal', customer: '中建信达', order_category: '中央空调', floor: '8楼', location: '会议中心A区', created_at: '2026-01-20 13:40', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 1700, partsFee: 0, discount: 0, totalAmount: 1700, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
  { id: 'WO-2026-0205', order_number: 'WO-2026-0205', status: 'Completed', priority: 'Normal', customer: '龙湖物业', order_category: '电梯', floor: '1楼', location: '主楼大厅', created_at: '2026-02-05 10:00', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 1900, partsFee: 0, discount: 0, totalAmount: 1900, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
  { id: 'WO-2026-0218', order_number: 'WO-2026-0218', status: 'Completed', priority: 'Normal', customer: '万达物业', order_category: '给排水', floor: '3楼', location: '卫生间', created_at: '2026-02-18 15:00', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 700, partsFee: 0, discount: 0, totalAmount: 700, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
  { id: 'WO-2026-0310', order_number: 'WO-2026-0310', status: 'Completed', priority: 'Normal', customer: '华润科技', order_category: '中央空调', floor: '8楼', location: '会议中心A区', created_at: '2026-03-10 11:20', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 1500, partsFee: 0, discount: 0, totalAmount: 1500, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
  { id: 'WO-2026-0325', order_number: 'WO-2026-0325', status: 'Completed', priority: 'Emergency', customer: '中建信达', order_category: '消防系统', floor: 'B1', location: '消防泵房', created_at: '2026-03-25 09:50', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 2200, partsFee: 0, discount: 0, totalAmount: 2200, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
  { id: 'WO-2026-0402', order_number: 'WO-2026-0402', status: 'Completed', priority: 'Normal', customer: '龙湖物业', order_category: '强电', floor: 'B2', location: '配电室', created_at: '2026-04-02 10:30', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 1300, partsFee: 0, discount: 0, totalAmount: 1300, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
  { id: 'WO-2026-0416', order_number: 'WO-2026-0416', status: 'Completed', priority: 'Normal', customer: '万达物业', order_category: '电梯', floor: '1楼', location: '主楼大厅', created_at: '2026-04-16 14:10', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 1700, partsFee: 0, discount: 0, totalAmount: 1700, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
]

function money(n) {
  if (!n && n !== 0) return '¥0.00'
  return '¥' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function enrich(o) {
  const hours = parseFloat(o.duration) || 0
  const hourlyRate = hours > 0 ? (Number(o.laborFee) || 0) / hours : 0
  return {
    ...o,
    statusText: STATUS_TEXT[o.status] || o.status,
    statusBg: STATUS_BG[o.status] || '#f5f5f5',
    statusColor: STATUS_COLOR[o.status] || '#737373',
    payBg: PAY_BG[o.payStatus] || '#f5f5f5',
    payColor: PAY_COLOR[o.payStatus] || '#a3a3a3',
    totalAmountText: money(o.totalAmount),
    laborFeeText: money(o.laborFee),
    hourlyRateText: hourlyRate > 0 ? '¥' + Math.round(hourlyRate).toLocaleString('en-US') + '/h' : '—',
    partsFeeText: money(o.partsFee),
    discountText: o.discount ? '-' + money(o.discount) : '-¥0.00',
    partsEnriched: (o.parts || []).map(p => ({
      ...p,
      subtotal: money((p.qty || 0) * (p.price || 0)),
      priceText: money(p.price),
    })),
  }
}

module.exports = {
  getAll: () => ORDERS,
  getById: (id) => ORDERS.find(o => o.id === id),
  update: (id, patch) => {
    const i = ORDERS.findIndex(o => o.id === id)
    if (i >= 0) {
      ORDERS[i] = { ...ORDERS[i], ...patch }
      return ORDERS[i]
    }
    return null
  },
  remove: (id) => {
    const i = ORDERS.findIndex(o => o.id === id)
    if (i >= 0) {
      ORDERS.splice(i, 1)
      return true
    }
    return false
  },
  addFromWorkOrder: (wo) => {
    const exists = ORDERS.find(o => o.id === wo.order_id || o.id === wo.order_number)
    if (exists) return exists
    const newOrder = {
      id: wo.order_number || wo.order_id,
      order_number: wo.order_number || wo.order_id,
      status: 'Pending Repair',
      priority: wo.priority || 'Normal',
      customer: wo.responsible_party || '',
      device: wo.order_category || wo.fault_type_name || '',
      floor: wo.floor || '',
      location: wo.location || '',
      order_category: wo.order_category || '',
      responsible_party: wo.responsible_party || '',
      description: wo.description || '',
      submitter: { name: wo.submitter?.name || '', phone: wo.submitter?.phone || '' },
      created_at: wo.created_at || '',
      photos: wo.photos || [],
      remark: wo.remark || '',
      chargeRemark: '',
      totalAmount: 0,
      payStatus: '未付',
      partsChanged: false,
      parts: [],
    }
    ORDERS.unshift(newOrder)
    return newOrder
  },
  enrich,
  money,
}
