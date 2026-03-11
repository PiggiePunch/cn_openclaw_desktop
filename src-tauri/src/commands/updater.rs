// 更新命令模块
// 提供前端调用的更新相关 Tauri 命令

use crate::updater::{self, UpdateInfo};
use tauri::AppHandle;

/// 检查更新
#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> Result<Option<UpdateInfo>, String> {
    updater::check_for_updates(&app).await
}

/// 下载更新（带进度事件）
#[tauri::command]
pub async fn download_update(app: AppHandle) -> Result<(), String> {
    updater::download_and_install_update(&app).await
}

/// 重启应用（用于完成更新安装）
/// 注意：此命令不会返回，因为应用会立即重启
#[tauri::command]
pub fn restart_app(app: AppHandle) {
    updater::restart_app(&app)
}

/// 获取当前应用版本
#[tauri::command]
pub fn get_app_version(app: AppHandle) -> String {
    updater::get_app_version(&app)
}
