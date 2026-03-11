// 系统命令

use sysinfo::System;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// 🔥 统一配置目录函数
/// 使用统一路径模块
fn get_config_dir() -> PathBuf {
    crate::paths::config_dir()
}

/// 系统信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    pub hostname: String,
    pub total_memory_mb: f64,
    pub available_memory_mb: f64,
    pub cpu_usage: f32,
}

#[tauri::command]
pub async fn get_system_info() -> Result<SystemInfo, String> {
    let mut sys = System::new_all();
    sys.refresh_all();

    Ok(SystemInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        hostname: System::host_name().unwrap_or_else(|| "未知".to_string()),
        total_memory_mb: sys.total_memory() as f64 / 1024.0 / 1024.0,
        available_memory_mb: sys.available_memory() as f64 / 1024.0 / 1024.0,
        cpu_usage: sys.global_cpu_info().cpu_usage(),
    })
}

#[tauri::command]
pub async fn open_logs_folder() -> Result<(), String> {
    let config_dir = get_config_dir();

    // 创建日志目录
    std::fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;

    // 打开文件夹
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&config_dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&config_dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&config_dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// 打开系统 URL（支持深层链接）
#[tauri::command]
pub async fn open_url(url: String) -> Result<(), String> {
    println!("🌐 打开 URL: {}", url);

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("打开 URL 失败: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", &url])
            .spawn()
            .map_err(|e| format!("打开 URL 失败: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("打开 URL 失败: {}", e))?;
    }

    Ok(())
}
