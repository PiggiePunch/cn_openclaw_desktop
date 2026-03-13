// Agent 间通信 (A2A) 功能测试
//
// 测试 Agent 间通信的各种功能

use chrono::Utc;
use openclaw_desktop::agents::a2a::{A2AManager, AgentId, AgentInfo, AgentStatus};

fn create_test_agent(id: &str, name: &str, status: AgentStatus) -> AgentInfo {
    AgentInfo {
        id: AgentId::new(id),
        name: name.to_string(),
        description: format!("{} Agent", name),
        status,
        capabilities: vec!["test_capability".to_string()],
        created_at: Utc::now().timestamp(),
    }
}

#[test]
fn test_agent_id_new() {
    let id = AgentId::new("test-agent");
    assert_eq!(id.to_string(), "test-agent");
}

#[test]
fn test_agent_id_is_local() {
    let local_id = AgentId::new("agent-browser");
    assert!(local_id.is_local());
    assert!(!local_id.is_remote());

    let remote_id = AgentId::new("http://remote:8080");
    assert!(!remote_id.is_local());
    assert!(remote_id.is_remote());
}

#[test]
fn test_agent_id_agent_type() {
    let browser_agent = AgentId::new("agent-browser");
    assert_eq!(browser_agent.agent_type(), Some("browser".to_string()));

    let memory_agent = AgentId::new("agent-memory");
    assert_eq!(memory_agent.agent_type(), Some("memory".to_string()));

    let remote_agent = AgentId::new("http://remote:8080");
    assert_eq!(remote_agent.agent_type(), None);
}

#[test]
fn test_agent_manager_register_and_list() {
    let manager = A2AManager::new();
    let rt = tokio::runtime::Runtime::new().unwrap();

    rt.block_on(async {
        // 注册两个 Agent
        let agent1 = create_test_agent("test-agent-1", "Test 1", AgentStatus::Active);
        let agent2 = create_test_agent("test-agent-2", "Test 2", AgentStatus::Inactive);

        manager.register_agent(agent1).await.unwrap();
        manager.register_agent(agent2).await.unwrap();

        // 列出所有 Agent
        let all_agents = manager.list_agents(None).await;
        assert_eq!(all_agents.len(), 2);

        // 过滤活跃 Agent
        let active_agents = manager.list_agents(Some(AgentStatus::Active)).await;
        assert_eq!(active_agents.len(), 1);
        assert_eq!(active_agents[0].id.to_string(), "test-agent-1");
    });
}

#[test]
fn test_agent_manager_unregister() {
    let manager = A2AManager::new();
    let rt = tokio::runtime::Runtime::new().unwrap();

    rt.block_on(async {
        let agent = create_test_agent("test-unregister", "Test", AgentStatus::Active);
        manager.register_agent(agent).await.unwrap();

        assert_eq!(manager.list_agents(None).await.len(), 1);

        manager
            .unregister_agent(&AgentId::new("test-unregister"))
            .await
            .unwrap();

        assert_eq!(manager.list_agents(None).await.len(), 0);
    });
}

#[test]
fn test_agent_manager_get_agent() {
    let manager = A2AManager::new();
    let rt = tokio::runtime::Runtime::new().unwrap();

    rt.block_on(async {
        let agent = create_test_agent("test-get", "Test Get", AgentStatus::Active);
        manager.register_agent(agent).await.unwrap();

        let retrieved = manager.get_agent(&AgentId::new("test-get")).await;
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().name, "Test Get");

        let not_found = manager.get_agent(&AgentId::new("not-found")).await;
        assert!(not_found.is_none());
    });
}

#[test]
fn test_agent_call_success() {
    let manager = A2AManager::new();
    let rt = tokio::runtime::Runtime::new().unwrap();

    rt.block_on(async {
        manager.init_default_agents().await.unwrap();

        let result = manager
            .call_agent(&AgentId::new("agent-browser"), "测试消息")
            .await;

        // P2 修复：无 runtime 时返回错误（防止生产环境误用）
        assert!(result.is_ok());
        let call_result = result.unwrap();
        // 由于没有配置 runtime，现在应该返回失败
        assert!(!call_result.success);
        assert!(call_result.error.is_some());
        assert!(call_result.error.unwrap().contains("Runtime 未配置"));
    });
}

#[test]
fn test_agent_call_not_found() {
    let manager = A2AManager::new();
    let rt = tokio::runtime::Runtime::new().unwrap();

    rt.block_on(async {
        let result = manager
            .call_agent(&AgentId::new("non-existent"), "测试消息")
            .await;

        assert!(result.is_err());
    });
}

#[test]
fn test_agent_call_inactive() {
    let manager = A2AManager::new();
    let rt = tokio::runtime::Runtime::new().unwrap();

    rt.block_on(async {
        let agent = create_test_agent("inactive-agent", "Inactive", AgentStatus::Inactive);
        manager.register_agent(agent).await.unwrap();

        let result = manager
            .call_agent(&AgentId::new("inactive-agent"), "测试消息")
            .await;

        assert!(result.is_ok());
        let call_result = result.unwrap();
        assert!(!call_result.success);
        assert!(call_result.error.is_some());
        assert!(call_result.error.unwrap().contains("状态不可用"));
    });
}

#[test]
fn test_agent_broadcast() {
    let manager = A2AManager::new();
    let rt = tokio::runtime::Runtime::new().unwrap();

    rt.block_on(async {
        manager.init_default_agents().await.unwrap();

        let agent_ids = vec![AgentId::new("agent-browser"), AgentId::new("agent-memory")];

        let results = manager.broadcast(&agent_ids, "广播消息").await;

        assert_eq!(results.len(), 2);
        // P2 修复：无 runtime 时所有调用都失败
        assert!(results.iter().all(|r| !r.success));
        assert!(results.iter().all(|r| r.error.is_some()));
    });
}

#[test]
fn test_agent_broadcast_with_nonexistent() {
    let manager = A2AManager::new();
    let rt = tokio::runtime::Runtime::new().unwrap();

    rt.block_on(async {
        manager.init_default_agents().await.unwrap();

        let agent_ids = vec![AgentId::new("agent-browser"), AgentId::new("non-existent")];

        let results = manager.broadcast(&agent_ids, "广播消息").await;

        assert_eq!(results.len(), 2);
        // P2 修复：无 runtime 时第一个也失败（之前是假成功）
        assert!(!results[0].success);
        // 第二个因为不存在而失败
        assert!(!results[1].success);
    });
}

#[test]
fn test_agent_status_equality() {
    assert_eq!(AgentStatus::Active, AgentStatus::Active);
    assert_ne!(AgentStatus::Active, AgentStatus::Inactive);
}

#[test]
fn test_agent_info_serialization() {
    let info = AgentInfo {
        id: AgentId::new("test-agent"),
        name: "Test Agent".to_string(),
        description: "Test Description".to_string(),
        status: AgentStatus::Active,
        capabilities: vec!["cap1".to_string(), "cap2".to_string()],
        created_at: 1234567890,
    };

    let json = serde_json::to_string(&info).unwrap();
    assert!(json.contains("test-agent"));
    assert!(json.contains("Test Agent"));

    let deserialized: AgentInfo = serde_json::from_str(&json).unwrap();
    assert_eq!(deserialized.id.to_string(), "test-agent");
    assert_eq!(deserialized.name, "Test Agent");
}

#[test]
fn test_agent_with_timeout() {
    let manager = A2AManager::new().with_timeout(5000);
    assert_eq!(manager.timeout_ms(), 5000);
}

// P3.2 优化：测试超时机制
#[test]
fn test_call_agent_timeout_mechanism() {
    let manager = A2AManager::new().with_timeout(100); // 设置 100ms 超时
    let rt = tokio::runtime::Runtime::new().unwrap();

    rt.block_on(async {
        manager.init_default_agents().await.unwrap();

        // 测试 call_agent_with_timeout 方法存在且可调用
        let result = manager
            .call_agent_with_timeout(
                &AgentId::new("agent-browser"),
                "测试消息",
                100, // 100ms 超时
            )
            .await;

        // 应该返回成功（虽然可能失败，但不应该崩溃）
        assert!(result.is_ok());
        let call_result = result.unwrap();

        // 由于没有 runtime，应该失败
        assert!(!call_result.success);
        // 超时或 runtime 未配置的错误
        assert!(call_result.error.is_some());
    });
}

#[test]
fn test_init_default_agents() {
    let manager = A2AManager::new();
    let rt = tokio::runtime::Runtime::new().unwrap();

    rt.block_on(async {
        manager.init_default_agents().await.unwrap();

        let agents = manager.list_agents(None).await;
        assert_eq!(agents.len(), 3);

        let agent_ids: Vec<_> = agents.iter().map(|a| a.id.to_string()).collect();
        assert!(agent_ids.contains(&"agent-browser".to_string()));
        assert!(agent_ids.contains(&"agent-memory".to_string()));
        assert!(agent_ids.contains(&"agent-search".to_string()));
    });
}
