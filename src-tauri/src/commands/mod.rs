// Tauri 命令模块
//
// Phase 3c 简化版 - 只保留桌面壳子需要的命令
// 其他功能通过 Gateway API (WebSocket) 调用

// 命令子模块
pub mod config; // 配置读写
pub mod gateway_process; // Gateway 进程管理
pub mod install; // OpenClaw 安装管理
pub mod permissions; // 权限管理
pub mod system; // 系统命令
pub mod updater; // 自动更新

// 重新导出 Gateway 进程管理命令
pub use gateway_process::{
    bundled_gateway_health_check, bundled_gateway_status, restart_bundled_gateway,
    start_bundled_gateway, stop_bundled_gateway, BundledGatewayHealthStatus,
};
