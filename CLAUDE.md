# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

微信小程序工单报修管理系统（小物业报修），使用微信云开发（CloudBase）作为后端。
- 前端：`miniprogram/` — 微信小程序，使用 Vant Weapp 组件库
- 后端：`cloudfunctions/` — 微信云函数 + 云数据库（无独立后端服务器）
- 云环境 ID：`cloud1-7glfhm4r06e030bd`（定义于 `miniprogram/utils/constants.js`）

## 开发方式

本项目通过**微信开发者工具**开发和调试，无 npm build/test/lint 命令。

- 打开微信开发者工具，导入项目根目录（`appid: wx8553f910840a6bf1`）
- 小程序前端代码在 `miniprogram/`，安装前端依赖后需在工具中"构建 npm"：
  ```bash
  cd miniprogram && npm install
  # 然后在微信开发者工具中：工具 → 构建 npm
  ```
- 云函数部署：在微信开发者工具中右键云函数目录 → 上传并部署（云端安装依赖）
- 每个云函数有独立的 `package.json` 和 `node_modules`

## 架构

### 云函数路由模式

所有云函数采用 **action 路由** 模式 — 一个云函数通过 `event.action` 分发到多个 handler：

```
cloudfunctions/workOrderManager/
├── index.js          # 主入口，switch(action) 路由
├── helpers.js        # 共享工具（db引用、用户查询等）
├── handlers/
│   ├── crud.js       # create/list/update
│   ├── status.js     # updateStatus/completeRepair/reviewOrder
│   └── notify.js     # urgeAccept/urgeRepair/urgeReview
```

`userAuth` 同理，handlers 拆分为 `auth.js`、`users.js`、`announcements.js`、`system.js`。

### 前端调用链

```
页面 → services/*.js → utils/cloudCall.js → wx.cloud.callFunction()
```

- `cloudCall.js`：统一封装 Loading、错误提示、请求去重、重试机制
  - `callCloud(name, data, options)` — 标准调用
  - `callCloudSilent(name, data)` — 静默调用（无 Loading/错误提示）
  - `callCloudWithRetry(name, data, retryCount)` — 带重试
- `services/` 层封装业务语义，页面不直接调用 `callCloud`

### Behaviors 复用

- `behaviors/listPage.js` — 列表页通用逻辑（分页、下拉刷新、加载更多），页面需实现 `loadListData()`
- `behaviors/adminPage.js` — 管理后台页面通用逻辑

### 页面结构

- 主包：首页(`home`)、登录(`login`)、工单详情/编辑、消息、数据分析、反馈、个人信息等
- 分包 `pages/admin/`：管理后台（用户管理、角色、配置、公告、审计日志、数据字典、反馈管理）
- 自定义 TabBar：`custom-tab-bar/`，3个入口（首页/消息/我的）

### 角色与权限

4种角色定义于 `utils/constants.js` 的 `ROLES`：
- `1` 系统管理员 / `2` 行政经理 / `3` 维修员 / `4` 办美员工

### 工单状态流转

`Pending Repair` → `In Progress` → `Repaired` → `Completed`（可能经 `Needs Rework` 返工）

状态值为英文字符串，中文映射在 `STATUS_DISPLAY_NAMES`。

## 关键文件

| 文件 | 作用 |
|------|------|
| `miniprogram/utils/constants.js` | 所有前端常量（状态、角色、颜色、存储键） |
| `miniprogram/utils/cloudCall.js` | 云函数调用统一封装 |
| `miniprogram/config/index.js` | 环境配置，`USE_CLOUD_DATABASE` 开关 |
| `miniprogram/services/auth.js` | 登录认证逻辑 |
| `miniprogram/services/workOrder.js` | 工单 CRUD 服务 |
| `miniprogram/app.js` | 全局状态（globalData）、登录检查、未读数管理 |
| `cloudfunctions/workOrderManager/` | 工单核心云函数 |
| `cloudfunctions/userAuth/` | 用户认证与管理云函数 |

## 注意事项

- 所有云函数返回值约定 `{ success: boolean, error?: string, ...data }`，`cloudCall.js` 会检查 `success` 字段
- 前端状态值使用英文（如 `'Pending Repair'`），显示时通过 `STATUS_DISPLAY_NAMES` 映射中文
- `globalData.unreadCounts` 是未读消息的唯一数据源，TabBar 通过 `_badgeVersion` 检测更新
- 图片上传经过压缩处理，配置在 `utils/imageUtils.js`

## Language

Respond in Simplified Chinese (简体中文) for all interactions.
