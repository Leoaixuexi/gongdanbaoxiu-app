/**
 * Timeline Component - T104
 * Visual timeline showing status history with timestamps and actors
 */

const { STATUS_COLORS } = require('../../utils/constants');
const { formatRelativeTime } = require('../../utils/formatter');

Component({
  /**
   * Component Properties
   */
  properties: {
    // Array of status history objects with actor info
    statusHistory: {
      type: Array,
      value: [],
      observer: 'processHistory'
    }
  },

  /**
   * Component Data
   */
  data: {
    processedHistory: []
  },

  /**
   * Component Methods
   */
  methods: {
    /**
     * Process History
     * Transform status history with display data
     */
    processHistory() {
      const history = this.data.statusHistory;

      if (!history || !Array.isArray(history)) {
        this.setData({ processedHistory: [] });
        return;
      }

      // Sort by timestamp DESC (newest first)
      const sorted = [...history].sort((a, b) => {
        const dateA = new Date(a.timestamp || a.created_at);
        const dateB = new Date(b.timestamp || b.created_at);
        return dateB - dateA;
      });

      // Process each history item
      const processed = sorted.map((item, index) => {
        // Get relative time
        const relativeTime = formatRelativeTime(item.timestamp || item.created_at);

        // Get dot color based on status
        const dotColor = STATUS_COLORS[item.status] || '#9e9e9e';

        return {
          ...item,
          relativeTime,
          dotColor,
          isLatest: index === 0
        };
      });

      this.setData({
        statusHistory: processed
      });
    },

    /**
     * Preview Photo
     * Show photo preview in fullscreen
     */
    previewPhoto(e) {
      const { photos, index } = e.currentTarget.dataset;

      if (!photos || photos.length === 0) {
        return;
      }

      wx.previewImage({
        urls: photos,
        current: photos[index] || photos[0]
      });
    }
  },

  /**
   * Component Lifetimes
   */
  lifetimes: {
    attached() {
      // Process history when component is attached
      this.processHistory();
    }
  },

  /**
   * Page Lifetimes
   */
  pageLifetimes: {
    show() {
      // Re-process when page is shown (for relative time updates)
      this.processHistory();
    }
  }
});
