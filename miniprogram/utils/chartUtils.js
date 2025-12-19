/**
 * ECharts 图表配置工具
 * 用于物业经理数据分析页面的图表配置
 */

/**
 * 获取环形图配置（工单处理进度）
 * @param {Array} data - 数据数组 [{name: '待维修', value: 10}, ...]
 * @returns {Object} ECharts option 配置
 */
function getRingChartOption(data) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  // 状态颜色映射：使用更现代、饱和度稍低的配色
  const statusColors = [
    '#3B82F6', // Blue (待维修)
    '#06B6D4', // Cyan (维修中)
    '#8B5CF6', // Violet (已修复)
    '#F59E0B', // Amber (待复核)
    '#F43F5E', // Rose (需重修)
    '#10B981'  // Emerald (已完成)
  ];

  return {
    color: statusColors,
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}单'
    },
    legend: {
      orient: 'horizontal',
      top: 10,
      left: 0,
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
      name: '工单状态',
      type: 'pie',
      radius: ['35%', '58%'],
      center: ['50%', '62%'],
      avoidLabelOverlap: true,
      label: {
        show: true,
        position: 'outside',
        formatter: '{b}: {c}',
        fontSize: 13,
        color: '#333'
      },
      labelLine: {
        show: true,
        length: 8,
        length2: 12
      },
      data: data
    }],
    graphic: [{
      type: 'group',
      left: 'center',
      top: '60%',
      children: [{
        type: 'text',
        left: 'center',
        top: -15,
        style: {
          text: '总数',
          textAlign: 'center',
          fill: '#999',
          fontSize: 12
        }
      }, {
        type: 'text',
        left: 'center',
        top: 5,
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
    color: ['#3B82F6', '#10B981'],
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderColor: '#e5e7eb',
      textStyle: { color: '#1f2937' },
      axisPointer: {
        type: 'line',
        lineStyle: {
          color: '#9ca3af',
          width: 1,
          type: 'dashed'
        }
      }
    },
    legend: {
      data: ['已提报', '已完成'],
      top: 0,
      icon: 'circle',
      itemGap: 24,
      textStyle: { color: '#6b7280' }
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
          width: 3,
          shadowColor: 'rgba(59, 130, 246, 0.2)',
          shadowBlur: 8,
          shadowOffsetY: 8
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{
              offset: 0, color: 'rgba(59, 130, 246, 0.2)'
            }, {
              offset: 1, color: 'rgba(59, 130, 246, 0)'
            }]
          }
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
          width: 3,
          shadowColor: 'rgba(16, 185, 129, 0.2)',
          shadowBlur: 8,
          shadowOffsetY: 8
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{
              offset: 0, color: 'rgba(16, 185, 129, 0.2)'
            }, {
              offset: 1, color: 'rgba(16, 185, 129, 0)'
            }]
          }
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
    color: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderColor: '#e5e7eb',
      textStyle: { color: '#1f2937' },
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      right: 0,
      top: 'center',
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: '#6b7280', fontSize: 12 },
      data: data.map(item => item.name)
    },
    series: [{
      name: title,
      type: 'pie',
      radius: ['40%', '70%'], // Donut style looks more modern
      center: ['35%', '50%'],
      itemStyle: {
        borderRadius: 8,
        borderColor: '#fff',
        borderWidth: 2
      },
      data: data,
      emphasis: {
        scale: true,
        scaleSize: 5,
        itemStyle: {
          shadowBlur: 20,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.1)'
        }
      },
      label: {
        show: false // Clean look, rely on legend/tooltip
      }
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
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderColor: '#e5e7eb',
      textStyle: { color: '#1f2937' },
      axisPointer: {
        type: 'shadow',
        shadowStyle: { color: 'rgba(243, 244, 246, 0.5)' }
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
  getBarChartOption,
  initChart
};
