// OpenClaw 安装命令
//
// 功能：
// - 检查安装状态
// - 触发自动安装
// - 版本检查
// - 手动更新

use crate::openclaw_manager::OpenClawManager;
use serde::{Deserialize, Serialize};

/// 安装状态响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallState {
    pub needs_install: bool,
    pub installed: bool,
    pub version: Option<String>,
    pub install_path: Option<String>,
    pub error: Option<String>,
}

/// 检查安装状态
#[tauri::command]
pub async fn check_install_status() -> Result<InstallState, String> {
    let manager = OpenClawManager::new();

    let installed = manager.is_installed().await;
    let version = manager.get_installed_version().await;
    let exec_path = manager.get_executable_path();

    Ok(InstallState {
        needs_install: !installed,
        installed,
        version,
        install_path: if installed {
            Some(exec_path.to_string_lossy().to_string())
        } else {
            Some(manager.install_dir().to_string_lossy().to_string())
        },
        error: None,
    })
}

/// 触发自动安装
#[tauri::command]
pub async fn install_openclaw() -> Result<InstallState, String> {
    let manager = OpenClawManager::new();

    // 1. 检查是否已安装
    if manager.is_installed().await {
        let version = manager.get_installed_version().await;
        return Ok(InstallState {
            needs_install: false,
            installed: true,
            version,
            install_path: Some(manager.get_executable_path().to_string_lossy().to_string()),
            error: None,
        });
    }

    // 2. 初始化配置
    if let Err(e) = manager.init_config().await {
        log::error!("初始化配置失败: {}", e);
    }

    // 3. 下载并安装
    match manager.download_and_install().await {
        Ok(status) => Ok(InstallState {
            needs_install: false,
            installed: status.installed,
            version: status.version,
            install_path: Some(manager.get_executable_path().to_string_lossy().to_string()),
            error: None,
        }),
        Err(e) => Ok(InstallState {
            needs_install: true,
            installed: false,
            version: None,
            install_path: None,
            error: Some(e.to_string()),
        }),
    }
}

/// 检查更新
#[tauri::command]
pub async fn check_openclaw_update() -> Result<Option<String>, String> {
    let manager = OpenClawManager::new();
    manager.check_update().await.map_err(|e| e.to_string())
}

/// 更新 OpenClaw
#[tauri::command]
pub async fn update_openclaw() -> Result<InstallState, String> {
    let manager = OpenClawManager::new();

    if !manager.is_installed().await {
        return Err("OpenClaw 未安装，请先安装".to_string());
    }

    match manager.update().await {
        Ok(status) => Ok(InstallState {
            needs_install: false,
            installed: status.installed,
            version: status.version,
            install_path: status.install_path.map(|p| p.to_string_lossy().to_string()),
            error: None,
        }),
        Err(e) => Ok(InstallState {
            needs_install: true,
            installed: false,
            version: None,
            install_path: None,
            error: Some(e.to_string()),
        }),
    }
}

/// 获取 OpenClaw 可执行文件路径
#[tauri::command]
pub fn get_openclaw_path() -> Result<String, String> {
    let manager = OpenClawManager::new();
    let path = manager.get_executable_path();

    if path.exists() {
        Ok(path.to_string_lossy().to_string())
    } else {
        Err("OpenClaw 未安装".to_string())
    }
}
