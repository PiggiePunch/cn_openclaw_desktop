// 权限命令

use crate::permissions::{parse_permission_type, PermissionManager, PermissionStatus};

/// 检查权限的 Tauri 命令
#[tauri::command]
pub async fn check_permission(permission: String) -> Result<PermissionStatus, String> {
    let manager = PermissionManager::new();
    let perm = parse_permission_type(&permission)?;
    Ok(manager.check_permission(&perm))
}

/// 请求权限的 Tauri 命令
#[tauri::command]
pub async fn request_permission(permission: String) -> Result<PermissionStatus, String> {
    let mut manager = PermissionManager::new();
    let perm = parse_permission_type(&permission)?;
    manager.request_permission(&perm)
}

/// 获取所有权限状态的 Tauri 命令
#[tauri::command]
pub async fn get_all_permissions() -> Vec<PermissionStatus> {
    let mut manager = PermissionManager::new();
    manager.refresh_all_permissions();
    manager.get_all_permissions()
}

/// 刷新所有权限状态的 Tauri 命令
#[tauri::command]
pub async fn refresh_permissions() -> Vec<PermissionStatus> {
    let mut manager = PermissionManager::new();
    manager.refresh_all_permissions();
    manager.get_all_permissions()
}
