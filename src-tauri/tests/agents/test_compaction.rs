// 会话压缩功能测试
//
// 测试会话压缩器的各种功能

use openclaw_desktop::agents::compaction::SessionCompactor;
use openclaw_desktop::agents::types::{ChatMessage, MessageRole};

fn create_test_message(role: MessageRole, content: &str) -> ChatMessage {
    ChatMessage {
        role,
        content: content.to_string(),
        tool_calls: None,
        tool_call_id: None,
    }
}

#[test]
fn test_default_compactor_config() {
    let compactor = SessionCompactor::default_config();

    assert_eq!(compactor.max_messages, 100);
    assert_eq!(compactor.summary_threshold, 50);
    assert_eq!(compactor.keep_recent, 20);
    // P3 优化：检查默认摘要长度限制
    assert_eq!(compactor.max_summary_length, 8000);
}

#[test]
fn test_needs_compaction_true() {
    let compactor = SessionCompactor::new(10, 5, 3);

    // 创建超过阈值的消息
    let messages: Vec<_> = (0..15)
        .map(|i| {
            create_test_message(
                if i % 2 == 0 { MessageRole::User } else { MessageRole::Assistant },
                &format!("Message {}", i),
            )
        })
        .collect();

    assert!(compactor.needs_compaction(&messages));
}

#[test]
fn test_needs_compaction_false() {
    let compactor = SessionCompactor::new(10, 5, 3);

    // 创建低于阈值的消息
    let messages = vec![
        create_test_message(MessageRole::User, "Hello"),
        create_test_message(MessageRole::Assistant, "Hi"),
    ];

    assert!(!compactor.needs_compaction(&messages));
}

#[test]
fn test_needs_summary_true() {
    // P3.3 修复：使用有效的配置
    let compactor = SessionCompactor::new(100, 30, 20);

    let messages: Vec<_> = (0..40)
        .map(|_| create_test_message(MessageRole::User, "Test"))
        .collect();

    assert!(compactor.needs_summary(&messages));
}

#[test]
fn test_needs_summary_false() {
    // P3.3 修复：使用有效的配置
    let compactor = SessionCompactor::new(100, 30, 20);

    let messages: Vec<_> = (0..5)
        .map(|_| create_test_message(MessageRole::User, "Test"))
        .collect();

    assert!(!compactor.needs_summary(&messages));
}

#[test]
fn test_compact_simple_preserves_system_messages() {
    let compactor = SessionCompactor::new(10, 5, 2);

    let messages = vec![
        create_test_message(MessageRole::System, "System prompt"),
        create_test_message(MessageRole::User, "Message 1"),
        create_test_message(MessageRole::Assistant, "Response 1"),
        create_test_message(MessageRole::User, "Message 2"),
        create_test_message(MessageRole::Assistant, "Response 2"),
    ];

    let result = compactor.compact_simple(&messages);

    // 应该保留系统消息
    assert!(result.iter().any(|m| {
        matches!(m.role, MessageRole::System) && m.content == "System prompt"
    }));
}

#[test]
fn test_compact_simple_keeps_recent_messages() {
    let compactor = SessionCompactor::new(10, 5, 2);

    let messages = vec![
        create_test_message(MessageRole::User, "Message 1"),
        create_test_message(MessageRole::Assistant, "Response 1"),
        create_test_message(MessageRole::User, "Message 2"),
        create_test_message(MessageRole::Assistant, "Response 2"),
        create_test_message(MessageRole::User, "Message 3"),
        create_test_message(MessageRole::Assistant, "Response 3"),
    ];

    let result = compactor.compact_simple(&messages);

    // 应该保留最后 2 条非系统消息
    let non_system: Vec<_> = result
        .iter()
        .filter(|m| !matches!(m.role, MessageRole::System))
        .collect();

    assert_eq!(non_system.len(), 2);
    // 保留最后 2 条非系统消息：Message 3 和 Response 3
    assert_eq!(non_system[0].content, "Message 3");
    assert_eq!(non_system[1].content, "Response 3");
}

#[test]
fn test_compact_simple_empty_messages() {
    let compactor = SessionCompactor::default_config();
    let messages: Vec<ChatMessage> = vec![];

    let result = compactor.compact_simple(&messages);
    assert!(result.is_empty());
}

#[test]
fn test_clean_summary() {
    let compactor = SessionCompactor::default_config();

    let dirty_summary = "  This is a summary  \n\n  With extra whitespace  \n  ";
    let cleaned = compactor.clean_summary(dirty_summary);

    assert_eq!(cleaned, "This is a summary\nWith extra whitespace");
}

#[test]
fn test_clean_summary_empty() {
    let compactor = SessionCompactor::default_config();

    let empty_summary = "";
    let cleaned = compactor.clean_summary(empty_summary);

    assert_eq!(cleaned, "");
}

#[test]
fn test_build_conversation_text_excludes_system() {
    let compactor = SessionCompactor::default_config();

    let messages = vec![
        create_test_message(MessageRole::System, "System prompt"),
        create_test_message(MessageRole::User, "Hello"),
        create_test_message(MessageRole::Assistant, "Hi there"),
    ];

    let text = compactor.build_conversation_text(&messages);

    // 系统消息应该被跳过
    assert!(!text.contains("System prompt"));

    // 用户和助手消息应该被包含
    assert!(text.contains("用户: Hello"));
    assert!(text.contains("助手: Hi there"));
}

#[test]
fn test_build_conversation_text_limits_length() {
    let compactor = SessionCompactor::default_config();

    // 创建大量消息（每条消息约 100 字符，确保超过 8000 字符限制）
    let long_content = "This is a much longer message with significantly more content to ensure we exceed the character limit for testing the truncation functionality. ";
    let messages: Vec<_> = (0..100)
        .map(|i| {
            create_test_message(
                MessageRole::User,
                &format!("{} Message number: {}", long_content, i),
            )
        })
        .collect();

    let text = compactor.build_conversation_text(&messages);

    // 应该被截断
    assert!(text.len() < 9000);
    assert!(text.contains("...(后续内容已省略)"));
}

// P3 优化：测试可配置的摘要长度限制
#[test]
fn test_custom_summary_limit() {
    // 创建一个限制为 500 字符的压缩器
    let compactor = SessionCompactor::with_summary_limit(10, 5, 2, 500);

    let long_content = "This is a much longer message with significantly more content to ensure we exceed the character limit for testing the truncation functionality. ";
    let messages: Vec<_> = (0..50)
        .map(|i| {
            create_test_message(
                MessageRole::User,
                &format!("{} Message number: {}", long_content, i),
            )
        })
        .collect();

    let text = compactor.build_conversation_text(&messages);

    // 应该被截断（由于自定义的 500 字符限制）
    assert!(text.len() < 600);
    assert!(text.contains("...(后续内容已省略)"));
}

#[test]
fn test_default_trait() {
    let compactor = SessionCompactor::default();

    assert_eq!(compactor.max_messages, 100);
    assert_eq!(compactor.summary_threshold, 50);
    assert_eq!(compactor.keep_recent, 20);
    // P3 优化：检查默认 trait 实现也包含新字段
    assert_eq!(compactor.max_summary_length, 8000);
}

// P3.3 优化：测试配置验证
#[test]
fn test_valid_configuration() {
    let compactor = SessionCompactor::new(100, 50, 20);
    assert!(compactor.is_valid());
}

#[test]
fn test_invalid_configuration_max_messages_not_greater_than_threshold() {
    // 这个测试会 panic，因为 max_messages 必须大于 summary_threshold
    // 我们使用 should_panic 来标记这个测试
}

#[test]
#[should_panic(expected = "max_messages")]
fn test_invalid_max_messages() {
    // max_messages (50) 不大于 summary_threshold (50)
    SessionCompactor::new(50, 50, 20);
}

#[test]
#[should_panic(expected = "summary_threshold")]
fn test_invalid_summary_threshold() {
    // summary_threshold (10) 不大于 keep_recent (20)
    SessionCompactor::new(100, 10, 20);
}

#[test]
#[should_panic(expected = "keep_recent")]
fn test_invalid_keep_recent() {
    // keep_recent (0) 小于 1
    SessionCompactor::new(100, 50, 0);
}

#[test]
#[should_panic(expected = "max_summary_length")]
fn test_invalid_summary_length() {
    // max_summary_length (50) 小于 100
    SessionCompactor::with_summary_limit(100, 50, 20, 50);
}
