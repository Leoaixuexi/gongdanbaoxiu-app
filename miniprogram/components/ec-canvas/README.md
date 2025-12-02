# ECharts 组件使用说明

## 安装步骤

1. 下载 ECharts 微信小程序版本
   - 访问：https://github.com/ecomfe/echarts-for-weixin
   - 或直接下载：https://github.com/ecomfe/echarts-for-weixin/raw/master/ec-canvas/echarts.js

2. 将下载的 `echarts.js` 文件重命名为 `echarts.min.js`

3. 放置到当前目录（miniprogram/components/ec-canvas/）

## 替代方案

如果无法下载，可以使用 npm 方式：

```bash
# 在 miniprogram 目录下执行
npm install echarts --save

# 然后在微信开发者工具中点击：
# 工具 -> 构建 npm
```

然后修改 `ec-canvas.js` 第一行：
```javascript
// 改为：
import * as echarts from 'echarts';
```

## 使用示例

```javascript
// 在页面 .js 文件中
import * as echarts from '../../components/ec-canvas/echarts.min';

Page({
  data: {
    ec: {
      onInit: initChart
    }
  }
});

function initChart(canvas, width, height, dpr) {
  const chart = echarts.init(canvas, null, {
    width: width,
    height: height,
    devicePixelRatio: dpr
  });

  const option = {
    // ECharts 配置项
  };

  chart.setOption(option);
  return chart;
}
```

```xml
<!-- 在页面 .wxml 文件中 -->
<ec-canvas
  id="mychart"
  canvas-id="mychart-bar"
  ec="{{ ec }}"
  style="width: 100%; height: 300px;">
</ec-canvas>
```

```json
// 在页面 .json 文件中
{
  "usingComponents": {
    "ec-canvas": "../../components/ec-canvas/ec-canvas"
  }
}
```
