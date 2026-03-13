// AVFoundation 权限管理模块
// 通过 Objective-C 桥接调用 macOS AVFoundation API 实现摄像头/麦克风权限请求

#[cfg(target_os = "macos")]
use objc::runtime::{Class, Object, BOOL, NO, YES};
#[cfg(target_os = "macos")]
use objc::{class, msg_send, sel, sel_impl};
#[cfg(target_os = "macos")]
use std::ffi::{c_void, CString};
#[cfg(target_os = "macos")]
use std::sync::Arc;
#[cfg(target_os = "macos")]
use std::sync::Condvar;
#[cfg(target_os = "macos")]
use std::sync::Mutex;
#[cfg(target_os = "macos")]
use std::time::Duration;

/// AVAuthorizationStatus 对应的枚举值
/// 参考: https://developer.apple.com/documentation/avfoundation/avauthorizationstatus
#[cfg(target_os = "macos")]
#[repr(i64)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AVAuthorizationStatus {
    /// 用户尚未选择是否授权
    NotDetermined = 0,
    /// 应用无法访问媒体设备（受系统限制）
    Restricted = 1,
    /// 用户明确拒绝授权
    Denied = 2,
    /// 用户已授权
    Authorized = 3,
}

#[cfg(target_os = "macos")]
impl AVAuthorizationStatus {
    /// 从 NSInteger 转换
    pub fn from_nsinteger(value: i64) -> Self {
        match value {
            0 => AVAuthorizationStatus::NotDetermined,
            1 => AVAuthorizationStatus::Restricted,
            2 => AVAuthorizationStatus::Denied,
            3 => AVAuthorizationStatus::Authorized,
            _ => AVAuthorizationStatus::NotDetermined,
        }
    }

    /// 是否已授权
    pub fn is_authorized(&self) -> bool {
        *self == AVAuthorizationStatus::Authorized
    }
}

/// 媒体类型
#[cfg(target_os = "macos")]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AVMediaType {
    /// 视频（摄像头）
    Video,
    /// 音频（麦克风）
    Audio,
}

#[cfg(target_os = "macos")]
mod avfoundation_impl {
    use super::*;

    /// 获取 AVMediaType NSString
    /// AVMediaTypeVideo = "vide" (四字符码)
    /// AVMediaTypeAudio = "soun" (四字符码)
    ///
    /// 注意：AVMediaType 常量实际上是 CoreMedia 四字符码的字符串表示
    fn get_media_type_nsstring(media_type: AVMediaType) -> *mut Object {
        unsafe {
            let type_str = match media_type {
                // AVMediaTypeVideo 对应 "vide" (四字符码)
                AVMediaType::Video => "vide",
                // AVMediaTypeAudio 对应 "soun" (四字符码)
                AVMediaType::Audio => "soun",
            };

            // 创建 NSString 对象
            let ns_string_cls = class!(NSString);
            let c_str = match CString::new(type_str) {
                Ok(s) => s,
                Err(_) => {
                    log::error!("Failed to create CString for media type");
                    return std::ptr::null_mut();
                }
            };

            // 使用 stringWithUTF8String: 创建自动释放的 NSString
            let ns_string: *mut Object =
                msg_send![ns_string_cls, stringWithUTF8String: c_str.as_ptr()];

            if ns_string.is_null() {
                log::error!("Failed to create NSString for media type: {:?}", media_type);
            }

            ns_string
        }
    }

    /// 检查媒体设备授权状态
    ///
    /// 调用: AVCaptureDevice.authorizationStatus(for:)
    ///
    /// # 参数
    /// - `media_type`: 媒体类型（视频或音频）
    ///
    /// # 返回
    /// - AVAuthorizationStatus 枚举值
    pub fn check_authorization_status(media_type: AVMediaType) -> AVAuthorizationStatus {
        unsafe {
            let avcapture_device_cls = match Class::get("AVCaptureDevice") {
                Some(cls) => cls,
                None => {
                    log::warn!("AVCaptureDevice class not available");
                    return AVAuthorizationStatus::NotDetermined;
                }
            };

            // 获取 AVMediaType
            let media_type_nsstring = get_media_type_nsstring(media_type);

            // 检查 NSString 是否创建成功
            if media_type_nsstring.is_null() {
                log::error!("Failed to create media type NSString");
                return AVAuthorizationStatus::NotDetermined;
            }

            // 调用 authorizationStatusForMediaType:
            // + (AVAuthorizationStatus)authorizationStatusForMediaType:(AVMediaType)type;
            let status: i64 = msg_send![avcapture_device_cls, authorizationStatusForMediaType: media_type_nsstring];

            AVAuthorizationStatus::from_nsinteger(status)
        }
    }

    /// 请求媒体设备访问权限（异步）
    ///
    /// 调用: AVCaptureDevice.requestAccess(for:completionHandler:)
    ///
    /// # 参数
    /// - `media_type`: 媒体类型（视频或音频）
    /// - `timeout`: 超时时间
    ///
    /// # 返回
    /// - `true` 表示用户授权，`false` 表示用户拒绝或超时
    pub fn request_access(media_type: AVMediaType, timeout: Duration) -> bool {
        unsafe {
            let avcapture_device_cls = match Class::get("AVCaptureDevice") {
                Some(cls) => cls,
                None => {
                    log::warn!("AVCaptureDevice class not available");
                    return false;
                }
            };

            // 首先检查当前状态
            let current_status = check_authorization_status(media_type);
            match current_status {
                AVAuthorizationStatus::Authorized => return true,
                AVAuthorizationStatus::Denied | AVAuthorizationStatus::Restricted => return false,
                AVAuthorizationStatus::NotDetermined => {
                    // 继续请求权限
                }
            }

            // 使用 Condvar 等待异步回调
            let result = Arc::new((Mutex::new(None::<bool>), Condvar::new()));
            let result_clone = Arc::clone(&result);

            // 创建 completion handler block
            // Block 结构体
            #[repr(C)]
            struct BlockLiteral {
                isa: *const Class,
                flags: i32,
                reserved: i32,
                invoke: extern "C" fn(*mut BlockLiteral, BOOL),
                descriptor: *const BlockDescriptor,
                // 捕获的变量
                result_ptr: *mut Arc<(Mutex<Option<bool>>, Condvar)>,
            }

            #[repr(C)]
            struct BlockDescriptor {
                reserved: usize,
                size: usize,
                copy: Option<extern "C" fn(*mut BlockLiteral, *mut BlockLiteral)>,
                dispose: Option<extern "C" fn(*mut BlockLiteral)>,
            }

            extern "C" fn block_invoke(block: *mut BlockLiteral, granted: BOOL) {
                unsafe {
                    let result_ptr = (*block).result_ptr;
                    if !result_ptr.is_null() {
                        let arc_ref = &**result_ptr;
                        let (lock, cvar) = arc_ref;
                        let mut granted_opt = lock.lock().unwrap();
                        *granted_opt = Some(granted == YES);
                        cvar.notify_all();
                    }
                }
            }

            // 获取 Block 类
            let block_cls = match Class::get("__NSStackBlock__") {
                Some(cls) => cls as *const Class,
                None => {
                    // 回退到手动构造 isa 指针
                    // NSStackBlock 的 isa 通常指向一个全局 Block 类
                    std::ptr::null()
                }
            };

            // 静态 descriptor
            static mut DESCRIPTOR: BlockDescriptor = BlockDescriptor {
                reserved: 0,
                size: std::mem::size_of::<BlockLiteral>(),
                copy: None,
                dispose: None,
            };

            let mut result_for_block = result_clone;
            let result_ptr = &mut result_for_block as *mut _;

            let mut block = BlockLiteral {
                isa: block_cls,
                flags: 1 << 29, // BLOCK_HAS_SIGNATURE
                reserved: 0,
                invoke: block_invoke,
                descriptor: &raw const DESCRIPTOR as *const _,
                result_ptr,
            };

            // 获取 AVMediaType
            let media_type_nsstring = get_media_type_nsstring(media_type);

            // 检查 NSString 是否创建成功
            if media_type_nsstring.is_null() {
                log::error!("Failed to create media type NSString for request");
                return false;
            }

            // 调用 requestAccessForMediaType:completionHandler:
            // + (void)requestAccessForMediaType:(AVMediaType)mediaType completionHandler:(void (^)(BOOL granted))handler;
            let block_ptr = &mut block as *mut _ as *mut Object;
            let _: () = msg_send![avcapture_device_cls, requestAccessForMediaType:media_type_nsstring completionHandler:block_ptr];

            // 等待回调
            let (lock, cvar) = &*result;
            let mut granted_opt = lock.lock().unwrap();

            let result_wait = cvar.wait_timeout(granted_opt, timeout).unwrap();
            granted_opt = result_wait.0;

            match *granted_opt {
                Some(granted) => granted,
                None => {
                    log::warn!("Permission request timed out");
                    false
                }
            }
        }
    }
}

/// 检查摄像头权限状态
#[cfg(target_os = "macos")]
pub fn check_camera_authorization() -> AVAuthorizationStatus {
    avfoundation_impl::check_authorization_status(AVMediaType::Video)
}

/// 请求摄像头权限
///
/// # 返回
/// - `true` 表示用户授权，`false` 表示用户拒绝
#[cfg(target_os = "macos")]
pub fn request_camera_access() -> bool {
    // 使用 60 秒超时
    avfoundation_impl::request_access(AVMediaType::Video, Duration::from_secs(60))
}

/// 检查麦克风权限状态
#[cfg(target_os = "macos")]
pub fn check_microphone_authorization() -> AVAuthorizationStatus {
    avfoundation_impl::check_authorization_status(AVMediaType::Audio)
}

/// 请求麦克风权限
///
/// # 返回
/// - `true` 表示用户授权，`false` 表示用户拒绝
#[cfg(target_os = "macos")]
pub fn request_microphone_access() -> bool {
    // 使用 60 秒超时
    avfoundation_impl::request_access(AVMediaType::Audio, Duration::from_secs(60))
}

/// 非 macOS 平台的存根实现
#[cfg(not(target_os = "macos"))]
pub fn check_camera_authorization() -> AVAuthorizationStatus {
    AVAuthorizationStatus::Authorized
}

#[cfg(not(target_os = "macos"))]
pub fn request_camera_access() -> bool {
    true
}

#[cfg(not(target_os = "macos"))]
pub fn check_microphone_authorization() -> AVAuthorizationStatus {
    AVAuthorizationStatus::Authorized
}

#[cfg(not(target_os = "macos"))]
pub fn request_microphone_access() -> bool {
    true
}

// 非 macOS 平台需要 AVAuthorizationStatus 存根
#[cfg(not(target_os = "macos"))]
#[repr(i64)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AVAuthorizationStatus {
    NotDetermined = 0,
    Restricted = 1,
    Denied = 2,
    Authorized = 3,
}

#[cfg(not(target_os = "macos"))]
impl AVAuthorizationStatus {
    pub fn is_authorized(&self) -> bool {
        *self == AVAuthorizationStatus::Authorized
    }
}

// ========== 单元测试 ==========
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[cfg(target_os = "macos")]
    fn test_authorization_status_from_nsinteger() {
        assert_eq!(
            AVAuthorizationStatus::from_nsinteger(0),
            AVAuthorizationStatus::NotDetermined
        );
        assert_eq!(
            AVAuthorizationStatus::from_nsinteger(1),
            AVAuthorizationStatus::Restricted
        );
        assert_eq!(
            AVAuthorizationStatus::from_nsinteger(2),
            AVAuthorizationStatus::Denied
        );
        assert_eq!(
            AVAuthorizationStatus::from_nsinteger(3),
            AVAuthorizationStatus::Authorized
        );
        // 未知值默认为 NotDetermined
        assert_eq!(
            AVAuthorizationStatus::from_nsinteger(999),
            AVAuthorizationStatus::NotDetermined
        );
    }

    #[test]
    #[cfg(target_os = "macos")]
    fn test_authorization_status_is_authorized() {
        assert!(AVAuthorizationStatus::Authorized.is_authorized());
        assert!(!AVAuthorizationStatus::Denied.is_authorized());
        assert!(!AVAuthorizationStatus::NotDetermined.is_authorized());
        assert!(!AVAuthorizationStatus::Restricted.is_authorized());
    }

    #[test]
    #[cfg(target_os = "macos")]
    #[ignore = "需要真实 macOS 环境，手动运行: cargo test -- --ignored"]
    fn test_check_camera_authorization() {
        // 这个测试只验证函数可以正常调用，不验证具体结果
        // 因为结果取决于用户的实际权限设置
        let status = check_camera_authorization();
        println!("Camera authorization status: {:?}", status);
        // 确保返回值是有效的枚举值
        matches!(
            status,
            AVAuthorizationStatus::NotDetermined
                | AVAuthorizationStatus::Restricted
                | AVAuthorizationStatus::Denied
                | AVAuthorizationStatus::Authorized
        );
    }

    #[test]
    #[cfg(target_os = "macos")]
    #[ignore = "需要真实 macOS 环境，手动运行: cargo test -- --ignored"]
    fn test_check_microphone_authorization() {
        let status = check_microphone_authorization();
        println!("Microphone authorization status: {:?}", status);
        matches!(
            status,
            AVAuthorizationStatus::NotDetermined
                | AVAuthorizationStatus::Restricted
                | AVAuthorizationStatus::Denied
                | AVAuthorizationStatus::Authorized
        );
    }
}
