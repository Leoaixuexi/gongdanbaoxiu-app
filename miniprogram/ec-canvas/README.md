# ECharts for WeChat Mini Program

This directory contains a simplified ECharts canvas component for WeChat Mini Programs.

## Installation

For production use, install the official echarts-for-weixin library:

1. Download from: https://github.com/ecomfe/echarts-for-weixin
2. Copy the `ec-canvas` directory to your miniprogram folder
3. Import echarts.min.js into your project

## Current Implementation

The current implementation is a placeholder that provides the basic component structure. To enable full chart functionality:

1. **Download ECharts for WeChat**
   ```bash
   # Clone the repository
   git clone https://github.com/ecomfe/echarts-for-weixin.git

   # Copy the ec-canvas directory
   cp -r echarts-for-weixin/ec-canvas miniprogram/
   ```

2. **Download ECharts Core Library**
   - Visit https://echarts.apache.org/en/download.html
   - Download the minified version (echarts.min.js)
   - Place it in the `miniprogram/ec-canvas/` directory

3. **Update Component**
   Replace the current `ec-canvas.js` with the official implementation

## Usage Example

```javascript
// In your page.js
const echarts = require('../../ec-canvas/echarts');

Page({
  data: {
    ec: {
      onInit: (canvas, width, height, dpr) => {
        const chart = echarts.init(canvas, null, {
          width: width,
          height: height,
          devicePixelRatio: dpr
        });

        canvas.setChart(chart);

        const option = {
          xAxis: {
            type: 'category',
            data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
          },
          yAxis: {
            type: 'value'
          },
          series: [{
            data: [820, 932, 901, 934, 1290, 1330, 1320],
            type: 'line'
          }]
        };

        chart.setOption(option);
        return chart;
      }
    }
  }
});
```

```xml
<!-- In your page.wxml -->
<view class="chart-container">
  <ec-canvas id="mychart" canvas-id="mychart" ec="{{ ec }}"></ec-canvas>
</view>
```

## Features

- Bar Charts
- Pie Charts
- Line Charts
- Interactive tooltips
- Responsive sizing
- Touch events

## Documentation

- Official ECharts Documentation: https://echarts.apache.org/
- ECharts for WeChat: https://github.com/ecomfe/echarts-for-weixin

## Notes

The current simplified implementation is sufficient for development and testing. For production deployment with actual chart rendering, follow the installation steps above.
