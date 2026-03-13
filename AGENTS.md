# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

**OpenClaw CN Desktop** - AI 助手桌面应用（国内版），基于 Tauri 2.0 + React 18 构建的跨平台桌面应用。

**架构特点**：桌面壳子 + 前端 GUI + 原版 OpenClaw Gateway

```
┌─────────────────────────────────────────────────────────────┐
│                  CN Desktop (Tauri App)                     │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │             前端 GUI (React + Tailwind)                │ │
│  │                                                      │ │
│  │   聊天界面、智能体管理、Skills、通道管理、记忆中心...  │ │
│  │                                                      │ │
│  │            ↓ WebSocket API ↓                        │ │
│  │         ws://127.0.0.1:18789                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                        │                                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │          Rust 桌面壳子 (精简，只保留必要)              │ │
│  │                                                      │ │
│  │   - 进程管理：启动/停止 Gateway 子进程               │ │
│  │   - 系统托盘                                         │ │
│  │   - 安装管理器（安装原版 OpenClaw）                  │ │
│  │   - 微信监控（CN 特色）                              │ │
│  │   - 权限管理（macOS）                                │ │
│  └────────────────────────────────────────────────────────┘ │
│                        │                                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │          原版 OpenClaw Gateway (Node.js)              │ │
│  │                                                      │ │
│  │   所有 AI 逻辑、通道、工具、记忆、定时任务...        │ │
│  │   数据目录: ~/.openclaw/ (与原版共用)                │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Commands

### Development
```bash
pnpm dev              # 启动 Vite 开发服务器 (端口 1420)
pnpm tauri:dev       # 启动 Tauri 开发模式
```

### Build
```bash
pnpm build           # 构建前端
pnpm tauri:build     # 构建 Tauri 应用
pnpm tauri:build:debug  # 构建调试版本
```

## Architecture

### Frontend (React + JavaScript)
- **入口**: [src/main.jsx](src/main.jsx) → [src/App.jsx](src/App.jsx)
- **路由**: 基于状态变量的单页应用，通过 `currentPage` 切换页面
- **API 层**:
  - [src/lib/gateway.js](src/lib/gateway.js) - WebSocket 客户端，直接连接原版 Gateway
  - [src/lib/api.js](src/lib/api.js) - 统一 API 封装，提供便捷调用接口
- **UI 组件**: [src/components/](src/components/) - 使用 Radix UI 构建
- **样式**: Tailwind CSS + clsx + tailwind-merge

### Pages (via currentPage state)
- `chat` - 聊天界面
- `agents` - 智能体管理 (WorkspaceEditor)
- `skills` - Skills 管理
- `schedule` - 定时任务
- `memory` - 记忆中心
- `browser` - 浏览器工具
- `tools` / `toolManager` - 工具列表/管理
- `settings` - 设置页面
- `channels` - 通道管理
- `cost` - 成本追踪
- `patterns` - 模式库
- `nodes` - 节点设备管理 (NodeManager) - 新增
- `devicePairing` - 设备配对 (DevicePairing) - 新增
- `canvas` - Canvas 画布 (Canvas) - 新增
- `models` - 模型管理 (ModelsManager) - 新增

### Backend (Rust/Tauri) - 精简后的模块
```
src-tauri/src/
├── main.rs              # Tauri 应用入口
├── lib.rs               # 库入口
├── config.rs            # 配置读写（简化）
├── openclaw_config.rs   # OpenClaw 配置结构
├── openclaw_manager.rs  # OpenClaw 安装管理
├── paths.rs             # 统一路径管理
├── process.rs           # Gateway 进程管理
├── tray.rs              # 系统托盘
├── updater.rs           # 应用更新
├── permissions.rs       # macOS 权限请求
├── avfoundation.rs      # macOS 摄像头/麦克风权限
├── wechat.rs            # 微信监控（CN 特色）
└── commands/            # Tauri 命令
    ├── mod.rs
    ├── config.rs        # 配置命令
    ├── gateway_process.rs # Gateway 进程命令
    ├── install.rs       # 安装命令
    ├── permissions.rs   # 权限命令
    ├── system.rs        # 系统命令
    └── updater.rs       # 更新命令
```

## Key Patterns

### API 调用示例

```javascript
import api from './lib/api'

// 获取配置
const config = await api.config.get()

// 聊天（流式）
const result = await api.chat.send({
  sessionKey: 'agent:main:main',
  text: '你好',
}, {
  onChunk: (chunk) => console.log(chunk)
})

// Skills 列表
const skills = await api.skills.list()

// 定时任务
const tasks = await api.cron.list()

// Gateway 状态
const status = await api.gateway.status()

// 记忆搜索
const memories = await api.memory.search('query', 10)
```

### 底层 Gateway 调用

```javascript
import { getGateway } from './lib/gateway'

const gateway = getGateway()

// 连接
await gateway.connect()

// 调用方法
const result = await gateway.call('chat.send', params)

// 监听事件
gateway.on('agent.response.chunk', (payload) => {
  console.log('收到 chunk:', payload)
})

// 取消订阅
gateway.off('agent.response.chunk', handler)
```

### 组件导入路径别名
- `@/` → `./src/`
- `@/components/` → `./src/components/`
- `@/lib/` → `./src/lib/`
- `@/hooks/` → `./src/hooks/`

## Data Storage

- **数据目录**: `~/.openclaw/` - 与原版 OpenClaw 共用
- **配置文件**: `~/.openclaw/openclaw.json`
- **会话存储**: 由原版 Gateway 管理（SQLite）

## Dependencies

### Frontend Key Dependencies
- React 18 + React DOM
- @tauri-apps/api - Tauri 集成
- @radix-ui/* - UI 组件库
- tailwindcss + tailwind-merge + clsx
- react-markdown + remark-gfm + rehype-highlight
- lucide-react - 图标

### Backend Key Dependencies
- tauri 2.x
- tokio - 异步运行时
- serde - 序列化
- serde_json - JSON 处理
- sysinfo - 系统信息
