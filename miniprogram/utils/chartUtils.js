/**
 * ECharts 图表配置工具
 * 用于行政经理数据分析页面的图表配置
 */

/**
 * 获取环形图配置（工单处理进度）
 * @param {Array} data - 数据数组 [{name: '待维修', value: 10}, ...]
 * @returns {Object} ECharts option 配置
 */
function getRingChartOption(data) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  // 状态颜色映射：按云函数返回顺序 ['已提报', '维修中', '待复核', '需返工', '已完成']
  const statusColors = [
    '#3B82F6', // Blue (已提报)
    '#06B6D4', // Cyan (维修中)
    '#F59E0B', // Amber (待复核)
    '#F43F5E', // Rose (需返工)
    '#10B981'  // Emerald (已完成)
  ];

  return {
    color: statusColors,
    tooltip: { show: false },
    legend: { show: false },
    series: [{
      name: '工单状态',
      type: 'pie',
      selectedMode: 'single',
      selectedOffset: 12,
      radius: ['48%', '85%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: false,
      label: {
        show: true,
        position: 'inside',
        formatter: function(p) { return p.percent > 0 ? p.percent + '%' : ''; },
        fontSize: 8,
        color: '#ffffff',
        fontWeight: 'bold'
      },
      labelLine: { show: false },
      data: data
    }],
    graphic: [{
      type: 'group',
      left: 'center',
      top: 'center',
      children: [{
        type: 'text',
        left: 'center',
        top: -14,
        style: {
          text: '总数',
          textAlign: 'center',
          fill: '#999',
          fontSize: 12
        }
      }, {
        type: 'text',
        left: 'center',
        top: 6,
        style: {
          text: String(total),
          textAlign: 'center',
          fill: '#333',
          fontSize: 22,
          fontWeight: 'bold'
        }
      }]
    }]
  };
}

/**
 * 获取折线图配置（工单趋势）
 * @param {Array} dates - 日期数组 ['01-01', '01-02', ...]
 * @param {Array} submittedData - 已提报数据 [10, 15, ...]
 * @param {Array} completedData - 已完成数据 [8, 12, ...]
 * @returns {Object} ECharts option 配置
 */
function getLineChartOption(dates, submittedData, completedData) {
  return {
    color: ['#FFAD0C', '#10B981'],
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#fff',
      borderColor: '#fff',
      borderWidth: 1,
      formatter: function (params) {
        let result = params[0].axisValue;
        params.forEach(function (item) {
          result += '\n' + item.seriesName + '：' + item.value + '单';
        });
        return result;
      }
    },
    legend: {
      data: ['已提报', '已完成'],
      top: 0,
      icon: 'roundRect',
      itemWidth: 24,
      itemHeight: 14,
      itemGap: 24,
      textStyle: {
        color: '#333',
        fontSize: 12
      }
    },
    grid: {
      left: '2%',
      right: '4%',
      bottom: '2%',
      top: '12%',
      containLabel: true,
      borderColor: '#f3f4f6'
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dates,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        fontSize: 11,
        color: '#9ca3af',
        margin: 12,
        interval: 0,
        rotate: dates.length > 7 ? 45 : 0
      },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      min: 0,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        fontSize: 11,
        color: '#9ca3af'
      },
      splitLine: {
        lineStyle: {
          color: '#f3f4f6',
          type: 'dashed'
        }
      }
    },
    series: [
      {
        name: '已提报',
        type: 'line',
        data: submittedData,
        smooth: true,
        showSymbol: false,
        symbolSize: 8,
        lineStyle: {
          width: 3
        }
      },
      {
        name: '已完成',
        type: 'line',
        data: completedData,
        smooth: true,
        showSymbol: false,
        symbolSize: 8,
        lineStyle: {
          width: 3
        }
      }
    ]
  };
}

/**
 * 获取饼图配置（故障类型/责任方分布）
 * @param {Array} data - 数据数组 [{name: '电梯维修', value: 10}, ...]
 * @param {string} title - 图表标题
 * @returns {Object} ECharts option 配置
 */
function getPieChartOption(data, title = '') {
  return {
    color: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
            '#06B6D4', '#F97316', '#EC4899', '#14B8A6', '#6366F1',
            '#84CC16', '#A855F7'],
    tooltip: {
      trigger: 'item',
      backgroundColor: '#ffffff',
      borderColor: 'transparent',
      borderWidth: 0,
      padding: [8, 12],
      textStyle: {
        color: '#1f2937',
        fontSize: 12
      },
      formatter: '{b}: {c}单 ({d}%)'
    },
    legend: {
      type: 'plain',
      orient: 'horizontal',
      top: 4,
      left: 0,
      right: 0,
      itemWidth: 24,
      itemHeight: 14,
      itemGap: 12,
      textStyle: {
        fontSize: 12,
        color: '#333'
      },
      data: data.map(item => item.name)
    },
    series: [{
      name: title,
      type: 'pie',
      radius: ['28%', '48%'],
      center: ['50%', '70%'],
      avoidLabelOverlap: true,
      itemStyle: {
        borderRadius: 8,
        borderColor: '#fff',
        borderWidth: 2
      },
      label: {
        show: true,
        position: 'outside',
        formatter: '{b}',
        fontSize: 13,
        color: '#333'
      },
      labelLine: {
        show: true,
        length: 6,
        length2: 8
      },
      data: data
    }]
  };
}

/**
 * 获取实心饼图配置（责任方分布）
 * @param {Array} data - 数据数组 [{name: '业主', value: 10}, ...]
 * @param {string} title - 图表标题
 * @returns {Object} ECharts option 配置
 */
function getSolidPieChartOption(data, title = '') {
  return {
    color: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'],
    tooltip: { show: false },
    legend: { show: false },
    series: [{
      name: title,
      type: 'pie',
      selectedMode: 'single',
      selectedOffset: 12,
      radius: '86%',
      center: ['50%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 6,
        borderColor: '#fff',
        borderWidth: 2
      },
      label: {
        show: true,
        position: 'inside',
        formatter: function(p) { return p.percent > 0 ? p.percent + '%' : ''; },
        fontSize: 9,
        color: '#ffffff',
        fontWeight: 'bold'
      },
      labelLine: { show: false },
      data: data
    }]
  };
}

/**
 * 获取柱状图配置（楼层/位置分布）
 * @param {Array} categories - X轴类别 ['1楼', '2楼', ...]
 * @param {Array} data - Y轴数据 [10, 15, ...]
 * @param {string} title - 图表标题
 * @returns {Object} ECharts option 配置
 */
function getBarChartOption(categories, data, title = '') {
  return {
    color: ['#3B82F6'],
    tooltip: {
      trigger: 'item',
      backgroundColor: '#fff',
      borderColor: '#fff',
      borderWidth: 1,
      textStyle: { color: '#1f2937' },
      formatter: function (params) {
        return params.name + '：' + params.value + '单';
      }
    },
    grid: {
      left: '2%',
      right: '4%',
      bottom: '2%',
      top: '10%',
      containLabel: true,
      borderColor: '#f3f4f6'
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        fontSize: 11,
        color: '#9ca3af',
        margin: 12,
        interval: 0,
        rotate: categories.length > 5 ? 45 : 0
      }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        fontSize: 11,
        color: '#9ca3af'
      },
      splitLine: {
        lineStyle: {
          color: '#f3f4f6',
          type: 'dashed'
        }
      }
    },
    series: [{
      name: title,
      type: 'bar',
      data: data,
      barWidth: '40%',
      itemStyle: {
        borderRadius: [4, 4, 0, 0],
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{
            offset: 0, color: '#3B82F6' // Blue-500
          }, {
            offset: 1, color: '#60A5FA' // Blue-400
          }]
        }
      },
      emphasis: {
        itemStyle: {
          color: '#9CA3AF'
        }
      },
      label: {
        show: true,
        position: 'top',
        fontSize: 10,
        color: '#6b7280'
      }
    }]
  };
}

/**
 * 初始化图表（返回初始化函数）
 * @param {Object} chart - ECharts 实例
 * @param {Object} option - 图表配置
 */
function initChart(chart, option) {
  if (chart) {
    chart.setOption(option);
  }
}

module.exports = {
  getRingChartOption,
  getLineChartOption,
  getPieChartOption,
  getSolidPieChartOption,
  getBarChartOption,
  initChart
};
