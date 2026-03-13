// 配置管理模块
// 支持原版 openclaw 格式 (models.providers, agents, bindings, etc.)

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppConfig {
    /// AI 提供商配置
    #[serde(default)]
    pub ai_provider: AIProvider,
    /// Gateway 配置
    #[serde(default)]
    pub gateway: GatewayConfig,
    /// 微信配置
    #[serde(default)]
    pub wechat: WeChatConfig,
    /// 搜索配置
    #[serde(default)]
    pub search: SearchConfig,
    /// 界面配置
    #[serde(default)]
    pub ui: UIConfig,
    /// 自动更新配置
    #[serde(default)]
    pub updater: UpdaterConfig,
    /// 会话配置
    #[serde(default)]
    pub session: SessionConfig,
    /// 用户信息
    #[serde(default)]
    pub user: UserInfo,
    /// 通道配置（Telegram、Discord 等）
    #[serde(default)]
    pub channels: ChannelsConfig,
    /// Failover 配置
    #[serde(default)]
    pub failover: FailoverAppConfig,
}

/// 用户信息
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct UserInfo {
    /// 用户名称
    #[serde(default)]
    pub name: String,
    /// 助手名称
    #[serde(default)]
    pub agent_name: String,
}

/// Failover 配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FailoverAppConfig {
    /// 是否启用 Failover
    #[serde(default = "default_failover_enabled")]
    pub enabled: bool,
    /// 最大重试次数
    #[serde(default = "default_max_retries")]
    pub max_retries: u32,
    /// 默认冷却时间（秒）
    #[serde(default = "default_cooldown_secs")]
    pub cooldown_secs: u64,
    /// 备用提供商列表（按优先级排序）
    #[serde(default)]
    pub fallback_providers: Vec<String>,
}

fn default_failover_enabled() -> bool {
    true
}
fn default_max_retries() -> u32 {
    3
}
fn default_cooldown_secs() -> u64 {
    60
}

impl Default for FailoverAppConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            max_retries: 3,
            cooldown_secs: 60,
            fallback_providers: vec!["deepseek".to_string(), "openai".to_string()],
        }
    }
}

/// AI 提供商配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIProvider {
    /// 当前使用的提供商
    pub current: String,
    /// 通义千问配置
    #[serde(rename = "qwen")]
    pub qwen: QwenConfig,
    /// 文心一言配置
    #[serde(rename = "ernie")]
    pub ernie: ErnieConfig,
    /// DeepSeek 配置
    #[serde(rename = "deepseek")]
    pub deepseek: DeepSeekConfig,
    /// 智谱 GLM 配置
    #[serde(rename = "zhipu", default)]
    pub zhipu: Option<ZhipuConfig>,
    /// 月之暗面配置
    #[serde(rename = "moonshot", default)]
    pub moonshot: Option<MoonshotConfig>,
    /// 豆包配置
    #[serde(rename = "doubao", default)]
    pub doubao: Option<DoubaoConfig>,
    /// MiniMax 配置
    #[serde(rename = "minimax", default)]
    pub minimax: Option<MinimaxConfig>,
    /// OpenAI 配置
    #[serde(rename = "openai")]
    pub openai: OpenAIConfig,
    /// Anthropic 配置
    #[serde(rename = "anthropic", default)]
    pub anthropic: Option<AnthropicConfig>,
    /// Google Gemini 配置
    #[serde(rename = "google", default)]
    pub google: Option<GoogleConfig>,
    /// GitHub Copilot 配置
    #[serde(rename = "copilot", default)]
    pub copilot: Option<CopilotConfig>,
    /// 自定义/OpenAI 兼容配置（支持 NewAPI、OneAPI 等中转）
    #[serde(rename = "custom", default)]
    pub custom: Option<CustomConfig>,
    /// 嵌入向量配置
    #[serde(rename = "embedding", default)]
    pub embedding: EmbeddingServiceConfig,
}

impl Default for AIProvider {
    fn default() -> Self {
        Self {
            current: "qwen".to_string(),
            qwen: QwenConfig::default(),
            ernie: ErnieConfig::default(),
            deepseek: DeepSeekConfig::default(),
            zhipu: Some(ZhipuConfig::default()),
            moonshot: Some(MoonshotConfig::default()),
            doubao: Some(DoubaoConfig::default()),
            minimax: Some(MinimaxConfig::default()),
            openai: OpenAIConfig::default(),
            anthropic: Some(AnthropicConfig::default()),
            google: Some(GoogleConfig::default()),
            copilot: Some(CopilotConfig::default()),
            custom: Some(CustomConfig::default()),
            embedding: EmbeddingServiceConfig::default(),
        }
    }
}

/// 通义千问配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QwenConfig {
    #[serde(default = "default_true")]
    pub enabled: bool,
    pub api_key: String,
    pub model: String,
    pub base_url: String,
    #[serde(default)]
    pub custom_models: Vec<String>,
    /// 嵌入模型名称（如 text-embedding-v3）
    #[serde(default)]
    pub embedding_model: Option<String>,
}

impl Default for QwenConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            api_key: String::new(),
            model: "qwen-plus".to_string(),
            base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1".to_string(),
            custom_models: Vec::new(),
            embedding_model: None,
        }
    }
}

/// 文心一言配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErnieConfig {
    #[serde(default)]
    pub enabled: bool,
    pub api_key: String,
    pub secret_key: String,
    pub model: String,
    #[serde(default)]
    pub custom_models: Vec<String>,
    /// 嵌入模型名称
    #[serde(default)]
    pub embedding_model: Option<String>,
}

impl Default for ErnieConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            api_key: String::new(),
            secret_key: String::new(),
            model: "ernie-bot-4".to_string(),
            custom_models: Vec::new(),
            embedding_model: None,
        }
    }
}

/// DeepSeek 配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeepSeekConfig {
    #[serde(default)]
    pub enabled: bool,
    pub api_key: String,
    pub model: String,
    #[serde(default)]
    pub base_url: String,
    #[serde(default)]
    pub custom_models: Vec<String>,
    /// 嵌入模型名称
    #[serde(default)]
    pub embedding_model: Option<String>,
}

impl Default for DeepSeekConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            api_key: String::new(),
            model: "deepseek-chat".to_string(),
            base_url: "https://api.deepseek.com/v1".to_string(),
            custom_models: Vec::new(),
            embedding_model: None,
        }
    }
}

/// OpenAI 配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAIConfig {
    #[serde(default)]
    pub enabled: bool,
    pub api_key: String,
    pub model: String,
    pub base_url: String,
    #[serde(default)]
    pub custom_models: Vec<String>,
    /// 嵌入模型名称（如 text-embedding-3-small）
    #[serde(default)]
    pub embedding_model: Option<String>,
}

impl Default for OpenAIConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            api_key: String::new(),
            model: "gpt-4o".to_string(),
            base_url: "https://api.openai.com/v1".to_string(),
            custom_models: Vec::new(),
            embedding_model: None,
        }
    }
}

/// 智谱 GLM 配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZhipuConfig {
    #[serde(default)]
    pub enabled: bool,
    pub api_key: String,
    pub model: String,
    #[serde(default)]
    pub base_url: String,
    #[serde(default)]
    pub custom_models: Vec<String>,
    /// 嵌入模型名称（如 embedding-3）
    #[serde(default)]
    pub embedding_model: Option<String>,
}

impl Default for ZhipuConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            api_key: String::new(),
            model: "glm-4".to_string(),
            base_url: "https://open.bigmodel.cn/api/paas/v4".to_string(),
            custom_models: Vec::new(),
            embedding_model: None,
        }
    }
}

/// 月之暗面配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoonshotConfig {
    #[serde(default)]
    pub enabled: bool,
    pub api_key: String,
    pub model: String,
    #[serde(default)]
    pub base_url: String,
    #[serde(default)]
    pub custom_models: Vec<String>,
    /// 嵌入模型名称
    #[serde(default)]
    pub embedding_model: Option<String>,
}

impl Default for MoonshotConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            api_key: String::new(),
            model: "moonshot-v1-128k".to_string(),
            base_url: "https://api.moonshot.cn/v1".to_string(),
            custom_models: Vec::new(),
            embedding_model: None,
        }
    }
}

/// 豆包配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DoubaoConfig {
    #[serde(default)]
    pub enabled: bool,
    pub api_key: String,
    pub model: String,
    #[serde(default)]
    pub base_url: String,
    #[serde(default)]
    pub custom_models: Vec<String>,
    /// 嵌入模型名称
    #[serde(default)]
    pub embedding_model: Option<String>,
}

impl Default for DoubaoConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            api_key: String::new(),
            model: "doubao-pro-32k".to_string(),
            base_url: "https://ark.cn-beijing.volces.com/api/v3".to_string(),
            custom_models: Vec::new(),
            embedding_model: None,
        }
    }
}

/// MiniMax 配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinimaxConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub api_key: String,
    #[serde(default = "default_minimax_model")]
    pub model: String,
    #[serde(default = "default_minimax_base_url")]
    pub base_url: String,
    #[serde(default)]
    pub custom_models: Vec<String>,
    /// 嵌入模型名称
    #[serde(default)]
    pub embedding_model: Option<String>,
    /// Group ID（MiniMax API 必需参数）
    #[serde(default)]
    pub group_id: Option<String>,
}

fn default_minimax_model() -> String {
    "MiniMax-M2.5".to_string()
}
fn default_minimax_base_url() -> String {
    "https://api.minimaxi.com/anthropic".to_string()
}

impl Default for MinimaxConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            api_key: String::new(),
            model: "MiniMax-M2.5".to_string(),
            base_url: "https://api.minimaxi.com/anthropic".to_string(),
            custom_models: Vec::new(),
            embedding_model: None,
            group_id: None,
        }
    }
}

/// 自定义/OpenAI 兼容 配置（支持 NewAPI、OneAPI 等中转）
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CustomConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub api_key: String,
    #[serde(default)]
    pub model: String,
    #[serde(default)]
    pub base_url: String,
    #[serde(default)]
    pub custom_models: Vec<String>,
    /// 嵌入模型名称
    #[serde(default)]
    pub embedding_model: Option<String>,
}

/// Anthropic Claude 配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnthropicConfig {
    #[serde(default)]
    pub enabled: bool,
    pub api_key: String,
    pub model: String,
    pub base_url: String,
    #[serde(default)]
    pub custom_models: Vec<String>,
    /// 嵌入模型名称（Anthropic 暂不支持嵌入，保留字段）
    #[serde(default)]
    pub embedding_model: Option<String>,
}

impl Default for AnthropicConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            api_key: String::new(),
            model: "claude-sonnet-4-5".to_string(),
            base_url: "https://api.anthropic.com/v1".to_string(),
            custom_models: Vec::new(),
            embedding_model: None,
        }
    }
}

/// Google Gemini 配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleConfig {
    #[serde(default)]
    pub enabled: bool,
    pub api_key: String,
    pub model: String,
    pub base_url: String,
    #[serde(default)]
    pub custom_models: Vec<String>,
    /// 嵌入模型名称（如 gemini-embedding-001）
    #[serde(default)]
    pub embedding_model: Option<String>,
}

impl Default for GoogleConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            api_key: String::new(),
            model: "gemini-2.5-pro".to_string(),
            base_url: "https://generativelanguage.googleapis.com/v1beta".to_string(),
            custom_models: Vec::new(),
            embedding_model: None,
        }
    }
}

/// GitHub Copilot 配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CopilotConfig {
    #[serde(default)]
    pub enabled: bool,
    pub api_key: String,
    pub model: String,
    pub base_url: String,
    #[serde(default)]
    pub custom_models: Vec<String>,
    /// 嵌入模型名称
    #[serde(default)]
    pub embedding_model: Option<String>,
}

impl Default for CopilotConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            api_key: String::new(),
            model: "gpt-4o-copilot".to_string(),
            base_url: "https://api.githubcopilot.com".to_string(),
            custom_models: Vec::new(),
            embedding_model: None,
        }
    }
}

/// 嵌入向量服务配置
///
/// 简化设计：默认使用当前 AI 提供商的配置（api_key, base_url, embedding_model）。
/// 用户只需在对应提供商配置中设置 embedding_model 即可。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct EmbeddingServiceConfig {
    /// 启用状态
    #[serde(default)]
    pub enabled: bool,
    /// 可选：覆盖提供商（默认使用 ai_provider.current）
    #[serde(default)]
    pub provider: Option<String>,
    /// 可选：覆盖嵌入模型（默认使用提供商的 embedding_model）
    #[serde(default)]
    pub model: Option<String>,
    /// 可选：覆盖 Base URL
    #[serde(default)]
    pub base_url: Option<String>,
    /// 可选：覆盖 API Key（仅用于 Voyage 等专用嵌入服务）
    #[serde(default)]
    pub api_key: Option<String>,
}

/// TLS 配置（兼容原项目 GatewayTlsConfig）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TlsConfig {
    /// 启用 TLS
    #[serde(default)]
    pub enabled: bool,
    /// 自动生成自签名证书（默认 true）
    #[serde(default = "default_true")]
    pub auto_generate: bool,
    /// PEM 证书路径
    #[serde(default = "default_cert_path")]
    pub cert_path: String,
    /// PEM 私钥路径
    #[serde(default = "default_key_path")]
    pub key_path: String,
    /// CA 证书路径（可选，用于 mTLS）
    #[serde(default)]
    pub ca_path: Option<String>,
}

fn default_true() -> bool {
    true
}

fn default_search_provider() -> String {
    "duckduckgo".to_string()
}

fn default_max_results() -> u32 {
    10
}

fn default_timeout_seconds() -> u64 {
    30
}

fn default_cache_ttl() -> u64 {
    60
}

fn default_gateway_port() -> u16 {
    3728
}

fn default_log_level() -> String {
    "info".to_string()
}

fn default_cert_path() -> String {
    crate::paths::config_dir()
        .join("gateway")
        .join("tls")
        .join("gateway-cert.pem")
        .to_string_lossy()
        .to_string()
}

fn default_key_path() -> String {
    crate::paths::config_dir()
        .join("gateway")
        .join("tls")
        .join("gateway-key.pem")
        .to_string_lossy()
        .to_string()
}

impl Default for TlsConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            auto_generate: true,
            cert_path: default_cert_path(),
            key_path: default_key_path(),
            ca_path: None,
        }
    }
}

/// Gateway 配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayConfig {
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default = "default_true")]
    pub auto_start: bool,
    #[serde(default = "default_gateway_port")]
    pub port: u16,
    #[serde(default = "default_log_level")]
    pub log_level: String,
    /// TLS 配置
    #[serde(default)]
    pub tls: TlsConfig,
}

impl Default for GatewayConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            auto_start: true,
            port: 3728,
            log_level: "info".to_string(),
            tls: TlsConfig::default(),
        }
    }
}

/// 微信配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeChatConfig {
    #[serde(default)]
    pub enabled: bool,
    pub auto_reply: bool,
    pub reply_delay_ms: u64,
    pub ai_provider: String,
}

impl Default for WeChatConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            auto_reply: false,
            reply_delay_ms: 1000,
            ai_provider: "qwen".to_string(),
        }
    }
}

/// 搜索配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchConfig {
    /// 搜索提供商: duckduckgo, brave, perplexity, grok
    #[serde(default = "default_search_provider")]
    pub provider: String,
    /// 是否启用搜索
    #[serde(default)]
    pub enabled: bool,
    /// 最大结果数
    #[serde(default = "default_max_results")]
    pub max_results: u32,
    /// 请求超时（秒）
    #[serde(default = "default_timeout_seconds")]
    pub timeout_seconds: u64,
    /// 缓存 TTL（分钟）
    #[serde(default = "default_cache_ttl")]
    pub cache_ttl_minutes: u64,

    /// Brave Search 配置
    #[serde(default)]
    pub brave: BraveSearchConfig,

    /// Perplexity 搜索配置
    #[serde(default)]
    pub perplexity: PerplexitySearchConfig,

    /// Grok/xAI 搜索配置
    #[serde(default)]
    pub grok: GrokSearchConfig,
}

/// Brave Search 配置
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BraveSearchConfig {
    /// Brave Search API Key
    #[serde(default)]
    pub api_key: String,
}

/// Perplexity 搜索配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerplexitySearchConfig {
    /// Perplexity API Key (或 OpenRouter API Key)
    #[serde(default)]
    pub api_key: String,
    /// API Base URL (默认 OpenRouter: https://openrouter.ai/api/v1, 直接: https://api.perplexity.ai)
    #[serde(default = "default_perplexity_base_url")]
    pub base_url: String,
    /// 模型 (默认: perplexity/sonar-pro)
    #[serde(default = "default_perplexity_model")]
    pub model: String,
}

impl Default for PerplexitySearchConfig {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            base_url: default_perplexity_base_url(),
            model: default_perplexity_model(),
        }
    }
}

fn default_perplexity_base_url() -> String {
    "https://openrouter.ai/api/v1".to_string()
}

fn default_perplexity_model() -> String {
    "perplexity/sonar-pro".to_string()
}

/// Grok/xAI 搜索配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GrokSearchConfig {
    /// xAI API Key
    #[serde(default)]
    pub api_key: String,
    /// 模型 (默认: grok-4-1-fast)
    #[serde(default = "default_grok_model")]
    pub model: String,
    /// 是否在响应中包含内联引用
    #[serde(default)]
    pub inline_citations: bool,
}

impl Default for GrokSearchConfig {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            model: default_grok_model(),
            inline_citations: false,
        }
    }
}

fn default_grok_model() -> String {
    "grok-4-1-fast".to_string()
}

impl Default for SearchConfig {
    fn default() -> Self {
        Self {
            provider: "duckduckgo".to_string(),
            enabled: true,
            max_results: 10,
            timeout_seconds: 30,
            cache_ttl_minutes: 60,
            brave: BraveSearchConfig::default(),
            perplexity: PerplexitySearchConfig::default(),
            grok: GrokSearchConfig::default(),
        }
    }
}

/// UI 配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UIConfig {
    pub language: String,
    pub theme: String,
    pub show_tray_icon: bool,
    pub start_minimized: bool,
}

impl Default for UIConfig {
    fn default() -> Self {
        Self {
            language: "zh-CN".to_string(),
            theme: "system".to_string(),
            show_tray_icon: true,
            start_minimized: false,
        }
    }
}

/// 更新配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdaterConfig {
    #[serde(default = "default_true")]
    pub enabled: bool,
    pub check_interval_hours: u64,
    pub channel: String,
}

impl Default for UpdaterConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            check_interval_hours: 24,
            channel: "stable".to_string(),
        }
    }
}

/// 会话配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionConfig {
    /// 会话压缩 - 最大消息数
    pub max_session_messages: usize,
    /// 会话压缩 - 触发摘要的消息数阈值
    pub summary_threshold: usize,
    /// 会话压缩 - 压缩后保留的最近消息数
    pub keep_recent_messages: usize,
    /// 会话压缩 - 启用状态
    pub enable_compaction: bool,

    /// 会话归档 - 归档天数阈值
    pub archive_after_days: i64,
    /// 会话归档 - 启用状态
    pub enable_archive: bool,

    /// A2A 通信 - 启用状态
    pub enable_a2a: bool,
    /// A2A 通信 - 超时时间（毫秒）
    pub a2a_timeout_ms: u64,

    /// 子 Agent - 最大子 Agent 数量
    pub max_subagents: usize,
    /// 子 Agent - 超时时间（毫秒）
    pub subagent_timeout_ms: u64,

    /// 自动记忆刷新配置
    #[serde(default)]
    pub memory_refresh: MemoryRefreshConfig,
}

/// 自动记忆刷新配置
/// 在会话压缩前触发静默 Agent 轮次，自动保存持久记忆
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryRefreshConfig {
    /// 是否启用自动记忆刷新
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// 触发记忆刷新的 token 阈值（上下文使用量）
    pub soft_threshold_tokens: usize,
    /// 记忆提取提示词
    pub prompt: String,
}

impl Default for MemoryRefreshConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            soft_threshold_tokens: 4000,
            prompt: r#"请分析以上对话，提取以下信息并存储到记忆系统：

1. **用户偏好和习惯** - 用户明确表达或暗示的偏好
2. **重要项目上下文** - 项目名称、技术栈、关键决策
3. **关键结论和决策** - 重要的讨论结果和决定
4. **待办事项和承诺** - 用户提到需要做的事情
5. **有用的信息** - 可能在未来对话中有用的信息

请以简洁的要点形式总结，不要重复已知信息。"#
                .to_string(),
        }
    }
}

impl Default for SessionConfig {
    fn default() -> Self {
        Self {
            max_session_messages: 100,
            summary_threshold: 50,
            keep_recent_messages: 20,
            enable_compaction: true,
            archive_after_days: 30,
            enable_archive: true,
            enable_a2a: true,
            a2a_timeout_ms: 30000,
            max_subagents: 5,
            subagent_timeout_ms: 120000,
            memory_refresh: MemoryRefreshConfig::default(),
        }
    }
}

/// 配置管理器
pub struct ConfigManager {
    #[allow(dead_code)]
    config_dir: PathBuf,
    config_file: PathBuf,
}

impl ConfigManager {
    pub fn new() -> Result<Self> {
        // 使用统一路径模块
        let config_dir = crate::paths::config_dir();

        // 创建配置目录
        fs::create_dir_all(&config_dir)?;

        let config_file = crate::paths::config_file();

        Ok(Self {
            config_dir,
            config_file,
        })
    }

    /// 加载配置（支持 v1 简化格式和 v2 原版格式）
    pub fn load(&self) -> Result<AppConfig> {
        if self.config_file.exists() {
            let content = fs::read_to_string(&self.config_file)?;

            // 先尝试检测配置版本
            if Self::is_v2_format(&content) {
                log::info!("检测到原版 openclaw 配置格式 (v2)，正在转换...");

                // 备份原配置
                let backup_path = self.config_file.with_extension("json.bak_v2");
                if !backup_path.exists() {
                    fs::copy(&self.config_file, &backup_path)?;
                    log::info!("原版配置已备份到: {:?}", backup_path);
                }

                // 解析 v2 格式并转换为 v1
                match Self::parse_v2_and_convert(&content) {
                    Ok(v1_config) => {
                        // 只做内存转换，不覆盖原版 openclaw.json（避免破坏 Gateway 配置）
                        log::info!("原版配置已转换为简化格式（内存）");
                        return Ok(v1_config);
                    }
                    Err(e) => {
                        log::warn!("原版配置转换失败: {}，尝试作为 v1 格式解析", e);
                    }
                }
            }

            // 尝试作为 v1 格式解析
            match serde_json::from_str::<AppConfig>(&content) {
                Ok(config) => Ok(config),
                Err(v1_err) => {
                    // 兜底：即使未检测到 v2，也再尝试一次按 v2 解析并转换
                    // 场景：用户配置可能是 v2 变体（如 channels.accounts 为对象）但缺少 models.providers 字段
                    log::warn!("v1 配置解析失败: {}，尝试按 v2 格式转换", v1_err);

                    match Self::parse_v2_and_convert(&content) {
                        Ok(v1_config) => {
                            log::info!("配置已按 v2 格式成功转换（内存）");
                            Ok(v1_config)
                        }
                        Err(v2_err) => {
                            log::error!("配置解析失败: v1={}, v2={}", v1_err, v2_err);
                            Err(anyhow::anyhow!(
                                "配置解析失败: v1={}, v2={}",
                                v1_err,
                                v2_err
                            ))
                        }
                    }
                }
            }
        } else {
            // 创建默认配置
            let default_config = AppConfig::default();
            self.save(&default_config)?;
            Ok(default_config)
        }
    }

    /// 检测是否为 v2 格式（原版 openclaw 格式）
    fn is_v2_format(content: &str) -> bool {
        // v2 格式特征：有 models.providers 字段
        content.contains("\"models\"") && content.contains("\"providers\"")
    }

    /// 解析 v2 格式并转换为 v1 格式
    fn parse_v2_and_convert(content: &str) -> Result<AppConfig> {
        use crate::openclaw_config::{ConfigMigrator, OpenClawConfig};

        let v2_config: OpenClawConfig = serde_json::from_str(content)?;
        let v1_config = ConfigMigrator::to_v1(&v2_config);
        Ok(v1_config)
    }

    /// 保存配置
    pub fn save(&self, config: &AppConfig) -> Result<()> {
        let content = serde_json::to_string_pretty(config)?;
        fs::write(&self.config_file, content)?;
        Ok(())
    }

    /// 重置配置
    pub fn reset(&self) -> Result<AppConfig> {
        let default_config = AppConfig::default();
        self.save(&default_config)?;
        Ok(default_config)
    }

    /// 获取配置目录
    #[allow(dead_code)]
    pub fn config_dir(&self) -> &PathBuf {
        &self.config_dir
    }
}

impl Default for ConfigManager {
    fn default() -> Self {
        Self::new().unwrap()
    }
}

/// Gateway 配置（OpenClaw 格式）
#[derive(Debug, Serialize, Deserialize, Default)]
struct GatewayConfigFile {
    #[serde(default)]
    gateway: GatewaySettings,
    #[serde(default)]
    agents: AgentsConfig,
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct GatewaySettings {
    #[serde(default)]
    mode: String,
    #[serde(default)]
    bind: String,
    #[serde(default)]
    auth: AuthSettings,
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct AuthSettings {
    #[serde(rename = "mode", default)]
    auth_mode: String,
    #[serde(default)]
    token: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct AgentsConfig {
    #[serde(default)]
    defaults: AgentDefaults,
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct AgentDefaults {
    #[serde(default)]
    model: ModelConfig,
    #[serde(default)]
    models: std::collections::HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct ModelConfig {
    #[serde(rename = "primary", default)]
    primary_model: String,
}

impl ConfigManager {
    /// 同步应用配置到 Gateway 配置
    ///
    /// 将应用中配置的 API Keys 同步到 OpenClaw Gateway 配置文件
    /// 使用平台标准配置目录
    pub fn sync_to_gateway(&self) -> Result<()> {
        // 1. 加载应用配置
        let app_config = self.load()?;

        // 2. Gateway 配置文件路径
        let gateway_config_path = self.config_dir.join("gateway.json");

        // 3. 读取现有 Gateway 配置或创建新的
        let mut gateway_config: GatewayConfigFile = if gateway_config_path.exists() {
            let content = fs::read_to_string(&gateway_config_path)
                .map_err(|e| anyhow::anyhow!("读取 Gateway 配置失败: {}", e))?;
            serde_json::from_str(&content).unwrap_or_else(|_| GatewayConfigFile::default())
        } else {
            GatewayConfigFile::default()
        };

        // 4. 设置 Gateway 基础配置
        gateway_config.gateway.mode = "local".to_string();
        gateway_config.gateway.bind = "loopback".to_string();
        gateway_config.gateway.auth.auth_mode = "token".to_string();
        // 只在 token 不存在时才生成新 token（避免每次同步都改变导致 token mismatch）
        if gateway_config.gateway.auth.token.is_none()
            || gateway_config
                .gateway
                .auth
                .token
                .as_ref()
                .is_none_or(|t| t.is_empty())
        {
            gateway_config.gateway.auth.token =
                Some(format!("openclaw-desktop-{}", uuid::Uuid::new_v4()));
            println!("🔑 生成新的 Gateway token");
        } else {
            println!(
                "🔑 保留现有 Gateway token: {:?}",
                gateway_config
                    .gateway
                    .auth
                    .token
                    .as_ref()
                    .map(|t| &t[..20.min(t.len())])
            );
        }

        // 5. 同步模型配置
        // Gateway 需要两个部分：
        // - models.providers: 提供商配置（baseUrl, apiKey, models 列表）
        // - agents.defaults.models: 可用模型目录

        let mut models = std::collections::HashMap::new();
        let mut providers = std::collections::HashMap::new();

        // 通义千问
        if !app_config.ai_provider.qwen.api_key.is_empty() {
            let qwen_models = vec![
                serde_json::json!({"id": "qwen-plus", "name": "qwen-plus"}),
                serde_json::json!({"id": "qwen-turbo", "name": "qwen-turbo"}),
                serde_json::json!({"id": "qwen-max", "name": "qwen-max"}),
                serde_json::json!({"id": "qwen-long", "name": "qwen-long"}),
            ];
            for model in &qwen_models {
                let id = model.get("id").and_then(|v| v.as_str()).unwrap_or("");
                models.insert(format!("qwen/{}", id), serde_json::json!({}));
            }
            providers.insert(
                "qwen".to_string(),
                serde_json::json!({
                    "baseUrl": app_config.ai_provider.qwen.base_url,
                    "apiKey": app_config.ai_provider.qwen.api_key,
                    "models": qwen_models
                }),
            );
            std::env::set_var(
                "OPENCLAW_CHANNEL_QWEN_API_KEY",
                &app_config.ai_provider.qwen.api_key,
            );
            std::env::set_var(
                "OPENCLAW_CHANNEL_QWEN_BASE_URL",
                &app_config.ai_provider.qwen.base_url,
            );
        }

        // 智谱 GLM
        if let Some(ref zhipu) = app_config.ai_provider.zhipu {
            if zhipu.enabled && !zhipu.api_key.is_empty() {
                // 🔥 优先使用自定义模型
                let zhipu_models = if !zhipu.custom_models.is_empty() {
                    // 使用用户自定义的模型列表
                    zhipu
                        .custom_models
                        .iter()
                        .map(|m| {
                            serde_json::json!({
                                "id": m,
                                "name": m,
                                "api": "openai-completions"
                            })
                        })
                        .collect::<Vec<_>>()
                } else {
                    // 否则使用默认模型
                    vec![
                        serde_json::json!({"id": "glm-4", "name": "glm-4", "api": "openai-completions"}),
                        serde_json::json!({"id": "glm-4-flash", "name": "glm-4-flash", "api": "openai-completions"}),
                        serde_json::json!({"id": "glm-4-plus", "name": "glm-4-plus", "api": "openai-completions"}),
                    ]
                };

                for model in &zhipu_models {
                    let id = model.get("id").and_then(|v| v.as_str()).unwrap_or("");
                    models.insert(format!("zhipu/{}", id), serde_json::json!({}));
                }
                providers.insert(
                    "zhipu".to_string(),
                    serde_json::json!({
                        "api": "openai-completions",
                        "baseUrl": "https://open.bigmodel.cn/api/paas/v4",
                        "apiKey": zhipu.api_key,
                        "models": zhipu_models
                    }),
                );
                std::env::set_var("OPENCLAW_CHANNEL_ZHIPU_API_KEY", &zhipu.api_key);
                std::env::set_var(
                    "OPENCLAW_CHANNEL_ZHIPU_BASE_URL",
                    "https://open.bigmodel.cn/api/paas/v4",
                );
            }
        }

        // DeepSeek
        if app_config.ai_provider.deepseek.enabled
            && !app_config.ai_provider.deepseek.api_key.is_empty()
        {
            let deepseek_models = vec![
                serde_json::json!({"id": "deepseek-chat", "name": "deepseek-chat", "api": "openai-completions"}),
                serde_json::json!({"id": "deepseek-coder", "name": "deepseek-coder", "api": "openai-completions"}),
            ];
            for model in &deepseek_models {
                let id = model.get("id").and_then(|v| v.as_str()).unwrap_or("");
                models.insert(format!("deepseek/{}", id), serde_json::json!({}));
            }
            providers.insert(
                "deepseek".to_string(),
                serde_json::json!({
                    "api": "openai-completions",
                    "baseUrl": "https://api.deepseek.com/v1",
                    "apiKey": app_config.ai_provider.deepseek.api_key,
                    "models": deepseek_models
                }),
            );
            std::env::set_var(
                "OPENCLAW_CHANNEL_DEEPSEEK_API_KEY",
                &app_config.ai_provider.deepseek.api_key,
            );
            std::env::set_var(
                "OPENCLAW_CHANNEL_DEEPSEEK_BASE_URL",
                "https://api.deepseek.com/v1",
            );
        }

        // 百度文心
        if app_config.ai_provider.ernie.enabled && !app_config.ai_provider.ernie.api_key.is_empty()
        {
            let ernie_models = vec![
                serde_json::json!({"id": "ernie-4.0-turbo-8k", "name": "ernie-4.0-turbo-8k"}),
                serde_json::json!({"id": "ernie-4.0-turbo-128k", "name": "ernie-4.0-turbo-128k"}),
                serde_json::json!({"id": "ernie-speed-128k", "name": "ernie-speed-128k"}),
            ];
            for model in &ernie_models {
                let id = model.get("id").and_then(|v| v.as_str()).unwrap_or("");
                models.insert(format!("ernie/{}", id), serde_json::json!({}));
            }
            // 百度文心使用固定的 base_url，配置中没有此字段
            providers.insert(
                "ernie".to_string(),
                serde_json::json!({
                    "baseUrl": "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop",
                    "apiKey": app_config.ai_provider.ernie.api_key,
                    "models": ernie_models
                }),
            );
            std::env::set_var(
                "OPENCLAW_CHANNEL_ERNIE_API_KEY",
                &app_config.ai_provider.ernie.api_key,
            );
            std::env::set_var(
                "OPENCLAW_CHANNEL_ERNIE_BASE_URL",
                "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop",
            );
        }

        // Moonshot
        if let Some(ref moonshot) = app_config.ai_provider.moonshot {
            if moonshot.enabled && !moonshot.api_key.is_empty() {
                let moonshot_models = vec![
                    serde_json::json!({"id": "moonshot-v1-8k", "name": "moonshot-v1-8k"}),
                    serde_json::json!({"id": "moonshot-v1-32k", "name": "moonshot-v1-32k"}),
                    serde_json::json!({"id": "moonshot-v1-128k", "name": "moonshot-v1-128k"}),
                ];
                for model in &moonshot_models {
                    let id = model.get("id").and_then(|v| v.as_str()).unwrap_or("");
                    models.insert(format!("moonshot/{}", id), serde_json::json!({}));
                }
                providers.insert(
                    "moonshot".to_string(),
                    serde_json::json!({
                        "baseUrl": "https://api.moonshot.cn/v1",
                        "apiKey": moonshot.api_key,
                        "models": moonshot_models
                    }),
                );
                std::env::set_var("OPENCLAW_CHANNEL_MOONSHOT_API_KEY", &moonshot.api_key);
                std::env::set_var(
                    "OPENCLAW_CHANNEL_MOONSHOT_BASE_URL",
                    "https://api.moonshot.cn/v1",
                );
            }
        }

        // 豆包
        if let Some(ref doubao) = app_config.ai_provider.doubao {
            if doubao.enabled && !doubao.api_key.is_empty() {
                let doubao_models = vec![
                    serde_json::json!({"id": "doubao-pro-32k", "name": "doubao-pro-32k"}),
                    serde_json::json!({"id": "doubao-pro-128k", "name": "doubao-pro-128k"}),
                ];
                for model in &doubao_models {
                    let id = model.get("id").and_then(|v| v.as_str()).unwrap_or("");
                    models.insert(format!("doubao/{}", id), serde_json::json!({}));
                }
                providers.insert(
                    "doubao".to_string(),
                    serde_json::json!({
                        "baseUrl": "https://ark.cn-beijing.volces.com/api/v3",
                        "apiKey": doubao.api_key,
                        "models": doubao_models
                    }),
                );
                std::env::set_var("OPENCLAW_CHANNEL_DOUBAO_API_KEY", &doubao.api_key);
                std::env::set_var(
                    "OPENCLAW_CHANNEL_DOUBAO_BASE_URL",
                    "https://ark.cn-beijing.volces.com/api/v3",
                );
            }
        }

        // MiniMax
        if let Some(ref minimax) = app_config.ai_provider.minimax {
            if minimax.enabled && !minimax.api_key.is_empty() {
                // 🔥 优先使用自定义模型
                let minimax_models = if !minimax.custom_models.is_empty() {
                    minimax
                        .custom_models
                        .iter()
                        .map(|m| {
                            serde_json::json!({
                                "id": m,
                                "name": m,
                                "api": "anthropic-messages"
                            })
                        })
                        .collect::<Vec<_>>()
                } else {
                    vec![
                        serde_json::json!({"id": "MiniMax-M2.5", "name": "MiniMax-M2.5", "api": "anthropic-messages"}),
                        serde_json::json!({"id": "MiniMax-M2.5-highspeed", "name": "MiniMax-M2.5-highspeed", "api": "anthropic-messages"}),
                        serde_json::json!({"id": "MiniMax-M2.1", "name": "MiniMax-M2.1", "api": "anthropic-messages"}),
                    ]
                };

                for model in &minimax_models {
                    let id = model.get("id").and_then(|v| v.as_str()).unwrap_or("");
                    models.insert(format!("minimax/{}", id), serde_json::json!({}));
                }
                let base_url = if minimax.base_url.is_empty() {
                    "https://api.minimaxi.com/anthropic"
                } else {
                    &minimax.base_url
                };
                providers.insert(
                    "minimax".to_string(),
                    serde_json::json!({
                        "api": "anthropic-messages",
                        "authHeader": true,
                        "baseUrl": base_url,
                        "apiKey": minimax.api_key,
                        "models": minimax_models
                    }),
                );
                std::env::set_var("OPENCLAW_CHANNEL_MINIMAX_API_KEY", &minimax.api_key);
                std::env::set_var("OPENCLAW_CHANNEL_MINIMAX_BASE_URL", base_url);
            }
        }

        // OpenAI
        if app_config.ai_provider.openai.enabled
            && !app_config.ai_provider.openai.api_key.is_empty()
        {
            let openai_models = vec![
                serde_json::json!({"id": "gpt-4o", "name": "gpt-4o"}),
                serde_json::json!({"id": "gpt-4o-mini", "name": "gpt-4o-mini"}),
                serde_json::json!({"id": "gpt-4-turbo", "name": "gpt-4-turbo"}),
                serde_json::json!({"id": "gpt-3.5-turbo", "name": "gpt-3.5-turbo"}),
            ];
            for model in &openai_models {
                let id = model.get("id").and_then(|v| v.as_str()).unwrap_or("");
                models.insert(format!("openai/{}", id), serde_json::json!({}));
            }
            providers.insert(
                "openai".to_string(),
                serde_json::json!({
                    "baseUrl": app_config.ai_provider.openai.base_url,
                    "apiKey": app_config.ai_provider.openai.api_key,
                    "models": openai_models
                }),
            );
            std::env::set_var(
                "OPENCLAW_CHANNEL_OPENAI_API_KEY",
                &app_config.ai_provider.openai.api_key,
            );
            std::env::set_var(
                "OPENCLAW_CHANNEL_OPENAI_BASE_URL",
                &app_config.ai_provider.openai.base_url,
            );
        }

        // Anthropic Claude
        if let Some(ref anthropic) = app_config.ai_provider.anthropic {
            if anthropic.enabled && !anthropic.api_key.is_empty() {
                let anthropic_models = vec![
                    serde_json::json!({"id": "claude-opus-4-5", "name": "claude-opus-4-5"}),
                    serde_json::json!({"id": "claude-sonnet-4-5", "name": "claude-sonnet-4-5"}),
                    serde_json::json!({"id": "claude-3-5-sonnet", "name": "claude-3-5-sonnet"}),
                    serde_json::json!({"id": "claude-3-haiku", "name": "claude-3-haiku"}),
                ];
                for model in &anthropic_models {
                    let id = model.get("id").and_then(|v| v.as_str()).unwrap_or("");
                    models.insert(format!("anthropic/{}", id), serde_json::json!({}));
                }
                providers.insert(
                    "anthropic".to_string(),
                    serde_json::json!({
                        "baseUrl": anthropic.base_url,
                        "apiKey": anthropic.api_key,
                        "models": anthropic_models
                    }),
                );
                std::env::set_var("OPENCLAW_CHANNEL_ANTHROPIC_API_KEY", &anthropic.api_key);
                std::env::set_var("OPENCLAW_CHANNEL_ANTHROPIC_BASE_URL", &anthropic.base_url);
            }
        }

        // Google Gemini
        if let Some(ref google) = app_config.ai_provider.google {
            if google.enabled && !google.api_key.is_empty() {
                let google_models = vec![
                    serde_json::json!({"id": "gemini-2.5-pro", "name": "gemini-2.5-pro"}),
                    serde_json::json!({"id": "gemini-2.0-flash", "name": "gemini-2.0-flash"}),
                    serde_json::json!({"id": "gemini-1.5-pro", "name": "gemini-1.5-pro"}),
                    serde_json::json!({"id": "gemini-1.5-flash", "name": "gemini-1.5-flash"}),
                ];
                for model in &google_models {
                    let id = model.get("id").and_then(|v| v.as_str()).unwrap_or("");
                    models.insert(format!("google/{}", id), serde_json::json!({}));
                }
                providers.insert(
                    "google".to_string(),
                    serde_json::json!({
                        "baseUrl": google.base_url,
                        "apiKey": google.api_key,
                        "models": google_models
                    }),
                );
                std::env::set_var("OPENCLAW_CHANNEL_GOOGLE_API_KEY", &google.api_key);
                std::env::set_var("OPENCLAW_CHANNEL_GOOGLE_BASE_URL", &google.base_url);
            }
        }

        // GitHub Copilot
        if let Some(ref copilot) = app_config.ai_provider.copilot {
            if copilot.enabled && !copilot.api_key.is_empty() {
                let copilot_models = vec![
                    serde_json::json!({"id": "gpt-4o-copilot", "name": "gpt-4o-copilot"}),
                    serde_json::json!({"id": "gpt-4-turbo-copilot", "name": "gpt-4-turbo-copilot"}),
                ];
                for model in &copilot_models {
                    let id = model.get("id").and_then(|v| v.as_str()).unwrap_or("");
                    models.insert(format!("copilot/{}", id), serde_json::json!({}));
                }
                providers.insert(
                    "copilot".to_string(),
                    serde_json::json!({
                        "baseUrl": copilot.base_url,
                        "apiKey": copilot.api_key,
                        "models": copilot_models
                    }),
                );
                std::env::set_var("OPENCLAW_CHANNEL_COPILOT_API_KEY", &copilot.api_key);
                std::env::set_var("OPENCLAW_CHANNEL_COPILOT_BASE_URL", &copilot.base_url);
            }
        }

        // 设置默认主模型（优先使用自定义模型）
        let primary_model = match app_config.ai_provider.current.as_str() {
            "qwen" => {
                if !app_config.ai_provider.qwen.custom_models.is_empty() {
                    format!("qwen/{}", app_config.ai_provider.qwen.custom_models[0])
                } else {
                    "qwen/qwen-plus".to_string()
                }
            }
            "zhipu" => {
                if let Some(ref zhipu) = app_config.ai_provider.zhipu {
                    if !zhipu.custom_models.is_empty() {
                        format!("zhipu/{}", zhipu.custom_models[0])
                    } else {
                        "zhipu/glm-4".to_string()
                    }
                } else {
                    "zhipu/glm-4".to_string()
                }
            }
            "deepseek" => {
                if !app_config.ai_provider.deepseek.custom_models.is_empty() {
                    format!(
                        "deepseek/{}",
                        app_config.ai_provider.deepseek.custom_models[0]
                    )
                } else {
                    "deepseek/deepseek-chat".to_string()
                }
            }
            "openai" => "openai/gpt-4o".to_string(),
            "anthropic" => "anthropic/claude-sonnet-4-5".to_string(),
            "google" => "google/gemini-2.5-pro".to_string(),
            "minimax" => {
                if let Some(ref minimax) = app_config.ai_provider.minimax {
                    if !minimax.custom_models.is_empty() {
                        format!("minimax/{}", minimax.custom_models[0])
                    } else {
                        "minimax/MiniMax-M2.5".to_string()
                    }
                } else {
                    "minimax/MiniMax-M2.5".to_string()
                }
            }
            "copilot" => "copilot/gpt-4o-copilot".to_string(),
            _ => "qwen/qwen-plus".to_string(),
        };

        gateway_config.agents.defaults.model.primary_model = primary_model.clone();
        let model_count = models.len();
        gateway_config.agents.defaults.models = models;

        // 6. 添加 meta 信息
        let meta = serde_json::json!({
            "lastTouchedVersion": "2026.2.2",
            "lastTouchedAt": chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
        });

        // 7. 构建完整配置
        let full_config = serde_json::json!({
            "meta": meta,
            "gateway": gateway_config.gateway,
            "models": {
                "providers": providers
            },
            "agents": gateway_config.agents,
            "messages": {
                "ackReactionScope": "group-mentions"
            },
            "commands": {
                "native": "auto",
                "nativeSkills": "auto"
            }
        });

        // 8. 创建 Gateway 配置目录
        if let Some(gateway_dir) = gateway_config_path.parent() {
            fs::create_dir_all(gateway_dir)
                .map_err(|e| anyhow::anyhow!("创建 Gateway 配置目录失败: {}", e))?;
        }

        // 9. 写入配置文件
        let content = serde_json::to_string_pretty(&full_config)
            .map_err(|e| anyhow::anyhow!("序列化 Gateway 配置失败: {}", e))?;
        fs::write(&gateway_config_path, content)
            .map_err(|e| anyhow::anyhow!("写入 Gateway 配置失败: {}", e))?;

        println!("✅ 配置已同步到 Gateway: {}", gateway_config_path.display());
        println!("   主模型: {}", primary_model);
        println!("   已配置模型: {} 个", model_count);

        Ok(())
    }
}

// ==================== 通道配置 ====================

/// 通道配置（Telegram、Discord 等）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ChannelsConfig {
    /// Telegram 配置
    #[serde(default)]
    pub telegram: TelegramChannelsConfig,
    /// Discord 配置
    #[serde(default)]
    pub discord: DiscordChannelsConfig,
    /// Slack 配置
    #[serde(default)]
    pub slack: SlackChannelsConfig,
}

/// Telegram 通道配置
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TelegramChannelsConfig {
    /// 是否启用
    #[serde(default)]
    pub enabled: bool,
    /// 账户列表
    #[serde(default)]
    pub accounts: Vec<TelegramAccountConfig>,
}

/// Telegram 账户配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelegramAccountConfig {
    /// 账户ID（唯一标识）
    pub id: String,
    /// Bot Token
    pub bot_token: String,
    /// 是否启用
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// 允许的群组ID列表（空表示允许所有）
    #[serde(default)]
    pub allowed_groups: Vec<String>,
    /// 允许的用户ID列表（空表示允许所有）
    #[serde(default)]
    pub allowed_users: Vec<String>,
    /// 代理URL（可选）
    #[serde(default)]
    pub proxy_url: Option<String>,
}

/// Discord 通道配置
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DiscordChannelsConfig {
    /// 是否启用
    #[serde(default)]
    pub enabled: bool,
    /// 账户列表
    #[serde(default)]
    pub accounts: Vec<DiscordAccountConfig>,
}

/// Discord 账户配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscordAccountConfig {
    /// 账户ID（唯一标识）
    pub id: String,
    /// Bot Token
    pub bot_token: String,
    /// 是否启用
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// 允许的服务器ID列表（空表示允许所有）
    #[serde(default)]
    pub allowed_guilds: Vec<String>,
    /// 允许的频道ID列表（空表示允许所有）
    #[serde(default)]
    pub allowed_channels: Vec<String>,
    /// 应用ID（用于斜杠命令）
    #[serde(default)]
    pub application_id: Option<String>,
}

/// Slack 通道配置
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SlackChannelsConfig {
    /// 是否启用
    #[serde(default)]
    pub enabled: bool,
    /// 账户列表
    #[serde(default)]
    pub accounts: Vec<SlackAccountConfig>,
}

/// Slack 账户配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlackAccountConfig {
    /// 账户ID（唯一标识）
    pub id: String,
    /// Bot Token (xoxb-...)
    pub bot_token: String,
    /// App Token (xapp-...) for Socket Mode
    #[serde(default)]
    pub app_token: Option<String>,
    /// 是否启用
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// 允许的频道ID列表（空表示允许所有）
    #[serde(default)]
    pub allowed_channels: Vec<String>,
    /// 允许的团队ID列表（空表示允许所有）
    #[serde(default)]
    pub allowed_teams: Vec<String>,
}

// ==================== 智能体注册表 ====================

/// 智能体注册表配置（对齐 openclaw.json 的 agents 结构）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AgentsRegistryConfig {
    /// 默认配置
    #[serde(default)]
    pub defaults: AgentDefaultsConfig,
    /// 智能体列表
    #[serde(default)]
    pub list: Vec<AgentConfigEntry>,
}

/// 智能体默认配置
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AgentDefaultsConfig {
    /// 默认模型
    #[serde(default)]
    pub model: Option<String>,
    /// 默认 workspace 路径
    #[serde(default)]
    pub workspace: Option<String>,
}

/// 智能体配置条目（存储在配置文件中）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfigEntry {
    /// 智能体 ID（唯一标识）
    pub id: String,
    /// 显示名称
    #[serde(default)]
    pub name: Option<String>,
    /// Workspace 路径
    #[serde(default)]
    pub workspace: Option<String>,
    /// 是否为默认智能体
    #[serde(default)]
    pub default: Option<bool>,
    /// 模型配置
    #[serde(default)]
    pub model: Option<String>,
    /// 身份配置（emoji, avatar 等）
    #[serde(default)]
    pub identity: Option<AgentIdentityConfig>,
}

/// 智能体身份配置（配置文件中的身份信息）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentIdentityConfig {
    /// 名称
    #[serde(default)]
    pub name: Option<String>,
    /// Emoji 图标
    #[serde(default)]
    pub emoji: Option<String>,
    /// 头像
    #[serde(default)]
    pub avatar: Option<String>,
}

/// 智能体注册表管理器
pub struct AgentRegistry {
    /// 配置文件路径
    config_file: PathBuf,
    /// 注册表配置
    config: AgentsRegistryConfig,
}

impl AgentRegistry {
    /// 创建新的智能体注册表
    pub fn new() -> Result<Self> {
        let config_dir = crate::paths::config_dir();
        let config_file = config_dir.join("agents.json");

        let config = if config_file.exists() {
            let content = fs::read_to_string(&config_file)?;
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            AgentsRegistryConfig::default()
        };

        Ok(Self {
            config_file,
            config,
        })
    }

    /// 列出所有智能体
    pub fn list(&self) -> &[AgentConfigEntry] {
        &self.config.list
    }

    /// 获取单个智能体
    pub fn get(&self, agent_id: &str) -> Option<&AgentConfigEntry> {
        self.config.list.iter().find(|a| a.id == agent_id)
    }

    /// 获取默认智能体 ID
    pub fn default_agent_id(&self) -> String {
        self.config
            .list
            .iter()
            .find(|a| a.default.unwrap_or(false))
            .map(|a| a.id.clone())
            .unwrap_or_else(|| {
                if self.config.list.is_empty() {
                    "main".to_string()
                } else {
                    self.config.list[0].id.clone()
                }
            })
    }

    /// 注册智能体
    pub fn register(&mut self, entry: AgentConfigEntry) -> Result<()> {
        // 检查是否已存在
        if self.get(&entry.id).is_some() {
            return Err(anyhow::anyhow!("智能体 '{}' 已存在", entry.id));
        }

        // 如果是第一个智能体，设置为默认
        let entry = if self.config.list.is_empty() {
            AgentConfigEntry {
                default: Some(true),
                ..entry
            }
        } else {
            entry
        };

        self.config.list.push(entry);
        self.save()
    }

    /// 更新智能体
    pub fn update(&mut self, agent_id: &str, updates: AgentConfigEntry) -> Result<()> {
        // 先检查是否存在
        if !self.config.list.iter().any(|a| a.id == agent_id) {
            return Err(anyhow::anyhow!("智能体 '{}' 不存在", agent_id));
        }

        // 如果设置为默认，先取消其他智能体的默认状态
        if updates.default.unwrap_or(false) {
            for a in &mut self.config.list {
                a.default = Some(false);
            }
        }

        // 然后更新目标智能体
        if let Some(entry) = self.config.list.iter_mut().find(|a| a.id == agent_id) {
            if updates.name.is_some() {
                entry.name = updates.name;
            }
            if updates.workspace.is_some() {
                entry.workspace = updates.workspace;
            }
            if updates.model.is_some() {
                entry.model = updates.model;
            }
            if updates.identity.is_some() {
                entry.identity = updates.identity;
            }
            if updates.default.is_some() {
                entry.default = updates.default;
            }
        }

        self.save()
    }

    /// 注销智能体
    pub fn unregister(&mut self, agent_id: &str) -> Result<Option<AgentConfigEntry>> {
        let index = self.config.list.iter().position(|a| a.id == agent_id);

        if let Some(i) = index {
            let removed = self.config.list.remove(i);

            // 如果移除的是默认智能体，设置第一个为默认
            if removed.default.unwrap_or(false) && !self.config.list.is_empty() {
                self.config.list[0].default = Some(true);
            }

            self.save()?;
            Ok(Some(removed))
        } else {
            Ok(None)
        }
    }

    /// 保存配置到文件
    fn save(&self) -> Result<()> {
        // 确保目录存在
        if let Some(parent) = self.config_file.parent() {
            fs::create_dir_all(parent)?;
        }

        let content = serde_json::to_string_pretty(&self.config)?;
        fs::write(&self.config_file, content)?;

        Ok(())
    }

    /// 同步 workspace 目录到注册表
    ///
    /// 扫描 agents 目录，将未注册的智能体添加到注册表
    pub fn sync_from_filesystem(&mut self) -> Result<Vec<String>> {
        let config_dir = crate::paths::config_dir();
        let agents_dir = config_dir.join("agents");

        if !agents_dir.exists() {
            return Ok(Vec::new());
        }

        let mut new_agents = Vec::new();

        for entry in fs::read_dir(&agents_dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.is_dir() {
                if let Some(agent_id) = path.file_name().and_then(|n| n.to_str()) {
                    // 跳过已注册的
                    if self.get(agent_id).is_some() {
                        continue;
                    }

                    // 跳过隐藏目录和非法名称
                    if agent_id.starts_with('.')
                        || agent_id.contains('/')
                        || agent_id.contains('\\')
                        || agent_id.is_empty()
                    {
                        continue;
                    }

                    // 从 IDENTITY.md 读取名称
                    let identity_path = path.join("workspace/IDENTITY.md");
                    let name = if identity_path.exists() {
                        if let Ok(content) = fs::read_to_string(&identity_path) {
                            // 简单解析 name 字段
                            content
                                .lines()
                                .find(|l| l.trim().starts_with("name:"))
                                .and_then(|l| {
                                    l.split(':').nth(1).map(|s| {
                                        s.trim().trim_matches('"').trim_matches('\'').to_string()
                                    })
                                })
                        } else {
                            None
                        }
                    } else {
                        None
                    };

                    // 注册智能体
                    let workspace = path.join("workspace").to_string_lossy().to_string();

                    let entry = AgentConfigEntry {
                        id: agent_id.to_string(),
                        name: name.or_else(|| Some(agent_id.to_string())),
                        workspace: Some(workspace),
                        default: None,
                        model: None,
                        identity: None,
                    };

                    self.config.list.push(entry);
                    new_agents.push(agent_id.to_string());
                }
            }
        }

        if !new_agents.is_empty() {
            self.save()?;
        }

        Ok(new_agents)
    }
}

/// 获取提供商的默认嵌入模型
///
/// 参考 OpenClaw 的设计，为每个 AI 提供商提供合理的默认嵌入模型，
/// 让用户无需手动配置 embedding_model 即可使用记忆系统。
pub fn get_default_embedding_model(provider: &str) -> Option<&'static str> {
    match provider {
        // 国内提供商
        "qwen" => Some("text-embedding-v3"),  // 通义千问
        "zhipu" => Some("embedding-3"),       // 智谱 GLM
        "deepseek" => Some("deepseek-embed"), // DeepSeek
        "moonshot" => None,                   // 月之暗面（暂无嵌入模型）
        "doubao" => None,                     // 豆包（需要单独配置）
        "ernie" => None,                      // 文心一言（需要单独配置）
        "minimax" => Some("embo-01"),         // MiniMax

        // 国际提供商
        "openai" => Some("text-embedding-3-small"), // OpenAI
        "google" | "gemini" => Some("gemini-embedding-001"), // Google Gemini
        "anthropic" => None,                        // Anthropic（暂无嵌入 API）

        // 自定义
        "custom" => None,
        _ => None,
    }
}
