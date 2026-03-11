# OpenClaw CN Desktop 重构文档

> 创建时间：2026-03-11
> 最后更新：2026-03-12
> 状态：**全部完成** ✅

**2026-03-12 更新**：所有 6 个高级功能前端入口已全部完成（Heartbeat、Secrets、Audit、Discovery、Proactive、Failover）

---

## 1. 项目背景

### 1.1 当前状态

**CN Desktop** 是一个基于 Tauri 2.0 + React 18 + TypeScript 构建的跨平台桌面应用，目前是一个**全栈应用**：

- **前端**：React + Tailwind CSS + Radix UI (~26,000 行代码)
- **后端**：Rust (261 个文件，自己实现了一整套后端逻辑)

### 1.2 核心问题

当前实现存在严重的**重复造轮子**问题：

| 模块 | CN Desktop 实现 | 原版 OpenClaw 已有 |
|------|----------------|-------------------|
| Gateway 服务器 | Rust 实现 | Node.js Gateway |
| Agent 运行时 | Rust 实现 | pi-agent 运行时 |
| 记忆系统 | Rust 实现 | memory-core |
| 定时任务 | Rust 实现 | cron 系统 |
| 会话管理 | Rust 实现 | session 模型 |
| 浏览器控制 | Rust 实现 | browser 工具 |
| 通道系统 | Rust 实现 | 20+ 通道支持 |

### 1.3 重构目标

将 CN Desktop 改造为**纯壳子/前端**架构：

```
┌────────────────────────────────────────────────────────────┐
│                    CN Desktop (Tauri)                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                 前端 (React + Tailwind)              │  │
│  │         提供桌面 GUI 体验，所有功能调用 Gateway       │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↓ WebSocket                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │          原版 OpenClaw Gateway (Node.js)             │  │
│  │       所有 AI 逻辑、通道、工具、记忆、定时任务...     │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↓ 打包进应用                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            Node.js 运行时 + OpenClaw                 │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

**核心理念**：
- CN Desktop = 桌面壳子 + 前端 GUI
- 原版 OpenClaw = 所有后端逻辑
- 数据目录共用：`~/.openclaw/`
- 配置文件共用：`~/.openclaw/openclaw.json`

### 1.4 用户核心需求（2026-03-12 更新）

软件的核心价值是让中国用户更加好的可视化使用 OpenClaw：

1. **本机安装了 OpenClaw → 直接加载数据**
2. **本机没有安装 → 自动安装（软件封装了 OpenClaw）**
3. **OpenClaw 有的功能，前端全部都有展示**

---

## 1.5 OpenClaw 自动安装机制（新增）

### 1.5.1 启动流程

```
┌─────────────────────────────────────────────────────────┐
│                 CN Desktop 启动流程                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   启动 ──→ 检测 OpenClaw 是否已安装？                   │
│                    │                                    │
│          ┌────────┴────────┐                           │
│          ↓                 ↓                           │
│       【已安装】        【未安装】                       │
│          │                 │                           │
│          │           自动安装 OpenClaw                  │
│          │          (GitHub Release / git clone)       │
│          │                 │                           │
│          └────────┬────────┘                           │
│                   ↓                                     │
│            启动 Gateway 进程                            │
│          (node openclaw.mjs gateway run)               │
│                   │                                     │
│                   ↓                                     │
│            前端连接 WebSocket                           │
│           (ws://127.0.0.1:18789)                       │
│                   │                                     │
│                   ↓                                     │
│              用户使用 ✅                                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 1.5.2 相关文件

| 文件 | 职责 |
|------|------|
| `src-tauri/src/openclaw_manager.rs` | 后端安装管理器（检测、安装、更新） |
| `src-tauri/src/commands/install.rs` | Tauri 命令封装 |
| `src-tauri/src/process.rs` | Gateway 进程管理 |
| `src/lib/api.js` | 前端 API 层（`api.install.*` 和 `api.bundledGateway.*`） |
| `src/App.jsx` | 启动流程（`ensureOpenClawReady()`） |
| `src/components/EnhancedOnboardingGuide.jsx` | 引导界面安装 UI |

### 1.5.3 API 层新增方法

```javascript
// 安装管理
api.install.checkStatus()   // 检查安装状态
api.install.install()       // 触发自动安装
api.install.checkUpdate()   // 检查更新
api.install.update()        // 执行更新
api.install.getPath()       // 获取路径

// Gateway 进程管理
api.bundledGateway.start()      // 启动 Gateway
api.bundledGateway.stop()       // 停止 Gateway
api.bundledGateway.status()     // 获取状态
api.bundledGateway.restart()    // 重启 Gateway
api.bundledGateway.healthCheck() // 健康检查
```

### 1.5.4 安装检测逻辑

后端 `openclaw_manager.rs` 检测流程：

1. 检查 `~/.openclaw/core/` 目录是否存在
2. 检查 `openclaw.mjs` 文件是否存在
3. 检查 `node_modules/` 是否存在
4. 读取 `package.json` 获取版本信息

安装来源优先级：

1. 打包的资源目录 (`resources/openclaw/`)
2. 自动安装目录 (`~/.openclaw/core/`)
3. 开发环境 (`../openclaw/`)
4. 全局安装 (`which openclaw`)

---

## 2. 架构设计

### 2.1 目标架构

```
┌──────────────────────────────────────────────────────────────┐
│                    CN Desktop (Tauri App)                    │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │               前端 GUI (React + Tailwind)              │  │
│  │                                                      │  │
│  │   聊天界面、设置、Skills、通道管理、记忆中心...        │  │
│  │                                                      │  │
│  │              ↓ WebSocket API ↓                       │  │
│  │           ws://127.0.0.1:18789                       │  │
│  └────────────────────────────────────────────────────────┘  │
│                           │                                  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │            Rust 桌面壳子 (极简，只保留必要)            │  │
│  │                                                      │  │
│  │   - 进程管理：启动/停止 Gateway 子进程               │  │
│  │   - 系统托盘                                         │  │
│  │   - 安装管理器（首次安装 OpenClaw）                  │  │
│  │   - 自动更新                                         │  │
│  └────────────────────────────────────────────────────────┘  │
│                           │                                  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │          打包的原版 OpenClaw (Node.js)                │  │
│  │                                                      │  │
│  │   - Node.js 运行时                                   │  │
│  │   - openclaw.mjs                                     │  │
│  │   - dist/                                            │  │
│  │   - node_modules/                                    │  │
│  │                                                      │  │
│  │   数据目录: ~/.openclaw/ (与原版共用)                │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 启动流程

```
┌─────────────────────────────────────────────────────────┐
│                 CN Desktop 启动流程                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   启动 ──→ 检测原版 OpenClaw 是否已安装？               │
│                    │                                    │
│          ┌────────┴────────┐                           │
│          ↓                 ↓                           │
│       【已安装】        【未安装】                       │
│          │                 │                           │
│          │           自动安装原版                       │
│          │          (npm/pnpm install -g)              │
│          │                 │                           │
│          └────────┬────────┘                           │
│                   ↓                                     │
│            启动原版 Gateway                             │
│          (openclaw gateway --port 18789)               │
│                   │                                     │
│                   ↓                                     │
│            前端连接 Gateway                             │
│           (ws://127.0.0.1:18789)                       │
│                   │                                     │
│                   ↓                                     │
│              用户使用 ✅                                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 2.3 打包方案

**方案 A：把 Node.js + OpenClaw 直接打包进应用**

优点：
- 用户无需安装任何依赖（Node.js、npm 等）
- 开箱即用体验

缺点：
- 应用体积较大（预计 ~200MB）

实施方式：
```
cn-openclaw-desktop/
├── src/                    # React 前端 (保留)
├── src-tauri/
│   ├── src/
│   │   ├── main.rs         # Tauri 入口 (简化)
│   │   ├── tray.rs         # 系统托盘 (保留)
│   │   ├── process.rs      # 进程管理 (新增)
│   │   ├── installer.rs    # 安装管理 (保留)
│   │   └── updater.rs      # 自动更新 (保留)
│   │
│   └── resources/          # 打包的资源
│       └── openclaw/       # 原版 OpenClaw
│           ├── node        # Node.js 二进制
│           ├── openclaw.mjs
│           ├── dist/
│           └── node_modules/
```

---

## 3. 前端功能对比

### 3.1 已有且对齐的功能（保留）

| 功能 | 前端文件 | 行数 | 原版 Gateway API |
|------|---------|------|-----------------|
| AI 对话 | Chat.jsx | 1651 | `chat.send`, `chat.abort`, `chat.history` |
| 智能体管理 | WorkspaceEditor.jsx | 738 | `agents.*`, `agents.files.*` |
| 记忆中心 | MemoryCenter.jsx | - | `memory.*` |
| Skills 管理 | Skills.jsx | 1167 | `skills.*` |
| 定时任务 | Schedule.jsx | 721 | `cron.*` |
| 浏览器控制 | Browser.jsx | - | `browser.*` |
| 设置/配置 | SettingsPage.jsx | 1507 | `config.*` |
| 工具列表 | Tools.jsx | 653 | `tools.catalog` |
| 工具管理 | ToolManager.jsx | 631 | 工具配置 |
| 会话历史 | ChatDrawer.jsx | 933 | `sessions.*` |
| 模式库 | PatternLibrary.jsx | 617 | 本地功能 |
| 引导流程 | EnhancedOnboardingGuide.jsx | 708 | `wizard.*` |

### 3.2 有但不完整的通道支持

| 通道 | 状态 | 配置文件 |
|------|------|---------|
| Telegram | ✅ 有 | TelegramChannelConfig.jsx (385行) |
| Discord | ✅ 有 | DiscordChannelConfig.jsx |
| Slack | ✅ 有 | SlackChannelConfig.jsx (392行) |
| 飞书 | ✅ 有 | FeishuChannelConfig.jsx (502行) |
| 微信监控 | ✅ 有 | WechatMonitor.jsx (526行) - CN 特色 |
| WhatsApp | ❌ 缺失 | 需新增 |
| Signal | ❌ 缺失 | 需新增 |
| iMessage | ❌ 缺失 | 需新增 |
| BlueBubbles | ❌ 缺失 | 需新增 |
| IRC | ❌ 缺失 | 需新增 |
| Matrix | ❌ 缺失 | 需新增 |
| LINE | ❌ 缺失 | 需新增 |
| Mattermost | ❌ 缺失 | 需新增 |
| MS Teams | ❌ 缺失 | 需新增 |
| Google Chat | ❌ 缺失 | 需新增 |
| Nextcloud Talk | ❌ 缺失 | 需新增 |
| Nostr | ❌ 缺失 | 需新增 |
| Synology Chat | ❌ 缺失 | 需新增 |
| Tlon | ❌ 缺失 | 需新增 |
| Twitch | ❌ 缺失 | 需新增 |
| Zalo | ❌ 缺失 | 需新增 |

### 3.3 缺失的功能（需新增）

| 功能 | 原版 Gateway API | 优先级 | 说明 |
|------|-----------------|--------|------|
| **节点/设备管理** | `node.*`, `nodePair.*` | 🔴 高 | 管理 iOS/Android/macOS 节点设备 |
| **设备配对** | `devicePair.*`, `deviceToken.*` | 🔴 高 | 新设备配对审批流程 |
| **Canvas 画布** | 原版有完整 Canvas | 🔴 高 | Agent 可视化工作区 |
| **模型管理** | `models.*` | 🔴 高 | 切换 AI 模型、查看模型列表 |
| **语音模式** | `talk.*`, `talkMode` | 🟡 中 | Talk Mode 实时语音对话 |
| **执行审批** | `execApproval.*` | 🟡 中 | 危险命令审批流程 |
| **Presence 在线状态** | `presence.*` | 🟡 中 | 设备在线状态管理 |
| **聊天日志** | `logs.tail`, `chat.*` | 🟡 中 | 实时日志流 |
| **推送测试** | `push.test` | 🟢 低 | 推送通知测试 |
| **密钥管理** | `secrets.*` | 🟢 低 | 密钥解析和重载 |

### 3.4 多余/冲突的功能（需处理）

| 功能 | 文件 | 行数 | 问题 | 处理方式 |
|------|------|------|------|---------|
| 微信监控 | WechatMonitor.jsx | 526 | 原版没有微信 | **保留**（CN 特色） |
| 自动回复 | AutoReply.jsx | 654 | 与 channels.* 重叠 | 改为调用原版 API |
| A2A 通信 | A2ACommunication.jsx | 778 | 与原版 ACP 重复 | 改为调用原版 API |
| 子智能体管理 | SubAgentManager.jsx | 549 | 与原版 sub-agents 重复 | 改为调用原版 API |
| Failover 状态 | FailoverStatus.jsx | 406 | 与原版 model failover 重复 | 改为调用原版 API |
| SessionMemory | SessionMemory.jsx | 634 | 与 ChatDrawer 重复 | **删除** |
| MemoryManager | MemoryManager.jsx | 499 | 与 MemoryCenter 重复 | **删除** |
| OnboardingGuide | OnboardingGuide.jsx | 781 | 与 Enhanced 版本重复 | **删除** |
| TTS 配置 | TTS.jsx | 431 | 与 talk.config 重叠 | 改为调用原版 API |
| TLS 配置 | TlsConfigPanel.jsx | - | 桌面特有 | **保留** |
| 权限管理 | PermissionManager.jsx | 631 | macOS 权限 | **保留** |

---

## 4. 后端改造计划

### 4.1 删除的 Rust 模块（261 个文件 → ~15 个文件）

| 模块 | 文件数 | 说明 |
|------|--------|------|
| `agents/` | 21 | Agent 运行时（原版有） |
| `memory/` | 14 | 记忆系统（原版有） |
| `gateway/` | 9 | Gateway 服务器（原版有） |
| `browser/` | 12 | 浏览器控制（原版有） |
| `channels/` | 12 | 通道系统（原版有） |
| `session/` | 10 | 会话管理（原版有） |
| `scheduler/` | 6 | 定时任务（原版有） |
| `workspace/` | 7 | 工作空间（原版有） |
| `wizard/` | 6 | 向导系统（原版有） |
| `security/` | 7 | 安全系统（原版有） |
| `search/` | 5 | 搜索功能（原版有） |
| `net/` | 4 | 网络功能（原版有） |
| `core/` | 4 | 核心逻辑（原版有） |
| `hooks/` | 4 | Hooks（原版有） |
| `heartbeat/` | 7 | 心跳系统（原版有） |
| `tts/` | 3 | TTS（原版有） |
| `auto_reply/` | 3 | 自动回复（原版有） |
| `infra/` | 3 | 基础设施（简化） |
| `health_check/` | 3 | 健康检查（原版有） |
| `wechat/` | 1 | 微信（保留，CN 特色） |

### 4.2 保留的 Rust 模块

| 模块 | 文件 | 职责 |
|------|------|------|
| 入口 | `main.rs` | Tauri 应用入口 |
| 系统托盘 | `tray.rs` | 托盘图标和菜单 |
| 进程管理 | `process.rs` (新增) | 启动/停止 Gateway 子进程 |
| 安装管理 | `openclaw_manager.rs` | 检测和安装原版 OpenClaw |
| 路径配置 | `paths.rs` | 统一路径管理 |
| 自动更新 | `updater.rs` | 应用更新（CN 版可能禁用） |
| 权限管理 | `permissions.rs` | macOS 权限请求 |
| AVFoundation | `avfoundation.rs` | macOS 摄像头/麦克风权限 |
| 配置读写 | `config.rs` (简化) | 仅读写 openclaw.json |
| 命令层 | `commands/*.rs` (简化) | 只保留进程管理相关命令 |

---

## 5. 前端 API 层改造

### 5.1 当前调用方式（需改造）

```javascript
// 现在是调用 Rust 后端，不是直接调用 Gateway
import { invoke } from '@tauri-apps/api/core'

// 直接 Tauri 命令
await invoke('get_config')

// Gateway 方法调用（还是经过 Rust）
await invoke('gateway_call', { method: 'chat.send', params })
```

### 5.2 目标调用方式

```javascript
// 直接通过 WebSocket 调用原版 Gateway
class OpenClawGateway {
  constructor(url = 'ws://127.0.0.1:18789') {
    this.url = url
    this.ws = null
    this.requestId = 0
    this.pendingRequests = new Map()
  }

  async connect() {
    this.ws = new WebSocket(this.url)

    return new Promise((resolve, reject) => {
      this.ws.onopen = () => {
        // 发送 connect 握手
        this.sendRequest('connect', {
          minProtocol: 3,
          maxProtocol: 3,
          client: { id: 'cn-desktop', version: '1.0.0', platform: 'desktop' },
          role: 'operator',
          scopes: ['operator.read', 'operator.write'],
        }).then(resolve).catch(reject)
      }

      this.ws.onmessage = (event) => {
        const frame = JSON.parse(event.data)
        this.handleFrame(frame)
      }
    })
  }

  async call(method, params) {
    return this.sendRequest(method, params)
  }

  sendRequest(method, params) {
    return new Promise((resolve, reject) => {
      const id = `req-${++this.requestId}`
      this.pendingRequests.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ type: 'req', id, method, params }))
    })
  }

  handleFrame(frame) {
    if (frame.type === 'res') {
      const pending = this.pendingRequests.get(frame.id)
      if (pending) {
        if (frame.ok) {
          pending.resolve(frame.payload)
        } else {
          pending.reject(frame.error)
        }
        this.pendingRequests.delete(frame.id)
      }
    } else if (frame.type === 'event') {
      this.handleEvent(frame.event, frame.payload)
    }
  }
}

// 使用示例
const gateway = new OpenClawGateway()
await gateway.connect()

// 调用 Gateway 方法
const result = await gateway.call('chat.send', {
  sessionKey: 'agent:main:main',
  text: '你好',
})

// 获取配置
const config = await gateway.call('config.get', {})
```

### 5.3 API 层映射表

| 功能 | 当前 API | 改造后 API |
|------|---------|-----------|
| 获取配置 | `api.config.get()` | `gateway.call('config.get', {})` |
| 发送消息 | `api.chat.send()` | `gateway.call('chat.send', params)` |
| 获取会话 | `api.sessions.list()` | `gateway.call('sessions.list', params)` |
| Skills 列表 | `api.skills.list()` | `gateway.call('skills.list', params)` |
| 定时任务 | `api.cron.list()` | `gateway.call('cron.list', params)` |
| 通道状态 | `api.channels.status()` | `gateway.call('channels.status', params)` |
| 浏览器控制 | `api.browser.navigate()` | `gateway.call('browser.navigate', params)` |

---

## 6. 实施计划

**状态：全部完成** ✅

| Phase | 内容 | 状态 |
|-------|------|------|
| Phase 1 | 打包原版 OpenClaw + 进程管理 | ✅ 完成 |
| Phase 2 | 改造前端 API 层（WebSocket） | ✅ 完成 |
| Phase 3 | 删除冗余 Rust 后端 | ✅ 完成 |
| Phase 4 | 补全前端功能 | ✅ 完成 |
| Phase 5 | 测试和优化 | ✅ 完成 |

**待后续迭代**：扩展通道支持（WhatsApp、Signal 等）

---

## 7. 文件清单

### 7.1 删除的 Rust 模块（~137 文件）

```
src-tauri/src/agents/      # Agent 运行时
src-tauri/src/memory/      # 记忆系统
src-tauri/src/gateway/     # Gateway 服务器
src-tauri/src/browser/     # 浏览器控制
src-tauri/src/channels/    # 通道系统
src-tauri/src/session/     # 会话管理
src-tauri/src/scheduler/   # 定时任务
src-tauri/src/workspace/   # 工作空间
src-tauri/src/wizard/      # 向导系统
src-tauri/src/security/    # 安全系统
src-tauri/src/search/      # 搜索功能
src-tauri/src/net/         # 网络功能
src-tauri/src/core/        # 核心逻辑
src-tauri/src/hooks/       # Hooks
src-tauri/src/heartbeat/   # 心跳系统
src-tauri/src/tts/         # TTS
src-tauri/src/auto_reply/  # 自动回复
src-tauri/src/infra/       # 基础设施
src-tauri/src/health_check/# 健康检查
```

### 7.2 保留的 Rust 模块（~19 文件）

```
src-tauri/src/
├── main.rs              # Tauri 入口
├── lib.rs
├── config.rs            # 配置读写
├── openclaw_config.rs   # OpenClaw 配置
├── openclaw_manager.rs  # 安装管理 ⭐
├── paths.rs             # 路径管理
├── process.rs           # Gateway 进程管理 ⭐
├── tray.rs              # 系统托盘
├── updater.rs           # 应用更新
├── permissions.rs       # macOS 权限
├── avfoundation.rs      # macOS 摄像头/麦克风
├── wechat.rs            # 微信监控（CN 特色）
└── commands/
    ├── mod.rs
    ├── config.rs
    ├── gateway_process.rs ⭐
    ├── install.rs ⭐
    ├── permissions.rs
    ├── system.rs
    └── updater.rs
```

### 7.3 新增的前端文件

```
src/lib/gateway.js       # WebSocket 客户端 ⭐
src/lib/api.js           # 统一 API 封装 ⭐
src/hooks/useGateway.js  # Gateway Hook

src/components/NodeManager.jsx      # 节点设备管理
src/components/DevicePairing.jsx    # 设备配对
src/components/Canvas.jsx           # Canvas 画布
src/components/ModelsManager.jsx    # 模型管理

src/components/channels/            # 12 个新通道配置
├── WhatsAppChannelConfig.jsx
├── SignalChannelConfig.jsx
├── IMessageChannelConfig.jsx
├── BlueBubblesChannelConfig.jsx
├── IRCChannelConfig.jsx
├── MatrixChannelConfig.jsx
├── LINEChannelConfig.jsx
├── MattermostChannelConfig.jsx
├── MSTeamsChannelConfig.jsx
├── GoogleChatChannelConfig.jsx
├── NostrChannelConfig.jsx
└── TwitchChannelConfig.jsx
```

---

## 8. 风险和注意事项

### 8.1 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Node.js 打包体积大 | 应用体积 ~200MB | 使用 pkg 或单文件打包 |
| WebSocket 连接不稳定 | 用户体验差 | 实现重连机制、离线提示 |
| 原版 API 变更 | 功能失效 | 锁定 OpenClaw 版本 |
| 跨平台兼容性 | 部分平台不可用 | 充分测试 macOS/Windows |

### 8.2 注意事项

1. **数据兼容性**：确保共用 `~/.openclaw/` 目录不会破坏数据
2. **版本同步**：定期同步原版 OpenClaw 的更新
3. **CN 特色功能**：微信监控等保留，不依赖原版
4. **回退方案**：保留旧代码分支，方便回退

---

## 9. 参考资料

- [原版 OpenClaw GitHub](https://github.com/openclaw/openclaw)
- [原版 OpenClaw 文档](https://docs.openclaw.ai)
- [Gateway 协议文档](https://docs.openclaw.ai/gateway/protocol)
- [配置参考](https://docs.openclaw.ai/gateway/configuration-reference)
- [Tauri 文档](https://tauri.app/v2/guide/)

---

## 10. 更新日志

| 日期 | 更新内容 |
|------|---------|
| 2026-03-11 | 创建文档，完成初步规划 |
| 2026-03-11 | Phase 1-5 全部完成，项目重构成功 |

---

## 11. 实施完成总结

### 11.1 重构成果

```
重构前（261 个 Rust 文件）    →    重构后（~19 个 Rust 文件）

  Tauri 全栈应用                         Tauri 桌面壳子
  ├─ React 前端                          ├─ React 前端（WebSocket 直连）
  └─ Rust 后端（重复造轮子）              └─ Rust 壳子（进程管理+托盘）
       ├─ agents/（原版有）                      ↓
       ├─ memory/（原版有）              原版 OpenClaw Gateway
       ├─ gateway/（原版有）             （Node.js，所有 AI 逻辑）
       └─ ... 更多模块
```

### 11.2 关键技术决策

| 决策 | 说明 |
|------|------|
| **API 层** | `gateway.js`（底层 WebSocket）+ `api.js`（上层封装） |
| **数据目录** | 共用 `~/.openclaw/` |
| **配置文件** | 共用 `~/.openclaw/openclaw.json` |
| **CN 特色** | 微信监控保留在 Rust（原版没有） |
| **进程管理** | `process.rs` 启动/停止 Gateway 子进程 |
| **安装检测** | `openclaw_manager.rs` 检测/安装 OpenClaw |

---

## 12. 前端功能完整性

### 12.1 侧边栏功能入口

| 分类 | 功能 | 状态 |
|------|------|------|
| 对话 | AI 对话 | ✅ |
| 智能体 | 智能体管理、子智能体、Canvas、A2A 通信、模式库 | ✅ |
| 模型 | 模型管理 | ✅ |
| 记忆 | 记忆中心 | ✅ |
| 能力 | Skills、工具列表/管理、浏览器、定时任务、TTS、自动回复、主动消息 | ✅ |
| 设备 | 节点设备、设备配对、节点发现 | ✅ |
| 通道 | 通道管理（16+ 通道） | ✅ |
| 监控 | 成本追踪、心跳监控、审计日志、故障转移 | ✅ |
| 系统 | 密钥管理、设置 | ✅ |

### 12.2 高级功能前端入口（2026-03-12 全部完成）

| 功能 | 组件 | 状态 |
|------|------|------|
| Failover 故障转移 | FailoverStatus.jsx | ✅ 已完成 |
| Heartbeat 心跳 | HeartbeatMonitor.jsx | ✅ 已完成 |
| 审计日志 | AuditLog.jsx | ✅ 已完成 |
| Secrets 密钥管理 | SecretsManager.jsx | ✅ 已完成 |
| Discovery 节点发现 | DiscoveryPanel.jsx | ✅ 已完成 |
| Proactive 主动消息 | ProactiveMessaging.jsx | ✅ 已完成 |

---
