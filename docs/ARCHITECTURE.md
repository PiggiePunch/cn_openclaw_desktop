# 架构说明

本文档详细介绍 OpenClaw CN Desktop 的技术架构和设计决策。

## 总体架构

OpenClaw CN Desktop 采用**三层架构**设计：

```
┌─────────────────────────────────────────────────────────────┐
│                     前端 GUI 层                              │
│              (React 18 + Tailwind CSS)                      │
│                                                             │
│  - 聊天界面 / 智能体管理 / Skills / 通道管理               │
│  - 记忆中心 / 定时任务 / 浏览器工具                        │
└──────────────────────────┬──────────────────────────────────┘
                           │ WebSocket + HTTP
┌──────────────────────────┴──────────────────────────────────┐
│                     桌面壳层                                  │
│                    (Rust / Tauri 2)                          │
│                                                             │
│  - 进程管理 / 系统托盘 / 安装管理                            │
│  - 权限管理 / 配置读写 / 自动更新                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────┐
│                   Gateway 层                                 │
│                (Node.js - 内置)                              │
│                                                             │
│  - AI 核心逻辑 / 通道服务 / 工具系统                        │
│  - 记忆存储 / 定时任务 / 会话管理                           │
└─────────────────────────────────────────────────────────────┘
```

## 数据流

### 典型请求流程

```
用户操作 → 前端组件 → API 适配层 → WebSocket → Gateway
                ↓                                    ↓
         Tauri Command ←───────────────────── 响应处理
                ↓
         Rust 后端执行
```

### 场景示例：发送聊天消息

1. 用户在聊天输入框输入消息
2. 前端调用 `api.chat.send()`
3. API 适配层通过 WebSocket 转发到 Gateway
4. Gateway 调用 AI 模型处理
5. 流式响应通过 WebSocket 返回前端
6. 前端渲染消息到聊天窗口

## 核心模块

### 前端 (src/)

| 模块 | 职责 | 关键文件 |
|------|------|----------|
| `lib/api.js` | 统一 API 封装 | 提供面向业务的接口 |
| `lib/gateway.js` | WebSocket 客户端 | 连接 Gateway |
| `components/` | UI 组件库 | Radix UI + Tailwind |
| `hooks/` | React Hooks | 状态和逻辑复用 |

#### 页面结构

前端采用**状态驱动路由**，通过 `currentPage` 状态切换页面：

```
currentPage = 'chat'     → 聊天界面
currentPage = 'agents'   → 智能体管理
currentPage = 'skills'   → Skills 管理
currentPage = 'schedule' → 定时任务
currentPage = 'memory'   → 记忆中心
currentPage = 'channels' → 通道管理
currentPage = 'settings' → 设置页面
...
```

### 后端 (src-tauri/)

| 模块 | 职责 |
|------|------|
| `process.rs` | Gateway 子进程生命周期管理 |
| `tray.rs` | 系统托盘图标和菜单 |
| `config.rs` | 配置文件读写 |
| `openclaw_manager.rs` | OpenClaw 安装/更新 |
| `permissions.rs` | macOS 权限请求 |
| `commands/` | Tauri 命令实现 |

#### Tauri Commands

```rust
// 配置命令
get_config()     → 读取配置
save_config()    → 保存配置

// Gateway 进程命令
start_gateway()  → 启动 Gateway
stop_gateway()   → 停止 Gateway
get_status()     → 获取状态

// 安装命令
install()        → 安装 OpenClaw
check_update()    → 检查更新

// 系统命令
open_path()      → 打开文件/目录
get_system_info() → 获取系统信息
```

### Gateway (src-tauri/resources/openclaw/)

这是打包在应用内的 OpenClaw Gateway，包含完整 AI 能力：

- **AI 引擎**: 大语言模型调用
- **通道服务**: Telegram、微信等
- **工具系统**: 浏览器、代码执行等
- **记忆存储**: SQLite 持久化
- **任务调度**: Cron 定时任务

## 关键设计

### 1. 双路径容错

前端 API 同时支持两种调用路径：

```javascript
// 方式 1: 通过 Gateway (WebSocket)
const result = await api.chat.send(params)

// 方式 2: 通过 Tauri Command (HTTP/文件)
const config = await api.config.get()
```

目的：减少接口差异带来的失败，提升稳定性。

### 2. 启动自愈机制

应用启动时自动检查并修复：

- 通道绑定的智能体是否存在
- 会话引用的智能体是否有效
- Cron 任务绑定的智能体状态
- 清理无效的本地文件

### 3. 数据兼容性

- 数据目录 `~/.openclaw/` 与原版 OpenClaw 共用
- 配置文件 `openclaw.json` 格式兼容
- 会话存储使用 SQLite，可共用

## 目录结构

```
cn-openclaw-desktop/
├── src/                          # 前端应用
│   ├── main.jsx                  # 入口
│   ├── App.jsx                   # 主组件
│   ├── lib/
│   │   ├── api.js                # API 封装
│   │   └── gateway.js            # WebSocket 客户端
│   ├── components/               # UI 组件
│   │   ├── Chat.jsx              # 聊天
│   │   ├── WorkspaceEditor.jsx   # 智能体编辑
│   │   └── ...
│   └── hooks/                    # React Hooks
├── src-tauri/                    # 桌面壳
│   ├── src/
│   │   ├── main.rs               # 入口
│   │   ├── lib.rs                # 库
│   │   ├── process.rs            # 进程管理
│   │   ├── tray.rs               # 托盘
│   │   └── commands/              # Tauri 命令
│   ├── resources/
│   │   └── openclaw/             # Gateway
│   └── tauri.conf.json           # Tauri 配置
├── docs/                         # 文档
│   ├── ARCHITECTURE.md           # 本文件
│   ├── DEVELOPMENT.md            # 开发指南
│   └── RELEASE.md                # 发布流程
└── package.json                  # 项目配置
```

## 扩展开发

### 新增页面

1. 在 `src/components/` 创建组件
2. 在 `App.jsx` 添加页面状态
3. 在侧边栏添加导航入口

### 新增 Tauri 命令

1. 在 `src-tauri/src/commands/` 添加命令实现
2. 在 `src/lib/api.js` 封装前端调用

### 新增通道

参考现有通道实现，在 Gateway 侧添加。

## 相关文档

- [开发指南](./DEVELOPMENT.md) - 环境配置和调试
- [API 调用示例](../CLAUDE.md#key-patterns) - 代码示例
