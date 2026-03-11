// 子 Agent 功能测试
//
// 测试子 Agent 生成和管理的各种功能

use openclaw_desktop::agents::subagent::{
    SubAgentManager, SubAgentConfig, SubAgentId, SubAgentStatus, SubAgentStats,
};

fn create_test_config(name: &str, description: &str) -> SubAgentConfig {
    SubAgentConfig {
        name: name.to_string(),
        description: description.to_string(),
        system_prompt: "你是一个测试助手".to_string(),
        tools: vec!["test_tool".to_string()],
        timeout_ms: 30000,
    }
}

#[test]
fn test_subagent_id_format() {
    let id = SubAgentId::new();
    assert!(id.to_string().starts_with("sub-"));
}

#[test]
fn test_subagent_config_from_default() {
    let config = SubAgentConfig::default();
    assert_eq!(config.name, "子 Agent");
    assert_eq!(config.timeout_ms, 60000);
}

#[test]
fn test_subagent_manager_max_subagents() {
    let manager = SubAgentManager::new(2);
    assert_eq!(manager.get_max_subagents(), 2);
}

#[test]
fn test_spawn_single_agent() {
    let manager = SubAgentManager::new(5);
    let rt = tokio::runtime::Runtime::new().unwrap();

    rt.block_on(async {
        let config = create_test_config("测试 Agent", "测试描述");
        let result = manager.spawn_agent(config, "测试任务").await;

        assert!(result.is_ok());
        let spawn_result = result.unwrap();
        assert!(spawn_result.success);
        assert!(spawn_result.result.is_some());

        // 验证结果包含任务信息
        assert!(spawn_result.result.unwrap().contains("测试 Agent"));
    });
}

#[test]
fn test_spawn_multiple_agents() {
    let manager = SubAgentManager::new(5);
    let rt = tokio::runtime::Runtime::new().unwrap();

    rt.block_on(async {
        let config1 = create_test_config("Agent 1", "描述 1");
        let config2 = create_test_config("Agent 2", "描述 2");

        let result1 = manager.spawn_agent(config1, "任务 1").await.unwrap();
        let result2 = manager.spawn_agent(config2, "任务 2").await.unwrap();

        assert!(result1.success);
        assert!(result2.success);
        assert_ne!(result1.agent_id.to_string(), result2.agent_id.to_string());
    });
}

#[test]
fn test_list_agents() {
    let manager = SubAgentManager::new(5);
    let rt = tokio::runtime::Runtime::new().unwrap();

    rt.block_on(async {
        let config = create_test_config("测试 Agent", "测试描述");
        manager.spawn_agent(config, "测试任务").await.unwrap();

        let agents = manager.list_agents().await;
        assert_eq!(agents.len(), 1);
        assert_eq!(agents[0].config.name, "测试 Agent");
        assert_eq!(agents[0].status, SubAgentStatus::Completed);
    });
}

#[test]
fn test_get_agent() {
    let manager = SubAgentManager::new(5);
    let rt = tokio::runtime::Runtime::new().unwrap();

    rt.block_on(async {
        let config = create_test_config("获取测试", "用于测试获取");
        let result = manager.spawn_agent(config, "测试").await.unwrap();
        let agent_id = result.agent_id;

        let info = manager.get_agent(&agent_id).await;
        assert!(info.is_some());
        assert_eq!(info.unwrap().config.name, "获取测试");
    });
}

#[test]
fn test_terminate_agent() {
    let manager = SubAgentManager::new(5);
    let rt = tokio::runtime::Runtime::new().unwrap();

    rt.block_on(async {
        let config = create_test_config("终止测试", "用于测试终止");
        let result = manager.spawn_agent(config, "测试").await.unwrap();
        let agent_id = result.agent_id;

        // 终止 Agent
        let terminated = manager.terminate_agent(&agent_id).await.unwrap();
        assert!(terminated);

        // 验证状态
        let info = manager.get_agent(&agent_id).await;
        assert_eq!(info.unwrap().status, SubAgentStatus::Terminated);
    });
}

#[test]
fn test_terminate_nonexistent_agent() {
    let manager = SubAgentManager::new(5);
    let rt = tokio::runtime::Runtime::new().unwrap();

    rt.block_on(async {
        let fake_id = SubAgentId::new();
        let terminated = manager.terminate_agent(&fake_id).await.unwrap();
        assert!(!terminated);
    });
}

#[test]
fn test_cleanup_completed() {
    let manager = SubAgentManager::new(5);
    let rt = tokio::runtime::Runtime::new().unwrap();

    rt.block_on(async {
        // 创建几个已完成的 Agent
        let config = create_test_config("清理测试", "用于测试清理");
        manager.spawn_agent(config.clone(), "任务 1").await.unwrap();
        manager.spawn_agent(config.clone(), "任务 2").await.unwrap();

        assert_eq!(manager.list_agents().await.len(), 2);

        // 清理已完成的
        let cleaned = manager.cleanup_completed().await;
        assert_eq!(cleaned, 2);

        // 验证列表已清空
        assert_eq!(manager.list_agents().await.len(), 0);
    });
}

#[test]
fn test_stats() {
    let manager = SubAgentManager::new(3);
    let rt = tokio::runtime::Runtime::new().unwrap();

    rt.block_on(async {
        let config = create_test_config("统计测试", "用于测试统计");

        // 创建几个 Agent
        manager.spawn_agent(config.clone(), "任务 1").await.unwrap();
        manager.spawn_agent(config.clone(), "任务 2").await.unwrap();

        let stats = manager.stats().await;
        assert_eq!(stats.total, 2);
        assert_eq!(stats.completed, 2);
        assert_eq!(stats.failed, 0);
        assert_eq!(stats.max_allowed, 3);
    });
}

#[test]
fn test_concurrent_limit_enforced() {
    let manager = SubAgentManager::new(2); // 最多 2 个
    let rt = tokio::runtime::Runtime::new().unwrap();

    rt.block_on(async {
        let config = create_test_config("限制测试", "用于测试限制");

        // 创建第 1 个 - 应该成功
        let result1 = manager.spawn_agent(config.clone(), "任务 1").await.unwrap();
        assert!(result1.success);

        // 创建第 2 个 - 应该成功
        let result2 = manager.spawn_agent(config.clone(), "任务 2").await.unwrap();
        assert!(result2.success);

        // 创建第 3 个 - 应该失败（超过限制）
        let result3 = manager.spawn_agent(config.clone(), "任务 3").await.unwrap();
        assert!(!result3.success);
        assert!(result3.error.is_some());
        assert!(result3.error.unwrap().contains("超过最大并发"));
    });
}

#[test]
fn test_agent_result_fields() {
    let manager = SubAgentManager::new(5);
    let rt = tokio::runtime::Runtime::new().unwrap();

    rt.block_on(async {
        let config = create_test_config("字段测试", "测试结果字段");
        let result = manager.spawn_agent(config, "测试消息").await.unwrap();

        assert!(result.success);
        assert!(result.result.is_some());
        assert!(result.error.is_none());

        // 验证结果包含配置信息
        let result_content = result.result.unwrap();
        assert!(result_content.contains("字段测试"));
    });
}

#[test]
fn test_serialization() {
    let config = SubAgentConfig {
        name: "序列化测试".to_string(),
        description: "测试序列化".to_string(),
        system_prompt: "测试提示".to_string(),
        tools: vec!["tool1".to_string(), "tool2".to_string()],
        timeout_ms: 5000,
    };

    let json = serde_json::to_string(&config).unwrap();
    assert!(json.contains("序列化测试"));

    let deserialized: SubAgentConfig = serde_json::from_str(&json).unwrap();
    assert_eq!(deserialized.name, "序列化测试");
    assert_eq!(deserialized.tools.len(), 2);
}

#[test]
fn test_stats_serialization() {
    let stats = SubAgentStats {
        total: 10,
        running: 2,
        completed: 7,
        failed: 1,
        max_allowed: 5,
    };

    let json = serde_json::to_string(&stats).unwrap();
    assert!(json.contains("\"total\":10"));

    let deserialized: SubAgentStats = serde_json::from_str(&json).unwrap();
    assert_eq!(deserialized.total, 10);
}
