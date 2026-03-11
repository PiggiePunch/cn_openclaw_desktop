// 微信自动回复模块
//
// P1-3: 微信监控功能
// 通过 macOS Accessibility API 监听微信消息并支持自动回复

use std::sync::{Arc, Mutex};
use anyhow::Result;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use std::time::{Duration, Instant};
use std::collections::HashSet;

// 导入内部模块
// TODO: Phase 3c - infra 和 auto_reply 模块已删除，需要重新设计这些功能
// use crate::infra::system_events;
// use crate::auto_reply;

// ============================================================================
// 类型定义
// ============================================================================

/// 消息类型
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageType {
    /// 文本消息
    #[default]
    Text,
    /// 图片消息
    Image,
    /// 文件消息
    File,
    /// 语音消息
    Voice,
    /// 视频消息
    Video,
    /// 链接消息
    Link,
    /// 小程序消息
    MiniProgram,
    /// 红包消息
    RedPacket,
    /// 表情消息
    Sticker,
    /// 系统消息（如撤回提示）
    System,
    /// 位置消息
    Location,
    /// 未知类型
    Unknown,
}

impl std::fmt::Display for MessageType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MessageType::Text => write!(f, "文本"),
            MessageType::Image => write!(f, "图片"),
            MessageType::File => write!(f, "文件"),
            MessageType::Voice => write!(f, "语音"),
            MessageType::Video => write!(f, "视频"),
            MessageType::Link => write!(f, "链接"),
            MessageType::MiniProgram => write!(f, "小程序"),
            MessageType::RedPacket => write!(f, "红包"),
            MessageType::Sticker => write!(f, "表情"),
            MessageType::System => write!(f, "系统"),
            MessageType::Location => write!(f, "位置"),
            MessageType::Unknown => write!(f, "未知"),
        }
    }
}

/// 微信消息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeChatMessage {
    /// 消息 ID
    pub id: String,
    /// 发送者名称
    pub sender: String,
    /// 消息内容
    pub content: String,
    /// 时间戳（毫秒）
    pub timestamp: i64,
    /// 是否群消息
    pub is_group: bool,
    /// 聊天名称（群名或私聊名称）
    pub chat_name: String,
    /// 消息类型
    #[serde(default)]
    pub msg_type: MessageType,
    /// @ 的用户列表（群消息时有效）
    #[serde(default)]
    pub at_list: Vec<String>,
    /// 是否 @ 了我
    #[serde(default)]
    pub at_me: bool,
    /// 附加信息（如文件名、链接标题等）
    #[serde(default)]
    pub extra: Option<String>,
}

/// 微信监控状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeChatMonitorStatus {
    /// 是否正在监控
    pub running: bool,
    /// 已接收消息数
    pub message_count: usize,
    /// 最后一条消息时间
    pub last_message_time: Option<i64>,
    /// 微信进程是否运行
    pub wechat_running: bool,
    /// 权限状态
    pub permission_granted: bool,
    /// 错误信息
    pub error: Option<String>,
    /// 连接状态
    pub connection_status: ConnectionStatus,
    /// 错误计数
    pub error_count: usize,
    /// 重连次数
    pub reconnect_count: usize,
    /// 监控运行时长（秒）
    pub uptime_secs: Option<u64>,
    /// 最后错误时间
    pub last_error_time: Option<i64>,
}

/// 连接状态
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ConnectionStatus {
    /// 已断开
    #[default]
    Disconnected,
    /// 正在连接
    Connecting,
    /// 已连接
    Connected,
    /// 正在重连
    Reconnecting,
    /// 错误
    Error,
}

impl std::fmt::Display for ConnectionStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ConnectionStatus::Disconnected => write!(f, "已断开"),
            ConnectionStatus::Connecting => write!(f, "正在连接"),
            ConnectionStatus::Connected => write!(f, "已连接"),
            ConnectionStatus::Reconnecting => write!(f, "正在重连"),
            ConnectionStatus::Error => write!(f, "错误"),
        }
    }
}

/// 微信监控配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeChatMonitorConfig {
    /// 监控轮询间隔（毫秒）
    #[serde(default = "default_poll_interval")]
    pub poll_interval_ms: u64,
    /// 是否启用自动回复
    #[serde(default)]
    pub auto_reply_enabled: bool,
    /// 目标会话（用于系统事件）
    #[serde(default = "default_session_key")]
    pub session_key: String,
    /// 忽略的发送者列表
    #[serde(default)]
    pub ignored_senders: Vec<String>,
    /// 监控的聊天列表（空 = 全部）
    #[serde(default)]
    pub monitored_chats: Vec<String>,
    /// 重连间隔（毫秒）
    #[serde(default = "default_reconnect_interval")]
    pub reconnect_interval_ms: u64,
    /// 最大重连次数（0 = 无限）
    #[serde(default = "default_max_reconnect")]
    pub max_reconnect_attempts: usize,
    /// 消息去重窗口（毫秒）
    #[serde(default = "default_dedup_window")]
    pub dedup_window_ms: u64,
    /// 是否处理群消息
    #[serde(default = "default_true")]
    pub process_group_messages: bool,
    /// 是否处理私聊消息
    #[serde(default = "default_true")]
    pub process_private_messages: bool,
    /// 只处理 @ 我的群消息
    #[serde(default)]
    pub only_at_me: bool,
}

fn default_reconnect_interval() -> u64 {
    5000 // 5秒
}

fn default_max_reconnect() -> usize {
    10 // 最大10次，0表示无限
}

fn default_dedup_window() -> u64 {
    60000 // 1分钟去重窗口
}

fn default_true() -> bool {
    true
}

fn default_poll_interval() -> u64 {
    500 // 500ms
}

fn default_session_key() -> String {
    "main".to_string()
}

impl Default for WeChatMonitorConfig {
    fn default() -> Self {
        Self {
            poll_interval_ms: default_poll_interval(),
            auto_reply_enabled: false,
            session_key: default_session_key(),
            ignored_senders: vec![
                "微信团队".to_string(),
                "WeChat Team".to_string(),
                "微信支付".to_string(),
                "文件传输助手".to_string(),
                "File Transfer".to_string(),
            ],
            monitored_chats: vec![],
            reconnect_interval_ms: default_reconnect_interval(),
            max_reconnect_attempts: default_max_reconnect(),
            dedup_window_ms: default_dedup_window(),
            process_group_messages: true,
            process_private_messages: true,
            only_at_me: false,
        }
    }
}

// ============================================================================
// macOS Accessibility API 实现
// ============================================================================

#[cfg(target_os = "macos")]
mod accessibility {
    use std::ffi::{c_void, CStr, CString};
    use std::os::raw::c_char;

    // AXUIElement 和 AXObserver 的 FFI 绑定
    #[link(name = "ApplicationServices", kind = "framework")]
    extern "C" {
        // AXUIElement API
        pub fn AXUIElementCreateApplication(pid: i32) -> *mut c_void;
        pub fn AXUIElementCreateSystemWide() -> *mut c_void;
        pub fn AXUIElementCopyAttributeValue(
            element: *mut c_void,
            attribute: *const c_char,
            value: *mut *mut c_void,
        ) -> i32;
        pub fn AXUIElementCopyAttributeValues(
            element: *mut c_void,
            attribute: *const c_char,
            min: u32,
            max: u32,
            values: *mut *mut c_void,
        ) -> i32;
        pub fn AXUIElementGetPid(element: *mut c_void, pid: *mut i32) -> i32;
        pub fn CFRelease(cf: *const c_void);

        // AXObserver API
        pub fn AXObserverCreate(pid: i32, callback: extern "C" fn(*mut c_void, *mut c_void, *mut c_void, *mut c_void), observer: *mut *mut c_void) -> i32;
        pub fn AXObserverAddNotification(
            observer: *mut c_void,
            element: *mut c_void,
            notification: *const c_char,
            context: *mut c_void,
        ) -> i32;
        pub fn AXObserverRemoveNotification(
            observer: *mut c_void,
            element: *mut c_void,
            notification: *const c_char,
        ) -> i32;
        pub fn AXObserverGetRunLoopSource(observer: *mut c_void) -> *mut c_void;

        // 辅助功能权限
        pub fn AXIsProcessTrusted() -> bool;
        pub fn AXIsProcessTrustedWithOptions(options: *const c_void) -> bool;
    }

    // CoreFoundation 类型
    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" {
        pub fn CFStringGetLength(cf_string: *const c_void) -> usize;
        pub fn CFStringGetMaximumSizeForEncoding(length: usize, encoding: u32) -> usize;
        pub fn CFStringGetCString(cf_string: *const c_void, buffer: *mut c_char, bufferSize: usize, encoding: u32) -> bool;
        pub fn CFArrayGetCount(array: *const c_void) -> usize;
        pub fn CFArrayGetValueAtIndex(array: *const c_void, index: usize) -> *const c_void;
        pub fn CFBooleanGetValue(cf_boolean: *const c_void) -> bool;
        pub fn CFNumberGetValue(number: *const c_void, theType: u32, valuePtr: *mut c_void) -> bool;
    }

    // 常量
    pub const K_CF_STRING_ENCODING_UTF8: u32 = 0x08000100;

    // AX Attribute 名称
    pub static AX_TITLE: once_cell::sync::Lazy<CString> = once_cell::sync::Lazy::new(|| {
        CString::new("AXTitle").unwrap()
    });
    pub static AX_VALUE: once_cell::sync::Lazy<CString> = once_cell::sync::Lazy::new(|| {
        CString::new("AXValue").unwrap()
    });
    pub static AX_DESCRIPTION: once_cell::sync::Lazy<CString> = once_cell::sync::Lazy::new(|| {
        CString::new("AXDescription").unwrap()
    });
    pub static AX_CHILDREN: once_cell::sync::Lazy<CString> = once_cell::sync::Lazy::new(|| {
        CString::new("AXChildren").unwrap()
    });
    pub static AX_ROLE: once_cell::sync::Lazy<CString> = once_cell::sync::Lazy::new(|| {
        CString::new("AXRole").unwrap()
    });
    pub static AX_SUBROLE: once_cell::sync::Lazy<CString> = once_cell::sync::Lazy::new(|| {
        CString::new("AXSubrole").unwrap()
    });
    pub static AX_IDENTIFIER: once_cell::sync::Lazy<CString> = once_cell::sync::Lazy::new(|| {
        CString::new("AXIdentifier").unwrap()
    });
    pub static AX_HELP: once_cell::sync::Lazy<CString> = once_cell::sync::Lazy::new(|| {
        CString::new("AXHelp").unwrap()
    });

    // AX Notification 名称
    pub static AX_VALUE_CHANGED_NOTIFICATION: once_cell::sync::Lazy<CString> = once_cell::sync::Lazy::new(|| {
        CString::new("AXValueChangedNotification").unwrap()
    });
    pub static AX_UI_ELEMENT_DESTROYED_NOTIFICATION: once_cell::sync::Lazy<CString> = once_cell::sync::Lazy::new(|| {
        CString::new("AXUIElementDestroyedNotification").unwrap()
    });
    pub static AX_WINDOW_CREATED_NOTIFICATION: once_cell::sync::Lazy<CString> = once_cell::sync::Lazy::new(|| {
        CString::new("AXWindowCreatedNotification").unwrap()
    });
    pub static AX_FOCUSED_UI_ELEMENT_CHANGED_NOTIFICATION: once_cell::sync::Lazy<CString> = once_cell::sync::Lazy::new(|| {
        CString::new("AXFocusedUIElementChangedNotification").unwrap()
    });

    /// 检查辅助功能权限
    pub fn check_permission() -> bool {
        unsafe { AXIsProcessTrusted() }
    }

    /// 将 CFString 转换为 Rust String
    pub fn cfstring_to_string(cf_string: *const c_void) -> Option<String> {
        if cf_string.is_null() {
            return None;
        }

        unsafe {
            let length = CFStringGetLength(cf_string);
            let max_size = CFStringGetMaximumSizeForEncoding(length, K_CF_STRING_ENCODING_UTF8);

            if max_size == 0 {
                return None;
            }

            let mut buffer = vec![0i8; max_size + 1];
            if CFStringGetCString(cf_string, buffer.as_mut_ptr(), max_size + 1, K_CF_STRING_ENCODING_UTF8) {
                CStr::from_ptr(buffer.as_ptr()).to_str().ok().map(|s| s.to_string())
            } else {
                None
            }
        }
    }

    /// 获取 AXUIElement 的属性值
    pub fn get_attribute_value(element: *mut c_void, attribute: &CString) -> Option<*mut c_void> {
        if element.is_null() {
            return None;
        }

        let mut value: *mut c_void = std::ptr::null_mut();
        let result = unsafe {
            AXUIElementCopyAttributeValue(element, attribute.as_ptr(), &mut value)
        };

        if result == 0 && !value.is_null() {
            Some(value)
        } else {
            None
        }
    }

    /// 获取 AXUIElement 的字符串属性
    pub fn get_string_attribute(element: *mut c_void, attribute: &CString) -> Option<String> {
        let value = get_attribute_value(element, attribute)?;
        let result = cfstring_to_string(value);
        unsafe { CFRelease(value) };
        result
    }

    /// 获取 AXUIElement 的子元素数组
    pub fn get_children(element: *mut c_void) -> Vec<*mut c_void> {
        let children_value = match get_attribute_value(element, &AX_CHILDREN) {
            Some(v) => v,
            None => return vec![],
        };

        let count = unsafe { CFArrayGetCount(children_value) };
        let mut children = Vec::with_capacity(count);

        for i in 0..count {
            let child = unsafe { CFArrayGetValueAtIndex(children_value, i) as *mut c_void };
            if !child.is_null() {
                children.push(child);
            }
        }

        unsafe { CFRelease(children_value) };
        children
    }
}

// ============================================================================
// 非 macOS 平台的存根实现
// ============================================================================

#[cfg(not(target_os = "macos"))]
mod accessibility {
    pub fn check_permission() -> bool {
        false
    }
}

// ============================================================================
// 消息解析器
// ============================================================================

/// 消息解析器
pub struct MessageParser {
    /// 已处理的消息 ID（用于去重）
    processed_ids: Mutex<HashSet<String>>,
    /// 最后清理时间
    last_cleanup: Mutex<Instant>,
}

impl MessageParser {
    pub fn new() -> Self {
        Self {
            processed_ids: Mutex::new(HashSet::new()),
            last_cleanup: Mutex::new(Instant::now()),
        }
    }

    /// 解析原始消息文本
    pub fn parse_raw_message(&self, raw: &str, chat_name: &str) -> Option<WeChatMessage> {
        // 清理过期记录（每分钟清理一次）
        self.maybe_cleanup();

        // 跳过空消息
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            return None;
        }

        // 尝试解析消息
        let (sender, content, msg_type) = self.extract_message_parts(trimmed);

        // 生成消息 ID 用于去重
        let msg_id = self.generate_message_id(&sender, &content, chat_name);

        // 检查去重
        {
            let mut processed = self.processed_ids.lock().unwrap();
            if processed.contains(&msg_id) {
                return None;
            }
            processed.insert(msg_id.clone());
        }

        // 检测是否是群消息
        let is_group = self.detect_group_message(chat_name);

        // 解析 @ 列表
        let (at_list, at_me) = if is_group {
            self.parse_at_list(&content)
        } else {
            (Vec::new(), false)
        };

        Some(WeChatMessage {
            id: msg_id,
            sender,
            content,
            timestamp: chrono::Utc::now().timestamp_millis(),
            is_group,
            chat_name: chat_name.to_string(),
            msg_type,
            at_list,
            at_me,
            extra: None,
        })
    }

    /// 提取消息部分（发送者、内容、类型）
    fn extract_message_parts(&self, raw: &str) -> (String, String, MessageType) {
        // 检测消息类型
        let msg_type = self.detect_message_type(raw);

        // 尝试解析 "发送者: 内容" 格式
        // 支持中英文冒号
        let colon_pos = raw.find(':').or_else(|| raw.find('：'));
        if let Some(pos) = colon_pos {
            let sender = raw[..pos].trim().to_string();
            // 根据实际找到的冒号类型确定跳过的字节数
            let colon_len = if raw.as_bytes().get(pos) == Some(&b':') { 1 } else { 3 }; // ASCII冒号1字节，中文冒号3字节
            let content = raw[pos + colon_len..].trim().to_string();

            // 过滤无效发送者
            if sender.is_empty() || sender.len() > 50 {
                return ("Unknown".to_string(), raw.to_string(), msg_type);
            }

            return (sender, content, msg_type);
        }

        // 无法解析发送者，可能是系统消息或特殊格式
        ("Unknown".to_string(), raw.to_string(), msg_type)
    }

    /// 检测消息类型
    fn detect_message_type(&self, content: &str) -> MessageType {
        let lower = content.to_lowercase();

        // 图片
        if lower.contains("[图片]") || lower.contains("[image]") || lower.contains("图片") {
            return MessageType::Image;
        }

        // 文件
        if lower.contains("[文件]") || lower.contains("[file]") ||
           lower.ends_with(".pdf") || lower.ends_with(".doc") ||
           lower.ends_with(".docx") || lower.ends_with(".xls") ||
           lower.ends_with(".xlsx") || lower.ends_with(".zip") ||
           lower.ends_with(".rar") {
            return MessageType::File;
        }

        // 语音
        if lower.contains("[语音]") || lower.contains("[voice]") {
            return MessageType::Voice;
        }

        // 视频
        if lower.contains("[视频]") || lower.contains("[video]") {
            return MessageType::Video;
        }

        // 链接
        if lower.contains("http://") || lower.contains("https://") ||
           lower.contains("www.") || lower.contains("[链接]") {
            return MessageType::Link;
        }

        // 小程序
        if lower.contains("[小程序]") || lower.contains("小程序") {
            return MessageType::MiniProgram;
        }

        // 红包
        if lower.contains("[红包]") || lower.contains("红包") {
            return MessageType::RedPacket;
        }

        // 表情
        if lower.starts_with('[') && lower.ends_with(']') &&
           (lower.contains("表情") || lower.contains("sticker")) {
            return MessageType::Sticker;
        }

        // 位置
        if lower.contains("[位置]") || lower.contains("位置:") || lower.contains("我在") {
            return MessageType::Location;
        }

        // 系统消息
        if lower.contains("撤回了一条消息") || lower.contains("recall") ||
           lower.contains("邀请了") || lower.contains("修改群名为") {
            return MessageType::System;
        }

        MessageType::Text
    }

    /// 检测是否是群消息
    fn detect_group_message(&self, chat_name: &str) -> bool {
        // 中文群名检测
        if chat_name.contains("群") {
            return true;
        }

        // 英文群名检测
        let lower = chat_name.to_lowercase();
        if lower.contains("group") || lower.contains("chat room") {
            return true;
        }

        // 特殊标记
        if chat_name.starts_with('#') || chat_name.starts_with('@') {
            return true;
        }

        false
    }

    /// 解析 @ 列表
    fn parse_at_list(&self, content: &str) -> (Vec<String>, bool) {
        let mut at_list = Vec::new();
        let mut at_me = false;

        // 匹配 @用户名 格式
        let re = regex::Regex::new(r"@([^\s@]+)").unwrap();
        for cap in re.captures_iter(content) {
            if let Some(name) = cap.get(1) {
                let name = name.as_str().to_string();
                // 检测是否 @ 所有人 或 @ 我
                if name == "所有人" || name == "all" {
                    at_me = true;
                }
                at_list.push(name);
            }
        }

        // 检测特殊 @ 标记
        if content.contains("@我") || content.contains("@你") {
            at_me = true;
        }

        (at_list, at_me)
    }

    /// 生成消息 ID
    fn generate_message_id(&self, sender: &str, content: &str, chat_name: &str) -> String {
        // 使用简化的内容 hash 作为 ID 的一部分
        let content_hash = {
            let mut hash: u64 = 0;
            for c in content.chars().take(100) {
                hash = hash.wrapping_mul(31).wrapping_add(c as u64);
            }
            hash
        };
        format!("{}:{}:{:016x}:{}", chat_name, sender, content_hash, chrono::Utc::now().timestamp() / 60)
    }

    /// 定期清理过期记录
    fn maybe_cleanup(&self) {
        let mut last_cleanup = self.last_cleanup.lock().unwrap();
        if last_cleanup.elapsed() > Duration::from_secs(60) {
            *last_cleanup = Instant::now();
            drop(last_cleanup);

            // 清理所有记录（简化实现，实际可以用时间窗口）
            let mut processed = self.processed_ids.lock().unwrap();
            processed.clear();
        }
    }

    /// 检查消息是否已处理
    pub fn is_processed(&self, msg_id: &str) -> bool {
        let processed = self.processed_ids.lock().unwrap();
        processed.contains(msg_id)
    }

    /// 重置解析器状态
    pub fn reset(&self) {
        let mut processed = self.processed_ids.lock().unwrap();
        processed.clear();
    }
}

impl Default for MessageParser {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// 微信监控器
// ============================================================================

/// 监控器内部状态
#[derive(Clone)]
struct MonitorState {
    /// 连接状态
    connection_status: ConnectionStatus,
    /// 错误计数
    error_count: usize,
    /// 重连次数
    reconnect_count: usize,
    /// 启动时间
    start_time: Option<Instant>,
    /// 最后错误时间
    last_error_time: Option<i64>,
    /// 最后错误信息
    last_error: Option<String>,
}

impl Default for MonitorState {
    fn default() -> Self {
        Self {
            connection_status: ConnectionStatus::Disconnected,
            error_count: 0,
            reconnect_count: 0,
            start_time: None,
            last_error_time: None,
            last_error: None,
        }
    }
}

/// 微信监控器
pub struct WeChatMonitor {
    /// 监控配置
    config: RwLock<WeChatMonitorConfig>,
    /// 是否正在监控
    running: Arc<RwLock<bool>>,
    /// 消息列表
    messages: Arc<Mutex<Vec<WeChatMessage>>>,
    /// 停止信号发送端
    stop_tx: RwLock<Option<tokio::sync::mpsc::Sender<()>>>,
    /// 微信进程 PID
    wechat_pid: RwLock<Option<i32>>,
    /// 最后检查时间
    last_check: RwLock<Option<Instant>>,
    /// 消息解析器
    parser: Arc<MessageParser>,
    /// 监控状态
    state: RwLock<MonitorState>,
}

impl WeChatMonitor {
    /// 创建新的微信监控器
    pub fn new() -> Self {
        Self {
            config: RwLock::new(WeChatMonitorConfig::default()),
            running: Arc::new(RwLock::new(false)),
            messages: Arc::new(Mutex::new(Vec::new())),
            stop_tx: RwLock::new(None),
            wechat_pid: RwLock::new(None),
            last_check: RwLock::new(None),
            parser: Arc::new(MessageParser::new()),
            state: RwLock::new(MonitorState::default()),
        }
    }

    /// 使用自定义配置创建
    pub fn with_config(config: WeChatMonitorConfig) -> Self {
        Self {
            config: RwLock::new(config),
            running: Arc::new(RwLock::new(false)),
            messages: Arc::new(Mutex::new(Vec::new())),
            stop_tx: RwLock::new(None),
            wechat_pid: RwLock::new(None),
            last_check: RwLock::new(None),
            parser: Arc::new(MessageParser::new()),
            state: RwLock::new(MonitorState::default()),
        }
    }

    /// 更新配置
    pub async fn update_config(&self, config: WeChatMonitorConfig) {
        *self.config.write().await = config;
    }

    /// 获取当前配置
    pub async fn get_config(&self) -> WeChatMonitorConfig {
        self.config.read().await.clone()
    }

    /// 检查辅助功能权限
    #[cfg(target_os = "macos")]
    pub fn check_permission() -> bool {
        accessibility::check_permission()
    }

    #[cfg(not(target_os = "macos"))]
    pub fn check_permission() -> bool {
        log::warn!("[WeChat] 非 macOS 平台不支持 Accessibility API");
        false
    }

    /// 查找微信进程 PID
    #[cfg(target_os = "macos")]
    fn find_wechat_process() -> Option<i32> {
        use sysinfo::System;
        let mut sys = System::new();
        sys.refresh_processes();

        for (pid, process) in sys.processes() {
            let name = process.name();
            // 微信进程名称可能是 "WeChat" 或 "wechat"
            if name.to_lowercase().contains("wechat") {
                // 排除 wechatdesktop 等
                if !name.to_lowercase().contains("desktop") {
                    return Some(pid.as_u32() as i32);
                }
            }
        }
        None
    }

    #[cfg(not(target_os = "macos"))]
    fn find_wechat_process() -> Option<i32> {
        None
    }

    /// 检查微信是否运行
    pub async fn is_wechat_running(&self) -> bool {
        Self::find_wechat_process().is_some()
    }

    /// 开始监控微信
    pub async fn start_monitoring(&self) -> Result<WeChatMonitorStatus> {
        let mut running = self.running.write().await;

        if *running {
            return Ok(self.get_status().await);
        }

        // 检查权限
        #[cfg(target_os = "macos")]
        {
            if !Self::check_permission() {
                let status = WeChatMonitorStatus {
                    running: false,
                    message_count: 0,
                    last_message_time: None,
                    wechat_running: false,
                    permission_granted: false,
                    error: Some("需要辅助功能权限，请在系统设置 > 隐私与安全性 > 辅助功能中授权".to_string()),
                    connection_status: ConnectionStatus::Error,
                    error_count: 0,
                    reconnect_count: 0,
                    uptime_secs: None,
                    last_error_time: None,
                };
                return Ok(status);
            }
        }

        // 查找微信进程
        let pid = Self::find_wechat_process();
        if pid.is_none() {
            let status = WeChatMonitorStatus {
                running: false,
                message_count: 0,
                last_message_time: None,
                wechat_running: false,
                permission_granted: true,
                error: Some("微信未运行，请先打开微信".to_string()),
                connection_status: ConnectionStatus::Disconnected,
                error_count: 0,
                reconnect_count: 0,
                uptime_secs: None,
                last_error_time: None,
            };
            return Ok(status);
        }

        *self.wechat_pid.write().await = pid;
        *running = true;

        // 初始化状态
        {
            let mut state = self.state.write().await;
            state.connection_status = ConnectionStatus::Connecting;
            state.start_time = Some(Instant::now());
            state.reconnect_count = 0;
            state.error_count = 0;
        }

        drop(running);

        // 创建停止通道
        let (stop_tx, mut stop_rx) = tokio::sync::mpsc::channel::<()>(1);
        *self.stop_tx.write().await = Some(stop_tx);

        let config = self.config.read().await.clone();
        let running_flag = self.running.clone();
        let messages = self.messages.clone();
        let wechat_pid = pid.unwrap();
        let parser = self.parser.clone();
        let state = Arc::new(RwLock::new(MonitorState::default()));
        *state.write().await = self.state.read().await.clone();

        log::info!("[WeChat] 开始监控微信，PID: {}", wechat_pid);

        // 启动监控线程
        // 使用 std::thread 因为 AXUIElement 不是 Send
        std::thread::spawn(move || {
            #[cfg(target_os = "macos")]
            {
                // 创建 tokio runtime 在这个线程中
                let rt = tokio::runtime::Builder::new_current_thread()
                    .enable_all()
                    .build()
                    .expect("Failed to create tokio runtime");

                rt.block_on(async {
                    Self::run_monitor_loop_with_reconnect(
                        wechat_pid,
                        config,
                        running_flag,
                        messages,
                        stop_rx,
                        parser,
                        state,
                    ).await;
                });
            }

            #[cfg(not(target_os = "macos"))]
            {
                log::warn!("[WeChat] 非 macOS 平台不支持监控");
                let _ = (config, running_flag, messages, stop_rx, parser, state);
            }
        });

        // 更新连接状态
        {
            let mut state = self.state.write().await;
            state.connection_status = ConnectionStatus::Connected;
        }

        Ok(self.get_status().await)
    }

    /// 带重连机制的监控循环
    #[cfg(target_os = "macos")]
    async fn run_monitor_loop_with_reconnect(
        wechat_pid: i32,
        config: WeChatMonitorConfig,
        running_flag: Arc<RwLock<bool>>,
        messages: Arc<Mutex<Vec<WeChatMessage>>>,
        mut stop_rx: tokio::sync::mpsc::Receiver<()>,
        parser: Arc<MessageParser>,
        state: Arc<RwLock<MonitorState>>,
    ) {
        let mut current_pid = wechat_pid;
        let mut reconnect_attempts = 0;

        loop {
            // 检查是否应该停止
            if !*running_flag.read().await {
                break;
            }

            // 更新连接状态
            {
                let mut s = state.write().await;
                s.connection_status = ConnectionStatus::Connected;
            }

            // 运行监控循环
            let result = Self::run_single_monitor_session(
                current_pid,
                &config,
                &running_flag,
                &messages,
                &mut stop_rx,
                &parser,
                &state,
            ).await;

            match result {
                Ok(should_stop) => {
                    if should_stop {
                        break;
                    }
                    // 正常断开，尝试重连
                }
                Err(e) => {
                    log::error!("[WeChat] 监控错误: {}", e);
                    {
                        let mut s = state.write().await;
                        s.error_count += 1;
                        s.last_error = Some(e.to_string());
                        s.last_error_time = Some(chrono::Utc::now().timestamp_millis());
                    }
                }
            }

            // 检查是否应该停止
            if !*running_flag.read().await {
                break;
            }

            // 检查重连限制
            if config.max_reconnect_attempts > 0 && reconnect_attempts >= config.max_reconnect_attempts {
                log::error!("[WeChat] 达到最大重连次数 {}，停止监控", reconnect_attempts);
                {
                    let mut s = state.write().await;
                    s.connection_status = ConnectionStatus::Error;
                    s.last_error = Some("达到最大重连次数".to_string());
                }
                break;
            }

            // 更新重连状态
            reconnect_attempts += 1;
            {
                let mut s = state.write().await;
                s.connection_status = ConnectionStatus::Reconnecting;
                s.reconnect_count += 1;
            }

            log::info!("[WeChat] 等待 {}ms 后尝试重连 (第 {} 次)...",
                config.reconnect_interval_ms, reconnect_attempts);

            // 等待重连间隔
            tokio::select! {
                _ = stop_rx.recv() => {
                    log::info!("[WeChat] 收到停止信号，取消重连");
                    break;
                }
                _ = tokio::time::sleep(Duration::from_millis(config.reconnect_interval_ms)) => {
                    // 查找新的微信进程
                    if let Some(new_pid) = Self::find_wechat_process() {
                        if new_pid != current_pid {
                            log::info!("[WeChat] 检测到新的微信进程，PID: {}", new_pid);
                            current_pid = new_pid;
                        }
                    } else {
                        log::warn!("[WeChat] 微信进程未运行，继续等待...");
                    }
                }
            }
        }

        // 更新最终状态
        {
            let mut s = state.write().await;
            s.connection_status = ConnectionStatus::Disconnected;
        }

        log::info!("[WeChat] 监控循环已停止");
    }

    /// 单次监控会话
    #[cfg(target_os = "macos")]
    async fn run_single_monitor_session(
        wechat_pid: i32,
        config: &WeChatMonitorConfig,
        running_flag: &Arc<RwLock<bool>>,
        messages: &Arc<Mutex<Vec<WeChatMessage>>>,
        stop_rx: &mut tokio::sync::mpsc::Receiver<()>,
        parser: &Arc<MessageParser>,
        state: &Arc<RwLock<MonitorState>>,
    ) -> Result<bool> {
        use accessibility::*;

        // 创建 AXUIElement
        let app_element = unsafe { AXUIElementCreateApplication(wechat_pid) };
        if app_element.is_null() {
            return Err(anyhow::anyhow!("无法创建 AXUIElement"));
        }

        // 记录上一次的消息内容（用于检测新消息）
        let mut last_messages: std::collections::HashMap<String, String> = std::collections::HashMap::new();

        log::info!("[WeChat] 监控会话已启动");

        loop {
            // 检查是否应该停止
            if !*running_flag.read().await {
                unsafe { CFRelease(app_element) };
                return Ok(true);
            }

            // 轮询检查消息
            match Self::poll_messages(app_element, config, messages, &mut last_messages, parser) {
                Ok(_) => {}
                Err(e) => {
                    // 检查是否是微信进程退出的错误
                    if Self::is_connection_error(&e) {
                        log::warn!("[WeChat] 连接丢失: {}", e);
                        unsafe { CFRelease(app_element) };
                        return Ok(false);
                    }
                    log::warn!("[WeChat] 轮询错误: {}", e);
                }
            }

            // 等待下一次轮询或停止信号
            tokio::select! {
                _ = stop_rx.recv() => {
                    log::info!("[WeChat] 收到停止信号");
                    unsafe { CFRelease(app_element) };
                    return Ok(true);
                }
                _ = tokio::time::sleep(Duration::from_millis(config.poll_interval_ms)) => {
                    // 继续下一次轮询
                }
            }
        }
    }

    /// 检查是否是连接错误
    #[cfg(target_os = "macos")]
    fn is_connection_error(error: &anyhow::Error) -> bool {
        let msg = error.to_string().to_lowercase();
        msg.contains("invalid") || msg.contains("timeout") || msg.contains("connection")
    }

    #[cfg(not(target_os = "macos"))]
    fn is_connection_error(_error: &anyhow::Error) -> bool {
        false
    }

    /// 轮询消息
    #[cfg(target_os = "macos")]
    fn poll_messages(
        app_element: *mut std::ffi::c_void,
        config: &WeChatMonitorConfig,
        messages: &Arc<Mutex<Vec<WeChatMessage>>>,
        last_messages: &mut std::collections::HashMap<String, String>,
        parser: &Arc<MessageParser>,
    ) -> Result<()> {
        use accessibility::*;

        // 获取所有窗口
        let windows = get_children(app_element);

        for window in windows {
            // 获取窗口标题（通常是聊天名称）
            let chat_name = get_string_attribute(window, &AX_TITLE).unwrap_or_default();

            // 跳过不在监控列表中的聊天
            if !config.monitored_chats.is_empty() && !config.monitored_chats.contains(&chat_name) {
                continue;
            }

            // 在窗口中查找消息列表
            Self::find_messages_in_element(window, &chat_name, config, messages, last_messages, parser);
        }

        Ok(())
    }

    /// 在元素树中查找消息
    #[cfg(target_os = "macos")]
    fn find_messages_in_element(
        element: *mut std::ffi::c_void,
        chat_name: &str,
        config: &WeChatMonitorConfig,
        messages: &Arc<Mutex<Vec<WeChatMessage>>>,
        last_messages: &mut std::collections::HashMap<String, String>,
        parser: &Arc<MessageParser>,
    ) {
        use accessibility::*;

        // 获取元素角色
        let role = get_string_attribute(element, &AX_ROLE).unwrap_or_default();

        // 检查是否是消息相关的元素
        // 微信的消息通常在 AXTable 或 AXList 中
        if role == "AXTable" || role == "AXList" || role == "AXOutline" {
            // 获取子元素（消息行）
            let children = get_children(element);

            for child in children {
                // 尝试获取消息内容
                if let Some(raw_content) = get_string_attribute(child, &AX_VALUE)
                    .or_else(|| get_string_attribute(child, &AX_DESCRIPTION))
                    .or_else(|| get_string_attribute(child, &AX_TITLE))
                {
                    // 检查是否是新消息（基于原始内容去重）
                    if last_messages.get(chat_name) == Some(&raw_content) {
                        continue;
                    }

                    // 更新最后消息
                    last_messages.insert(chat_name.to_string(), raw_content.clone());

                    // 使用解析器解析消息
                    if let Some(message) = parser.parse_raw_message(&raw_content, chat_name) {
                        // 跳过忽略的发送者
                        if config.ignored_senders.contains(&message.sender) {
                            continue;
                        }

                        // 检查是否处理群消息
                        if message.is_group && !config.process_group_messages {
                            continue;
                        }

                        // 检查是否处理私聊消息
                        if !message.is_group && !config.process_private_messages {
                            continue;
                        }

                        // 检查是否只处理 @ 我的群消息
                        if config.only_at_me && message.is_group && !message.at_me {
                            continue;
                        }

                        log::info!(
                            "[WeChat] 收到新消息 [{}] {} - {}: {}",
                            message.msg_type,
                            message.chat_name,
                            message.sender,
                            message.content
                        );

                        // 保存消息
                        {
                            let mut msgs = messages.lock().unwrap();
                            // 限制消息数量
                            if msgs.len() > 1000 {
                                msgs.remove(0);
                            }
                            msgs.push(message.clone());
                        }

                        // 触发系统事件
                        let session_key = config.session_key.clone();
                        let event_text = if message.is_group {
                            format!(
                                "微信群消息 [{}] {}: {}",
                                message.chat_name,
                                message.sender,
                                message.content
                            )
                        } else {
                            format!(
                                "微信消息 [{}] {}",
                                message.sender,
                                message.content
                            )
                        };

                        // TODO: Phase 3c - system_events 模块已删除，需要重新设计
                        // tokio::spawn(async move {
                        //     system_events::enqueue_system_event(
                        //         &event_text,
                        //         &session_key,
                        //         Some("wechat:incoming"),
                        //     ).await;
                        // });
                        log::info!("[WeChat] {}", event_text);

                        // TODO: Phase 3c - auto_reply 模块已删除，需要重新设计
                        // 如果启用自动回复，触发处理
                        // if config.auto_reply_enabled {
                        //     let msg_for_reply = message.clone();
                        //     tokio::spawn(async move {
                        //         if let Some(manager) = auto_reply::get_auto_reply_manager().await {
                        //             ...
                        //         }
                        //     });
                        // }
                    }
                }
            }
        }

        // 递归搜索子元素
        let children = get_children(element);
        for child in children {
            Self::find_messages_in_element(child, chat_name, config, messages, last_messages, parser);
        }
    }

    /// 停止监控
    pub async fn stop_monitoring(&self) -> Result<()> {
        let mut running = self.running.write().await;
        if !*running {
            return Ok(());
        }

        *running = false;

        // 发送停止信号
        if let Some(tx) = self.stop_tx.write().await.take() {
            let _ = tx.send(()).await;
        }

        log::info!("[WeChat] 监控已停止");
        Ok(())
    }

    /// 获取状态
    pub async fn get_status(&self) -> WeChatMonitorStatus {
        // 先获取消息信息，避免 MutexGuard 跨 await
        let (message_count, last_message_time) = {
            let messages = self.messages.lock().unwrap();
            (messages.len(), messages.last().map(|m| m.timestamp))
        };

        let running = *self.running.read().await;
        let wechat_running = Self::find_wechat_process().is_some();

        // 获取内部状态
        let state = self.state.read().await;
        let uptime_secs = state.start_time.map(|t| t.elapsed().as_secs());

        WeChatMonitorStatus {
            running,
            message_count,
            last_message_time,
            wechat_running,
            permission_granted: Self::check_permission(),
            error: state.last_error.clone(),
            connection_status: state.connection_status,
            error_count: state.error_count,
            reconnect_count: state.reconnect_count,
            uptime_secs,
            last_error_time: state.last_error_time,
        }
    }

    /// 获取消息列表
    pub fn get_messages(&self) -> Vec<WeChatMessage> {
        self.messages.lock().unwrap().clone()
    }

    /// 清空消息列表
    pub fn clear_messages(&self) {
        self.messages.lock().unwrap().clear();
    }
}

impl Default for WeChatMonitor {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// 微信管理器（高层接口）
// ============================================================================

/// 微信管理器
pub struct WeChatManager {
    /// 监控器
    monitor: WeChatMonitor,
    /// 自动回复启用状态
    auto_reply_enabled: Arc<RwLock<bool>>,
}

impl WeChatManager {
    pub fn new() -> Self {
        Self {
            monitor: WeChatMonitor::new(),
            auto_reply_enabled: Arc::new(RwLock::new(false)),
        }
    }

    /// 检查辅助功能权限
    pub fn check_permission() -> bool {
        WeChatMonitor::check_permission()
    }

    /// 开始监控
    pub fn start_monitoring(&self) -> impl std::future::Future<Output = Result<WeChatMonitorStatus>> + Send {
        let monitor = self.monitor.clone();
        async move {
            monitor.start_monitoring().await
        }
    }

    /// 停止监控
    pub fn stop_monitoring(&self) -> impl std::future::Future<Output = Result<()>> + Send {
        let monitor = self.monitor.clone();
        async move {
            monitor.stop_monitoring().await
        }
    }

    /// 获取状态
    pub fn get_status(&self) -> impl std::future::Future<Output = WeChatMonitorStatus> + Send {
        let monitor = self.monitor.clone();
        async move {
            monitor.get_status().await
        }
    }

    /// 处理接收到的消息（自动回复集成入口）
    ///
    /// 此方法检查消息是否需要自动回复，并返回匹配的回复内容
    ///
    /// # 参数
    /// - `msg`: 微信消息
    ///
    /// # 返回
    /// 如果匹配到自动回复规则，返回 Some(回复内容)，否则返回 None
    ///
    /// TODO: Phase 3c - auto_reply 模块已删除，需要重新设计
    pub async fn process_incoming_message(&self, msg: &WeChatMessage) -> Option<String> {
        // 检查是否启用自动回复
        if !*self.auto_reply_enabled.read().await {
            return None;
        }

        // TODO: Phase 3c - auto_reply 模块已删除，需要重新实现
        log::warn!("[WeChat] 自动回复功能暂不可用（auto_reply 模块已删除）");
        None

        // 原实现（已注释）
        // let manager = auto_reply::get_auto_reply_manager().await?;
        // let mut metadata = std::collections::HashMap::new();
        // metadata.insert("msg_type".to_string(), msg.msg_type.to_string());
        // ...
        // let result = manager.process(&ctx).await;
        // if result.matched { result.response } else { None }
    }

    /// 批量处理消息
    ///
    /// 处理所有未读消息并返回所有需要回复的内容
    pub async fn process_all_messages(&self) -> Vec<(WeChatMessage, String)> {
        let messages = self.get_messages();
        let mut results = Vec::new();

        for msg in messages {
            if let Some(reply) = self.process_incoming_message(&msg).await {
                results.push((msg, reply));
            }
        }

        results
    }

    /// 发送微信消息
    ///
    /// 通过模拟键盘输入发送消息
    pub async fn send_message(&self, chat_name: &str, content: &str) -> Result<()> {
        #[cfg(target_os = "macos")]
        {
            self.send_message_macos(chat_name, content).await
        }

        #[cfg(not(target_os = "macos"))]
        {
            log::warn!("[WeChat] 非 macOS 平台暂不支持发送消息");
            Err(anyhow::anyhow!("不支持的平台"))
        }
    }

    /// macOS 平台发送消息
    #[cfg(target_os = "macos")]
    async fn send_message_macos(&self, chat_name: &str, content: &str) -> Result<()> {
        use accessibility::*;

        // 检查权限
        if !Self::check_permission() {
            return Err(anyhow::anyhow!("需要辅助功能权限"));
        }

        // 查找微信进程
        let pid = WeChatMonitor::find_wechat_process()
            .ok_or_else(|| anyhow::anyhow!("微信未运行"))?;

        // 创建 AXUIElement
        let app_element = unsafe { AXUIElementCreateApplication(pid) };
        if app_element.is_null() {
            return Err(anyhow::anyhow!("无法创建 AXUIElement"));
        }

        // 查找目标聊天窗口
        let windows = get_children(app_element);
        let mut target_window: Option<*mut std::ffi::c_void> = None;

        for window in windows {
            if let Some(title) = get_string_attribute(window, &AX_TITLE) {
                if title.contains(chat_name) {
                    target_window = Some(window);
                    break;
                }
            }
        }

        unsafe { CFRelease(app_element) };

        let window = target_window
            .ok_or_else(|| anyhow::anyhow!("未找到聊天窗口: {}", chat_name))?;

        // 激活窗口（通过 Cmd+Tab 或点击）
        // 这里使用 AppleScript 来激活微信并切换到指定聊天
        let script = r#"
            tell application "WeChat"
                activate
            end tell
            "#.to_string();

        // 执行 AppleScript
        let output = tokio::process::Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .output()
            .await;

        if output.is_err() {
            log::warn!("[WeChat] 激活微信失败");
        }

        // 等待窗口激活
        tokio::time::sleep(Duration::from_millis(500)).await;

        // 使用剪贴板粘贴方式发送消息（更可靠）
        // 1. 复制内容到剪贴板
        let copy_script = format!(
            r#"
            set the clipboard to "{}"
            "#,
            content.replace('"', r#"\""#)
        );

        let _ = tokio::process::Command::new("osascript")
            .arg("-e")
            .arg(&copy_script)
            .output()
            .await;

        // 2. 模拟 Cmd+V 粘贴
        let paste_script = r#"
            tell application "System Events"
                keystroke "v" using command down
            end tell
        "#;

        let _ = tokio::process::Command::new("osascript")
            .arg("-e")
            .arg(paste_script)
            .output()
            .await;

        // 3. 等待粘贴完成
        tokio::time::sleep(Duration::from_millis(200)).await;

        // 4. 模拟回车发送
        let enter_script = r#"
            tell application "System Events"
                keystroke return
            end tell
        "#;

        let _ = tokio::process::Command::new("osascript")
            .arg("-e")
            .arg(enter_script)
            .output()
            .await;

        log::info!("[WeChat] 消息已发送到 {}: {}", chat_name, content);

        Ok(())
    }

    /// 获取消息列表
    pub fn get_messages(&self) -> Vec<WeChatMessage> {
        self.monitor.get_messages()
    }

    /// 设置自动回复
    pub async fn set_auto_reply(&self, enabled: bool) {
        *self.auto_reply_enabled.write().await = enabled;

        // 更新监控配置
        let mut config = self.monitor.get_config().await;
        config.auto_reply_enabled = enabled;
        self.monitor.update_config(config).await;

        log::info!("[WeChat] 自动回复已{}", if enabled { "启用" } else { "禁用" });
    }

    /// 获取自动回复状态
    pub async fn is_auto_reply_enabled(&self) -> bool {
        *self.auto_reply_enabled.read().await
    }

    /// 清空消息列表
    pub fn clear_messages(&self) {
        self.monitor.clear_messages();
    }
}

impl Clone for WeChatMonitor {
    fn clone(&self) -> Self {
        // 使用 try_read 避免在异步运行时中阻塞
        // 如果无法获取锁，使用默认值
        let config = self.config.try_read()
            .map(|c| c.clone())
            .unwrap_or_default();
        let wechat_pid = self.wechat_pid.try_read()
            .map(|p| *p)
            .unwrap_or(None);
        let last_check = self.last_check.try_read()
            .map(|l| *l)
            .unwrap_or(None);
        let state = self.state.try_read()
            .map(|s| s.clone())
            .unwrap_or_default();

        Self {
            config: RwLock::new(config),
            running: self.running.clone(),
            messages: self.messages.clone(),
            stop_tx: RwLock::new(None),
            wechat_pid: RwLock::new(wechat_pid),
            last_check: RwLock::new(last_check),
            parser: self.parser.clone(),
            state: RwLock::new(state),
        }
    }
}

impl Default for WeChatManager {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// 全局管理器
// ============================================================================

use once_cell::sync::Lazy;

static WECHAT_MANAGER: Lazy<Arc<RwLock<WeChatManager>>> = Lazy::new(|| {
    Arc::new(RwLock::new(WeChatManager::new()))
});

/// 获取全局微信管理器
pub fn get_wechat_manager() -> Arc<RwLock<WeChatManager>> {
    WECHAT_MANAGER.clone()
}

// ============================================================================
// 测试
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // -------------------------------------------------------------------------
    // 消息解析测试
    // -------------------------------------------------------------------------

    #[test]
    fn test_message_parser_text_message() {
        let parser = MessageParser::new();
        let raw = "张三: 你好，最近怎么样？";
        let msg = parser.parse_raw_message(raw, "张三").unwrap();

        assert_eq!(msg.sender, "张三");
        assert_eq!(msg.content, "你好，最近怎么样？");
        assert_eq!(msg.msg_type, MessageType::Text);
        assert!(!msg.is_group);
    }

    #[test]
    fn test_message_parser_chinese_colon() {
        let parser = MessageParser::new();
        let raw = "李四：这是中文冒号";
        let msg = parser.parse_raw_message(raw, "李四").unwrap();

        assert_eq!(msg.sender, "李四");
        assert_eq!(msg.content, "这是中文冒号");
    }

    #[test]
    fn test_message_parser_image_message() {
        let parser = MessageParser::new();
        let raw = "王五: [图片]";
        let msg = parser.parse_raw_message(raw, "测试群").unwrap();

        assert_eq!(msg.msg_type, MessageType::Image);
    }

    #[test]
    fn test_message_parser_file_message() {
        let parser = MessageParser::new();
        let raw = "赵六: [文件] report.pdf";
        let msg = parser.parse_raw_message(raw, "工作群").unwrap();

        assert_eq!(msg.msg_type, MessageType::File);
    }

    #[test]
    fn test_message_parser_voice_message() {
        let parser = MessageParser::new();
        let raw = "小明: [语音] 5\"";
        let msg = parser.parse_raw_message(raw, "小明").unwrap();

        assert_eq!(msg.msg_type, MessageType::Voice);
    }

    #[test]
    fn test_message_parser_video_message() {
        let parser = MessageParser::new();
        let raw = "小红: [视频]";
        let msg = parser.parse_raw_message(raw, "小红").unwrap();

        assert_eq!(msg.msg_type, MessageType::Video);
    }

    #[test]
    fn test_message_parser_link_message() {
        let parser = MessageParser::new();
        let raw = "小刚: https://example.com/article";
        let msg = parser.parse_raw_message(raw, "小刚").unwrap();

        assert_eq!(msg.msg_type, MessageType::Link);
    }

    #[test]
    fn test_message_parser_red_packet() {
        let parser = MessageParser::new();
        let raw = "老板: [红包] 恭喜发财";
        let msg = parser.parse_raw_message(raw, "工作群").unwrap();

        assert_eq!(msg.msg_type, MessageType::RedPacket);
    }

    #[test]
    fn test_message_parser_location() {
        let parser = MessageParser::new();
        let raw = "朋友: [位置] 北京市朝阳区";
        let msg = parser.parse_raw_message(raw, "朋友").unwrap();

        assert_eq!(msg.msg_type, MessageType::Location);
    }

    #[test]
    fn test_message_parser_system_message() {
        let parser = MessageParser::new();
        let raw = "小王 撤回了一条消息";
        let msg = parser.parse_raw_message(raw, "群聊").unwrap();

        assert_eq!(msg.msg_type, MessageType::System);
    }

    // -------------------------------------------------------------------------
    // 群消息检测测试
    // -------------------------------------------------------------------------

    #[test]
    fn test_message_parser_group_detection_chinese() {
        let parser = MessageParser::new();

        let msg = parser.parse_raw_message("测试: 内容", "工作群").unwrap();
        assert!(msg.is_group);

        let msg = parser.parse_raw_message("测试: 内容", "家人群").unwrap();
        assert!(msg.is_group);
    }

    #[test]
    fn test_message_parser_group_detection_english() {
        let parser = MessageParser::new();

        let msg = parser.parse_raw_message("Test: content", "Work Group").unwrap();
        assert!(msg.is_group);

        let msg = parser.parse_raw_message("Test: content", "Chat Room").unwrap();
        assert!(msg.is_group);
    }

    #[test]
    fn test_message_parser_private_message() {
        let parser = MessageParser::new();

        let msg = parser.parse_raw_message("张三: 内容", "张三").unwrap();
        assert!(!msg.is_group);

        let msg = parser.parse_raw_message("李四: 内容", "我的朋友").unwrap();
        assert!(!msg.is_group);
    }

    // -------------------------------------------------------------------------
    // @ 解析测试
    // -------------------------------------------------------------------------

    #[test]
    fn test_message_parser_at_list() {
        let parser = MessageParser::new();
        let raw = "张三: @李四 @王五 大家好";
        let msg = parser.parse_raw_message(raw, "工作群").unwrap();

        assert!(msg.at_list.contains(&"李四".to_string()));
        assert!(msg.at_list.contains(&"王五".to_string()));
    }

    #[test]
    fn test_message_parser_at_me_all() {
        let parser = MessageParser::new();
        let raw = "管理员: @所有人 重要通知";
        let msg = parser.parse_raw_message(raw, "工作群").unwrap();

        assert!(msg.at_me);
    }

    #[test]
    fn test_message_parser_at_me_special() {
        let parser = MessageParser::new();
        let raw = "张三: @我 请回复";
        let msg = parser.parse_raw_message(raw, "工作群").unwrap();

        assert!(msg.at_me);
    }

    // -------------------------------------------------------------------------
    // 消息去重测试
    // -------------------------------------------------------------------------

    #[test]
    fn test_message_parser_deduplication() {
        let parser = MessageParser::new();
        let raw = "张三: 测试消息";
        let chat_name = "张三";

        // 第一次应该成功解析
        let msg1 = parser.parse_raw_message(raw, chat_name);
        assert!(msg1.is_some());

        // 相同消息在短时间内应该被去重
        let msg2 = parser.parse_raw_message(raw, chat_name);
        assert!(msg2.is_none(), "重复消息应该被过滤");
    }

    #[test]
    fn test_message_parser_different_chats() {
        let parser = MessageParser::new();
        let raw = "张三: 测试消息";

        // 不同聊天的相同内容应该都能解析
        let msg1 = parser.parse_raw_message(raw, "聊天1");
        let msg2 = parser.parse_raw_message(raw, "聊天2");

        assert!(msg1.is_some());
        assert!(msg2.is_some());
    }

    // -------------------------------------------------------------------------
    // 消息类型测试
    // -------------------------------------------------------------------------

    #[test]
    fn test_message_type_display() {
        assert_eq!(format!("{}", MessageType::Text), "文本");
        assert_eq!(format!("{}", MessageType::Image), "图片");
        assert_eq!(format!("{}", MessageType::File), "文件");
        assert_eq!(format!("{}", MessageType::Voice), "语音");
        assert_eq!(format!("{}", MessageType::Video), "视频");
        assert_eq!(format!("{}", MessageType::Link), "链接");
        assert_eq!(format!("{}", MessageType::RedPacket), "红包");
        assert_eq!(format!("{}", MessageType::System), "系统");
    }

    // -------------------------------------------------------------------------
    // 连接状态测试
    // -------------------------------------------------------------------------

    #[test]
    fn test_connection_status_display() {
        assert_eq!(format!("{}", ConnectionStatus::Disconnected), "已断开");
        assert_eq!(format!("{}", ConnectionStatus::Connecting), "正在连接");
        assert_eq!(format!("{}", ConnectionStatus::Connected), "已连接");
        assert_eq!(format!("{}", ConnectionStatus::Reconnecting), "正在重连");
        assert_eq!(format!("{}", ConnectionStatus::Error), "错误");
    }

    // -------------------------------------------------------------------------
    // 配置测试
    // -------------------------------------------------------------------------

    #[test]
    fn test_wechat_monitor_config_default() {
        let config = WeChatMonitorConfig::default();

        assert_eq!(config.poll_interval_ms, 500);
        assert!(!config.auto_reply_enabled);
        assert_eq!(config.reconnect_interval_ms, 5000);
        assert_eq!(config.max_reconnect_attempts, 10);
        assert_eq!(config.dedup_window_ms, 60000);
        assert!(config.process_group_messages);
        assert!(config.process_private_messages);
        assert!(!config.only_at_me);

        // 检查忽略列表
        assert!(config.ignored_senders.contains(&"微信团队".to_string()));
        assert!(config.ignored_senders.contains(&"WeChat Team".to_string()));
        assert!(config.ignored_senders.contains(&"微信支付".to_string()));
        assert!(config.ignored_senders.contains(&"文件传输助手".to_string()));
    }

    #[test]
    fn test_wechat_monitor_config_custom() {
        let config = WeChatMonitorConfig {
            poll_interval_ms: 1000,
            auto_reply_enabled: true,
            session_key: "custom-session".to_string(),
            ignored_senders: vec!["机器人".to_string()],
            monitored_chats: vec!["工作群".to_string()],
            reconnect_interval_ms: 10000,
            max_reconnect_attempts: 5,
            dedup_window_ms: 30000,
            process_group_messages: true,
            process_private_messages: false,
            only_at_me: true,
        };

        assert_eq!(config.poll_interval_ms, 1000);
        assert!(config.auto_reply_enabled);
        assert_eq!(config.session_key, "custom-session");
        assert!(config.only_at_me);
        assert!(!config.process_private_messages);
    }

    // -------------------------------------------------------------------------
    // WeChatMessage 测试
    // -------------------------------------------------------------------------

    #[test]
    fn test_wechat_message_creation() {
        let msg = WeChatMessage {
            id: "test-id".to_string(),
            sender: "张三".to_string(),
            content: "你好".to_string(),
            timestamp: 1700000000000,
            is_group: false,
            chat_name: "张三".to_string(),
            msg_type: MessageType::Text,
            at_list: vec![],
            at_me: false,
            extra: None,
        };

        assert_eq!(msg.sender, "张三");
        assert_eq!(msg.content, "你好");
        assert!(!msg.is_group);
        assert_eq!(msg.msg_type, MessageType::Text);
    }

    #[test]
    fn test_wechat_message_group_with_at() {
        let msg = WeChatMessage {
            id: "test-id".to_string(),
            sender: "李四".to_string(),
            content: "@所有人 开会了".to_string(),
            timestamp: 1700000000000,
            is_group: true,
            chat_name: "工作群".to_string(),
            msg_type: MessageType::Text,
            at_list: vec!["所有人".to_string()],
            at_me: true,
            extra: None,
        };

        assert!(msg.is_group);
        assert!(msg.at_me);
        assert!(msg.at_list.contains(&"所有人".to_string()));
    }

    #[test]
    fn test_wechat_message_serialization() {
        let msg = WeChatMessage {
            id: "test-id".to_string(),
            sender: "张三".to_string(),
            content: "测试".to_string(),
            timestamp: 1700000000000,
            is_group: false,
            chat_name: "张三".to_string(),
            msg_type: MessageType::Text,
            at_list: vec![],
            at_me: false,
            extra: None,
        };

        // 序列化
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("张三"));
        assert!(json.contains("测试"));
        assert!(json.contains("text"));

        // 反序列化
        let decoded: WeChatMessage = serde_json::from_str(&json).unwrap();
        assert_eq!(decoded.sender, msg.sender);
        assert_eq!(decoded.content, msg.content);
    }

    // -------------------------------------------------------------------------
    // WeChatMonitorStatus 测试
    // -------------------------------------------------------------------------

    #[test]
    fn test_wechat_monitor_status_serialization() {
        let status = WeChatMonitorStatus {
            running: true,
            message_count: 10,
            last_message_time: Some(1700000000000),
            wechat_running: true,
            permission_granted: true,
            error: None,
            connection_status: ConnectionStatus::Connected,
            error_count: 0,
            reconnect_count: 0,
            uptime_secs: Some(60),
            last_error_time: None,
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("connected"));
        assert!(json.contains("running"));

        let decoded: WeChatMonitorStatus = serde_json::from_str(&json).unwrap();
        assert_eq!(decoded.message_count, 10);
        assert_eq!(decoded.connection_status, ConnectionStatus::Connected);
    }

    // -------------------------------------------------------------------------
    // WeChatManager 测试
    // -------------------------------------------------------------------------

    #[test]
    fn test_wechat_manager_creation() {
        let manager = WeChatManager::new();
        let messages = manager.get_messages();
        assert!(messages.is_empty());
    }

    #[tokio::test]
    async fn test_wechat_manager_auto_reply() {
        let manager = WeChatManager::new();
        assert!(!manager.is_auto_reply_enabled().await);

        manager.set_auto_reply(true).await;
        assert!(manager.is_auto_reply_enabled().await);

        manager.set_auto_reply(false).await;
        assert!(!manager.is_auto_reply_enabled().await);
    }

    #[tokio::test]
    async fn test_wechat_manager_process_message_disabled() {
        let manager = WeChatManager::new();

        // 自动回复未启用时应该返回 None
        let msg = WeChatMessage {
            id: "test".to_string(),
            sender: "张三".to_string(),
            content: "你好".to_string(),
            timestamp: chrono::Utc::now().timestamp_millis(),
            is_group: false,
            chat_name: "张三".to_string(),
            msg_type: MessageType::Text,
            at_list: vec![],
            at_me: false,
            extra: None,
        };

        let result = manager.process_incoming_message(&msg).await;
        assert!(result.is_none());
    }

    // -------------------------------------------------------------------------
    // MessageParser 重置测试
    // -------------------------------------------------------------------------

    #[test]
    fn test_message_parser_reset() {
        let parser = MessageParser::new();
        let raw = "张三: 测试消息";
        let chat_name = "张三";

        // 解析消息
        let msg1 = parser.parse_raw_message(raw, chat_name);
        assert!(msg1.is_some());

        // 重置后应该能再次解析
        parser.reset();
        let msg2 = parser.parse_raw_message(raw, chat_name);
        assert!(msg2.is_some());
    }

    // -------------------------------------------------------------------------
    // 空消息处理测试
    // -------------------------------------------------------------------------

    #[test]
    fn test_message_parser_empty_message() {
        let parser = MessageParser::new();

        let msg = parser.parse_raw_message("", "聊天");
        assert!(msg.is_none());

        let msg = parser.parse_raw_message("   ", "聊天");
        assert!(msg.is_none());
    }

    // -------------------------------------------------------------------------
    // 边界情况测试
    // -------------------------------------------------------------------------

    #[test]
    fn test_message_parser_long_sender() {
        let parser = MessageParser::new();
        // 超长发送者名称应该被视为无效
        let long_sender = "a".repeat(100);
        let raw = format!("{}: 内容", long_sender);

        let msg = parser.parse_raw_message(&raw, "聊天").unwrap();
        assert_eq!(msg.sender, "Unknown");
    }

    #[test]
    fn test_message_parser_no_sender() {
        let parser = MessageParser::new();
        // 没有发送者的消息
        let raw = "这是一条没有发送者的消息";

        let msg = parser.parse_raw_message(raw, "聊天").unwrap();
        assert_eq!(msg.sender, "Unknown");
        assert_eq!(msg.content, raw);
    }
}
