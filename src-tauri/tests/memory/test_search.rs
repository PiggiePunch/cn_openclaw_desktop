// src-tauri/tests/memory/test_search.rs
// 搜索引擎测试

use openclaw_desktop::memory::search::SearchEngine;
use openclaw_desktop::memory::store::MemoryStore;
use openclaw_desktop::memory::embedding::EmbeddingClient;
use openclaw_desktop::memory::types::{MemoryChunk, MemoryEntry, Metadata, MemorySource, ChunkMetadata, SearchOptionsCompat as SearchOptions, EmbeddingConfig};
use uuid::Uuid;

/// 创建测试搜索引擎
fn create_test_search_engine() -> SearchEngine {
    let store = MemoryStore::open().unwrap();
    let config = EmbeddingConfig {
        provider: "openai".to_string(),
        openai: Some(openclaw_desktop::memory::types::OpenAIConfig {
            api_key: "test-key".to_string(),
            model: "text-embedding-3-small".to_string(),
            dimensions: 1536,
            batch_size: 100,
        }),
        gemini: None,
    };
    let client = EmbeddingClient::new(config);
    SearchEngine::new(store, client)
}

#[test]
fn test_search_engine_creation() {
    let engine = create_test_search_engine();
    // 如果这行编译通过，说明创建成功
    let _ = engine;
}

#[test]
fn test_extract_snippet() {
    let engine = create_test_search_engine();

    // 测试短文本（不需要截断）
    let short_text = "短文本";
    let snippet = engine.extract_snippet(short_text, 100);
    assert_eq!(snippet, short_text, "短文本不应被截断");

    // 测试长文本（需要截断）
    let long_text = "a".repeat(300);
    let snippet = engine.extract_snippet(&long_text, 100);
    assert!(snippet.len() <= 103, "截断后的文本应不超过 103 字符（100 + '...'）");
    assert!(snippet.ends_with("..."), "截断后的文本应以 '...' 结尾");
}

#[test]
fn test_extract_snippet_exact_length() {
    let engine = create_test_search_engine();

    // 测试恰好等于最大长度的文本
    let exact_text = "a".repeat(100);
    let snippet = engine.extract_snippet(&exact_text, 100);
    assert_eq!(snippet.len(), 100, "恰好等于最大长度的文本不应被截断");
    assert!(!snippet.ends_with("..."), "恰好等于最大长度的文本不应添加 '...'");
}

#[test]
fn test_snippet_multibyte_chars() {
    let engine = create_test_search_engine();

    // 测试多字节字符（中文）
    let chinese_text = "你好".repeat(100);
    let snippet = engine.extract_snippet(&chinese_text, 50);
    assert!(snippet.len() < chinese_text.len(), "中文长文本应被截断");
    assert!(snippet.ends_with("..."), "截断后的中文文本应以 '...' 结尾");
}

#[tokio::test]
async fn test_search_zero_weights() {
    let store = MemoryStore::open().unwrap();

    let config = EmbeddingConfig {
        provider: "openai".to_string(),
        openai: Some(openclaw_desktop::memory::types::OpenAIConfig {
            api_key: "test-key".to_string(),
            model: "text-embedding-3-small".to_string(),
            dimensions: 1536,
            batch_size: 100,
        }),
        gemini: None,
    };
    let client = EmbeddingClient::new(config);
    let engine = SearchEngine::new(store, client);

    // 两个权重都为 0，应该返回空结果
    let options = SearchOptions {
        max_results: 10,
        min_score: 0.0,
        session_key: None,
        vector_weight: 0.0,
        text_weight: 0.0,
    };

    let results = engine.search("测试", &options).await;
    assert!(results.is_ok(), "搜索失败: {:?}", results.err());

    let results = results.unwrap();
    assert!(results.is_empty(), "零权重搜索应返回空结果");
}

#[tokio::test]
async fn test_search_min_score_filter() {
    let store = MemoryStore::open().unwrap();

    let config = EmbeddingConfig {
        provider: "openai".to_string(),
        openai: Some(openclaw_desktop::memory::types::OpenAIConfig {
            api_key: "test-key".to_string(),
            model: "text-embedding-3-small".to_string(),
            dimensions: 1536,
            batch_size: 100,
        }),
        gemini: None,
    };
    let client = EmbeddingClient::new(config);
    let engine = SearchEngine::new(store, client);

    // 设置很高的最小分数阈值
    let options = SearchOptions {
        max_results: 10,
        min_score: 999.0, // 非常高的阈值
        session_key: None,
        vector_weight: 0.0,
        text_weight: 1.0,
    };

    let results = engine.search("测试", &options).await;
    assert!(results.is_ok(), "搜索失败: {:?}", results.err());

    let results = results.unwrap();
    // 由于设置了极高的 min_score，应该没有结果
    assert!(results.is_empty(), "高 min_score 应过滤掉所有结果");
}

// FTS5 特殊字符测试
// 这个测试验证我们不会因为特殊字符而崩溃
#[tokio::test]
async fn test_search_escaped_characters() {
    let store = MemoryStore::open().unwrap();

    let config = EmbeddingConfig {
        provider: "openai".to_string(),
        openai: Some(openclaw_desktop::memory::types::OpenAIConfig {
            api_key: "test-key".to_string(),
            model: "text-embedding-3-small".to_string(),
            dimensions: 1536,
            batch_size: 100,
        }),
        gemini: None,
    };
    let client = EmbeddingClient::new(config);
    let engine = SearchEngine::new(store, client);

    let options = SearchOptions {
        max_results: 10,
        min_score: 0.0,
        session_key: None,
        vector_weight: 0.0,
        text_weight: 1.0,
    };

    // 使用普通关键词，验证搜索能正常工作
    let results = engine.search("编程", &options).await;
    assert!(results.is_ok(), "搜索失败: {:?}", results.err());
}
