//! Gateway 进程管理命令（Phase 1 新增）
//!
//! 提供打包的 OpenClaw Gateway 子进程管理功能。
//! 这些命令与 commands/gateway.rs 中的旧版 Rust Gateway 命令不同。

use crate::process::{get_gateway_process_manager, GatewayProcessStatus};

/// 启动打包的 Gateway 进程
///
/// 启动打包的 OpenClaw Gateway 子进程（Node.js）。
/// 如果已在运行，返回当前状态。
#[tauri::command]
pub async fn start_bundled_gateway() -> Result<GatewayProcessStatus, String> {
    log::info!("📡 前端请求启动打包的 Gateway");

    let manager = get_gateway_process_manager();
    manager.start().await.map_err(|e: anyhow::Error| {
        log::error!("启动 Gateway 失败: {}", e);
        e.to_string()
    })
}

/// 停止打包的 Gateway 进程
///
/// 优雅停止 Gateway 子进程。
#[tauri::command]
pub async fn stop_bundled_gateway() -> Result<(), String> {
    log::info!("📡 前端请求停止打包的 Gateway");

    let manager = get_gateway_process_manager();
    manager.stop().await.map_err(|e: anyhow::Error| {
        log::error!("停止 Gateway 失败: {}", e);
        e.to_string()
    })
}

/// 获取打包的 Gateway 状态
///
/// 返回 Gateway 进程的当前状态，包括：
/// - 是否运行中
/// - PID
/// - 端口
/// - 运行时间
/// - WebSocket 连接状态
#[tauri::command]
pub async fn bundled_gateway_status() -> Result<GatewayProcessStatus, String> {
    log::debug!("📡 前端请求打包的 Gateway 状态");

    let manager = get_gateway_process_manager();
    manager.get_status().await.map_err(|e: anyhow::Error| {
        log::error!("获取 Gateway 状态失败: {}", e);
        e.to_string()
    })
}

/// 重启打包的 Gateway 进程
///
/// 停止并重新启动 Gateway。
#[tauri::command]
pub async fn restart_bundled_gateway() -> Result<GatewayProcessStatus, String> {
    log::info!("📡 前端请求重启打包的 Gateway");

    let manager = get_gateway_process_manager();
    manager.restart().await.map_err(|e: anyhow::Error| {
        log::error!("重启 Gateway 失败: {}", e);
        e.to_string()
    })
}

/// 打包的 Gateway 健康检查
///
/// 返回 Gateway 是否健康，以及是否需要重启。
#[tauri::command]
pub async fn bundled_gateway_health_check() -> Result<BundledGatewayHealthStatus, String> {
    log::debug!("📡 前端请求打包的 Gateway 健康检查");

    let manager = get_gateway_process_manager();
    let (is_healthy, should_restart) = manager.health_check().await;

    Ok(BundledGatewayHealthStatus {
        is_healthy,
        should_restart,
    })
}

/// 打包的 Gateway 健康状态
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BundledGatewayHealthStatus {
    /// 是否健康
    pub is_healthy: bool,
    /// 是否需要重启
    pub should_restart: bool,
}
