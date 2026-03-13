// 系统托盘模块

use tauri::{AppHandle, Emitter};

/// 托盘管理器
pub struct TrayManager {
    #[allow(dead_code)]
    handle: AppHandle,
}

impl TrayManager {
    pub fn new(handle: AppHandle) -> Self {
        Self { handle }
    }

    /// 创建系统托盘
    pub fn create_tray(&self) -> tauri::Result<()> {
        // TODO: 创建系统托盘（需要图标文件）
        // 暂时跳过，不影响主要功能
        Ok(())
    }

    /// 更新托盘状态
    #[allow(dead_code)]
    pub fn update_status(&self, _running: bool) -> tauri::Result<()> {
        // TODO: 更新托盘图标
        Ok(())
    }

    /// 显示托盘通知
    #[allow(dead_code)]
    pub fn show_notification(&self, title: &str, body: &str) -> tauri::Result<()> {
        self.handle.emit(
            "tray-notification",
            serde_json::json!({
                "title": title,
                "body": body
            }),
        )?;

        Ok(())
    }
}
