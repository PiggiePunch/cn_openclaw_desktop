// OpenClaw 原版配置格式支持
// 用于加载/保存兼容原版 openclaw 的配置文件

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use anyhow::Result;
use std::fs;
use std::path::PathBuf;

// ==================== 配置版本检测 ====================

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ConfigVersion {
    /// 旧版 (cn_openclaw_desktop): ai_provider.qwen, accounts 是 Vec
    V1,
    /// 新版 (原版 openclaw): models.providers, accounts 是 HashMap
    V2,
}

/// 检测配置版本
pub fn detect_version(json: &serde_json::Value) -> ConfigVersion {
    // 新版有 models.providers 结构
    if json.get("models")
        .and_then(|m| m.get("providers"))
        .map(|p| p.is_object())
        .unwrap_or(false)
    {
        return ConfigVersion::V2;
    }

    // 旧版有 ai_provider 结构
    if json.get("ai_provider").is_some() {
        return ConfigVersion::V1;
    }

    // 默认为新版
    ConfigVersion::V2
}

// ==================== 新版配置结构 (原版 openclaw) ====================

/// 主配置结构（原版 openclaw 格式）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OpenClawConfig {
    /// 配置元信息
    #[serde(default)]
    pub meta: Option<MetaConfig>,

    /// 模型配置（原版格式）
    #[serde(default)]
    pub models: ModelsConfig,

    /// Agent 配置（原版格式）
    #[serde(default)]
    pub agents: AgentsConfig,

    /// Agent 绑定
    #[serde(default)]
    pub bindings: Vec<BindingConfig>,

    /// 通道配置（原版格式：accounts 是 HashMap）
    #[serde(default, rename = "channels")]
    pub channels_v2: ChannelsConfigV2,

    /// 环境变量
    #[serde(default)]
    pub env: HashMap<String, String>,

    /// Gateway 配置
    #[serde(default, rename = "gateway")]
    pub gateway_v2: GatewayConfigV2,

    /// 搜索配置
    #[serde(default, rename = "search")]
    pub search_v2: SearchConfigV2,

    /// 消息配置
    #[serde(default)]
    pub messages: Option<MessagesConfig>,

    /// 命令配置
    #[serde(default)]
    pub commands: Option<CommandsConfig>,
}

// --- Meta ---
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetaConfig {
    #[serde(default, rename = "lastTouchedVersion")]
    pub last_touched_version: Option<String>,
    #[serde(default, rename = "lastTouchedAt")]
    pub last_touched_at: Option<String>,
}

impl Default for MetaConfig {
    fn default() -> Self {
        Self {
            last_touched_version: Some(env!("CARGO_PKG_VERSION").to_string()),
            last_touched_at: Some(chrono::Utc::now().to_rfc3339()),
        }
    }
}

// --- Models ---
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ModelsConfig {
    #[serde(default)]
    pub providers: HashMap<String, ProviderConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProviderConfig {
    #[serde(default, rename = "baseUrl")]
    pub base_url: String,
    #[serde(default, rename = "apiKey")]
    pub api_key: String,
    #[serde(default)]
    pub api: String,
    #[serde(default)]
    pub models: Vec<ModelDefinition>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ModelDefinition {
    pub id: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub reasoning: bool,
    #[serde(default)]
    pub input: Vec<String>,
    #[serde(default)]
    pub cost: ModelCost,
    #[serde(default, rename = "contextWindow")]
    pub context_window: Option<u32>,
    #[serde(default, rename = "maxTokens")]
    pub max_tokens: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ModelCost {
    #[serde(default)]
    pub input: f64,
    #[serde(default)]
    pub output: f64,
    #[serde(default, rename = "cacheRead")]
    pub cache_read: f64,
    #[serde(default, rename = "cacheWrite")]
    pub cache_write: f64,
}

// --- Agents ---
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentsConfig {
    #[serde(default)]
    pub defaults: AgentDefaults,
    #[serde(default)]
    pub list: Vec<AgentEntry>,
}

impl Default for AgentsConfig {
    fn default() -> Self {
        Self {
            defaults: AgentDefaults::default(),
            list: vec![AgentEntry { id: "main".to_string(), ..Default::default() }],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentDefaults {
    #[serde(default)]
    pub model: ModelSelector,
    #[serde(default)]
    pub workspace: Option<String>,
    #[serde(default)]
    pub models: HashMap<String, ModelAlias>,
    #[serde(default, rename = "memorySearch")]
    pub memory_search: Option<MemorySearchConfig>,
    #[serde(default)]
    pub compaction: Option<CompactionConfig>,
}

impl Default for AgentDefaults {
    fn default() -> Self {
        Self {
            model: ModelSelector::default(),
            workspace: None,
            models: HashMap::new(),
            memory_search: None,
            compaction: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelSelector {
    #[serde(default = "default_primary_model")]
    pub primary: String,
}

fn default_primary_model() -> String {
    "qwen/qwen-plus".to_string()
}

impl Default for ModelSelector {
    fn default() -> Self {
        Self {
            primary: default_primary_model(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ModelAlias {
    #[serde(default)]
    pub alias: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MemorySearchConfig {
    #[serde(default)]
    pub provider: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CompactionConfig {
    #[serde(default)]
    pub mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentEntry {
    pub id: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub workspace: Option<String>,
    #[serde(default, rename = "agentDir")]
    pub agent_dir: Option<String>,
    #[serde(default)]
    pub subagents: Option<SubagentsConfig>,
}

impl Default for AgentEntry {
    fn default() -> Self {
        Self {
            id: "main".to_string(),
            name: None,
            workspace: None,
            agent_dir: None,
            subagents: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SubagentsConfig {
    #[serde(default, rename = "allowAgents")]
    pub allow_agents: Vec<String>,
}

// --- Bindings ---
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BindingConfig {
    #[serde(rename = "agentId")]
    pub agent_id: String,
    pub r#match: BindingMatch,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BindingMatch {
    pub channel: String,
    #[serde(default, rename = "accountId")]
    pub account_id: Option<String>,
    #[serde(default, rename = "groupId")]
    pub group_id: Option<String>,
}

// --- Channels (新版: accounts 是 HashMap) ---
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ChannelsConfigV2 {
    #[serde(default)]
    pub telegram: TelegramChannelConfig,
    #[serde(default)]
    pub discord: DiscordChannelConfig,
    #[serde(default)]
    pub slack: SlackChannelConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TelegramChannelConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default, rename = "dmPolicy")]
    pub dm_policy: Option<String>,
    #[serde(default, rename = "botToken")]
    pub bot_token: Option<String>,
    #[serde(default, rename = "groupPolicy")]
    pub group_policy: Option<String>,
    #[serde(default)]
    pub streaming: Option<bool>,
    #[serde(default)]
    pub accounts: HashMap<String, TelegramAccountConfigV2>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelegramAccountConfigV2 {
    #[serde(default, rename = "botToken")]
    pub bot_token: Option<String>,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default, rename = "dmPolicy")]
    pub dm_policy: Option<String>,
    #[serde(default)]
    pub groups: HashMap<String, TelegramGroupConfig>,
    #[serde(default, rename = "allowFrom")]
    pub allow_from: Vec<String>,
    #[serde(default, rename = "groupPolicy")]
    pub group_policy: Option<String>,
    #[serde(default)]
    pub streaming: Option<bool>,
    #[serde(default, rename = "proxyUrl")]
    pub proxy_url: Option<String>,
}

impl Default for TelegramAccountConfigV2 {
    fn default() -> Self {
        Self {
            bot_token: None,
            enabled: true,
            dm_policy: None,
            groups: HashMap::new(),
            allow_from: Vec::new(),
            group_policy: None,
            streaming: None,
            proxy_url: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TelegramGroupConfig {
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default, rename = "requireMention")]
    pub require_mention: bool,
}

fn default_true() -> bool { true }

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DiscordChannelConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub accounts: HashMap<String, DiscordAccountConfigV2>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DiscordAccountConfigV2 {
    #[serde(default, rename = "botToken")]
    pub bot_token: Option<String>,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SlackChannelConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub accounts: HashMap<String, SlackAccountConfigV2>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SlackAccountConfigV2 {
    #[serde(default, rename = "botToken")]
    pub bot_token: Option<String>,
    #[serde(default, rename = "appToken")]
    pub app_token: Option<String>,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

// --- Gateway ---
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayConfigV2 {
    #[serde(default = "default_gateway_port")]
    pub port: u16,
    #[serde(default)]
    pub mode: Option<String>,
    #[serde(default)]
    pub bind: Option<String>,
    #[serde(default)]
    pub auth: Option<GatewayAuthConfig>,
    #[serde(default)]
    pub tls: Option<GatewayTlsConfig>,
    #[serde(default)]
    pub tailscale: Option<TailscaleConfig>,
}

fn default_gateway_port() -> u16 { 18789 }

impl Default for GatewayConfigV2 {
    fn default() -> Self {
        Self {
            port: 18789,
            mode: Some("local".to_string()),
            bind: Some("loopback".to_string()),
            auth: None,
            tls: None,
            tailscale: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GatewayAuthConfig {
    #[serde(default)]
    pub mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GatewayTlsConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default, rename = "auto_generate")]
    pub auto_generate: bool,
    #[serde(default, rename = "cert_path")]
    pub cert_path: Option<String>,
    #[serde(default, rename = "key_path")]
    pub key_path: Option<String>,
    #[serde(default, rename = "ca_path")]
    pub ca_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TailscaleConfig {
    #[serde(default)]
    pub mode: String,
    #[serde(default, rename = "resetOnExit")]
    pub reset_on_exit: bool,
}

// --- Search ---
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SearchConfigV2 {
    #[serde(default)]
    pub provider: String,
    #[serde(default)]
    pub enabled: bool,
    #[serde(default, rename = "max_results")]
    pub max_results: Option<u32>,
    #[serde(default, rename = "timeout_seconds")]
    pub timeout_seconds: Option<u32>,
    #[serde(default, rename = "cache_ttl_minutes")]
    pub cache_ttl_minutes: Option<u32>,
    #[serde(default)]
    pub brave: Option<BraveSearchConfigV2>,
    #[serde(default)]
    pub duckduckgo: Option<DuckDuckGoSearchConfig>,
    #[serde(default)]
    pub perplexity: Option<PerplexitySearchConfig>,
    #[serde(default)]
    pub grok: Option<GrokSearchConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BraveSearchConfigV2 {
    #[serde(default, rename = "api_key")]
    pub api_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DuckDuckGoSearchConfig {
    // no fields
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PerplexitySearchConfig {
    #[serde(default, rename = "api_key")]
    pub api_key: String,
    #[serde(default, rename = "base_url")]
    pub base_url: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GrokSearchConfig {
    #[serde(default, rename = "api_key")]
    pub api_key: String,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default, rename = "inline_citations")]
    pub inline_citations: bool,
}

// --- Messages ---
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessagesConfig {
    #[serde(default, rename = "ackReactionScope")]
    pub ack_reaction_scope: String,
}

impl Default for MessagesConfig {
    fn default() -> Self {
        Self {
            ack_reaction_scope: "group-mentions".to_string(),
        }
    }
}

// --- Commands ---
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CommandsConfig {
    #[serde(default)]
    pub native: String,
    #[serde(default, rename = "nativeSkills")]
    pub r#type: String,
    #[serde(default)]
    pub restart: Option<bool>,
    #[serde(default, rename = "ownerDisplay")]
    pub owner_display: Option<String>,
}

// ==================== 迁逻辑 ====================

/// 配置迁移器
pub struct ConfigMigrator;

impl ConfigMigrator {
    /// 从 v1 格式 (cn_openclaw_desktop) 迁移到 v2 格式 (原版 openclaw)
    pub fn migrate_from_v1(v1: &crate::config::AppConfig) -> OpenClawConfig {
        let mut v2 = OpenClawConfig::default();

        // 1. 迁移 AI Provider -> models.providers
        let providers = Self::migrate_providers(&v1.ai_provider);
        v2.models.providers = providers;

        // 设置默认模型
        let current = &v1.ai_provider.current;
        let primary_model = Self::get_primary_model(&v1.ai_provider, current);
        v2.agents.defaults.model.primary = primary_model;

        // 2. 迁移 channels (Vec -> HashMap)
        v2.channels_v2 = Self::migrate_channels(&v1.channels);

        // 3. 迁移 gateway
        // 使用 v1 的 port，其他字段使用默认值
        v2.gateway_v2 = GatewayConfigV2 {
            port: v1.gateway.port,
            ..Default::default()
        };

        // 4. 迁移 search
        v2.search_v2 = SearchConfigV2 {
            provider: v1.search.provider.clone(),
            enabled: v1.search.enabled,
            ..Default::default()
        };

        // 5. 创建默认 Agent 列表
        v2.agents.list = vec![AgentEntry {
            id: "main".to_string(),
            name: if !v1.user.agent_name.is_empty() {
                Some(v1.user.agent_name.clone())
            } else {
                None
            },
            workspace: None,
            agent_dir: None,
            subagents: None,
        }];

        // 6. 创建默认绑定
        for (idx, acc) in v1.channels.telegram.accounts.iter().enumerate() {
            let account_id = if idx == 0 { "default".to_string() } else { acc.id.clone() };
            v2.bindings.push(BindingConfig {
                agent_id: "main".to_string(),
                r#match: BindingMatch {
                    channel: "telegram".to_string(),
                    account_id: Some(account_id),
                    group_id: None,
                },
            });
        }

        // 7. 保留元信息
        v2.meta = Some(MetaConfig {
            last_touched_version: Some(env!("CARGO_PKG_VERSION").to_string()),
            last_touched_at: Some(chrono::Utc::now().to_rfc3339()),
        });

        v2
    }

    /// 迁移 AI 提供商配置
    fn migrate_providers(ai_provider: &crate::config::AIProvider) -> HashMap<String, ProviderConfig> {
        let mut providers = HashMap::new();
        let current = &ai_provider.current;

        // 通义千问
        if !ai_provider.qwen.api_key.is_empty() || current == "qwen" {
            providers.insert("qwen".to_string(), ProviderConfig {
                base_url: if ai_provider.qwen.base_url.is_empty() {
                    "https://dashscope.aliyuncs.com/compatible-mode/v1".to_string()
                } else {
                    ai_provider.qwen.base_url.clone()
                },
                api_key: ai_provider.qwen.api_key.clone(),
                api: "openai-chat".to_string(),
                models: Self::build_model_list(&ai_provider.qwen.custom_models, &ai_provider.qwen.model),
            });
        }

        // DeepSeek
        if !ai_provider.deepseek.api_key.is_empty() || current == "deepseek" {
            providers.insert("deepseek".to_string(), ProviderConfig {
                base_url: if ai_provider.deepseek.base_url.is_empty() {
                    "https://api.deepseek.com/v1".to_string()
                } else {
                    ai_provider.deepseek.base_url.clone()
                },
                api_key: ai_provider.deepseek.api_key.clone(),
                api: "openai-chat".to_string(),
                models: Self::build_model_list(&ai_provider.deepseek.custom_models, &ai_provider.deepseek.model),
            });
        }

        // 智谱 GLM
        if let Some(ref zhipu) = ai_provider.zhipu {
            if !zhipu.api_key.is_empty() || current == "zhipu" {
                providers.insert("zhipu".to_string(), ProviderConfig {
                    base_url: if zhipu.base_url.is_empty() {
                        "https://open.bigmodel.cn/api/paas/v4".to_string()
                    } else {
                        zhipu.base_url.clone()
                    },
                    api_key: zhipu.api_key.clone(),
                    api: "openai-chat".to_string(),
                    models: Self::build_model_list(&zhipu.custom_models, &zhipu.model),
                });
            }
        }

        // OpenAI
        if !ai_provider.openai.api_key.is_empty() || current == "openai" {
            providers.insert("openai".to_string(), ProviderConfig {
                base_url: if ai_provider.openai.base_url.is_empty() {
                    "https://api.openai.com/v1".to_string()
                } else {
                    ai_provider.openai.base_url.clone()
                },
                api_key: ai_provider.openai.api_key.clone(),
                api: "openai-chat".to_string(),
                models: Self::build_model_list(&ai_provider.openai.custom_models, &ai_provider.openai.model),
            });
        }

        // 其他提供商...
        // 保存当前选择的提供商
        if !providers.contains_key(current) {
            providers.insert(current.clone(), ProviderConfig {
                base_url: String::new(),
                api_key: String::new(),
                api: "openai-chat".to_string(),
                models: vec![ModelDefinition {
                    id: "default".to_string(),
                    name: Some("Default Model".to_string()),
                    ..Default::default()
                }],
            });
        }

        providers
    }

    /// 构建模型列表
    fn build_model_list(custom_models: &[String], default_model: &str) -> Vec<ModelDefinition> {
        if !custom_models.is_empty() {
            custom_models.iter().map(|m| ModelDefinition {
                id: m.clone(),
                name: Some(m.clone()),
                ..Default::default()
            }).collect()
        } else {
            vec![ModelDefinition {
                id: default_model.to_string(),
                name: Some(default_model.to_string()),
                ..Default::default()
            }]
        }
    }

    /// 获取主模型标识
    fn get_primary_model(ai_provider: &crate::config::AIProvider, current: &str) -> String {
        let default_model = match current {
            "qwen" => &ai_provider.qwen.model,
            "deepseek" => &ai_provider.deepseek.model,
            "zhipu" => if let Some(ref z) = ai_provider.zhipu { &z.model } else { "glm-4" },
            "openai" => &ai_provider.openai.model,
            _ => "default",
        };
        format!("{}/{}", current, default_model)
    }

    /// 迁移通道配置
    fn migrate_channels(channels: &crate::config::ChannelsConfig) -> ChannelsConfigV2 {
        let mut v2 = ChannelsConfigV2::default();

        // Telegram: Vec -> HashMap
        for (idx, acc) in channels.telegram.accounts.iter().enumerate() {
            let account_id = if idx == 0 { "default".to_string() } else { acc.id.clone() };
            let mut groups = HashMap::new();
            for g in &acc.allowed_groups {
                groups.insert(g.clone(), TelegramGroupConfig {
                    enabled: true,
                    require_mention: false,
                });
            }

            v2.telegram.accounts.insert(account_id, TelegramAccountConfigV2 {
                bot_token: if !acc.bot_token.is_empty() { Some(acc.bot_token.clone()) } else { None },
                enabled: acc.enabled,
                groups,
                allow_from: acc.allowed_users.clone(),
                proxy_url: acc.proxy_url.clone(),
                ..Default::default()
            });
        }
        v2.telegram.enabled = channels.telegram.enabled;

        // Discord
        for (idx, acc) in channels.discord.accounts.iter().enumerate() {
            let account_id = if idx == 0 { "default".to_string() } else { acc.id.clone() };
            v2.discord.accounts.insert(account_id, DiscordAccountConfigV2 {
                bot_token: if !acc.bot_token.is_empty() { Some(acc.bot_token.clone()) } else { None },
                enabled: acc.enabled,
            });
        }
        v2.discord.enabled = channels.discord.enabled;

        // Slack
        for (idx, acc) in channels.slack.accounts.iter().enumerate() {
            let account_id = if idx == 0 { "default".to_string() } else { acc.id.clone() };
            v2.slack.accounts.insert(account_id, SlackAccountConfigV2 {
                bot_token: if !acc.bot_token.is_empty() { Some(acc.bot_token.clone()) } else { None },
                app_token: acc.app_token.clone(),
                enabled: acc.enabled,
            });
        }
        v2.slack.enabled = channels.slack.enabled;

        v2
    }

    /// 从 v2 格式 (原版 openclaw) 转换到 v1 格式 (cn_openclaw_desktop)
    pub fn to_v1(v2: &OpenClawConfig) -> crate::config::AppConfig {
        use crate::config::*;

        let mut v1 = AppConfig::default();

        // 1. 转换 providers -> ai_provider
        for (provider_name, provider_config) in &v2.models.providers {
            match provider_name.as_str() {
                "qwen" => {
                    v1.ai_provider.qwen.api_key = provider_config.api_key.clone();
                    v1.ai_provider.qwen.base_url = provider_config.base_url.clone();
                    if let Some(model) = provider_config.models.first() {
                        v1.ai_provider.qwen.model = model.id.clone();
                    }
                    v1.ai_provider.qwen.custom_models = provider_config.models.iter()
                        .skip(1)
                        .map(|m| m.id.clone())
                        .collect();
                }
                "deepseek" => {
                    v1.ai_provider.deepseek.api_key = provider_config.api_key.clone();
                    v1.ai_provider.deepseek.base_url = provider_config.base_url.clone();
                    if let Some(model) = provider_config.models.first() {
                        v1.ai_provider.deepseek.model = model.id.clone();
                    }
                }
                "zhipu" => {
                    v1.ai_provider.zhipu = Some(ZhipuConfig {
                        api_key: provider_config.api_key.clone(),
                        base_url: provider_config.base_url.clone(),
                        model: provider_config.models.first().map(|m| m.id.clone()).unwrap_or_else(|| "glm-4".to_string()),
                        custom_models: provider_config.models.iter().map(|m| m.id.clone()).collect(),
                        enabled: !provider_config.api_key.is_empty(),
                        embedding_model: None,
                    });
                }
                "openai" => {
                    v1.ai_provider.openai.api_key = provider_config.api_key.clone();
                    v1.ai_provider.openai.base_url = provider_config.base_url.clone();
                    if let Some(model) = provider_config.models.first() {
                        v1.ai_provider.openai.model = model.id.clone();
                    }
                }
                _ => {}
            }
        }

        // 2. 设置当前提供商
        let primary = &v2.agents.defaults.model.primary;
        let parts: Vec<&str> = primary.split('/').collect();
        if parts.len() >= 1 {
            v1.ai_provider.current = parts[0].to_string();
        }

        // 3. 转换 channels (HashMap -> Vec)
        for (account_id, acc_config) in &v2.channels_v2.telegram.accounts {
            v1.channels.telegram.accounts.push(TelegramAccountConfig {
                id: account_id.clone(),
                bot_token: acc_config.bot_token.clone().unwrap_or_default(),
                enabled: acc_config.enabled,
                allowed_groups: acc_config.groups.keys().cloned().collect(),
                allowed_users: acc_config.allow_from.clone(),
                proxy_url: acc_config.proxy_url.clone(),
            });
        }
        v1.channels.telegram.enabled = v2.channels_v2.telegram.enabled;

        // 4. 转换 gateway
        v1.gateway.port = v2.gateway_v2.port;

        // 5. 转换 search
        v1.search.provider = v2.search_v2.provider.clone();
        v1.search.enabled = v2.search_v2.enabled;

        // 6. 转换 user
        if let Some(main_agent) = v2.agents.list.first() {
            v1.user.agent_name = main_agent.name.clone().unwrap_or_default();
        }

        v1
    }

    /// 保存配置文件 (v2 格式)
    pub fn save_v2(config: &OpenClawConfig, path: &PathBuf) -> Result<()> {
        let content = serde_json::to_string_pretty(config)?;
        fs::write(path, content)?;
        Ok(())
    }
}
