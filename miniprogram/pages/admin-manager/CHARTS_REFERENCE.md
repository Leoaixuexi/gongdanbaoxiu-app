# Charts & Data Visualization Reference

## Quick Overview

This guide provides details on all charts and visualizations in the Admin Manager pages.

---

## Dashboard Page KPIs

### KPI Cards Layout (2-column grid)

```
┌─────────────────┬─────────────────┐
│  Total Active   │  Avg Response   │
│    Orders       │     Time        │
│   📋 [count]    │  ⏱️ [hours]     │
└─────────────────┴─────────────────┘
┌─────────────────┬─────────────────┐
│ Avg Resolution  │  Overdue Rate   │
│      Time       │                 │
│   ✓ [hours]     │  ⚠️ [percent]   │
└─────────────────┴─────────────────┘
┌─────────────────┬─────────────────┐
│ First-Time Fix  │  Completion     │
│      Rate       │     Rate        │
│   🎯 [percent]  │  📊 [percent]   │
└─────────────────┴─────────────────┘
```

### KPI Color Coding

| Metric | Good | Warning | Danger |
|--------|------|---------|--------|
| Avg Response Time | < 24h | ≥ 24h | - |
| Avg Resolution Time | < 72h | ≥ 72h | - |
| Overdue Rate | - | - | > 10% |
| First-Time Fix Rate | > 85% | - | - |
| Completion Rate | > 90% | - | - |

---

## Analytics Page Charts

### 1. Bar Chart - Work Orders by Category (Tab 1)

**Purpose**: Compare work order volume across different fault types

**API Endpoint**: `GET /analytics/by-category`

**Expected Response Format**:
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

**Visual Representation**:
```
      │
   50 │     █
   40 │     █     █
   30 │     █     █     █
   20 │     █     █     █     █
   10 │     █     █     █     █
    0 └─────┴─────┴─────┴─────┴───
        Elec  Plum  HVAC  Other
```

**Features**:
- X-axis: Fault type name
- Y-axis: Count
- Bar color: Blue (#2196f3)
- Bar height: Scaled to max value
- Data labels: Show count on each bar
- Responsive: Bars shrink/grow based on container

---

### 2. Pie Chart - Work Orders by Priority (Tab 2)

**Purpose**: Show distribution of work orders by priority level

**API Endpoint**: `GET /analytics/by-priority`

**Expected Response Format**:
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

**Visual Representation**:
```
Legend:
🟥 Emergency: 5 (5.0%)
🟧 High: 15 (15.0%)
🟦 Normal: 60 (60.0%)
⬜ Low: 20 (20.0%)
```

**Color Mapping**:
- Emergency: Red (#f44336)
- High: Orange (#ff9800)
- Normal: Blue (#2196f3)
- Low: Grey (#9e9e9e)

**Features**:
- Percentage calculation
- Color-coded legend
- Count and percentage display
- Interactive legend items

---

### 3. Line Chart - Trend Over Time (Tab 3)

**Purpose**: Track work order metrics over time periods

**API Endpoint**: `GET /analytics/trends?period={daily|weekly|monthly}`

**Expected Response Format**:
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

**Visual Representation**:
```
Legend:
─── Total Orders (Blue)
─── Completed (Green)
─── Overdue (Red)

Date        Total  Completed  Overdue
01-01         25      20         2
01-02         30      22         3
01-03         28      24         1
```

**Period Options**:
- Daily: Day-by-day trends
- Weekly: Week-over-week trends
- Monthly: Month-over-month trends

**Line Colors**:
- Total orders: Blue (#2196f3)
- Completed orders: Green (#4caf50)
- Overdue orders: Red (#f44336)

**Features**:
- Multiple series on same chart
- Period selector tabs
- Date formatting based on period
- Smooth curves
- Data point markers

---

### 4. Technician Performance Table (Tab 4)

**Purpose**: Compare technician performance metrics

**API Endpoint**: `GET /analytics/technician-performance`

**Expected Response Format**:
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

**Table Structure**:
```
┌──────────┬─────┬─────┬──────┬────────┬──────┐
│   Name   │Asgnd│Comp │Rate% │Avg Time│Fix%  │
├──────────┼─────┼─────┼──────┼────────┼──────┤
│ 张三     │  50 │  45 │ 90.0 │  24.5h │ 88.9 │
│ 李四     │  40 │  38 │ 95.0 │  20.1h │ 92.5 │
│ 王五     │  35 │  28 │ 80.0 │  30.2h │ 75.0 │
└──────────┴─────┴─────┴──────┴────────┴──────┘
```

**Sortable Columns**:
1. **Technician Name** (String)
2. **Total Assigned** (Integer)
3. **Completed** (Integer)
4. **Completion Rate** (Float, %)
5. **Avg Resolution Time** (Float, hours)
6. **First-Time Fix Rate** (Float, %)

**Default Sort**: Completion Rate (Descending)

**Color Coding**:
- **Green** (Good):
  - Completion Rate ≥ 90%
  - First-Time Fix Rate ≥ 85%
- **Red** (Poor):
  - Completion Rate < 70%
  - First-Time Fix Rate < 60%

**Features**:
- Click column header to sort
- Toggle ascending/descending
- Visual indicators (↑/↓) for sort direction
- Horizontal scroll for narrow screens
- Performance-based color coding

---

## Export Feature

### Export Modal Options

**Report Types**:
1. **Overview Report**: All KPIs and summary statistics
2. **Trends Report**: Time-series data with all metrics
3. **Category Report**: Work orders grouped by fault type
4. **Technician Performance**: Full performance table

**File Formats**:
1. **Excel (.xlsx)**: Formatted spreadsheet with styling
2. **CSV (.csv)**: Plain text, comma-separated values

**Date Range**: Uses selected date range from analytics page

**API Endpoint**: `POST /analytics/export`

**Request Format**:
```json
{
  "report_type": "overview",
  "format": "excel",
  "start_date": "2025-01-01",
  "end_date": "2025-01-31"
}
```

**Response Format**:
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

**Download Flow**:
1. User clicks "导出报表" button
2. Modal opens with options
3. User selects report type and format
4. User clicks "确认导出"
5. API call to generate report
6. Download file automatically
7. Save to device storage
8. Success message displayed

---

## Date Range Filtering

### Dashboard Date Filter
- Part of collapsible filter section
- Start Date picker
- End Date picker
- Applied with other filters via "应用筛选" button

### Analytics Date Selector
- Prominent at top of page
- Start Date picker
- End Date picker
- Separate "应用" button
- Affects all charts simultaneously

### Default Behavior
- **Dashboard**: No default date range (all dates)
- **Analytics**: Last 30 days by default

---

## Data Refresh Strategies

### Dashboard
- **Auto-refresh**: Every 5 minutes
- **Manual refresh**: Button in header
- **Pull-to-refresh**: Swipe down gesture
- **On filter change**: Immediate update

### Analytics
- **On date range change**: Manual trigger
- **On period change**: Immediate (trends only)
- **No auto-refresh**: User-initiated only

---

## Responsive Behavior

### Mobile (< 375px)
- KPI cards: Stack vertically
- Charts: Full width
- Tables: Horizontal scroll
- Filters: Full width inputs

### Tablet (375px - 768px)
- KPI cards: 2-column grid
- Charts: Optimized width
- Tables: Fit to screen or scroll
- Filters: Inline layout

### Desktop (> 768px)
- KPI cards: 3-column grid (if needed)
- Charts: Fixed width with margins
- Tables: Full layout visible
- Filters: Horizontal row

---

## Performance Considerations

### Chart Rendering
- **Lazy Load**: Only render active tab
- **Data Limit**: Cap at 100 data points per chart
- **Pagination**: Table shows 20 rows at a time

### API Optimization
- **Parallel Requests**: Load multiple charts simultaneously
- **Caching**: Store responses for 5 minutes
- **Debouncing**: Filter changes debounced 500ms

### Memory Management
- **Cleanup**: Clear intervals on page unload
- **Reset**: Clear chart data when switching tabs
- **Garbage Collection**: Remove unused data references

---

## Accessibility Features

### Visual Indicators
- Color + icon for status (not color alone)
- Text labels on all interactive elements
- Loading states with text descriptions

### Touch Targets
- Minimum size: 44x44 pixels
- Adequate spacing between elements
- Visual feedback on tap

### Text
- Minimum font size: 24rpx (12pt)
- High contrast ratios
- No text in images

---

## Error Handling

### API Errors
- Show toast with error message
- Retry button for failed requests
- Fallback to cached data if available

### Empty States
- Display helpful message
- Suggest actions (adjust filters, etc.)
- Show relevant icon

### Network Errors
- Detect offline state
- Queue requests for later
- Notify user of connection issues

---

## Future Enhancements

### Potential Additions
1. **Real-time Updates**: WebSocket for live data
2. **Advanced Filters**: Multi-select, date ranges, search
3. **Drill-down**: Click chart elements for details
4. **Comparison Mode**: Compare periods side-by-side
5. **Custom Dashboards**: User-configurable layouts
6. **Export Scheduling**: Automated report generation
7. **Alerts**: Threshold-based notifications
8. **Mobile Gestures**: Swipe between tabs/charts

---

## Testing Checklist

### Dashboard
- [ ] KPI cards load correctly
- [ ] All 6 metrics displayed with proper formatting
- [ ] Color coding works for thresholds
- [ ] Filters apply correctly
- [ ] Clear filters resets all inputs
- [ ] Pagination works
- [ ] Auto-refresh triggers every 5 min
- [ ] Manual refresh works
- [ ] Pull-to-refresh works
- [ ] Work order cards clickable
- [ ] Navigation to analytics works

### Analytics
- [ ] All 4 tabs render correctly
- [ ] Bar chart displays categories
- [ ] Pie chart shows priorities with colors
- [ ] Line chart shows trends
- [ ] Period selector changes data
- [ ] Performance table sorts correctly
- [ ] Table columns sortable
- [ ] Color coding in table works
- [ ] Date range selector applies
- [ ] Export modal opens
- [ ] Export generates file
- [ ] File downloads successfully

---

## Summary Statistics

**Total Lines of Code**: ~2,332 lines

**Files Created**:
- Dashboard: 4 files (WXML, JS, WXSS, JSON)
- Analytics: 4 files (WXML, JS, WXSS, JSON)
- ECharts: 5 files (Component + README)
- Documentation: 2 files (Summary + Reference)

**Chart Types**: 4
- 1 Bar Chart (Category Distribution)
- 1 Pie Chart (Priority Distribution)
- 1 Line Chart (Trend Analysis)
- 1 Table (Technician Performance)

**API Endpoints**: 8
- 3 for Dashboard
- 5 for Analytics

**Interactive Elements**:
- 6 KPI cards
- 7 filter controls
- 4 chart tabs
- 6 sortable table columns
- 1 export modal

---

## Support

For questions or issues:
1. Review API documentation
2. Check console logs for errors
3. Verify data formats match expected schemas
4. Test with mock data first
5. Ensure all dependencies installed

For ECharts setup assistance, see: `miniprogram/ec-canvas/README.md`
