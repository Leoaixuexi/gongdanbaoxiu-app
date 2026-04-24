# 小物业报修 · 工单报修管理小程序

公司内部使用的工单报修管理系统，基于**微信小程序 + 微信云开发（CloudBase）**。

## 技术栈

- 前端：微信小程序（原生） + [Vant Weapp](https://vant-contrib.gitee.io/vant-weapp/) 组件库 + ECharts for WeChat
- 后端：微信云函数（Node.js） + 云数据库 + 云存储（无独立服务器）
- 云环境 ID：`cloud1-7glfhm4r06e030bd`（定义于 `miniprogram/utils/constants.js`）
- AppID：`wx8553f910840a6bf1`

## 目录结构

```
gongdanbaoxiu/
├── miniprogram/            # 小程序前端
│   ├── app.js / app.json / app.wxss
│   ├── pages/              # 页面（主包 + admin 分包）
│   ├── components/         # 自定义组件（custom-picker / ec-canvas / header ...）
│   ├── custom-tab-bar/     # 自定义 TabBar（首页 / 消息 / 我的）
│   ├── services/           # 业务服务层（封装云函数调用）
│   ├── utils/              # 工具函数（cloudCall / formatter / imageUtils ...）
│   ├── behaviors/          # 页面 Behavior（列表页、管理页）
│   ├── config/             # 按钮/状态配置
│   ├── styles/             # 全局样式（theme.wxss / iconfont.wxss）
│   └── images/             # 图标与 TabBar 资源
├── cloudfunctions/         # 云函数（每个目录一个云函数）
│   ├── workOrderManager/   # 工单核心（action 路由）
│   ├── userAuth/           # 用户/角色/公告/系统配置
│   ├── sendNotification/   # 消息与通知
│   ├── uploadImage/        # 图片上传
│   ├── materialManager/    # 耗品/物料管理
│   ├── dictionaryManager/  # 数据字典
│   ├── feedbackManager/    # 反馈管理
│   └── getAnalytics*/ getEmployeeRanking/  # 数据分析
├── scripts/                # 运维脚本（种子数据、断言测试）
├── docs/                   # 项目文档
├── CLAUDE.md               # Claude Code 协作指引
└── project.config.json     # 微信开发者工具项目配置
```

## 角色

| role_id | 名称 | 主要权限 |
|---|---|---|
| 1 | 系统管理员 | 所有权限 |
| 2 | 行政经理 | 数据分析、工单审核、报表导出 |
| 3 | 维修员 | 接单、维修、状态更新 |
| 4 | 办美员工 | 提交工单、查看进度 |

## 工单状态流转

```
Pending Repair（已提报） → In Progress（维修中） → Repaired（待复核） → Completed（已完成）
                                                   ↓
                                            Needs Rework（需返工） → In Progress
```

状态值在前后端均为英文字符串；中文显示通过 `STATUS_DISPLAY_NAMES`（`miniprogram/utils/constants.js`）映射。

## 快速开始

### 依赖

- 微信开发者工具（最新稳定版）
- Node.js ≥ 16（用于前端 `npm install` 和云函数依赖安装）

### 步骤

```bash
# 1. 安装小程序前端依赖
cd miniprogram
npm install
```

```
# 2. 微信开发者工具
- 打开项目根目录
- 工具 → 构建 npm
- 使用云开发控制台登录至云环境 cloud1-7glfhm4r06e030bd
- 右键每个 cloudfunctions/<name>/ 目录 → "上传并部署：云端安装依赖"
```

### 云函数部署注意事项

- 每个云函数有独立的 `package.json` 和 `node_modules`
- 修改后必须重新上传部署才会生效
- 所有云函数返回值约定 `{ success: boolean, error?: string, ...data }`

## 关键架构点

### 云函数 action 路由

所有业务云函数通过 `event.action` 字段分发：

```
cloudfunctions/workOrderManager/
├── index.js          # switch(action) 路由
├── helpers.js        # 共享工具（db 引用、用户查询）
└── handlers/
    ├── crud.js       # create / list / update
    ├── status.js     # updateStatus / completeRepair / reviewOrder
    └── notify.js     # urgeAccept / urgeRepair / urgeReview
```

### 前端调用链

```
页面 → services/*.js → utils/cloudCall.js → wx.cloud.callFunction()
```

- `cloudCall.js` 统一封装 Loading、错误提示、请求去重、重试
- `services/` 层按业务领域拆分（auth / workOrder / material / dictionary / notification ...）
- 页面不直接调用 `callCloud`，必须走 service

### Behaviors 复用

- `behaviors/listPage.js` — 列表页通用逻辑（分页、下拉刷新、加载更多）
- `behaviors/adminPage.js` — 管理后台通用逻辑（权限校验、操作确认）

### 自定义 TabBar

`custom-tab-bar/` 3 个入口：首页（dashboard）、消息（notifications）、我的（property/submitted）。徽章数据通过 `app.globalData.unreadCounts` + `_badgeVersion` 驱动更新。

## 协作指引

- 更详细的代码约定、架构决策、模块划分见 [CLAUDE.md](CLAUDE.md)
- 交互与语言：所有沟通使用简体中文
