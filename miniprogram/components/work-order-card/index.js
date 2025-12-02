/**
 * Work Order Card Component
 * Displays work order summary in list view with SLA indicators
 */

const { PRIORITY_DISPLAY_NAMES } = require('../../utils/constants');
const { formatRelativeTime, formatSLATimeRemaining, getSLAColorClass, getSLABadgeText } = require('../../utils/formatter');

Component({
  /**
   * Component properties
   */
  properties: {
    // Work order data
    workOrder: {
      type: Object,
      value: {},
      observer: 'updateDisplay'
    },

    // Show additional details
    showDetails: {
      type: Boolean,
      value: false
    }
  },

  /**
   * Component data
   */
  data: {
    priorityDisplay: '',   // Priority display name
    relativeTime: '',      // Relative time display
    photoCount: 0,         // Photo count
    slaDisplay: '',        // SLA timer display (T173)
    slaColorClass: '',     // SLA color class (T173)
    slaBadgeText: '',      // SLA badge text (T174)
    showSLABadge: false,   // Show SLA warning/overdue badge (T174)
    slaTimerInterval: null, // Timer interval ID
    isUrgent: false,       // Is emergency priority
    isCompleted: false,    // Is completed status
    statusText: '',        // Status text display
    statusClass: ''        // Status CSS class
  },

  /**
   * Component methods
   */
  methods: {
    /**
     * Update display data
     * Processes work order data for display
     */
    updateDisplay() {
      const workOrder = this.data.workOrder;

      if (!workOrder || Object.keys(workOrder).length === 0) {
        return;
      }

      // Update priority display
      const priorityDisplay = PRIORITY_DISPLAY_NAMES[workOrder.priority] || workOrder.priority || '未知';

      // Check if urgent
      const isUrgent = workOrder.priority === 'Emergency';

      // Check if completed
      const isCompleted = workOrder.status === 'Completed';

      // Determine status text and class
      let statusText = '待处理';
      let statusClass = 'status-processing';

      if (workOrder.status === 'Completed') {
        statusText = '已完成';
        statusClass = 'status-completed';
      } else if (workOrder.status === 'In Progress' || workOrder.status === 'InProgress' || workOrder.status === 'Maintenance') {
        statusText = '维修中';
        statusClass = 'status-maintenance';
      } else if (workOrder.status === 'Pending Repair' || workOrder.status === 'Reported') {
        statusText = '已提报';
        statusClass = 'status-reported';
      } else if (workOrder.status === 'Repaired' || workOrder.status === 'PendingReview' || workOrder.status === 'Review') {
        statusText = '待复核';
        statusClass = 'status-review';
      }

      // Update relative time - format as "2025-10-28   14:31"
      let relativeTime = '未知时间';
      if (workOrder.created_at) {
        const createdAt = workOrder.created_at.$date ? new Date(workOrder.created_at.$date) : new Date(workOrder.created_at);
        const year = createdAt.getFullYear();
        const month = String(createdAt.getMonth() + 1).padStart(2, '0');
        const day = String(createdAt.getDate()).padStart(2, '0');
        const hour = String(createdAt.getHours()).padStart(2, '0');
        const minute = String(createdAt.getMinutes()).padStart(2, '0');
        relativeTime = `${year}-${month}-${day}   ${hour}:${minute}`;
      }

      // Update photo count
      let photoCount = 0;
      if (workOrder.photos && Array.isArray(workOrder.photos)) {
        photoCount = workOrder.photos.length;
      } else if (workOrder.photo_count) {
        photoCount = workOrder.photo_count;
      }

      // T173 - Update SLA display
      let slaDisplay = '';
      let slaColorClass = '';
      let slaBadgeText = '';
      let showSLABadge = false;

      if (workOrder.time_remaining !== undefined && workOrder.time_remaining !== null) {
        slaDisplay = formatSLATimeRemaining(workOrder.time_remaining);
        slaColorClass = getSLAColorClass(workOrder.is_overdue, workOrder.percentage_used || 0);

        // T174 - Show badge for overdue or warning status
        if (workOrder.is_overdue || workOrder.sla_status === 'warning') {
          slaBadgeText = getSLABadgeText(workOrder.sla_status, workOrder.is_overdue);
          showSLABadge = true;
        }
      }

      this.setData({
        priorityDisplay,
        relativeTime,
        photoCount,
        slaDisplay,
        slaColorClass,
        slaBadgeText,
        showSLABadge,
        isUrgent,
        isCompleted,
        statusText,
        statusClass
      });

      // Start SLA timer update if card is visible and has SLA data
      if (workOrder.time_remaining !== undefined) {
        this.startSLATimer();
      }
    },

    /**
     * T173 - Start SLA timer to update display every minute
     */
    startSLATimer() {
      // Clear existing timer
      this.stopSLATimer();

      // Update every minute (60000ms)
      const interval = setInterval(() => {
        const workOrder = this.data.workOrder;
        if (workOrder && workOrder.time_remaining !== undefined) {
          // Recalculate time remaining (decrease by 1 minute)
          const updatedTimeRemaining = workOrder.time_remaining - 60000;

          // Update work order data
          this.setData({
            'workOrder.time_remaining': updatedTimeRemaining,
            slaDisplay: formatSLATimeRemaining(updatedTimeRemaining)
          });

          // Update badge if status changed
          const isOverdue = updatedTimeRemaining <= 0;
          if (isOverdue && !this.data.showSLABadge) {
            this.setData({
              showSLABadge: true,
              slaBadgeText: '超期',
              slaColorClass: 'red'
            });
          }
        }
      }, 60000);

      this.setData({ slaTimerInterval: interval });
    },

    /**
     * Stop SLA timer updates
     */
    stopSLATimer() {
      if (this.data.slaTimerInterval) {
        clearInterval(this.data.slaTimerInterval);
        this.setData({ slaTimerInterval: null });
      }
    },

    /**
     * Handle card tap
     * Emits event with work order ID
     */
    handleTap() {
      const workOrder = this.data.workOrder;

      if (!workOrder || !workOrder.id) {
        console.warn('[WorkOrderCard] No work order ID to emit');
        return;
      }

      // Emit tap event with work order ID and data
      this.triggerEvent('tap', {
        id: workOrder.id,
        workOrder: workOrder
      });
    }
  },

  /**
   * Component lifetimes
   */
  lifetimes: {
    attached() {
      // Initialize display
      this.updateDisplay();
    },

    detached() {
      // Clean up timer when component is removed
      this.stopSLATimer();
    }
  },

  /**
   * Page lifetimes
   */
  pageLifetimes: {
    show() {
      // Refresh display when page is shown
      this.updateDisplay();
    },

    hide() {
      // Stop timer when page is hidden to save resources
      this.stopSLATimer();
    }
  }
});
