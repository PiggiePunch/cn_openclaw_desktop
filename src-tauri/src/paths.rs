//! 统一配置路径
//!
//! 使用 ~/.openclaw/ 目录（与原版 openclaw 一致）：
//! - macOS: ~/.openclaw
//! - Linux: ~/.openclaw
//! - Windows: %USERPROFILE%/.openclaw
//!
//! # 重要
//! 所有模块应该使用此模块的函数，而不是重复定义路径逻辑。

use std::path::PathBuf;

/// 获取用户主目录
fn home_dir() -> Option<PathBuf> {
    dirs::home_dir()
}

/// Get the base data directory (~/.openclaw)
///
/// Returns:
/// - macOS: ~/.openclaw
/// - Linux: ~/.openclaw
/// - Windows: %USERPROFILE%/.openclaw
pub fn data_dir() -> PathBuf {
    home_dir()
        .unwrap_or_else(|| {
            log::warn!("无法获取用户主目录，使用临时目录作为回退");
            std::env::temp_dir()
        })
        .join(".openclaw")
}

/// Get the base config directory (same as data_dir for simplicity)
///
/// 使用 ~/.openclaw/openclaw.json 作为配置文件
pub fn config_dir() -> PathBuf {
    data_dir()
}

/// 兼容旧接口（已弃用，请使用 data_dir()）
#[deprecated(since = "1.0.0", note = "请使用 data_dir() 代替")]
pub fn old_config_dir() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| {
            log::warn!("无法获取标准配置目录，使用临时目录作为回退");
            std::env::temp_dir().join("openclaw_config")
        })
        .join("openclaw")
}

/// 确保配置目录存在
///
/// 返回配置目录路径，如果目录不存在则创建
pub fn ensure_config_dir() -> std::io::Result<PathBuf> {
    let dir = config_dir();
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

/// Get the config directory as Result (for error handling)
pub fn config_dir_result() -> Result<PathBuf, String> {
    Ok(data_dir())
}

/// OpenClaw 安装目录 (~/.openclaw/core/)
pub fn openclaw_install_dir() -> PathBuf {
    data_dir().join("core")
}

/// OpenClaw 配置文件 (~/.openclaw/openclaw.json)
pub fn openclaw_config_file() -> PathBuf {
    data_dir().join("openclaw.json")
}

/// Get the workspace directory
pub fn workspace_dir() -> PathBuf {
    config_dir().join("workspace")
}

/// Get the agents root directory
pub fn agents_dir() -> PathBuf {
    config_dir().join("agents")
}

/// Get the memories directory
pub fn memories_dir() -> PathBuf {
    config_dir().join("memories")
}

/// Get agent-specific directory
///
/// # Arguments
/// * `agent_id` - The agent identifier
///
/// # Returns
/// Path to the agent directory: {config_dir}/agents/{agent_id}
pub fn agent_dir(agent_id: &str) -> PathBuf {
    agents_dir().join(agent_id)
}

/// Get agent sessions directory
///
/// # Returns
/// Path to the agent sessions: {config_dir}/agents/{agent_id}/sessions
pub fn agent_sessions_dir(agent_id: &str) -> PathBuf {
    agent_dir(agent_id).join("sessions")
}

/// Get agent workspace directory
///
/// # Returns
/// Path to the agent workspace: {config_dir}/agents/{agent_id}/workspace
pub fn agent_workspace_dir(agent_id: &str) -> PathBuf {
    agent_dir(agent_id).join("workspace")
}

/// Get config file path (~/.openclaw/openclaw.json)
pub fn config_file() -> PathBuf {
    openclaw_config_file()
}

/// Get gateway config file path
pub fn gateway_config_file() -> PathBuf {
    config_dir().join("gateway.json")
}

/// Get tasks file path (for scheduler)
pub fn tasks_file() -> PathBuf {
    config_dir().join("tasks.json")
}
