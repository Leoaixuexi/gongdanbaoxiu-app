/**
 * 数据统计页面
 */

const auth = require('../../services/auth');
const workOrderService = require('../../services/workOrder');

Page({
  data: {
    // 工单统计
    stats: [],
    // 月度排名
    rankings: [],
    // 自定义导航栏高度
    headerHeight: 0,
    // 用户角色信息
    userRole: null,
    userDepartment: null,
    userId: null,
    isPropertyStaff: false,
    isMaintenanceWorker: false,
    loading: true
  },

  onLoad() {
    // 计算自定义导航栏高度
    const systemInfo = wx.getSystemInfoSync();
    const statusBarHeight = systemInfo.statusBarHeight;
    const navBarHeight = 88 * systemInfo.windowWidth / 750;
    this.setData({
      headerHeight: statusBarHeight + navBarHeight
    });
  },

  async onShow() {
    // 设置自定义 tabBar 选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 1
      });
    }

    // 获取用户角色信息
    try {
      const userInfo = await auth.getCurrentUser();
      if (userInfo) {
        const isPropertyStaff = userInfo.role_id === 4;
        const isMaintenanceWorker = userInfo.role_id === 3;

        this.setData({
          userRole: userInfo.role_id,
          userDepartment: userInfo.department,
          userId: userInfo.id,
          isPropertyStaff,
          isMaintenanceWorker
        });

        console.log('[Data] User role:', {
          role_id: userInfo.role_id,
          department: userInfo.department,
          isPropertyStaff,
          isMaintenanceWorker
        });

        // 加载统计数据
        await this.loadStatistics();
      }
    } catch (error) {
      console.error('[Data] Get user info error:', error);
      this.setData({ loading: false });
    }
  },

  /**
   * 根据角色获取统计配置
   */
  getStatsConfigByRole(isPropertyStaff, isMaintenanceWorker) {
    if (isPropertyStaff) {
      // 物业员工统计配置
      return [
        {
          key: 'today_reported',
          label: '今日提报',
          status: null, // 今日提报不按状态过滤
          bgClass: '#dbeafe',
          color: '#2563eb'
        },
        {
          key: 'in_progress',
          label: '维修中',
          status: 'In Progress',
          bgClass: '#cffafe',
          color: '#0891b2'
        },
        {
          key: 'review',
          label: '待复核',
          status: 'Repaired',
          bgClass: '#fee2e2',
          color: '#dc2626'
        },
        {
          key: 'completed',
          label: '已完成',
          status: 'Completed',
          bgClass: '#d1fae5',
          color: '#059669'
        }
      ];
    } else if (isMaintenanceWorker) {
      // 维修员统计配置
      return [
        {
          key: 'pending_accept',
          label: '待接单',
          status: 'Pending Repair',
          bgClass: '#dbeafe',
          color: '#2563eb'
        },
        {
          key: 'in_progress',
          label: '维修中',
          status: 'In Progress',
          bgClass: '#cffafe',
          color: '#0891b2'
        },
        {
          key: 'repaired',
          label: '已修复',
          status: 'Repaired',
          bgClass: '#f3e8ff',
          color: '#9333ea'
        },
        {
          key: 'rework',
          label: '需重修',
          status: 'Needs Rework',
          bgClass: '#ffedd5',
          color: '#ea580c'
        },
        {
          key: 'completed',
          label: '已完成',
          status: 'Completed',
          bgClass: '#d1fae5',
          color: '#059669'
        }
      ];
    }
    return [];
  },

  /**
   * 加载统计数据
   */
  async loadStatistics() {
    try {
      this.setData({ loading: true });

      const { isPropertyStaff, isMaintenanceWorker, userId, userDepartment } = this.data;

      // 获取统计配置
      const statsConfig = this.getStatsConfigByRole(isPropertyStaff, isMaintenanceWorker);

      // 获取所有工单
      const allOrders = await workOrderService.getWorkOrders({});

      // 根据角色过滤工单
      let myOrders = [];
      if (isPropertyStaff && userId) {
        // 物业员工：只看自己提报的工单
        myOrders = allOrders.filter(order =>
          order.submitter && order.submitter.user_id === userId
        );
      } else if (isMaintenanceWorker && userDepartment) {
        // 维修员：只看责任方=自己部门的工单
        myOrders = allOrders.filter(order =>
          order.responsible_party === userDepartment
        );
      }

      // 计算各项统计数据
      const stats = statsConfig.map(config => {
        let count = 0;

        if (config.key === 'today_reported' && isPropertyStaff) {
          // 今日提报：统计今天创建的工单
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          count = myOrders.filter(order => {
            const createdAt = order.created_at?.$date ?
              new Date(order.created_at.$date) : new Date(order.created_at);
            return createdAt >= today;
          }).length;
        } else if (config.status) {
          // 按状态统计
          count = myOrders.filter(order => order.status === config.status).length;
        }

        return {
          label: config.label,
          value: count,
          bgClass: config.bgClass,
          color: config.color
        };
      });

      this.setData({
        stats,
        loading: false
      });

      console.log('[Data] Statistics loaded:', stats);

    } catch (error) {
      console.error('[Data] Load statistics error:', error);
      this.setData({ loading: false });
      wx.showToast({
        title: '加载统计失败',
        icon: 'none'
      });
    }
  },

  /**
   * 查看全部排名
   */
  viewAllRankings() {
    wx.showToast({
      title: '查看全部排名',
      icon: 'none'
    });
    // TODO: 跳转到完整排名页面
    // wx.navigateTo({
    //   url: '/pages/rankings/index'
    // });
  }
});
