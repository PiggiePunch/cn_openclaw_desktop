# 开发指南

本文档面向开发人员，提供开发环境配置、调试技巧和问题排查指南。

## 环境准备

### 必需工具

| 工具 | 版本要求 | 说明 |
|------|----------|------|
| Node.js | 18+ (推荐 20 LTS) | 前端运行时 |
| pnpm | 8+ | 包管理器 |
| Rust | stable | Tauri 编译 |
| Cargo | stable | Rust 包管理 |

### macOS 额外依赖

```bash
# 安装 Homebrew (如未安装)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 pnpm
npm install -g pnpm
```

### Windows 额外依赖

- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

### Linux 额外依赖

```bash
# Ubuntu/Debian
sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

# Fedora
sudo dnf install webkit2gtk4.1-devel libappindicator-gtk3-devel librsvg2-devel
```

## 项目初始化

### 1. 克隆仓库

```bash
git clone https://github.com/your-repo/cn-openclaw-desktop.git
cd cn-openclaw-desktop
```

### 2. 安装依赖

```bash
pnpm install
```

此步骤会自动：
- 安装前端依赖
- 下载 OpenClaw Gateway 到 `src-tauri/resources/openclaw/`

### 3. 启动开发服务器

```bash
# 前端开发模式 (端口 1420)
pnpm dev

# 完整 Tauri 开发模式 (带桌面窗口)
pnpm tauri:dev
```

## 开发命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动前端开发服务器 |
| `pnpm tauri:dev` | 启动 Tauri 开发模式 |
| `pnpm build` | 构建前端资源 |
| `pnpm tauri:build` | 构建发布版本 |
| `pnpm tauri:build:debug` | 构建调试版本 |

## 调试指南

### 前端调试

#### 浏览器开发者工具

1. 在 Tauri 开发模式下打开 DevTools：
   - Windows/Linux: `Ctrl + Shift + I`
   - macOS: `Cmd + Option + I`

2. 主要调试面板：
   - **Console**: 查看日志和错误
   - **Network**: 查看 WebSocket 通信
   - **Elements**: 检查 DOM 结构
   - **React**: 检查组件树 (安装 React DevTools)

#### 常用调试代码

```javascript
// 在控制台查看 Gateway 状态
import { getGateway } from './lib/gateway'
const gw = getGateway()
console.log('Gateway:', gw)

// 查看当前配置
import api from './lib/api'
const config = await api.config.get()
console.log('Config:', config)
```

### Rust 后端调试

#### 查看 Tauri 日志

Tauri 开发模式下，终端会输出 Rust 端的日志：

```bash
# 观察日志输出
pnpm tauri:dev 2>&1 | tee tauri.log
```

#### 添加调试日志

```rust
// src-tauri/src/lib.rs
use log::info;

fn some_function() {
    info!("调试信息: {:?}", some_value);
}
```

### Gateway 调试

Gateway 日志位于数据目录：

```bash
# 查看 Gateway 日志
tail -f ~/.openclaw/logs/gateway.log
```

## 常见问题

### 1. 前端端口占用

```
Error: listen EADDRINUSE: address already in use :::1420
```

解决方案：

```bash
# 查找占用进程
lsof -i :1420

# 结束进程
kill -9 <PID>

# 或使用清理脚本
node scripts/clean-port.js
```

### 2. 下载 OpenClaw 失败

```
Error: Failed to download OpenClaw
```

解决方案：

```bash
# 使用镜像
OPENCLAW_MIRROR=https://ghproxy.com pnpm install

# 或跳过下载（自行准备 Gateway）
OPENCLAW_SKIP=true pnpm install
```

### 3. Rust 编译失败

检查 Rust 工具链：

```bash
# 更新 Rust
rustup update

# 清理缓存
cargo clean

# 重新编译
pnpm tauri:build:debug
```

### 4. macOS 权限问题

首次运行可能需要授权：

- **屏幕录制**: 用于截图功能
- **辅助功能**: 用于自动化
- **文件访问**: 用于文件操作

### 5. Gateway 连接失败

```
Error: WebSocket connection failed
```

检查步骤：

1. 确认 Gateway 进程运行：
   ```bash
   ps aux | grep openclaw
   ```

2. 检查端口是否监听：
   ```bash
   lsof -i :18789
   ```

3. 查看 Gateway 日志：
   ```bash
   cat ~/.openclaw/logs/gateway.log
   ```

### 6. 定时任务不执行

排查步骤：

1. 检查任务配置是否存在
2. 确认绑定的智能体未删除
3. 验证推送通道配置有效（如 Telegram chatId）
4. 查看 Gateway 日志中的 cron 执行记录

## 代码规范

### 前端 (React)

- 使用函数组件 + Hooks
- 组件文件使用 PascalCase: `Chat.jsx`
- 工具函数使用 camelCase: `formatDate.js`
- 样式使用 Tailwind CSS 类名
- Props 使用解构

### Rust

- 模块遵循 Rust 命名规范
- 使用 `snake_case` 函数名
- 保持函数短小（建议 < 50 行）
- 添加适当的文档注释

### Git 提交

推荐格式：

```
<类型>(<范围>): <描述>

[可选正文]

[可选脚注]
```

类型建议：
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档
- `refactor`: 重构
- `chore`: 构建/工具

示例：
```
feat(chat): 添加消息撤回功能

修复定时任务绑定已删除智能体导致失败
```

## 测试建议

### 本地回归测试

每次提交前验证：

```bash
# 构建前端
pnpm build

# 构建 Tauri
pnpm tauri:build:debug
```

### 功能测试清单

- [ ] 聊天发送和接收
- [ ] 智能体创建和编辑
- [ ] 定时任务创建和触发
- [ ] 通道配置和消息收发
- [ ] 会话切换和数据持久化
- [ ] Gateway 重启和应用恢复
- [ ] 配置文件保存和加载

## 相关文档

- [架构说明](./ARCHITECTURE.md) - 架构设计
- [发布流程](./RELEASE.md) - 版本发布
- [CLAUDE.md](../CLAUDE.md) - AI 助手指南
