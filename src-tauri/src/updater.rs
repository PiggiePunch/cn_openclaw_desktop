// OpenClaw 自动更新模块
// CN 版本暂时禁用 - 所有功能返回错误

/// 更新信息结构体
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct UpdateInfo {
    pub version: String,
    pub date: Option<String>,
    pub notes: Option<String>,
}

/// 下载进度结构体
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DownloadProgress {
    pub downloaded: u64,
    pub total: u64,
    pub percent: f32,
}

/// 检查更新 - CN 版本已禁用
pub async fn check_for_updates(_app: &tauri::AppHandle) -> Result<Option<UpdateInfo>, String> {
    Err("自动更新功能已在 CN 版本中禁用".to_string())
}

/// 下载并安装更新 - CN 版本已禁用
pub async fn download_and_install_update(_app: &tauri::AppHandle) -> Result<(), String> {
    Err("自动更新功能已在 CN 版本中禁用".to_string())
}

/// 重启应用 - CN 版本已禁用
pub fn restart_app(_app: &tauri::AppHandle) -> ! {
    panic!("自动更新功能已在 CN 版本中禁用")
}

/// 获取当前应用版本
pub fn get_app_version(app: &tauri::AppHandle) -> String {
    app.config()
        .version
        .clone()
        .unwrap_or_else(|| "unknown".to_string())
}
