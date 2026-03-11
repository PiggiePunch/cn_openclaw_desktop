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
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::process::Command as TokioCommand;
use tokio::sync::Mutex;
use tokio::time::timeout;

/// 默认 Gateway 端口
pub const DEFAULT_GATEWAY_PORT: u16 = 18789;

/// Gateway 启动超时时间（秒）
const GATEWAY_STARTUP_TIMEOUT_SECS: u64 = 30;

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
    /// 进程类型（"bundled" 表示打包的 Node.js）
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
            process_type: "bundled".to_string(),
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
    /// openclaw 路径
    openclaw_path: PathBuf,
    /// Node.js 运行时路径
    node_path: PathBuf,
}

/// Gateway 进程管理器
///
/// 负责 Gateway 子进程的完整生命周期管理：
/// - 查找 openclaw 可执行文件
/// - 启动/停止/重启进程
/// - 健康检查和自动恢复
/// - 端口冲突处理
pub struct GatewayProcessManager {
    /// 进程句柄（可选）
    process: Arc<Mutex<Option<GatewayProcessHandle>>>,
    /// 监听端口
    port: u16,
    /// 自动重启计数器
    restart_count: Arc<Mutex<u32>>,
    /// 最大自动重启次数
    max_restart_count: u32,
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
        }
    }

    /// 获取管理器端口
    pub fn port(&self) -> u16 {
        self.port
    }

    /// 启动 Gateway 进程
    ///
    /// 启动流程：
    /// 1. 检查是否已在运行
    /// 2. 检查并清理端口占用
    /// 3. 查找 openclaw 可执行文件
    /// 4. 查找 Node.js 运行时
    /// 5. 启动子进程
    /// 6. 等待 WebSocket 就绪
    /// 7. 保存进程句柄
    pub async fn start(&self) -> Result<GatewayProcessStatus> {
        log::info!("🚀 启动 Gateway 进程...");

        // 1. 检查是否已在运行
        if self.is_running().await? {
            log::info!("✅ Gateway 已在运行");
            return self.get_status().await;
        }

        // 2. 检查并清理端口占用
        if let Err(e) = self.check_and_clear_port().await {
            log::warn!("⚠️ 端口检查警告: {}", e);
        }

        // 3. 查找 openclaw 可执行文件
        let openclaw_path = self.find_openclaw_path()?;
        log::info!("📁 OpenClaw 路径: {:?}", openclaw_path);

        // 4. 查找 Node.js 运行时
        let node_path = self.find_node_path()?;
        log::info!("📦 Node.js 路径: {:?}", node_path);

        // 5. 构建启动命令
        let mut cmd = TokioCommand::new(&node_path);
        cmd.arg(&openclaw_path);
        cmd.args(["gateway", "run"]);
        cmd.args(["--port", &self.port.to_string()]);
        cmd.args(["--bind", "loopback"]);
        cmd.args(["--allow-unconfigured"]);

        // 设置环境变量
        self.setup_environment(&mut cmd);

        // 设置工作目录
        if let Some(work_dir) = openclaw_path.parent().and_then(|p| p.parent()) {
            if work_dir.join("package.json").exists() {
                cmd.current_dir(work_dir);
                log::info!("📂 工作目录: {:?}", work_dir);
            }
        }

        // 6. 启动进程
        log::info!("🔧 启动命令: node {:?} gateway run --port {}", openclaw_path, self.port);
        let mut child = cmd.spawn()
            .map_err(|e| anyhow!("启动 Gateway 失败: {}\n请确保 openclaw 和 Node.js 已正确安装", e))?;

        let pid = child.id();
        log::info!("✅ Gateway 进程已启动 (PID: {:?})", pid);

        // 7. 等待 WebSocket 就绪
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

        // 8. 保存进程句柄
        let handle = GatewayProcessHandle {
            child,
            start_time: Instant::now(),
            openclaw_path,
            node_path,
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
            process_type: "bundled".to_string(),
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
            Ok(false)
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
    /// 1. 打包的资源目录 (resources/openclaw/)
    /// 2. 自动安装目录 (~/.openclaw/core/)
    /// 3. 开发环境 (../openclaw/)
    /// 4. 全局安装 (which/where)
    fn find_openclaw_path(&self) -> Result<PathBuf> {
        // 获取当前可执行文件目录
        let exe_path = std::env::current_exe()
            .map_err(|e| anyhow!("无法获取当前可执行文件路径: {}", e))?;
        let exe_dir = exe_path.parent()
            .ok_or_else(|| anyhow!("无法获取可执行文件目录"))?;

        // 资源搜索路径列表
        let search_paths = vec![
            // 🔥 优先级 1：打包的资源目录
            // macOS: .app/Contents/MacOS/resources/openclaw/openclaw.mjs
            exe_dir.join("resources/openclaw/openclaw.mjs"),
            // macOS: .app/Contents/Resources/openclaw/openclaw.mjs
            exe_dir.join("../Resources/openclaw/openclaw.mjs"),
            // 通用: resources/openclaw/openclaw.mjs
            exe_dir.join("../resources/openclaw/openclaw.mjs"),
            // 开发环境
            exe_dir.join("../../../resources/openclaw/openclaw.mjs"),

            // 🔥 优先级 2：自动安装目录
            dirs::home_dir()
                .map(|h| h.join(".openclaw/core/openclaw.mjs"))
                .unwrap_or_default(),
            dirs::home_dir()
                .map(|h| h.join(".openclaw/core/dist/openclaw.mjs"))
                .unwrap_or_default(),

            // 🔥 优先级 3：开发环境（openclaw 和 openclaw-desktop 同级）
            exe_dir.join("../../../openclaw/openclaw.mjs"),
            exe_dir.join("../../../openclaw/dist/openclaw.mjs"),
        ];

        for path in search_paths {
            if path.exists() {
                let canonical = path.canonicalize().unwrap_or(path.clone());
                log::debug!("找到 openclaw: {:?}", canonical);
                return Ok(canonical);
            }
        }

        // 🔥 优先级 4：全局安装
        #[cfg(unix)]
        {
            if let Ok(output) = StdCommand::new("which").arg("openclaw").output() {
                if output.status.success() {
                    let path_str = String::from_utf8_lossy(&output.stdout);
                    let path = path_str.trim();
                    if !path.is_empty() {
                        return Ok(PathBuf::from(path));
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
                            return Ok(PathBuf::from(path.trim()));
                        }
                    }
                }
            }
        }

        Err(anyhow!(
            "找不到 openclaw 可执行文件。\n\
             请确保：\n\
             1. 已运行打包脚本将 openclaw 打包到 resources/openclaw/\n\
             2. 或已全局安装 openclaw\n\
             3. 或将 openclaw 项目放在 openclaw-desktop 同级目录"
        ))
    }

    /// 查找 Node.js 运行时路径
    ///
    /// 查找顺序：
    /// 1. 打包的 Node.js (resources/openclaw/node/)
    /// 2. 系统 Node.js
    fn find_node_path(&self) -> Result<PathBuf> {
        // 获取当前可执行文件目录
        let exe_path = std::env::current_exe()
            .map_err(|e| anyhow!("无法获取当前可执行文件路径: {}", e))?;
        let exe_dir = exe_path.parent()
            .ok_or_else(|| anyhow!("无法获取可执行文件目录"))?;

        // 平台特定的 Node.js 可执行文件名
        #[cfg(unix)]
        let node_bin = "node";
        #[cfg(windows)]
        let node_bin = "node.exe";

        // 打包的 Node.js 路径
        let bundled_paths = vec![
            exe_dir.join("resources/openclaw/node").join(node_bin),
            exe_dir.join("../Resources/openclaw/node").join(node_bin),
            exe_dir.join("../resources/openclaw/node").join(node_bin),
        ];

        for path in bundled_paths {
            if path.exists() {
                let canonical = path.canonicalize().unwrap_or(path.clone());
                log::info!("使用打包的 Node.js: {:?}", canonical);
                return Ok(canonical);
            }
        }

        // 使用系统 Node.js
        #[cfg(unix)]
        {
            if let Ok(output) = StdCommand::new("which").arg("node").output() {
                if output.status.success() {
                    let path_str = String::from_utf8_lossy(&output.stdout);
                    let path = path_str.trim();
                    if !path.is_empty() {
                        log::info!("使用系统 Node.js: {}", path);
                        return Ok(PathBuf::from(path));
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
                            return Ok(PathBuf::from(path.trim()));
                        }
                    }
                }
            }
        }

        Err(anyhow!(
            "找不到 Node.js 运行时。\n\
             请确保：\n\
             1. 已将 Node.js 打包到 resources/openclaw/node/\n\
             2. 或已安装 Node.js 并添加到 PATH"
        ))
    }

    /// 设置环境变量
    fn setup_environment(&self, cmd: &mut TokioCommand) {
        // 设置 OpenClaw 配置目录
        let config_dir = crate::paths::data_dir();
        cmd.env("OPENCLAW_CONFIG_DIR", &config_dir);
        log::info!("🔧 OPENCLAW_CONFIG_DIR: {:?}", config_dir);

        // 尝试加载应用的 API Keys（如果配置管理器可用）
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
                if config.ai_provider.deepseek.enabled && !config.ai_provider.deepseek.api_key.is_empty() {
                    cmd.env("DEEPSEEK_API_KEY", &config.ai_provider.deepseek.api_key);
                }
            }
        }
    }

    /// 检查并清理端口占用
    async fn check_and_clear_port(&self) -> Result<()> {
        let addr = format!("127.0.0.1:{}", self.port);

        match tokio::net::TcpStream::connect(&addr).await {
            Ok(_) => {
                log::warn!("⚠️ 端口 {} 被占用，尝试清理...", self.port);

                #[cfg(unix)]
                {
                    let current_pid = std::process::id();

                    // 使用 lsof 查找占用端口的进程
                    if let Ok(output) = StdCommand::new("lsof")
                        .args(["-ti", &format!(":{}", self.port)])
                        .output()
                    {
                        let pids = String::from_utf8_lossy(&output.stdout);
                        for pid_str in pids.lines() {
                            if let Ok(pid) = pid_str.trim().parse::<u32>() {
                                if pid == current_pid {
                                    continue;
                                }
                                log::info!("🔧 终止占用端口的进程 (PID: {})", pid);
                                let _ = StdCommand::new("kill")
                                    .args(["-9", &pid.to_string()])
                                    .output();
                            }
                        }
                    }

                    // 等待端口释放
                    tokio::time::sleep(Duration::from_millis(500)).await;

                    // 再次检查
                    if tokio::net::TcpStream::connect(&addr).await.is_ok() {
                        return Err(anyhow!("端口 {} 仍被占用，请手动清理", self.port));
                    }

                    log::info!("✅ 端口 {} 已清理", self.port);
                }

                #[cfg(windows)]
                {
                    // Windows 端口清理待实现
                    return Err(anyhow!("端口 {} 被占用，请手动清理", self.port));
                }

                Ok(())
            }
            Err(_) => Ok(()),
        }
    }

    /// 等待 WebSocket 就绪
    async fn wait_for_websocket(&self) -> Result<bool> {
        for attempt in 1..=WS_CONNECT_RETRIES {
            tokio::time::sleep(Duration::from_millis(
                if attempt == 1 { 3000 } else { WS_CONNECT_RETRY_INTERVAL_MS }
            )).await;

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

        match tokio::net::TcpStream::connect(&addr).await {
            Ok(mut stream) => {
                // 发送 WebSocket 握手请求
                let handshake = format!(
                    "GET / HTTP/1.1\r\n\
                     Host: 127.0.0.1:{}\r\n\
                     Upgrade: websocket\r\n\
                     Connection: Upgrade\r\n\
                     Sec-WebSocket-Version: 13\r\n\
                     Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n",
                    self.port
                );

                if stream.write_all(handshake.as_bytes()).await.is_err() {
                    return false;
                }

                // 等待响应
                tokio::time::sleep(Duration::from_millis(500)).await;

                // 读取响应
                let mut buffer = [0u8; 2048];
                match timeout(Duration::from_secs(3), stream.read(&mut buffer)).await {
                    Ok(Ok(n)) if n > 0 => {
                        let response = String::from_utf8_lossy(&buffer[..n]);
                        response.contains("101") || response.contains("Switching Protocols")
                    }
                    _ => false,
                }
            }
            Err(_) => false,
        }
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
