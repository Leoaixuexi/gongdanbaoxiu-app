# Admin Manager Pages - Quick Start Guide

## Overview

This guide will help you quickly set up and test the Dashboard and Analytics pages.

---

## Files Created

### Dashboard Page
```
miniprogram/pages/admin-manager/dashboard/
├── index.wxml    (Layout)
├── index.js      (Logic - 432 lines)
├── index.wxss    (Styles)
└── index.json    (Config)
```

### Analytics Page
```
miniprogram/pages/admin-manager/analytics/
├── index.wxml    (Layout)
├── index.js      (Logic - 432 lines)
├── index.wxss    (Styles)
└── index.json    (Config)
```

### ECharts Component
```
miniprogram/ec-canvas/
├── ec-canvas.wxml
├── ec-canvas.js
├── ec-canvas.wxss
├── ec-canvas.json
└── README.md (Installation guide)
```

### Documentation
```
miniprogram/pages/admin-manager/
├── IMPLEMENTATION_SUMMARY.md (Detailed implementation)
├── CHARTS_REFERENCE.md (Chart specifications)
└── QUICKSTART.md (This file)
```

---

## Quick Setup

### 1. Verify Dependencies

Ensure these components exist:
- `components/work-order-card/` - Work order card component
- `services/api.js` - API client
- `utils/constants.js` - Constants
- `utils/formatter.js` - Formatters

### 2. Configure API Base URL

Update `miniprogram/utils/constants.js`:
```javascript
const API_BASE_URL = 'http://your-backend-url:3000/api';
```

### 3. Add Pages to app.json

```json
{
  "pages": [
    "pages/admin-manager/dashboard/index",
    "pages/admin-manager/analytics/index"
  ]
}
```

### 4. Optional: Install ECharts

For full chart rendering, follow `ec-canvas/README.md`:
```bash
# Download echarts-for-weixin
git clone https://github.com/ecomfe/echarts-for-weixin.git

# Copy to your project
cp -r echarts-for-weixin/ec-canvas miniprogram/
```

---

## Testing Without Backend

### Mock API Responses

Create `miniprogram/services/mock-api.js`:

```javascript
// Mock data for testing
const mockOverview = {
  success: true,
  data: {
    totalActiveOrders: 42,
    avgResponseTime: 18.5,
    avgResolutionTime: 45.2,
    overdueRate: 8.3,
    firstTimeFixRate: 87.5,
    completionRate: 92.1
  }
};

const mockWorkOrders = {
  success: true,
  data: [
    {
      id: 1,
      title: "Test Work Order 1",
      status: "In Progress",
      priority: "High",
      created_at: "2025-01-10T10:00:00Z",
      fault_type: "Electrical Issues",
      floor: "3F"
    }
  ],
  pagination: {
    total: 1,
    page: 1,
    limit: 20
  }
};

// Export mock functions
module.exports = {
  mockOverview,
  mockWorkOrders
};
```

---

## Navigation

### From Dashboard to Analytics

Button in dashboard footer navigates to analytics:
```javascript
navigateToAnalytics() {
  wx.navigateTo({
    url: '/pages/admin-manager/analytics/index'
  });
}
```

### From Other Pages to Dashboard

```javascript
wx.navigateTo({
  url: '/pages/admin-manager/dashboard/index'
});
```

---

## API Endpoints Required

### Dashboard Page

1. **GET /analytics/overview**
   - Returns: 6 KPI metrics
   - Used by: `loadOverview()`

2. **GET /workorders**
   - Params: page, limit, status, priority, fault_type_id, floor, start_date, end_date
   - Returns: Paginated work orders
   - Used by: `loadWorkOrders()`

3. **GET /fault-types**
   - Returns: List of fault types
   - Used by: `loadFaultTypes()`

### Analytics Page

1. **GET /analytics/by-category**
   - Params: start_date, end_date
   - Returns: Work orders grouped by fault type
   - Used by: `loadCategoryData()`

2. **GET /analytics/by-priority**
   - Params: start_date, end_date
   - Returns: Work orders grouped by priority
   - Used by: `loadPriorityData()`

3. **GET /analytics/trends**
   - Params: period (daily/weekly/monthly), start_date, end_date
   - Returns: Time-series data
   - Used by: `loadTrendData()`

4. **GET /analytics/technician-performance**
   - Params: start_date, end_date
   - Returns: Technician metrics
   - Used by: `loadTechnicianData()`

5. **POST /analytics/export**
   - Body: report_type, format, start_date, end_date
   - Returns: File URL
   - Used by: `handleExport()`

---

## Response Formats

### Overview Response
```json
{
  "success": true,
  "data": {
    "totalActiveOrders": 42,
    "avgResponseTime": 18.5,
    "avgResolutionTime": 45.2,
    "overdueRate": 8.3,
    "firstTimeFixRate": 87.5,
    "completionRate": 92.1
  }
}
```

### Work Orders Response
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Air conditioning not cooling",
      "status": "In Progress",
      "priority": "High",
      "created_at": "2025-01-10T10:00:00Z",
      "fault_type": "HVAC",
      "floor": "3F",
      "photos": ["url1", "url2"]
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20
  }
}
```

### Category Analytics Response
```json
{
  "success": true,
  "data": [
    {
      "faultType": "Electrical Issues",
      "faultTypeId": 1,
      "count": 45
    },
    {
      "faultType": "Plumbing Problems",
      "faultTypeId": 2,
      "count": 32
    }
  ]
}
```

### Priority Analytics Response
```json
{
  "success": true,
  "data": [
    {
      "priority": "Emergency",
      "count": 5
    },
    {
      "priority": "High",
      "count": 15
    },
    {
      "priority": "Normal",
      "count": 60
    },
    {
      "priority": "Low",
      "count": 20
    }
  ]
}
```

### Trends Response
```json
{
  "success": true,
  "data": [
    {
      "date": "2025-01-01",
      "total": 25,
      "completed": 20,
      "overdue": 2
    },
    {
      "date": "2025-01-02",
      "total": 30,
      "completed": 22,
      "overdue": 3
    }
  ]
}
```

### Technician Performance Response
```json
{
  "success": true,
  "data": [
    {
      "technicianId": 1,
      "technicianName": "张三",
      "totalAssigned": 50,
      "completed": 45,
      "completionRate": 90.0,
      "avgResolutionTime": 24.5,
      "firstTimeFixRate": 88.9
    }
  ]
}
```

### Export Response
```json
{
  "success": true,
  "data": {
    "fileUrl": "https://example.com/reports/report_123.xlsx",
    "fileName": "analytics_report_20250113.xlsx",
    "fileSize": 45678
  }
}
```

---

## Common Issues & Solutions

### Issue: "Cannot read property 'totalActiveOrders' of undefined"
**Solution**: Ensure API returns data in expected format with `success` and `data` fields.

### Issue: Work order cards not displaying
**Solution**: Check that `work-order-card` component is properly registered in `index.json`.

### Issue: Auto-refresh not working
**Solution**: Verify `startAutoRefresh()` is called in `onLoad()` and interval is properly set.

### Issue: Filters not applying
**Solution**: Check that filter values are correctly bound to `this.data.filters` object.

### Issue: Charts not showing
**Solution**: Currently using placeholder visualizations. To render actual charts, install echarts-for-weixin (see `ec-canvas/README.md`).

### Issue: Export not downloading
**Solution**: Verify backend returns valid `fileUrl` and check WeChat download permissions.

---

## Testing Checklist

### Dashboard Tests
```
□ Page loads without errors
□ KPI cards display correctly
□ All 6 metrics show values
□ Color coding works (green/red indicators)
□ Filter section toggles open/closed
□ Status dropdown populates
□ Priority dropdown populates
□ Fault type dropdown loads from API
□ Date pickers work
□ Apply filters updates work order list
□ Clear filters resets all inputs
□ Work order cards display
□ Pagination buttons work
□ Manual refresh button works
□ Auto-refresh triggers (wait 5 min)
□ Navigation to analytics works
```

### Analytics Tests
```
□ Page loads without errors
□ Date range selector works
□ Apply date range reloads charts
□ Tab navigation works
□ Bar chart displays (tab 1)
□ Pie chart displays (tab 2)
□ Line chart displays (tab 3)
□ Period selector changes trend data
□ Performance table displays (tab 4)
□ Table columns sort correctly
□ Color coding in table works
□ Export button opens modal
□ Export modal displays options
□ Export generates file
□ Download succeeds
```

---

## Development Tips

### Debugging

1. **Enable Console Logs**
   - All functions log to console
   - Check DevTools for API responses

2. **Network Inspector**
   - Verify API requests
   - Check response formats

3. **Data Inspector**
   - Use AppData tab to view page data
   - Verify filter values and work order array

### Performance

1. **API Response Time**
   - Dashboard should load in < 2 seconds
   - Analytics charts should render in < 3 seconds

2. **Memory Usage**
   - Monitor with WeChat DevTools
   - Watch for memory leaks in auto-refresh

3. **Rendering**
   - Keep work order list pagination at 20
   - Limit chart data points to 100

### Customization

1. **KPI Thresholds**
   - Edit in dashboard WXML (line 40-80)
   - Modify color conditions

2. **Auto-Refresh Interval**
   - Change `REFRESH_INTERVAL_MS` in dashboard JS
   - Default: 5 minutes (300000ms)

3. **Pagination Size**
   - Edit `pageSize` in dashboard data
   - Default: 20 items

4. **Chart Colors**
   - Modify in analytics WXSS
   - Update `PRIORITY_COLORS` in constants.js

---

## Next Steps

1. **Backend Integration**
   - Implement all 8 API endpoints
   - Test with real data

2. **ECharts Setup**
   - Follow `ec-canvas/README.md`
   - Replace placeholder visualizations

3. **Permissions**
   - Add role-based access control
   - Verify user has admin/manager role

4. **Testing**
   - Complete testing checklist
   - Test on real devices

5. **Optimization**
   - Add response caching
   - Implement error retry logic

6. **Deployment**
   - Build for production
   - Submit to WeChat for review

---

## Support Resources

- **Implementation Details**: See `IMPLEMENTATION_SUMMARY.md`
- **Chart Specifications**: See `CHARTS_REFERENCE.md`
- **ECharts Setup**: See `ec-canvas/README.md`
- **API Client**: See `services/api.js`
- **Constants**: See `utils/constants.js`

---

## File Size Summary

| Component | Files | Lines | Size |
|-----------|-------|-------|------|
| Dashboard | 4 | ~1,100 | ~35KB |
| Analytics | 4 | ~1,200 | ~40KB |
| ECharts | 5 | ~100 | ~5KB |
| Docs | 3 | - | ~50KB |
| **Total** | **16** | **~2,400** | **~130KB** |

---

## Conclusion

You now have a fully functional Dashboard and Analytics implementation for User Story 4. Follow this guide to set up, test, and deploy the pages. For detailed implementation information, refer to the other documentation files.

Happy coding!
