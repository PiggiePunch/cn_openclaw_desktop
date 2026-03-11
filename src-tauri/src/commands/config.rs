// 配置命令

use crate::config::{ConfigManager, AppConfig};
use crate::paths::config_dir;

#[tauri::command]
pub async fn get_config() -> Result<AppConfig, String> {
    let manager = ConfigManager::new().map_err(|e| e.to_string())?;
    manager.load().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_config(config: AppConfig) -> Result<(), String> {
    let manager = ConfigManager::new().map_err(|e| e.to_string())?;
    manager.save(&config).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reset_config() -> Result<AppConfig, String> {
    let manager = ConfigManager::new().map_err(|e| e.to_string())?;
    manager.reset().map_err(|e| e.to_string())
}

/// 🔥 重置所有数据（删除整个配置目录）
#[tauri::command]
pub async fn reset_all_data() -> Result<(), String> {
    let config_dir = config_dir();

    if config_dir.exists() {
        std::fs::remove_dir_all(&config_dir)
            .map_err(|e| format!("删除配置目录失败: {}", e))?;
        log::info!("✅ 已删除配置目录: {:?}", config_dir);
    }

    Ok(())
}
