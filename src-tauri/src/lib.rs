// OpenClaw CN - Tauri 后端库
//
// 国内版精简架构：只保留核心功能模块

// 开发时抑制警告（提升开发体验）
#![allow(dead_code)]
#![allow(unused_imports)]
#![allow(unused_variables)]
#![allow(unused_mut)]

// ============================================
// 核心基础设施模块（最先声明）
// ============================================

/// 统一路径管理
pub mod paths;

/// 配置管理（CN 版本简化配置）
pub mod config;

/// OpenClaw 原版配置格式支持
pub mod openclaw_config;

/// OpenClaw 自动安装管理器
pub mod openclaw_manager;

/// 自动更新模块
pub mod updater;

/// 系统托盘
pub mod tray;

// ============================================
// 平台专用模块
// ============================================

/// macOS 平台专用：AVFoundation 权限管理（摄像头/麦克风）
#[cfg(target_os = "macos")]
pub mod avfoundation;

// ============================================
// 核心功能模块
// ============================================

/// Gateway 进程管理（管理 Node.js Gateway 子进程）
pub mod process;

/// 微信集成（CN 特色功能）
pub mod wechat;

/// 权限管理
pub mod permissions;

// ============================================
// Tauri 命令模块（所有前端调用的入口点）
// ============================================

pub mod commands;

// ============================================
// 重新导出常用类型（方便使用）
// ============================================

pub use openclaw_manager::{OpenClawManager, InstallStatus};
pub use config::*;
pub use wechat::*;
pub use permissions::*;
