//! Gateway 进程管理模块
//!
//! 功能：
//! - 启动 Gateway 子进程（openclaw gateway --port 18789）
//! - 停止 Gateway 子进程
//! - 进程健康监控
//! - 端口检测（默认 18789）
//! - 自动重启机制
//! - 跨平台兼容（macOS/Windows）
//!
//! ## 架构说明
//! CN Desktop 将成为纯壳子，调用原版 OpenClaw Gateway（Node.js）提供所有后端功能。
//! 本模块负责管理 Gateway 子进程的生命周期。

use std::path::PathBuf;
use std::process::Command as StdCommand;
use std::sync::Arc;
use std::time::{Duration, Instant};

use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use tokio::process::Command as TokioCommand;
use tokio::sync::Mutex;
use tokio::time::timeout;

/// 默认 Gateway 端口
pub const DEFAULT_GATEWAY_PORT: u16 = 18789;

/// WebSocket 连接重试次数
const WS_CONNECT_RETRIES: u32 = 15;

/// WebSocket 连接重试间隔（毫秒）
const WS_CONNECT_RETRY_INTERVAL_MS: u64 = 2000;

/// Gateway 进程状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayProcessStatus {
    /// 是否运行中
    pub running: bool,
    /// 进程 PID
    pub pid: Option<u32>,
    /// 监听端口
    pub port: u16,
    /// 运行时间（秒）
    pub uptime_seconds: Option<u64>,
    /// 内存使用量（MB）
    pub memory_mb: Option<f32>,
    /// WebSocket 是否可连接
    pub websocket_connected: bool,
    /// 进程类型（managed/external）
    pub process_type: String,
    /// 错误信息
    pub error: Option<String>,
    /// 自动重启次数
    pub restart_count: u32,
}

impl Default for GatewayProcessStatus {
    fn default() -> Self {
        Self {
            running: false,
            pid: None,
            port: DEFAULT_GATEWAY_PORT,
            uptime_seconds: None,
            memory_mb: None,
            websocket_connected: false,
            process_type: "managed".to_string(),
            error: None,
            restart_count: 0,
        }
    }
}

/// Gateway 进程内部句柄
struct GatewayProcessHandle {
    /// 子进程句柄
    child: tokio::process::Child,
    /// 启动时间
    start_time: Instant,
}

/// Gateway 进程状态
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GatewayState {
    /// 已停止
    Stopped,
    /// 启动中
    Starting,
    /// 运行中
    Running,
    /// 停止中
    Stopping,
}

impl Default for GatewayState {
    fn default() -> Self {
        Self::Stopped
    }
}

/// Gateway 进程管理器
///
/// 负责 Gateway 子进程的完整生命周期管理：
/// - 查找 openclaw 可执行文件
/// - 启动/停止/重启进程
/// - 健康检查和自动恢复
/// - 端口冲突处理
/// - 并发启动保护（使用互斥锁）
pub struct GatewayProcessManager {
    /// 进程句柄（可选）
    process: Arc<Mutex<Option<GatewayProcessHandle>>>,
    /// 监听端口
    port: u16,
    /// 自动重启计数器
    restart_count: Arc<Mutex<u32>>,
    /// 最大自动重启次数
    max_restart_count: u32,
    /// 当前状态
    state: Arc<Mutex<GatewayState>>,
    /// 启动互斥锁（防止并发启动）
    starting_lock: Arc<Mutex<()>>,
}

impl GatewayProcessManager {
    /// 创建新的进程管理器
    ///
    /// # Arguments
    /// * `port` - Gateway 监听端口，默认 18789
    ///
    /// # Returns
    /// 进程管理器实例
    pub fn new(port: Option<u16>) -> Self {
        Self {
            process: Arc::new(Mutex::new(None)),
            port: port.unwrap_or(DEFAULT_GATEWAY_PORT),
            restart_count: Arc::new(Mutex::new(0)),
            max_restart_count: 3,
            state: Arc::new(Mutex::new(GatewayState::default())),
            starting_lock: Arc::new(Mutex::new(())),
        }
    }

    /// 获取管理器端口
    pub fn port(&self) -> u16 {
        self.port
    }

    /// 启动 Gateway 进程
    ///
    /// 启动流程：
    /// 1. 获取启动锁（防止并发启动）
    /// 2. 检查是否已在运行（包含外部 Gateway）
    /// 3. 仅在必要时启动受管 Gateway，且不清理外部占用进程
    /// 4. 查找 openclaw 可执行路径（优先系统安装，其次自动安装目录）
    /// 5. 启动子进程
    /// 6. 等待 WebSocket 就绪
    /// 7. 保存进程句柄
    pub async fn start(&self) -> Result<GatewayProcessStatus> {
        log::info!("🚀 启动 Gateway 进程...");

        // 1. 获取启动锁，防止并发启动
        let _lock = self.starting_lock.lock().await;

        // 检查当前状态
        {
            let state = self.state.lock().await;
            if *state == GatewayState::Starting {
                log::info!("⏳ Gateway 正在启动中，跳过重复请求");
                return self.get_status().await;
            }
        }

        // 2. 双重检查是否已在运行
        if self.is_running().await? {
            log::info!("✅ Gateway 已在运行");
            return self.get_status().await;
        }

        // 2.5 优先复用外部 Gateway（例如 launchctl 守护进程）
        if let Some(status) = self.detect_external_gateway_status().await {
            log::info!("✅ 检测到外部 Gateway 正在运行，直接复用");
            return Ok(status);
        }

        // 3. 标记启动中状态
        *self.state.lock().await = GatewayState::Starting;

        // 4. 执行启动逻辑
        let result = self.do_start().await;

        // 5. 根据结果更新状态
        match &result {
            Ok(_) => {
                *self.state.lock().await = GatewayState::Running;
            }
            Err(_) => {
                *self.state.lock().await = GatewayState::Stopped;
            }
        }

        result
    }

    /// 实际的启动逻辑（内部方法）
    async fn do_start(&self) -> Result<GatewayProcessStatus> {
        // 1. 检查端口可用性（不再强杀外部进程）
        self.ensure_port_available().await?;

        // 2. 查找 openclaw 可执行文件
        let openclaw_path = self.find_openclaw_path()?;
        log::info!("📁 OpenClaw 路径: {:?}", openclaw_path);

        // 3. 构建启动命令
        let is_mjs_entry = openclaw_path
            .extension()
            .and_then(|s| s.to_str())
            .map(|s| s.eq_ignore_ascii_case("mjs"))
            .unwrap_or(false);

        let mut cmd = if is_mjs_entry {
            let node_path = self.find_node_path()?;
            log::info!("📦 Node.js 路径: {:?}", node_path);
            let mut c = TokioCommand::new(&node_path);
            c.arg(&openclaw_path);
            c
        } else {
            TokioCommand::new(&openclaw_path)
        };

        cmd.args(["gateway", "run"]);
        cmd.args(["--port", &self.port.to_string()]);
        cmd.args(["--bind", "loopback"]);
        cmd.args(["--allow-unconfigured"]);

        // 设置环境变量
        self.setup_environment(&mut cmd);

        // mjs 模式下设置工作目录
        if is_mjs_entry {
            if let Some(work_dir) = openclaw_path.parent().and_then(|p| p.parent()) {
                if work_dir.join("package.json").exists() {
                    cmd.current_dir(work_dir);
                    log::info!("📂 工作目录: {:?}", work_dir);
                }
            }
        }

        // 4. 启动进程
        log::info!("🔧 启动命令: {:?} gateway run --port {}", openclaw_path, self.port);
        let mut child = cmd.spawn().map_err(|e| {
            anyhow!(
                "启动 Gateway 失败: {}\n请确保已安装 openclaw CLI（未安装时可通过应用自动安装）",
                e
            )
        })?;

        let pid = child.id();
        log::info!("✅ Gateway 进程已启动 (PID: {:?})", pid);

        // 5. 等待 WebSocket 就绪
        log::info!("⏳ 等待 WebSocket 服务器启动...");
        let ws_connected = self.wait_for_websocket().await?;

        if !ws_connected {
            // 连接失败，清理进程
            let _ = child.kill().await;
            let _ = child.wait().await;
            return Err(anyhow!(
                "Gateway WebSocket 连接失败，请检查 openclaw 是否正常工作"
            ));
        }

        log::info!("✅ WebSocket 连接成功");

        // 6. 保存进程句柄
        let handle = GatewayProcessHandle {
            child,
            start_time: Instant::now(),
        };
        *self.process.lock().await = Some(handle);

        self.get_status().await
    }

    /// 停止 Gateway 进程
    ///
    /// 优雅关闭流程：
    /// 1. 发送终止信号
    /// 2. 等待进程退出
    /// 3. 清理句柄
    pub async fn stop(&self) -> Result<()> {
        let mut process_guard = self.process.lock().await;

        if let Some(mut handle) = process_guard.take() {
            log::info!("🛑 停止 Gateway 进程 (PID: {:?})...", handle.child.id());

            // 尝试优雅关闭
            let _ = handle.child.kill().await;
            let _ = handle.child.wait().await;

            log::info!("✅ Gateway 已停止");
        } else {
            log::info!("ℹ️ Gateway 未在运行");
        }

        Ok(())
    }

    /// 重启 Gateway 进程
    pub async fn restart(&self) -> Result<GatewayProcessStatus> {
        log::info!("🔄 重启 Gateway...");

        self.stop().await?;

        // 等待进程完全停止
        tokio::time::sleep(Duration::from_secs(1)).await;

        // 增加重启计数
        {
            let mut count = self.restart_count.lock().await;
            *count += 1;
        }

        self.start().await
    }

    /// 获取进程状态
    pub async fn get_status(&self) -> Result<GatewayProcessStatus> {
        let guard = self.process.lock().await;

        if guard.is_none() {
            drop(guard);
            if let Some(status) = self.detect_external_gateway_status().await {
                return Ok(status);
            }
            return Ok(GatewayProcessStatus::default());
        }

        let handle = guard.as_ref().unwrap();
        let pid = handle.child.id();
        let uptime = Some(handle.start_time.elapsed().as_secs());

        // 获取内存使用量
        let memory_mb = if let Some(p) = pid {
            Some(self.get_process_memory(p).await)
        } else {
            None
        };

        // 检查 WebSocket 连接
        let ws_connected = self.check_websocket_connection().await;

        let restart_count = *self.restart_count.lock().await;

        Ok(GatewayProcessStatus {
            running: true,
            pid,
            port: self.port,
            uptime_seconds: uptime,
            memory_mb,
            websocket_connected: ws_connected,
            process_type: "managed".to_string(),
            error: None,
            restart_count,
        })
    }

    /// 检查进程是否在运行
    pub async fn is_running(&self) -> Result<bool> {
        let guard = self.process.lock().await;

        if let Some(handle) = guard.as_ref() {
            // 检查 PID 是否存在
            Ok(handle.child.id().is_some())
        } else {
            drop(guard);
            Ok(self.detect_external_gateway_status().await.is_some())
        }
    }

    /// 健康检查（用于定时监控）
    ///
    /// 返回 (is_healthy, should_restart)
    pub async fn health_check(&self) -> (bool, bool) {
        let status = self.get_status().await.unwrap_or_default();

        if !status.running {
            return (false, true);
        }

        if !status.websocket_connected {
            log::warn!("⚠️ Gateway WebSocket 不可连接");
            return (false, true);
        }

        (true, false)
    }

    // ========== 内部方法 ==========

    /// 查找 openclaw 可执行文件路径
    ///
    /// 查找顺序：
    /// 1. 系统安装的 openclaw 命令（推荐）
    /// 2. 自动安装目录 (~/.openclaw/core/)
    fn find_openclaw_path(&self) -> Result<PathBuf> {
        // 优先系统安装
        #[cfg(unix)]
        {
            if let Ok(output) = StdCommand::new("which").arg("openclaw").output() {
                if output.status.success() {
                    let path_str = String::from_utf8_lossy(&output.stdout);
                    let path = path_str.trim();
                    if !path.is_empty() {
                        return Ok(PathBuf::from(path).canonicalize().unwrap_or(PathBuf::from(path)));
                    }
                }
            }
        }

        #[cfg(windows)]
        {
            if let Ok(output) = StdCommand::new("where").arg("openclaw").output() {
                if output.status.success() {
                    let path_str = String::from_utf8_lossy(&output.stdout);
                    if let Some(path) = path_str.lines().next() {
                        if !path.is_empty() {
                            return Ok(
                                PathBuf::from(path.trim())
                                    .canonicalize()
                                    .unwrap_or(PathBuf::from(path.trim())),
                            );
                        }
                    }
                }
            }
        }

        // 自动安装目录（应用按需安装的 core）
        let fallback_paths = vec![
            dirs::home_dir()
                .map(|h| h.join(".openclaw/core/openclaw.mjs"))
                .unwrap_or_default(),
            dirs::home_dir()
                .map(|h| h.join(".openclaw/core/dist/openclaw.mjs"))
                .unwrap_or_default(),
        ];

        for path in fallback_paths {
            if path.exists() {
                let canonical = path.canonicalize().unwrap_or(path.clone());
                log::info!("使用自动安装的 OpenClaw core: {:?}", canonical);
                return Ok(canonical);
            }
        }

        Err(anyhow!(
            "找不到 openclaw 可执行文件。\n\
             请确保：\n\
             1. 已全局安装 openclaw（推荐）\n\
             2. 或通过应用自动安装 OpenClaw core"
        ))
    }

    /// 查找 Node.js 运行时路径
    ///
    /// 仅使用系统 Node.js（不再依赖应用内置 Node 资源）
    fn find_node_path(&self) -> Result<PathBuf> {
        // 使用系统 Node.js
        #[cfg(unix)]
        {
            if let Ok(output) = StdCommand::new("which").arg("node").output() {
                if output.status.success() {
                    let path_str = String::from_utf8_lossy(&output.stdout);
                    let path = path_str.trim();
                    if !path.is_empty() {
                        log::info!("使用系统 Node.js: {}", path);
                        return Ok(PathBuf::from(path).canonicalize().unwrap_or(PathBuf::from(path)));
                    }
                }
            }
        }

        #[cfg(windows)]
        {
            if let Ok(output) = StdCommand::new("where").arg("node").output() {
                if output.status.success() {
                    let path_str = String::from_utf8_lossy(&output.stdout);
                    if let Some(path) = path_str.lines().next() {
                        if !path.is_empty() {
                            log::info!("使用系统 Node.js: {}", path.trim());
                            return Ok(
                                PathBuf::from(path.trim())
                                    .canonicalize()
                                    .unwrap_or(PathBuf::from(path.trim())),
                            );
                        }
                    }
                }
            }
        }

        Err(anyhow!("找不到 Node.js 运行时，请先安装 Node.js 并确保在 PATH 中可见"))
    }

    /// 设置环境变量
    fn setup_environment(&self, cmd: &mut TokioCommand) {
        // 尝试加载应用的 API Keys（如果配置管理器可用）
        // 注意：不再覆写 OPENCLAW_CONFIG_DIR，直接复用用户原生 ~/.openclaw 配置
        if let Ok(config_mgr) = crate::config::ConfigManager::new() {
            if let Ok(config) = config_mgr.load() {
                // 通义千问
                if !config.ai_provider.qwen.api_key.is_empty() {
                    cmd.env("QWEN_API_KEY", &config.ai_provider.qwen.api_key);
                }
                // 智谱 GLM
                if let Some(ref zhipu) = config.ai_provider.zhipu {
                    if zhipu.enabled && !zhipu.api_key.is_empty() {
                        cmd.env("ZHIPU_API_KEY", &zhipu.api_key);
                    }
                }
                // DeepSeek
                if config.ai_provider.deepseek.enabled
                    && !config.ai_provider.deepseek.api_key.is_empty()
                {
                    cmd.env("DEEPSEEK_API_KEY", &config.ai_provider.deepseek.api_key);
                }
            }
        }
    }

    /// 探测是否已有外部 Gateway 在运行（不属于本进程管理器）
    async fn detect_external_gateway_status(&self) -> Option<GatewayProcessStatus> {
        if !self.check_websocket_connection().await {
            return None;
        }

        let restart_count = *self.restart_count.lock().await;
        let pid = self.find_port_owner_pid().await;

        Some(GatewayProcessStatus {
            running: true,
            pid,
            port: self.port,
            uptime_seconds: None,
            memory_mb: None,
            websocket_connected: true,
            process_type: "external".to_string(),
            error: None,
            restart_count,
        })
    }

    /// 查找端口占用进程 PID（Unix）
    async fn find_port_owner_pid(&self) -> Option<u32> {
        #[cfg(unix)]
        {
            if let Ok(output) = StdCommand::new("lsof")
                .args(["-ti", &format!(":{}", self.port)])
                .output()
            {
                let pids = String::from_utf8_lossy(&output.stdout);
                for line in pids.lines() {
                    if let Ok(pid) = line.trim().parse::<u32>() {
                        return Some(pid);
                    }
                }
            }
        }

        None
    }

    /// 检查端口可用性（禁止误杀已有进程）
    async fn ensure_port_available(&self) -> Result<()> {
        let addr = format!("127.0.0.1:{}", self.port);

        match tokio::net::TcpStream::connect(&addr).await {
            Ok(_) => {
                let pid_desc = self
                    .find_port_owner_pid()
                    .await
                    .map(|pid| format!(" (PID: {})", pid))
                    .unwrap_or_default();
                Err(anyhow!(
                    "端口 {} 已被占用{}，并且不是由桌面进程托管。请先停止该服务或复用它。",
                    self.port,
                    pid_desc
                ))
            }
            Err(_) => Ok(()),
        }
    }

    /// 等待 WebSocket 就绪
    async fn wait_for_websocket(&self) -> Result<bool> {
        for attempt in 1..=WS_CONNECT_RETRIES {
            tokio::time::sleep(Duration::from_millis(if attempt == 1 {
                3000
            } else {
                WS_CONNECT_RETRY_INTERVAL_MS
            }))
            .await;

            log::debug!("🔍 WebSocket 连接尝试 {}...", attempt);

            if self.check_websocket_connection().await {
                return Ok(true);
            }
        }

        Ok(false)
    }

    /// 检查 WebSocket 连接
    async fn check_websocket_connection(&self) -> bool {
        let addr = format!("127.0.0.1:{}", self.port);

        matches!(
            timeout(Duration::from_secs(2), tokio::net::TcpStream::connect(&addr)).await,
            Ok(Ok(_))
        )
    }

    /// 获取进程内存使用量
    #[cfg(unix)]
    async fn get_process_memory(&self, pid: u32) -> f32 {
        if let Ok(output) = TokioCommand::new("ps")
            .args(["-o", "rss=", "-p", &pid.to_string()])
            .output()
            .await
        {
            if output.status.success() {
                let rss_str = String::from_utf8_lossy(&output.stdout);
                if let Some(kb_str) = rss_str.trim().strip_suffix(" KB") {
                    if let Ok(kb) = kb_str.parse::<f32>() {
                        return kb / 1024.0;
                    }
                }
            }
        }
        0.0
    }

    #[cfg(windows)]
    async fn get_process_memory(&self, _pid: u32) -> f32 {
        // Windows 实现待完成
        0.0
    }
}

impl Clone for GatewayProcessManager {
    fn clone(&self) -> Self {
        Self {
            process: Arc::clone(&self.process),
            port: self.port,
            restart_count: Arc::clone(&self.restart_count),
            max_restart_count: self.max_restart_count,
            state: Arc::clone(&self.state),
            starting_lock: Arc::clone(&self.starting_lock),
        }
    }
}

// ========== 全局单例 ==========

use once_cell::sync::Lazy;

/// 全局 Gateway 进程管理器
static GATEWAY_PROCESS_MANAGER: Lazy<GatewayProcessManager> =
    Lazy::new(|| GatewayProcessManager::new(None));

/// 获取全局 Gateway 进程管理器
pub fn get_gateway_process_manager() -> &'static GatewayProcessManager {
    &GATEWAY_PROCESS_MANAGER
}

// ========== 单元测试 ==========

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gateway_status_default() {
        let status = GatewayProcessStatus::default();
        assert!(!status.running);
        assert!(status.pid.is_none());
        assert_eq!(status.port, DEFAULT_GATEWAY_PORT);
    }

    #[test]
    fn test_process_manager_creation() {
        let manager = GatewayProcessManager::new(Some(8080));
        assert_eq!(manager.port(), 8080);
    }
}
