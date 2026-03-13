// 配置命令

use crate::config::{AppConfig, ConfigManager};
use crate::paths::{config_dir, data_dir};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

#[tauri::command]
pub async fn get_config() -> Result<AppConfig, String> {
    let manager = ConfigManager::new().map_err(|e| e.to_string())?;
    manager.load().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_config(config: AppConfig) -> Result<(), String> {
    let manager = ConfigManager::new().map_err(|e| e.to_string())?;
    manager.save(&config).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reset_config() -> Result<AppConfig, String> {
    let manager = ConfigManager::new().map_err(|e| e.to_string())?;
    manager.reset().map_err(|e| e.to_string())
}

/// 🔥 重置所有数据（删除整个配置目录）
#[tauri::command]
pub async fn reset_all_data() -> Result<(), String> {
    let config_dir = config_dir();

    if config_dir.exists() {
        std::fs::remove_dir_all(&config_dir).map_err(|e| format!("删除配置目录失败: {}", e))?;
        log::info!("✅ 已删除配置目录: {:?}", config_dir);
    }

    Ok(())
}

/// 🔥 直接保存 OpenClaw 配置到 ~/.openclaw/openclaw.json
/// 绕过 Gateway 的 baseHash 问题
#[tauri::command]
pub async fn save_openclaw_config(config_json: String) -> Result<(), String> {
    // 解析 JSON
    let mut incoming: serde_json::Value =
        serde_json::from_str(&config_json).map_err(|e| format!("JSON 格式错误: {}", e))?;

    let openclaw_dir = data_dir();

    // 确保目录存在
    if !openclaw_dir.exists() {
        fs::create_dir_all(&openclaw_dir).map_err(|e| format!("创建配置目录失败: {}", e))?;
    }

    let config_path = openclaw_dir.join("openclaw.json");
    let existing = if config_path.exists() {
        match fs::read_to_string(&config_path) {
            Ok(content) => serde_json::from_str::<serde_json::Value>(&content).ok(),
            Err(_) => None,
        }
    } else {
        None
    };

    // 防止把被脱敏的 token（__OPENCLAW_REDACTED__）写回配置导致 1006
    preserve_model_provider_api_keys(&mut incoming, existing.as_ref());
    let token = preserve_or_generate_gateway_token(&mut incoming, existing.as_ref());

    let final_json =
        serde_json::to_string_pretty(&incoming).map_err(|e| format!("序列化配置失败: {}", e))?;
    fs::write(&config_path, final_json).map_err(|e| format!("写入配置失败: {}", e))?;

    log::info!("✅ 已保存 OpenClaw 配置: {:?}", config_path);
    if let Some(token_value) = token {
        log::info!(
            "🔑 Gateway token 已确认: {}***",
            &token_value[..8.min(token_value.len())]
        );
    }
    Ok(())
}

/// 🔥 直接读取 OpenClaw 配置
#[tauri::command]
pub async fn get_openclaw_config() -> Result<String, String> {
    let config_path = data_dir().join("openclaw.json");

    if !config_path.exists() {
        return Err("配置文件不存在".to_string());
    }

    fs::read_to_string(&config_path).map_err(|e| format!("读取配置失败: {}", e))
}

/// 🔥 获取可用的 Gateway auth token（必要时自动修复/生成）
#[tauri::command]
pub async fn resolve_gateway_auth_token() -> Result<String, String> {
    let config_path = data_dir().join("openclaw.json");

    if !config_path.exists() {
        return Err("配置文件不存在".to_string());
    }

    let content = fs::read_to_string(&config_path).map_err(|e| format!("读取配置失败: {}", e))?;
    let mut config: Value =
        serde_json::from_str(&content).map_err(|e| format!("配置 JSON 解析失败: {}", e))?;
    let original = config.clone();

    let token = preserve_or_generate_gateway_token(&mut config, Some(&original))
        .ok_or_else(|| "无法生成 Gateway token".to_string())?;

    // 如有修复，写回文件
    if config != original {
        let final_json =
            serde_json::to_string_pretty(&config).map_err(|e| format!("序列化配置失败: {}", e))?;
        fs::write(&config_path, final_json).map_err(|e| format!("写入配置失败: {}", e))?;
        log::warn!("⚠️ 已自动修复无效的 Gateway token 并写回配置");
    }

    Ok(token)
}

fn is_redacted_secret(value: &str) -> bool {
    let s = value.trim();
    if s.is_empty() {
        return true;
    }
    if s == "__OPENCLAW_REDACTED__" {
        return true;
    }
    if s.contains("REDACTED") {
        return true;
    }
    s.chars().all(|ch| ch == '*')
}

fn read_provider_api_key(config: &Value, provider_id: &str) -> Option<String> {
    config
        .get("models")
        .and_then(|v| v.get("providers"))
        .and_then(|v| v.get(provider_id))
        .and_then(|v| v.get("apiKey"))
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn preserve_model_provider_api_keys(incoming: &mut Value, existing: Option<&Value>) {
    let Some(root) = incoming.as_object_mut() else {
        return;
    };
    let Some(models) = root.get_mut("models").and_then(|v| v.as_object_mut()) else {
        return;
    };
    let Some(providers) = models.get_mut("providers").and_then(|v| v.as_object_mut()) else {
        return;
    };

    for (provider_id, provider_val) in providers.iter_mut() {
        let Some(provider_obj) = provider_val.as_object_mut() else {
            continue;
        };
        let incoming_api_key = provider_obj
            .get("apiKey")
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_string());

        let needs_restore = match incoming_api_key {
            Some(ref key) => is_redacted_secret(key),
            None => false,
        };
        if !needs_restore {
            continue;
        }

        if let Some(prev_key) = existing.and_then(|cfg| read_provider_api_key(cfg, provider_id)) {
            if !is_redacted_secret(&prev_key) {
                provider_obj.insert("apiKey".to_string(), Value::String(prev_key));
                continue;
            }
        }

        provider_obj.remove("apiKey");
    }
}

fn read_gateway_token(config: &Value) -> Option<String> {
    config
        .get("gateway")
        .and_then(|v| v.get("auth"))
        .and_then(|v| v.get("token"))
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn ensure_gateway_auth_object(config: &mut Value) -> &mut serde_json::Map<String, Value> {
    if !config.is_object() {
        *config = json!({});
    }

    let root = config.as_object_mut().expect("root should be object");
    let gateway = root.entry("gateway").or_insert_with(|| json!({}));
    if !gateway.is_object() {
        *gateway = json!({});
    }

    let gateway_obj = gateway.as_object_mut().expect("gateway should be object");
    let auth = gateway_obj.entry("auth").or_insert_with(|| json!({}));
    if !auth.is_object() {
        *auth = json!({});
    }

    auth.as_object_mut().expect("auth should be object")
}

fn ensure_gateway_mode(config: &mut Value) {
    if !config.is_object() {
        *config = json!({});
    }

    let root = config.as_object_mut().expect("root should be object");
    let gateway = root.entry("gateway").or_insert_with(|| json!({}));
    if !gateway.is_object() {
        *gateway = json!({});
    }

    let gateway_obj = gateway.as_object_mut().expect("gateway should be object");
    let mode = gateway_obj
        .get("mode")
        .and_then(|v| v.as_str())
        .map(|s| s.trim())
        .unwrap_or("");

    if mode.is_empty() {
        gateway_obj.insert("mode".to_string(), Value::String("local".to_string()));
    }
}

fn preserve_or_generate_gateway_token(config: &mut Value, existing: Option<&Value>) -> Option<String> {
    ensure_gateway_mode(config);

    let current = read_gateway_token(config);

    let final_token = match current {
        Some(token) if !is_redacted_secret(&token) => token,
        _ => {
            if let Some(previous) = existing.and_then(read_gateway_token) {
                if !is_redacted_secret(&previous) {
                    previous
                } else {
                    format!("openclaw-cn-{}", uuid::Uuid::new_v4().as_simple())
                }
            } else {
                format!("openclaw-cn-{}", uuid::Uuid::new_v4().as_simple())
            }
        }
    };

    let auth_obj = ensure_gateway_auth_object(config);
    auth_obj.insert("mode".to_string(), Value::String("token".to_string()));
    auth_obj.insert("token".to_string(), Value::String(final_token.clone()));

    Some(final_token)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalAgentInfo {
    pub id: String,
    pub name: String,
    pub emoji: String,
    pub workspace: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalAgentIdentity {
    pub name: String,
    pub emoji: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalAgentWorkspace {
    pub agent_id: String,
    pub workspace: String,
    pub identity: LocalAgentIdentity,
    pub channels: Vec<String>,
    pub files: Vec<String>,
}

#[derive(Debug, Clone, Default)]
struct AgentHint {
    workspace: Option<PathBuf>,
    name: Option<String>,
    emoji: Option<String>,
}

fn expand_tilde(input: &str) -> PathBuf {
    if input == "~" {
        return dirs::home_dir().unwrap_or_else(|| PathBuf::from("/"));
    }

    if let Some(rest) = input.strip_prefix("~/") {
        if let Some(home) = dirs::home_dir() {
            return home.join(rest);
        }
    }

    PathBuf::from(input)
}

fn normalize_token(input: &str) -> String {
    input
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .flat_map(|ch| ch.to_lowercase())
        .collect::<String>()
}

fn common_prefix_len(a: &str, b: &str) -> usize {
    let mut len = 0usize;
    let mut ai = a.chars();
    let mut bi = b.chars();
    loop {
        match (ai.next(), bi.next()) {
            (Some(x), Some(y)) if x == y => len += 1,
            _ => break,
        }
    }
    len
}

fn parse_identity_markdown(content: &str) -> (Option<String>, Option<String>, Option<String>) {
    let mut name: Option<String> = None;
    let mut emoji: Option<String> = None;
    let mut description: Option<String> = None;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        if name.is_none() && (trimmed.starts_with("name:") || trimmed.starts_with("Name:")) {
            if let Some((_, value)) = trimmed.split_once(':') {
                let parsed = value.trim().trim_matches('"').trim_matches('\'');
                if !parsed.is_empty() {
                    name = Some(parsed.to_string());
                }
            }
        }
        if emoji.is_none() && (trimmed.starts_with("emoji:") || trimmed.starts_with("Emoji:")) {
            if let Some((_, value)) = trimmed.split_once(':') {
                let parsed = value.trim().trim_matches('"').trim_matches('\'');
                if !parsed.is_empty() {
                    emoji = Some(parsed.to_string());
                }
            }
        }
        if description.is_none()
            && (trimmed.starts_with("description:") || trimmed.starts_with("Description:"))
        {
            if let Some((_, value)) = trimmed.split_once(':') {
                let parsed = value.trim().trim_matches('"').trim_matches('\'');
                if !parsed.is_empty() {
                    description = Some(parsed.to_string());
                }
            }
        }

        if trimmed.starts_with("- **") && trimmed.contains(":**") {
            let after_prefix = trimmed.trim_start_matches("- **");
            if let Some((key, rest)) = after_prefix.split_once(":**") {
                let key_lc = key.trim().to_lowercase();
                let value = rest.trim().trim_matches('"').trim_matches('\'');
                if value.is_empty() || value.starts_with("_(") {
                    continue;
                }
                match key_lc.as_str() {
                    "name" if name.is_none() => name = Some(value.to_string()),
                    "emoji" if emoji.is_none() => emoji = Some(value.to_string()),
                    "description" if description.is_none() => description = Some(value.to_string()),
                    _ => {}
                }
            }
        }
    }

    (name, emoji, description)
}

fn parse_channels_markdown(content: &str) -> Vec<String> {
    for line in content.lines() {
        let trimmed = line.trim();
        if !(trimmed.starts_with("channels:") || trimmed.starts_with("Channels:")) {
            continue;
        }
        let Some((_, raw)) = trimmed.split_once(':') else {
            continue;
        };
        let value = raw.trim();
        if value.is_empty() {
            continue;
        }
        if let Ok(parsed) = serde_json::from_str::<Value>(value) {
            if let Some(arr) = parsed.as_array() {
                return arr
                    .iter()
                    .filter_map(|v| v.as_str().map(|s| s.trim().to_string()))
                    .filter(|s| !s.is_empty())
                    .collect();
            }
        }
    }
    Vec::new()
}

fn read_identity_from_workspace(
    workspace: &Path,
) -> (Option<String>, Option<String>, Option<String>) {
    let path = workspace.join("IDENTITY.md");
    if !path.exists() {
        return (None, None, None);
    }

    let Ok(content) = fs::read_to_string(path) else {
        return (None, None, None);
    };

    parse_identity_markdown(&content)
}

fn extract_hints_from_config_value(value: &Value, hints: &mut HashMap<String, AgentHint>) {
    let Some(agents) = value.get("agents") else {
        return;
    };

    if let Some(default_workspace) = agents
        .get("defaults")
        .and_then(|defaults| defaults.get("workspace"))
        .and_then(|v| v.as_str())
    {
        let hint = hints.entry("main".to_string()).or_default();
        if hint.workspace.is_none() {
            hint.workspace = Some(expand_tilde(default_workspace));
        }
    }

    let Some(list) = agents.get("list").and_then(|v| v.as_array()) else {
        return;
    };

    for item in list {
        let Some(id) = item
            .get("id")
            .and_then(|v| v.as_str())
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
        else {
            continue;
        };

        let hint = hints.entry(id.to_string()).or_default();
        if hint.workspace.is_none() {
            if let Some(workspace) = item.get("workspace").and_then(|v| v.as_str()) {
                hint.workspace = Some(expand_tilde(workspace));
            }
        }

        if hint.name.is_none() {
            if let Some(name) = item
                .get("identity")
                .and_then(|identity| identity.get("name"))
                .and_then(|v| v.as_str())
                .or_else(|| item.get("name").and_then(|v| v.as_str()))
            {
                let trimmed = name.trim();
                if !trimmed.is_empty() {
                    hint.name = Some(trimmed.to_string());
                }
            }
        }

        if hint.emoji.is_none() {
            if let Some(emoji) = item
                .get("identity")
                .and_then(|identity| identity.get("emoji"))
                .and_then(|v| v.as_str())
                .or_else(|| item.get("emoji").and_then(|v| v.as_str()))
            {
                let trimmed = emoji.trim();
                if !trimmed.is_empty() {
                    hint.emoji = Some(trimmed.to_string());
                }
            }
        }
    }
}

fn collect_agent_hints(base_dir: &Path) -> HashMap<String, AgentHint> {
    let mut hints: HashMap<String, AgentHint> = HashMap::new();
    let mut config_candidates: Vec<PathBuf> = Vec::new();

    let primary = base_dir.join("openclaw.json");
    if primary.exists() {
        config_candidates.push(primary);
    }

    if let Ok(entries) = fs::read_dir(base_dir) {
        let mut backups: Vec<(std::time::SystemTime, PathBuf)> = entries
            .filter_map(Result::ok)
            .filter_map(|entry| {
                let path = entry.path();
                let file_name = path.file_name()?.to_str()?.to_string();
                if !file_name.starts_with("openclaw.json.") {
                    return None;
                }
                let modified = entry
                    .metadata()
                    .ok()
                    .and_then(|m| m.modified().ok())
                    .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
                Some((modified, path))
            })
            .collect();

        backups.sort_by(|a, b| b.0.cmp(&a.0));
        config_candidates.extend(backups.into_iter().map(|(_, path)| path));
    }

    let mut seen = HashSet::new();
    for path in config_candidates {
        if !seen.insert(path.clone()) {
            continue;
        }

        let Ok(content) = fs::read_to_string(&path) else {
            continue;
        };
        let Ok(value) = serde_json::from_str::<Value>(&content) else {
            continue;
        };
        extract_hints_from_config_value(&value, &mut hints);
    }

    hints
}

fn discover_workspace_dirs(base_dir: &Path) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Ok(entries) = fs::read_dir(base_dir) {
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let Some(name) = path.file_name().and_then(|v| v.to_str()) else {
                continue;
            };
            if name == "workspace" || name.starts_with("workspace-") {
                dirs.push(path);
            }
        }
    }
    dirs
}

fn resolve_workspace_for_agent(
    agent_id: &str,
    base_dir: &Path,
    hints: &HashMap<String, AgentHint>,
    workspace_dirs: &[PathBuf],
    used: &mut HashSet<PathBuf>,
) -> Option<PathBuf> {
    if let Some(path) = hints
        .get(agent_id)
        .and_then(|hint| hint.workspace.as_ref())
        .map(PathBuf::from)
        .filter(|path| path.exists())
    {
        used.insert(path.clone());
        return Some(path);
    }

    if agent_id == "main" {
        let path = base_dir.join("workspace");
        if path.exists() {
            used.insert(path.clone());
            return Some(path);
        }
    }

    for candidate in [
        base_dir.join(format!("workspace-{}", agent_id)),
        base_dir.join(format!("workspace-{}", agent_id.replace('_', "-"))),
    ] {
        if candidate.exists() {
            used.insert(candidate.clone());
            return Some(candidate);
        }
    }

    let norm_agent = normalize_token(agent_id);
    if norm_agent.len() < 3 {
        return None;
    }

    let mut best: Option<(usize, PathBuf)> = None;
    for dir in workspace_dirs {
        if used.contains(dir) {
            continue;
        }
        let Some(name) = dir.file_name().and_then(|v| v.to_str()) else {
            continue;
        };
        let Some(suffix) = name.strip_prefix("workspace-") else {
            continue;
        };
        let score = common_prefix_len(&norm_agent, &normalize_token(suffix));
        if score < 4 {
            continue;
        }

        match &best {
            Some((best_score, _)) if *best_score >= score => {}
            _ => best = Some((score, dir.clone())),
        }
    }

    if let Some((_, path)) = best {
        used.insert(path.clone());
        return Some(path);
    }

    None
}

fn workspace_file_name_is_safe(file_name: &str) -> bool {
    let name = file_name.trim();
    if name.is_empty() {
        return false;
    }
    if name.contains('/') || name.contains('\\') || name.contains("..") {
        return false;
    }
    name.ends_with(".md") || name.ends_with(".MD")
}

fn build_local_agents_snapshot() -> Vec<LocalAgentInfo> {
    let base_dir = data_dir();
    let hints = collect_agent_hints(&base_dir);
    let workspace_dirs = discover_workspace_dirs(&base_dir);

    let mut ids: HashSet<String> = hints.keys().cloned().collect();
    ids.insert("main".to_string());

    let agents_dir = base_dir.join("agents");
    if let Ok(entries) = fs::read_dir(agents_dir) {
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            if let Some(id) = path.file_name().and_then(|v| v.to_str()) {
                let trimmed = id.trim();
                if !trimmed.is_empty() {
                    ids.insert(trimmed.to_string());
                }
            }
        }
    }

    let mut used_workspaces: HashSet<PathBuf> = HashSet::new();
    let mut rows: Vec<LocalAgentInfo> = Vec::new();

    let mut sorted_ids: Vec<String> = ids.into_iter().collect();
    sorted_ids.sort_unstable();
    sorted_ids.sort_by(|a, b| {
        if a == "main" {
            std::cmp::Ordering::Less
        } else if b == "main" {
            std::cmp::Ordering::Greater
        } else {
            a.cmp(b)
        }
    });

    for id in sorted_ids {
        let workspace_path = resolve_workspace_for_agent(
            &id,
            &base_dir,
            &hints,
            &workspace_dirs,
            &mut used_workspaces,
        );

        let (name_from_identity, emoji_from_identity, _description) = workspace_path
            .as_ref()
            .map(|path| read_identity_from_workspace(path))
            .unwrap_or((None, None, None));

        let hint = hints.get(&id);
        let name = name_from_identity
            .or_else(|| hint.and_then(|h| h.name.clone()))
            .unwrap_or_else(|| {
                if id == "main" {
                    "默认助手".to_string()
                } else {
                    id.clone()
                }
            });

        let emoji = emoji_from_identity
            .or_else(|| hint.and_then(|h| h.emoji.clone()))
            .unwrap_or_else(|| "🤖".to_string());

        rows.push(LocalAgentInfo {
            id: id.clone(),
            name,
            emoji,
            workspace: workspace_path
                .unwrap_or_else(|| {
                    if id == "main" {
                        base_dir.join("workspace")
                    } else {
                        base_dir.join(format!("workspace-{}", id))
                    }
                })
                .to_string_lossy()
                .to_string(),
        });
    }

    rows
}

fn find_local_agent(agent_id: &str) -> Option<LocalAgentInfo> {
    build_local_agents_snapshot()
        .into_iter()
        .find(|agent| agent.id == agent_id)
}

#[tauri::command]
pub async fn list_local_agents() -> Result<Vec<LocalAgentInfo>, String> {
    Ok(build_local_agents_snapshot())
}

#[tauri::command]
pub async fn load_local_agent_workspace(agent_id: String) -> Result<LocalAgentWorkspace, String> {
    let safe_agent_id = if agent_id.trim().is_empty() {
        "main".to_string()
    } else {
        agent_id.trim().to_string()
    };

    let agent = find_local_agent(&safe_agent_id)
        .ok_or_else(|| format!("未找到本地智能体: {}", safe_agent_id))?;
    let workspace = PathBuf::from(&agent.workspace);

    if !workspace.exists() {
        return Err(format!("Workspace 不存在: {}", workspace.to_string_lossy()));
    }

    let (name, emoji, description) = read_identity_from_workspace(&workspace);
    let identity = LocalAgentIdentity {
        name: name.unwrap_or_else(|| agent.name.clone()),
        emoji: emoji.unwrap_or_else(|| agent.emoji.clone()),
        description: description.unwrap_or_default(),
    };

    let channels = fs::read_to_string(workspace.join("CHANNELS.md"))
        .map(|content| parse_channels_markdown(&content))
        .unwrap_or_default();

    let mut files: Vec<String> = fs::read_dir(&workspace)
        .ok()
        .into_iter()
        .flat_map(|entries| entries.filter_map(Result::ok))
        .filter_map(|entry| {
            let path = entry.path();
            if !path.is_file() {
                return None;
            }
            let name = path.file_name()?.to_str()?.to_string();
            if !name.to_ascii_uppercase().ends_with(".MD") {
                return None;
            }
            Some(name)
        })
        .collect();
    files.sort_unstable();

    Ok(LocalAgentWorkspace {
        agent_id: safe_agent_id,
        workspace: workspace.to_string_lossy().to_string(),
        identity,
        channels,
        files,
    })
}

#[tauri::command]
pub async fn read_local_agent_workspace_file(
    agent_id: String,
    file_name: String,
) -> Result<String, String> {
    let safe_agent_id = if agent_id.trim().is_empty() {
        "main".to_string()
    } else {
        agent_id.trim().to_string()
    };
    let safe_file_name = file_name.trim().to_string();
    if !workspace_file_name_is_safe(&safe_file_name) {
        return Err(format!("非法文件名: {}", file_name));
    }

    let agent = find_local_agent(&safe_agent_id)
        .ok_or_else(|| format!("未找到本地智能体: {}", safe_agent_id))?;
    let path = PathBuf::from(agent.workspace).join(&safe_file_name);

    if !path.exists() {
        return Ok(String::new());
    }

    fs::read_to_string(path).map_err(|e| format!("读取文件失败: {}", e))
}

#[tauri::command]
pub async fn save_local_agent_workspace_file(
    agent_id: String,
    file_name: String,
    content: String,
) -> Result<(), String> {
    let safe_agent_id = if agent_id.trim().is_empty() {
        "main".to_string()
    } else {
        agent_id.trim().to_string()
    };
    let safe_file_name = file_name.trim().to_string();
    if !workspace_file_name_is_safe(&safe_file_name) {
        return Err(format!("非法文件名: {}", file_name));
    }

    let agent = find_local_agent(&safe_agent_id)
        .ok_or_else(|| format!("未找到本地智能体: {}", safe_agent_id))?;
    let workspace = PathBuf::from(agent.workspace);
    if !workspace.exists() {
        fs::create_dir_all(&workspace).map_err(|e| format!("创建 workspace 目录失败: {}", e))?;
    }

    let path = workspace.join(&safe_file_name);
    fs::write(path, content).map_err(|e| format!("写入文件失败: {}", e))
}
