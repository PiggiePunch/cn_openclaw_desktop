// 权限管理模块
// 实现跨平台的系统权限请求和检查功能

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 权限类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum PermissionType {
    /// 屏幕录制
    ScreenCapture,
    /// 摄像头
    Camera,
    /// 麦克风
    Microphone,
    /// 文件系统访问
    FileSystem,
    /// 网络访问
    Network,
    /// 自动化/辅助功能
    Automation,
}

/// 权限状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionStatus {
    pub permission: PermissionType,
    pub granted: bool,
    pub reason: Option<String>,
}

// ========== macOS FFI 绑定 ==========
#[cfg(target_os = "macos")]
mod macos_bindings {
    use std::ffi::c_void;

    // CoreGraphics 屏幕录制权限
    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        /// 检查屏幕录制权限状态
        /// 返回 true 表示已授权，false 表示未授权
        pub fn CGPreflightScreenCaptureAccess() -> bool;

        /// 请求屏幕录制权限
        /// 会弹出系统对话框，返回 true 表示已授权
        pub fn CGRequestScreenCaptureAccess() -> bool;
    }

    // CoreFoundation 用于 CFDictionary
    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" {
        pub fn CFRelease(cf: *const c_void);
        pub fn CFRetain(cf: *const c_void);
    }

    // Accessibility API 辅助功能权限
    #[link(name = "ApplicationServices", kind = "framework")]
    extern "C" {
        /// 检查辅助功能权限
        /// 返回 true 表示已授权
        pub fn AXIsProcessTrusted() -> bool;

        /// 检查并可选请求辅助功能权限
        /// options: AXOptions 字典，可以包含 kAXTrustedCheckOptionPrompt 键
        /// 返回 true 表示已授权
        pub fn AXIsProcessTrustedWithOptions(options: *const c_void) -> bool;
    }

    // kAXTrustedCheckOptionPrompt 的键
    #[allow(non_upper_case_globals)]
    pub static kAXTrustedCheckOptionPrompt: &str = "AXTrustedCheckOptionPrompt";

    // 注意: AVFoundation 的摄像头/麦克风权限 API 需要通过 Objective-C 桥接调用
    // 这里暂时使用存根实现，因为微信监控只需要 Automation 权限
}

// ========== macOS 权限辅助函数 ==========
#[cfg(target_os = "macos")]
mod macos_permissions {
    use super::macos_bindings::*;
    use crate::avfoundation;
    use core_foundation::base::TCFType;
    use std::ffi::c_void;
    use std::ptr;

    /// 检查屏幕录制权限
    pub fn check_screen_capture() -> bool {
        unsafe { CGPreflightScreenCaptureAccess() }
    }

    /// 请求屏幕录制权限
    pub fn request_screen_capture() -> bool {
        unsafe { CGRequestScreenCaptureAccess() }
    }

    /// 检查辅助功能权限
    pub fn check_automation() -> bool {
        unsafe { AXIsProcessTrusted() }
    }

    /// 请求辅助功能权限（带提示对话框）
    pub fn request_automation() -> bool {
        unsafe {
            // 创建一个带提示选项的字典
            // 这里我们直接调用带 prompt 选项的 API
            // 由于直接创建 CFDictionary 比较复杂，我们使用简化的方式

            // kAXTrustedCheckOptionPrompt = true 会显示系统提示
            let key = core_foundation::string::CFString::new("AXTrustedCheckOptionPrompt");
            let value = core_foundation::boolean::CFBoolean::true_value();

            let dict = core_foundation::dictionary::CFDictionary::from_CFType_pairs(&[(
                key.as_CFType(),
                value.as_CFType(),
            )]);

            AXIsProcessTrustedWithOptions(dict.as_concrete_TypeRef() as *const c_void)
        }
    }

    /// 检查摄像头权限
    /// 使用 AVFoundation API 检查摄像头授权状态
    pub fn check_camera() -> bool {
        avfoundation::check_camera_authorization().is_authorized()
    }

    /// 请求摄像头权限
    /// 使用 AVFoundation API 请求摄像头访问权限
    /// 注意：此函数会阻塞等待用户响应（最多 60 秒）
    pub fn request_camera() -> bool {
        avfoundation::request_camera_access()
    }

    /// 检查麦克风权限
    /// 使用 AVFoundation API 检查麦克风授权状态
    pub fn check_microphone() -> bool {
        avfoundation::check_microphone_authorization().is_authorized()
    }

    /// 请求麦克风权限
    /// 使用 AVFoundation API 请求麦克风访问权限
    /// 注意：此函数会阻塞等待用户响应（最多 60 秒）
    pub fn request_microphone() -> bool {
        avfoundation::request_microphone_access()
    }
}

/// 权限管理器
pub struct PermissionManager {
    permissions: HashMap<PermissionType, PermissionStatus>,
}

impl PermissionManager {
    pub fn new() -> Self {
        let mut permissions = HashMap::new();

        // 初始化所有权限状态
        for perm in [
            PermissionType::ScreenCapture,
            PermissionType::Camera,
            PermissionType::Microphone,
            PermissionType::FileSystem,
            PermissionType::Network,
            PermissionType::Automation,
        ] {
            permissions.insert(
                perm.clone(),
                PermissionStatus {
                    permission: perm,
                    granted: false,
                    reason: None,
                },
            );
        }

        Self { permissions }
    }

    /// 检查权限
    pub fn check_permission(&self, perm: &PermissionType) -> PermissionStatus {
        #[cfg(target_os = "macos")]
        {
            self.check_macos_permission(perm)
        }

        #[cfg(target_os = "windows")]
        {
            self.check_windows_permission(perm)
        }

        #[cfg(target_os = "linux")]
        {
            self.check_linux_permission(perm)
        }

        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        {
            PermissionStatus {
                permission: perm.clone(),
                granted: false,
                reason: Some("不支持的平台".to_string()),
            }
        }
    }

    /// 请求权限
    pub fn request_permission(
        &mut self,
        perm: &PermissionType,
    ) -> Result<PermissionStatus, String> {
        #[cfg(target_os = "macos")]
        {
            self.request_macos_permission(perm)
        }

        #[cfg(target_os = "windows")]
        {
            self.request_windows_permission(perm)
        }

        #[cfg(target_os = "linux")]
        {
            self.request_linux_permission(perm)
        }

        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        {
            Err("不支持的平台".to_string())
        }
    }

    // ========== macOS 实现 ==========

    /// macOS 检查权限
    #[cfg(target_os = "macos")]
    fn check_macos_permission(&self, perm: &PermissionType) -> PermissionStatus {
        use macos_permissions::*;

        match perm {
            PermissionType::ScreenCapture => {
                let granted = check_screen_capture();
                PermissionStatus {
                    permission: perm.clone(),
                    granted,
                    reason: if granted {
                        None
                    } else {
                        Some("需要在系统设置 > 隐私与安全性 > 屏幕录制中授权".to_string())
                    },
                }
            }
            PermissionType::Camera => {
                let granted = check_camera();
                PermissionStatus {
                    permission: perm.clone(),
                    granted,
                    reason: if granted {
                        None
                    } else {
                        Some("需要在系统设置 > 隐私与安全性 > 摄像头中授权".to_string())
                    },
                }
            }
            PermissionType::Microphone => {
                let granted = check_microphone();
                PermissionStatus {
                    permission: perm.clone(),
                    granted,
                    reason: if granted {
                        None
                    } else {
                        Some("需要在系统设置 > 隐私与安全性 > 麦克风中授权".to_string())
                    },
                }
            }
            PermissionType::Automation => {
                let granted = check_automation();
                PermissionStatus {
                    permission: perm.clone(),
                    granted,
                    reason: if granted {
                        None
                    } else {
                        Some("需要在系统设置 > 隐私与安全性 > 辅助功能中授权".to_string())
                    },
                }
            }
            PermissionType::FileSystem => {
                // 文件系统权限在 macOS 上通常不需要特殊授权
                // 沙盒环境下需要用户选择目录
                PermissionStatus {
                    permission: perm.clone(),
                    granted: true,
                    reason: None,
                }
            }
            PermissionType::Network => {
                // 网络权限在 macOS 上通常默认允许
                PermissionStatus {
                    permission: perm.clone(),
                    granted: true,
                    reason: None,
                }
            }
        }
    }

    /// macOS 权限请求
    #[cfg(target_os = "macos")]
    fn request_macos_permission(
        &mut self,
        perm: &PermissionType,
    ) -> Result<PermissionStatus, String> {
        use macos_permissions::*;

        let status = match perm {
            PermissionType::ScreenCapture => {
                let granted = request_screen_capture();
                PermissionStatus {
                    permission: perm.clone(),
                    granted,
                    reason: if granted {
                        None
                    } else {
                        Some("请在弹出的系统对话框中授权屏幕录制权限".to_string())
                    },
                }
            }
            PermissionType::Camera => {
                let granted = request_camera();
                PermissionStatus {
                    permission: perm.clone(),
                    granted,
                    reason: if granted {
                        None
                    } else {
                        Some("请在弹出的系统对话框中授权摄像头权限".to_string())
                    },
                }
            }
            PermissionType::Microphone => {
                let granted = request_microphone();
                PermissionStatus {
                    permission: perm.clone(),
                    granted,
                    reason: if granted {
                        None
                    } else {
                        Some("请在弹出的系统对话框中授权麦克风权限".to_string())
                    },
                }
            }
            PermissionType::Automation => {
                let granted = request_automation();
                PermissionStatus {
                    permission: perm.clone(),
                    granted,
                    reason: if granted {
                        None
                    } else {
                        Some("请在系统设置 > 隐私与安全性 > 辅助功能中授权".to_string())
                    },
                }
            }
            PermissionType::FileSystem => PermissionStatus {
                permission: perm.clone(),
                granted: true,
                reason: None,
            },
            PermissionType::Network => PermissionStatus {
                permission: perm.clone(),
                granted: true,
                reason: None,
            },
        };

        self.permissions.insert(perm.clone(), status.clone());
        Ok(status)
    }

    // ========== Windows 实现 ==========

    /// Windows 检查权限
    #[cfg(target_os = "windows")]
    fn check_windows_permission(&self, perm: &PermissionType) -> PermissionStatus {
        // Windows 使用不同的权限模型
        // 大多数权限在安装时或首次使用时请求
        match perm {
            PermissionType::FileSystem | PermissionType::Network => PermissionStatus {
                permission: perm.clone(),
                granted: true,
                reason: None,
            },
            _ => {
                // Windows 上其他权限通常默认允许或由系统管理
                PermissionStatus {
                    permission: perm.clone(),
                    granted: true,
                    reason: None,
                }
            }
        }
    }

    /// Windows 权限请求
    #[cfg(target_os = "windows")]
    fn request_windows_permission(
        &mut self,
        perm: &PermissionType,
    ) -> Result<PermissionStatus, String> {
        let status = PermissionStatus {
            permission: perm.clone(),
            granted: true, // Windows 通常默认允许
            reason: None,
        };

        self.permissions.insert(perm.clone(), status.clone());
        Ok(status)
    }

    // ========== Linux 实现 ==========

    /// Linux 检查权限
    #[cfg(target_os = "linux")]
    fn check_linux_permission(&self, perm: &PermissionType) -> PermissionStatus {
        // Linux 权限比较复杂，取决于发行版
        // Flatpak 使用 Portal API
        // 原生应用通常直接访问
        PermissionStatus {
            permission: perm.clone(),
            granted: true,
            reason: None,
        }
    }

    /// Linux 权限请求
    #[cfg(target_os = "linux")]
    fn request_linux_permission(
        &mut self,
        perm: &PermissionType,
    ) -> Result<PermissionStatus, String> {
        let status = PermissionStatus {
            permission: perm.clone(),
            granted: true,
            reason: None,
        };

        self.permissions.insert(perm.clone(), status.clone());
        Ok(status)
    }

    /// 获取所有权限状态
    pub fn get_all_permissions(&self) -> Vec<PermissionStatus> {
        self.permissions.values().cloned().collect()
    }

    /// 刷新所有权限状态
    pub fn refresh_all_permissions(&mut self) {
        for perm in [
            PermissionType::ScreenCapture,
            PermissionType::Camera,
            PermissionType::Microphone,
            PermissionType::FileSystem,
            PermissionType::Network,
            PermissionType::Automation,
        ] {
            let status = self.check_permission(&perm);
            self.permissions.insert(perm, status);
        }
    }
}

impl Default for PermissionManager {
    fn default() -> Self {
        Self::new()
    }
}

/// 解析权限类型字符串
pub fn parse_permission_type(s: &str) -> Result<PermissionType, String> {
    match s.to_lowercase().as_str() {
        "screencapture" | "screen_capture" | "screen" => Ok(PermissionType::ScreenCapture),
        "camera" | "webcam" => Ok(PermissionType::Camera),
        "microphone" | "mic" | "audio" => Ok(PermissionType::Microphone),
        "filesystem" | "fs" | "file" => Ok(PermissionType::FileSystem),
        "network" | "net" => Ok(PermissionType::Network),
        "automation" | "accessibility" | "auto" => Ok(PermissionType::Automation),
        _ => Err(format!("未知的权限类型: {}", s)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_permission_manager_new() {
        let manager = PermissionManager::new();
        assert_eq!(manager.permissions.len(), 6);
    }

    #[test]
    fn test_parse_permission_type() {
        assert!(matches!(
            parse_permission_type("screencapture"),
            Ok(PermissionType::ScreenCapture)
        ));
        assert!(matches!(
            parse_permission_type("camera"),
            Ok(PermissionType::Camera)
        ));
        assert!(matches!(
            parse_permission_type("microphone"),
            Ok(PermissionType::Microphone)
        ));
        assert!(matches!(
            parse_permission_type("automation"),
            Ok(PermissionType::Automation)
        ));
        assert!(parse_permission_type("unknown").is_err());
    }

    #[test]
    #[cfg(target_os = "macos")]
    fn test_macos_check_permission() {
        let manager = PermissionManager::new();

        // 测试文件系统权限（应该默认允许）
        let status = manager.check_permission(&PermissionType::FileSystem);
        assert!(status.granted);

        // 测试网络权限（应该默认允许）
        let status = manager.check_permission(&PermissionType::Network);
        assert!(status.granted);
    }

    #[test]
    fn test_get_all_permissions() {
        let manager = PermissionManager::new();
        let all = manager.get_all_permissions();
        assert_eq!(all.len(), 6);
    }
}
