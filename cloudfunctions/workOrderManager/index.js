/**
 * 工单管理云函数
 * 处理工单的增删改查、状态流转、分配等操作
 */

const XLSX = require('xlsx');

const {
  cloud,
  db,
  _,
  ROLE,
  normalizeStatus,
  getEffectiveOpenId,
  getUserByOpenId,
  enhanceWorkOrder,
  refreshStatusHistoryAvatars,
  getStatusVariants,
  canViewOrder,
  writeAuditLog,
} = require('./helpers');

const { createWorkOrder, getWorkOrders, updateWorkOrderDetails } = require('./handlers/crud');
const { updateOrderStatus, completeRepair, reviewOrder } = require('./handlers/status');
const { urgeAccept, urgeRepair, urgeReview } = require('./handlers/notify');

/**
 * 主函数
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { action, data = {} } = event;

  const openid = getEffectiveOpenId(wxContext, event);
  if (!openid) {
    return {
      success: false,
      error: '无法获取微信身份，请在小程序内操作',
    };
  }

  console.log(`[WorkOrderManager] Action: ${action}, OpenID: ${openid}`);

  try {
    switch (action) {
      case 'create':
        const newOrder = await createWorkOrder(openid, data);
        return {
          success: true,
          order: newOrder,
          message: '工单创建成功'
        };

      case 'updateStatus':
        const statusResult = await updateOrderStatus(
          openid,
          data.order_id,
          data.status,
          data.notes
        );
        return {
          success: true,
          ...statusResult,
          message: '工单状态更新成功'
        };

      case 'list':
        // 只信任云函数上下文的 openid，避免客户端伪造 user_id 越权查询
        return {
          success: true,
          ...(await getWorkOrders(openid, data.filters || {})),
        };

      case 'getById':
        {
          const currentUser = await getUserByOpenId(openid);
          if (!currentUser) {
            return { success: false, error: '用户不存在' };
          }

          const orderId = parseInt(data.order_id, 10);
          if (Number.isNaN(orderId)) {
            return { success: false, error: '工单ID不正确' };
          }

          const workOrders = db.collection('work_orders');
          const { data: orderData } = await workOrders.where({ order_id: orderId }).get();
          if (orderData.length === 0) {
            return { success: false, error: '工单不存在' };
          }

          const order = orderData[0];

          if (!canViewOrder(currentUser, order)) {
            return { success: false, error: '无权限查看该工单' };
          }

          // 刷新status_history中的头像为最新
          const refreshedOrder = await refreshStatusHistoryAvatars(order);

          return {
            success: true,
            order: enhanceWorkOrder(refreshedOrder),
          };
        }

      // 公开只读接口 - 用于分享链接访问（无需登录）
      case 'getByIdPublic':
        {
          const orderId = parseInt(data.order_id, 10);
          if (Number.isNaN(orderId)) {
            return { success: false, error: '工单ID不正确' };
          }

          const workOrders = db.collection('work_orders');
          const { data: orderData } = await workOrders.where({ order_id: orderId }).get();
          if (orderData.length === 0) {
            return { success: false, error: '工单不存在' };
          }

          const order = orderData[0];

          // 转换照片URL：将 cloud:// 格式转换为可直接访问的临时URL
          // 这样未登录用户也能正常查看照片
          if (order.photos && order.photos.length > 0) {
            const cloudFileIds = order.photos.filter(url => url && url.startsWith('cloud://'));
            if (cloudFileIds.length > 0) {
              try {
                const { fileList } = await cloud.getTempFileURL({
                  fileList: cloudFileIds
                });
                const urlMap = {};
                let successCount = 0;
                fileList.forEach(item => {
                  // 使用宽松比较，因为微信API可能返回字符串"0"或数字0
                  if (item.tempFileURL && item.status == 0) {
                    urlMap[item.fileID] = item.tempFileURL;
                    successCount++;
                  } else {
                    console.warn('[getByIdPublic] URL转换失败:', item.fileID, 'status:', item.status);
                  }
                });
                console.log('[getByIdPublic] URL转换完成:', successCount, '/', cloudFileIds.length);
                order.photos = order.photos.map(url => urlMap[url] || url);
              } catch (e) {
                console.error('[getByIdPublic] Convert photo URLs error:', e);
              }
            }
          }

          // 数据脱敏：移除敏感信息
          const publicOrder = {
            ...order,
            submitter: order.submitter ? {
              name: order.submitter.name,
              avatar: order.submitter.avatar
            } : null,
            assigned_technician: order.assigned_technician ? {
              name: order.assigned_technician.name,
              avatar: order.assigned_technician.avatar
            } : null
          };

          // 刷新status_history中的头像
          const refreshedPublicOrder = await refreshStatusHistoryAvatars(publicOrder);

          return {
            success: true,
            order: enhanceWorkOrder(refreshedPublicOrder),
            isPublicView: true
          };
        }

      case 'getByNumber':
        {
          const currentUser = await getUserByOpenId(openid);
          if (!currentUser) {
            return { success: false, error: '用户不存在' };
          }

          const orderNumber = data.order_number;
          if (!orderNumber) {
            return { success: false, error: '工单编号不正确' };
          }

          const workOrders = db.collection('work_orders');
          const { data: orderData } = await workOrders.where({ order_number: orderNumber }).get();
          if (orderData.length === 0) {
            return { success: false, error: '工单不存在' };
          }

          const order = orderData[0];

          if (!canViewOrder(currentUser, order)) {
            return { success: false, error: '无权限查看该工单' };
          }

          return {
            success: true,
            order: enhanceWorkOrder(order),
          };
        }

      // 检查工单编号是否已存在（不需要权限校验，用于扫码时判断编号是否重复）
      case 'checkOrderNumberExists':
        {
          const orderNumber = data.order_number;
          if (!orderNumber) {
            return { success: false, error: '工单编号不正确' };
          }

          const workOrders = db.collection('work_orders');
          const { data: orderData } = await workOrders.where({ order_number: orderNumber }).get();

          return {
            success: true,
            exists: orderData.length > 0
          };
        }

      case 'getFaultTypes':
        const faultTypes = db.collection('fault_types');
        const { data: types } = await faultTypes.where({
          active: true
        }).get();

        return {
          success: true,
          fault_types: types
        };

      case 'updateDetails':
        {
          const detailsResult = await updateWorkOrderDetails(
            openid,
            data.order_id,
            data.updates || {}
          );
          return {
            success: true,
            ...detailsResult,
            message: '工单信息更新成功'
          };
        }

      case 'completeRepair':
        const completeResult = await completeRepair(
          openid,
          data.order_id,
          data.completion_notes,
          data.parts_used
        );
        return {
          success: true,
          ...completeResult,
          message: '维修完成提交成功'
        };

      case 'reviewOrder':
        const reviewResult = await reviewOrder(
          openid,
          data.order_id,
          data.status,
          data.review_notes
        );
        return {
          success: true,
          ...reviewResult,
          message: '审核提交成功'
        };

      case 'delete':
        {
          // 行政经理和办美员工可以删除工单
          const deleteUser = await getUserByOpenId(openid);
          if (!deleteUser) {
            return { success: false, error: '用户未注册' };
          }
          if (deleteUser.role_id !== 2 && deleteUser.role_id !== 4) { // 2 = 行政经理, 4 = 办美员工
            return { success: false, error: '只有行政经理和办美员工才能删除工单' };
          }

          const workOrders = db.collection('work_orders');
          const { data: orders } = await workOrders.where({
            order_id: parseInt(data.order_id)
          }).get();

          if (orders.length === 0) {
            return { success: false, error: '工单不存在' };
          }

          const orderToDelete = orders[0];

          // 权限校验：管理员可删除任意工单，其他用户只能删除自己提交的工单
          const isAdmin = deleteUser.role_id === 1;
          const isSubmitter = orderToDelete.submitter?.user_id === deleteUser.user_id;

          if (!isAdmin && !isSubmitter) {
            return { success: false, error: '只能删除自己提交的工单' };
          }

          // 只允许删除待维修状态的工单
          const normalizedStatus = normalizeStatus(orderToDelete.status);
          if (normalizedStatus !== 'Pending Repair') {
            return { success: false, error: '只能删除已提报状态的工单' };
          }

          // 删除云存储中的照片文件
          if (orderToDelete.photos && orderToDelete.photos.length > 0) {
            const cloudFileIds = orderToDelete.photos.filter(url => url && url.startsWith('cloud://'));
            if (cloudFileIds.length > 0) {
              try {
                await cloud.deleteFile({ fileList: cloudFileIds });
                console.log(`[WorkOrderManager] Deleted ${cloudFileIds.length} photos for order ${data.order_id}`);
              } catch (e) {
                console.error('[WorkOrderManager] Delete photos error:', e);
                // 照片删除失败不阻止工单删除
              }
            }
          }

          await workOrders.doc(orderToDelete._id).remove();

          await writeAuditLog({
            user: deleteUser,
            action: 'delete_order',
            order_id: orderToDelete.order_id,
            before: { status: normalizedStatus, order_number: orderToDelete.order_number },
            after: null,
          });

          console.log(`[WorkOrderManager] Order ${data.order_id} deleted by user ${deleteUser.user_id}`);

          return {
            success: true,
            message: '工单已删除'
          };
        }

      case 'urgeAccept':
        {
          const urgeAcceptResult = await urgeAccept(openid, data.order_id);
          return { success: true, ...urgeAcceptResult };
        }

      case 'urgeRepair':
        {
          const urgeRepairResult = await urgeRepair(openid, data.order_id);
          return { success: true, ...urgeRepairResult };
        }

      case 'urgeReview':
        {
          const urgeReviewResult = await urgeReview(openid, data.order_id);
          return { success: true, ...urgeReviewResult };
        }

      // ===== 懒加载优化：获取统计和ID列表（轻量数据） =====
      case 'getStatistics':
        {
          const statsUser = await getUserByOpenId(openid);
          if (!statsUser) {
            return { success: false, error: '用户不存在' };
          }
          if (statsUser.active === false) {
            return { success: false, error: '账号已被停用' };
          }

          const workOrders = db.collection('work_orders');
          const statsConditions = {};

          // 根据角色过滤
          if (statsUser.role_id === 3 && statsUser.department) {
            statsConditions.responsible_party = statsUser.department;
          }

          // 只获取轻量字段
          const { data: lightOrders } = await workOrders
            .where(statsConditions)
            .field({ order_id: true, status: true, created_at: true, _id: true })
            .orderBy('created_at', 'desc')
            .limit(1000)  // 最多1000条
            .get();

          // 计算状态统计
          const statistics = {};
          const orderIds = [];
          lightOrders.forEach(order => {
            const ns = normalizeStatus(order.status);
            statistics[ns] = (statistics[ns] || 0) + 1;
            orderIds.push(order.order_id);
          });

          return {
            success: true,
            statistics,
            orderIds,
            total: lightOrders.length
          };
        }

      // ===== 懒加载优化：根据ID列表获取工单详情 =====
      case 'getOrdersByIds':
        {
          const idsUser = await getUserByOpenId(openid);
          if (!idsUser) {
            return { success: false, error: '用户不存在' };
          }
          if (idsUser.active === false) {
            return { success: false, error: '账号已被停用' };
          }

          const { ids } = data;
          if (!Array.isArray(ids) || ids.length === 0) {
            return { success: true, orders: [] };
          }

          // 限制单次最多获取50条
          const limitedIds = ids.slice(0, 50);
          const workOrders = db.collection('work_orders');

          const { data: orderDetails } = await workOrders
            .where({ order_id: _.in(limitedIds) })
            .orderBy('created_at', 'desc')
            .get();

          // 按请求的ID顺序排序
          const orderMap = new Map(orderDetails.map(o => [o.order_id, o]));
          const sortedOrders = limitedIds
            .map(id => orderMap.get(id))
            .filter(Boolean)
            .map(order => enhanceWorkOrder(order));

          return {
            success: true,
            orders: sortedOrders
          };
        }

      // ===== 工单导出功能（仅行政经理可用） =====
      case 'exportWorkOrders':
        {
          const exportUser = await getUserByOpenId(openid);
          if (!exportUser) {
            return { success: false, error: '用户不存在' };
          }
          if (exportUser.active === false) {
            return { success: false, error: '账号已被停用' };
          }
          // 权限校验：仅行政经理可导出
          if (exportUser.role_id !== 2) {
            return { success: false, error: '无权限导出工单' };
          }

          const { filters = {} } = data;
          const workOrders = db.collection('work_orders');

          // 构建查询条件
          const conditions = {};

          // 状态筛选（'all' 或空表示全部，不添加条件）
          if (filters.status && filters.status !== 'all') {
            conditions.status = _.in(getStatusVariants(filters.status));
          }

          // 时间范围筛选
          if (filters.timeRange) {
            const now = new Date();
            let startTime, endTime;

            switch (filters.timeRange.type) {
              case 'today':
                startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
              case 'week':
                startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
              case 'month':
                startTime = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                break;
              case 'date':
                if (filters.timeRange.startDate && filters.timeRange.endDate) {
                  startTime = new Date(filters.timeRange.startDate);
                  endTime = new Date(filters.timeRange.endDate);
                  endTime.setHours(23, 59, 59, 999);
                }
                break;
            }

            if (startTime) {
              conditions.created_at = conditions.created_at || {};
              conditions.created_at = _.gte(startTime);
              if (endTime) {
                conditions.created_at = _.and(_.gte(startTime), _.lte(endTime));
              }
            }
          }

          // 高级筛选
          if (filters.advancedFilters) {
            const af = filters.advancedFilters;
            if (af.floor) conditions.floor = af.floor;
            if (af.owner) conditions.responsible_party = af.owner;
            if (af.category) conditions.order_category = af.category;
            if (af.reporter) conditions['submitter.name'] = af.reporter;
            if (af.priority) {
              conditions.priority = af.priority === '紧急' ? 'Emergency' : _.neq('Emergency');
            }
          }

          // 查询数据（限制5000条）
          const MAX_EXPORT_COUNT = 5000;
          console.log('[exportWorkOrders] filters:', JSON.stringify(filters));
          console.log('[exportWorkOrders] conditions:', JSON.stringify(conditions));
          const { total } = await workOrders.where(conditions).count();
          console.log('[exportWorkOrders] total count:', total);

          if (total > MAX_EXPORT_COUNT) {
            return {
              success: false,
              error: `数据量过大（${total}条），请缩小筛选范围后重试（最多支持${MAX_EXPORT_COUNT}条）`
            };
          }

          // 分批获取所有数据（云数据库单次最多100条）
          const allOrders = [];
          const batchSize = 100;
          const batchCount = Math.ceil(total / batchSize);

          for (let i = 0; i < batchCount; i++) {
            const { data: batch } = await workOrders
              .where(conditions)
              .orderBy('created_at', 'desc')
              .skip(i * batchSize)
              .limit(batchSize)
              .get();
            allOrders.push(...batch);
          }

          if (allOrders.length === 0) {
            return { success: false, error: '没有符合条件的工单数据' };
          }

          // 搜索文本过滤（与前端逻辑一致，匹配工单编号/位置/问题描述）
          let exportOrders = allOrders;
          if (filters.searchText) {
            const searchLower = filters.searchText.toLowerCase();
            exportOrders = allOrders.filter(order => {
              const orderNumber = String(order.order_number || '').toLowerCase();
              const location = String(order.location || '').toLowerCase();
              const description = String(order.description || '').toLowerCase();
              return orderNumber.includes(searchLower) ||
                location.includes(searchLower) ||
                description.includes(searchLower);
            });
            if (exportOrders.length === 0) {
              return { success: false, error: '没有符合条件的工单数据' };
            }
          }

          // 状态中文映射
          const statusTextMap = {
            'Pending Repair': '已提报',
            'In Progress': '维修中',
            'Repaired': '待复核',
            'Needs Rework': '需返工',
            'Completed': '已完成'
          };

          // 格式化日期
          const formatDate = (dateVal) => {
            if (!dateVal) return '';
            const d = dateVal.$date ? new Date(dateVal.$date) : new Date(dateVal);
            if (isNaN(d.getTime())) return '';
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hour = String(d.getHours()).padStart(2, '0');
            const minute = String(d.getMinutes()).padStart(2, '0');
            const second = String(d.getSeconds()).padStart(2, '0');
            return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
          };

          // 转换数据为Excel行
          const excelData = exportOrders.map(order => ({
            '工单编号': order.order_number || '',
            '楼层': order.floor || '',
            '位置': order.location || '',
            '工单类别': order.order_category || '',
            '责任方': order.responsible_party || '',
            '优先级': order.priority === 'Emergency' ? '紧急' : '普通',
            '状态': statusTextMap[normalizeStatus(order.status)] || order.status,
            '问题描述': order.description || '',
            '备注': order.remark || '',
            '现场照片': order.photos ? JSON.stringify(order.photos) : '',
            '提报人': order.submitter?.name || '',
            '报修时间': formatDate(order.report_time)
          }));

          // 生成 Excel
          const worksheet = XLSX.utils.json_to_sheet(excelData);
          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, '工单数据');

          // 设置列宽
          worksheet['!cols'] = [
            { wch: 18 }, // 工单编号
            { wch: 8 },  // 楼层
            { wch: 20 }, // 位置
            { wch: 12 }, // 工单类别
            { wch: 12 }, // 责任方
            { wch: 8 },  // 优先级
            { wch: 10 }, // 状态
            { wch: 40 }, // 问题描述
            { wch: 20 }, // 备注
            { wch: 50 }, // 现场照片
            { wch: 10 }, // 提报人
            { wch: 20 }, // 报修时间
          ];

          // 生成 buffer
          const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

          // 生成文件名
          const fileName = '工单数据.xlsx';
          // 云存储路径加时间戳避免冲突
          const cloudPath = `exports/${Date.now()}_${fileName}`;

          // 上传到云存储
          const uploadResult = await cloud.uploadFile({
            cloudPath,
            fileContent: buffer
          });

          // 获取临时下载链接（1小时有效）
          const { fileList } = await cloud.getTempFileURL({
            fileList: [uploadResult.fileID]
          });

          const downloadUrl = fileList[0]?.tempFileURL;

          if (!downloadUrl) {
            return { success: false, error: '生成下载链接失败' };
          }

          console.log(`[WorkOrderManager] Export completed: ${total} orders, file: ${fileName}`);

          return {
            success: true,
            downloadUrl,
            fileID: uploadResult.fileID,
            fileName,
            totalCount: exportOrders.length
          };
        }

      default:
        return {
          success: false,
          error: `未知操作: ${action}`,
          available_actions: ['create', 'updateStatus', 'updateDetails', 'list', 'getById', 'getFaultTypes', 'completeRepair', 'reviewOrder', 'urgeAccept', 'urgeRepair', 'urgeReview', 'getStatistics', 'getOrdersByIds', 'exportWorkOrders']
        };
    }

  } catch (error) {
    console.error('[WorkOrderManager] Error:', error);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
};
