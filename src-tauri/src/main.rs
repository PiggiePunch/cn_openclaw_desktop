// OpenClaw CN - Tauri 桌面应用入口
//
// 国内版精简架构：只保留核心功能模块

// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// ============================================
// 模块声明（只保留存在的模块）
// ============================================

mod commands;
mod config;
mod openclaw_config;
mod openclaw_manager;
mod paths;
mod process;
mod tray;
mod updater;
mod wechat;

#[cfg(target_os = "macos")]
mod avfoundation;

mod permissions;

use tray::TrayManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化日志
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .init();

    let ctx = tauri::generate_context!();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            log::info!("🚀 OpenClaw CN 启动中...");

            // 初始化系统托盘
            let tray_manager = TrayManager::new(app.handle().clone());
            if let Err(e) = tray_manager.create_tray() {
                log::warn!("创建系统托盘失败: {}", e);
            }

            log::info!("✅ OpenClaw CN 启动完成");

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // ========== OpenClaw 安装管理 ==========
            commands::install::check_install_status,
            commands::install::install_openclaw,
            commands::install::check_openclaw_update,
            commands::install::update_openclaw,
            commands::install::get_openclaw_path,

            // ========== Gateway 进程管理（打包的 Node.js Gateway）==========
            commands::gateway_process::start_bundled_gateway,
            commands::gateway_process::stop_bundled_gateway,
            commands::gateway_process::bundled_gateway_status,
            commands::gateway_process::restart_bundled_gateway,
            commands::gateway_process::bundled_gateway_health_check,

            // ========== 配置管理 ==========
            commands::config::get_config,
            commands::config::set_config,
            commands::config::reset_config,
            commands::config::reset_all_data,

            // ========== 权限管理 ==========
            commands::permissions::check_permission,
            commands::permissions::request_permission,
            commands::permissions::get_all_permissions,
            commands::permissions::refresh_permissions,

            // ========== 系统命令 ==========
            commands::system::get_system_info,
            commands::system::open_logs_folder,
            commands::system::open_url,

            // ========== 自动更新 ==========
            commands::updater::check_for_updates,
            commands::updater::download_update,
            commands::updater::restart_app,
            commands::updater::get_app_version,
        ])
        .run(ctx)
        .expect("error while running tauri application");
}

fn main() {
    run()
}
