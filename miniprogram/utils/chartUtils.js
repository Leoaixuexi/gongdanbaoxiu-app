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

  return {
    color: ['#ff9800', '#2196f3', '#4caf50', '#9e9e9e'],
    series: [{
      name: '工单状态',
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      label: {
        show: true,
        formatter: '{b}: {d}%'
      },
      emphasis: {
        label: {
          show: true,
          fontSize: 14,
          fontWeight: 'bold'
        }
      },
      labelLine: {
        show: true
      },
      data: data
    }],
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
      data: data.map(item => item.name)
    },
    graphic: [{
      type: 'text',
      left: 'center',
      top: '45%',
      style: {
        text: `总数\n${total}`,
        textAlign: 'center',
        fill: '#333',
        fontSize: 16,
        fontWeight: 'bold'
      }
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
    color: ['#2196f3', '#4caf50'],
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross'
      }
    },
    legend: {
      data: ['已提报', '已完成'],
      top: 10
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dates,
      axisLabel: {
        fontSize: 10,
        interval: 0,
        rotate: dates.length > 7 ? 45 : 0
      }
    },
    yAxis: {
      type: 'value',
      minInterval: 1
    },
    series: [
      {
        name: '已提报',
        type: 'line',
        data: submittedData,
        smooth: true,
        lineStyle: {
          width: 2
        }
      },
      {
        name: '已完成',
        type: 'line',
        data: completedData,
        smooth: true,
        lineStyle: {
          width: 2
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
    color: ['#2196f3', '#4caf50', '#ff9800', '#f44336', '#9c27b0'],
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
      data: data.map(item => item.name)
    },
    series: [{
      name: title,
      type: 'pie',
      radius: '55%',
      center: ['40%', '50%'],
      data: data,
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      },
      label: {
        formatter: '{b}: {d}%'
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
    color: ['#2196f3'],
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: {
        fontSize: 10,
        interval: 0,
        rotate: categories.length > 5 ? 45 : 0
      }
    },
    yAxis: {
      type: 'value',
      minInterval: 1
    },
    series: [{
      name: title,
      type: 'bar',
      data: data,
      barWidth: '60%',
      itemStyle: {
        borderRadius: [4, 4, 0, 0]
      },
      label: {
        show: true,
        position: 'top',
        fontSize: 10
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
