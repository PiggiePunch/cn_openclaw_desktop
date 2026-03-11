// 会话归档功能测试
//
// 测试会话归档器的各种功能

use openclaw_desktop::agents::archive::{SessionArchiver, ArchiveSession, ArchiveResult, ArchiveId};
use openclaw_desktop::agents::types::{ChatMessage, MessageRole};
use chrono::{Utc, Duration};

fn create_test_message(role: MessageRole, content: &str) -> ChatMessage {
    ChatMessage {
        role,
        content: content.to_string(),
        tool_calls: None,
        tool_call_id: None,
    }
}

fn create_test_session(id: &str, days_since_active: i64) -> ArchiveSession {
    let last_active = if days_since_active >= 0 {
        Some(Utc::now() - Duration::days(days_since_active))
    } else {
        None
    };

    ArchiveSession {
        id: id.to_string(),
        messages: vec![
            create_test_message(MessageRole::User, "Test message"),
            create_test_message(MessageRole::Assistant, "Test response"),
        ],
        last_active_at: last_active,
    }
}

#[test]
fn test_needs_archive_old_session() {
    let archiver = SessionArchiver::new(30);

    // 超过 30 天未活跃
    let session = create_test_session("test-1", 35);
    assert!(archiver.needs_archive(session.last_active_at));
}

#[test]
fn test_no_archive_needed_recent_session() {
    let archiver = SessionArchiver::new(30);

    // 仅 7 天前活跃
    let session = create_test_session("test-2", 7);
    assert!(!archiver.needs_archive(session.last_active_at));
}

#[test]
fn test_no_archive_threshold_boundary() {
    let archiver = SessionArchiver::new(30);

    // 正好 30 天
    let session = create_test_session("test-3", 30);
    assert!(archiver.needs_archive(session.last_active_at));
}

#[test]
fn test_no_archive_without_last_active() {
    let archiver = SessionArchiver::new(30);

    // 没有活跃时间记录
    let session = ArchiveSession {
        id: "test-4".to_string(),
        messages: vec![],
        last_active_at: None,
    };

    assert!(!archiver.needs_archive(session.last_active_at));
}

#[test]
fn test_generate_summary_with_content() {
    let archiver = SessionArchiver::default_config();

    let messages = vec![
        create_test_message(MessageRole::User, "如何学习 Rust？"),
        create_test_message(MessageRole::Assistant, "建议从官方文档开始..."),
        create_test_message(MessageRole::User, "有什么推荐的书籍吗？"),
        create_test_message(MessageRole::Assistant, "《Rust 程序设计语言》是经典..."),
    ];

    let summary = archiver.generate_summary(&messages);

    assert!(summary.contains("会话包含 4 条消息"));
    assert!(summary.contains("用户消息: 2 条"));
    assert!(summary.contains("助手消息: 2 条"));
    assert!(summary.contains("如何学习 Rust"));
}

#[test]
fn test_generate_summary_empty_session() {
    let archiver = SessionArchiver::default_config();

    let summary = archiver.generate_summary(&[]);
    assert_eq!(summary, "[空会话]");
}

#[test]
fn test_generate_summary_long_content_truncation() {
    let archiver = SessionArchiver::default_config();

    let long_content = "这是一条很长的消息内容".repeat(10);
    let messages = vec![
        create_test_message(MessageRole::User, &long_content),
    ];

    let summary = archiver.generate_summary(&messages);

    // 长内容应该被截断
    assert!(summary.contains("..."));
}

#[test]
fn test_archive_session_without_memory_manager() {
    let archiver = SessionArchiver::new(30);

    let session = create_test_session("test-5", 35);

    // 即使没有记忆管理器，归档也应该成功（返回模拟 ID）
    let result = tokio::runtime::Runtime::new().unwrap().block_on(async {
        archiver.archive_session(&session.id, &session.messages, session.last_active_at).await
    });

    assert!(result.is_ok());
}

#[test]
fn test_archive_id_generation() {
    let id1 = ArchiveId::new();
    let id2 = ArchiveId::new();

    // IDs 应该是唯一的
    assert_ne!(id1.to_string(), id2.to_string());

    // IDs 应该是有效的 UUID 格式
    assert!(uuid::Uuid::parse_str(&id1.to_string()).is_ok());
    assert!(uuid::Uuid::parse_str(&id2.to_string()).is_ok());
}

#[test]
fn test_batch_archive_sessions() {
    let archiver = SessionArchiver::new(30);

    let sessions = vec![
        create_test_session("old-session-1", 45),
        create_test_session("old-session-2", 60),
        create_test_session("recent-session", 10),
    ];

    let results = tokio::runtime::Runtime::new().unwrap().block_on(async {
        archiver.archive_sessions(sessions).await
    });

    // 应该返回 3 个结果
    assert_eq!(results.len(), 3);

    // 检查结果类型
    for result in &results {
        match result {
            ArchiveResult::Archived { session_id, .. } => {
                assert!(session_id.starts_with("old-session"));
            }
            ArchiveResult::Skipped { session_id, reason } => {
                assert_eq!(session_id, "recent-session");
                assert!(reason.contains("活跃"));
            }
            ArchiveResult::Failed { .. } => {
                panic!("不应该有失败的归档");
            }
        }
    }
}

#[test]
fn test_custom_archive_threshold() {
    let archiver = SessionArchiver::new(7); // 7 天阈值

    let session = create_test_session("test-6", 8);
    assert!(archiver.needs_archive(session.last_active_at));

    let recent_session = create_test_session("test-7", 5);
    assert!(!archiver.needs_archive(recent_session.last_active_at));
}
