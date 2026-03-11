// src-tauri/tests/memory/test_store.rs
// SQLite 存储层测试

use openclaw_desktop::memory::store::MemoryStore;
use openclaw_desktop::memory::types::{MemoryChunk, MemoryEntry, Metadata, MemorySource, ChunkMetadata};
use uuid::Uuid;

/// 清理测试数据库（删除数据但不删除数据库文件）
fn cleanup_test_db() {
    // 通过重新打开数据库来初始化，然后清理表数据
    if let Ok(store) = MemoryStore::open() {
        let _ = store.cleanup_all_data();
    }
}

#[test]
fn test_store_open() {
    let store = MemoryStore::open();
    assert!(store.is_ok(), "无法打开存储: {:?}", store.err());
}

#[test]
fn test_store_and_get_memory() {
    let store = MemoryStore::open().unwrap();

    let memory = MemoryEntry {
        id: Uuid::new_v4().to_string(),
        content: "测试记忆内容".to_string(),
        metadata: Metadata {
            created_at: Some(100),
            source: Some(MemorySource::Memory),
            tags: vec!["test".to_string(), "unit".to_string()],
            file_path: Some("/test/path.rs".to_string()),
        },
        created_at: 100,
        updated_at: 100,
    };

    // 存储记忆
    let result = store.store_memory(&memory);
    assert!(result.is_ok(), "存储记忆失败: {:?}", result.err());

    // 获取记忆
    let retrieved = store.get_memory(&memory.id);
    assert!(retrieved.is_ok(), "获取记忆失败: {:?}", retrieved.err());

    let retrieved = retrieved.unwrap();
    assert!(retrieved.is_some(), "记忆不存在");
    let retrieved = retrieved.unwrap();

    assert_eq!(retrieved.id, memory.id);
    assert_eq!(retrieved.content, memory.content);
    assert_eq!(retrieved.metadata.source, memory.metadata.source);
}

#[test]
fn test_store_and_get_chunk() {
    let store = MemoryStore::open().unwrap();

    // 首先创建父记忆，避免外键约束失败
    let memory_id = Uuid::new_v4().to_string();
    let memory = MemoryEntry {
        id: memory_id.clone(),
        content: "测试记忆".to_string(),
        metadata: Metadata {
            created_at: Some(100),
            source: Some(MemorySource::Memory),
            tags: vec!["test".to_string()],
            file_path: None,
        },
        created_at: 100,
        updated_at: 100,
    };
    store.store_memory(&memory).unwrap();

    let chunk = MemoryChunk {
        id: Uuid::new_v4().to_string(),
        content: "测试块内容".to_string(),
        embedding: None,
        metadata: ChunkMetadata {
            memory_id: memory_id.clone(),
            start_line: Some(1),
            end_line: Some(10),
            created_at: Some(100),
            source: Some(MemorySource::Memory),
            tags: vec!["test".to_string()],
            file_path: None,
        },
    };

    // 存储块
    let result = store.store_chunk(&chunk);
    assert!(result.is_ok(), "存储块失败: {:?}", result.err());

    // 获取块
    let retrieved = store.get_chunk_by_id(&chunk.id);
    assert!(retrieved.is_ok(), "获取块失败: {:?}", retrieved.err());

    let retrieved = retrieved.unwrap();
    assert!(retrieved.is_some(), "块不存在");
    let retrieved = retrieved.unwrap();

    assert_eq!(retrieved.id, chunk.id);
    assert_eq!(retrieved.content, chunk.content);
}

#[test]
fn test_store_embedding() {
    let store = MemoryStore::open().unwrap();

    // 首先创建父记忆和块，避免外键约束失败
    let memory_id = Uuid::new_v4().to_string();
    let memory = MemoryEntry {
        id: memory_id.clone(),
        content: "测试记忆".to_string(),
        metadata: Metadata {
            created_at: Some(100),
            source: Some(MemorySource::Memory),
            tags: vec!["test".to_string()],
            file_path: None,
        },
        created_at: 100,
        updated_at: 100,
    };
    store.store_memory(&memory).unwrap();

    let chunk_id = Uuid::new_v4().to_string();
    let chunk = MemoryChunk {
        id: chunk_id.clone(),
        content: "测试块内容".to_string(),
        embedding: None,
        metadata: ChunkMetadata {
            memory_id: memory_id.clone(),
            start_line: Some(1),
            end_line: Some(10),
            created_at: Some(100),
            source: Some(MemorySource::Memory),
            tags: vec!["test".to_string()],
            file_path: None,
        },
    };
    store.store_chunk(&chunk).unwrap();

    let embedding = vec![0.1_f32, 0.2, 0.3, 0.4, 0.5];

    // 存储嵌入
    let result = store.store_embedding(&chunk_id, &embedding);
    assert!(result.is_ok(), "存储嵌入失败: {:?}", result.err());
}

#[test]
fn test_fts_search() {
    // 清理数据库以确保测试独立性
    cleanup_test_db();

    let store = MemoryStore::open().unwrap();

    // 首先创建父记忆，避免外键约束失败
    let memory_id = Uuid::new_v4().to_string();
    let memory = MemoryEntry {
        id: memory_id.clone(),
        content: "测试记忆".to_string(),
        metadata: Metadata {
            created_at: Some(100),
            source: Some(MemorySource::Memory),
            tags: Vec::new(),
            file_path: None,
        },
        created_at: 100,
        updated_at: 100,
    };
    store.store_memory(&memory).unwrap();

    // 创建测试块
    let chunk1 = MemoryChunk {
        id: Uuid::new_v4().to_string(),
        content: "Rust 是一门系统编程语言".to_string(),
        embedding: None,
        metadata: ChunkMetadata {
            memory_id: memory_id.clone(),
            start_line: Some(1),
            end_line: Some(1),
            created_at: Some(100),
            source: Some(MemorySource::Memory),
            tags: Vec::new(),
            file_path: None,
        },
    };

    let chunk2 = MemoryChunk {
        id: Uuid::new_v4().to_string(),
        content: "Python 是一门高级编程语言".to_string(),
        embedding: None,
        metadata: ChunkMetadata {
            memory_id: memory_id.clone(),
            start_line: Some(2),
            end_line: Some(2),
            created_at: Some(100),
            source: Some(MemorySource::Memory),
            tags: Vec::new(),
            file_path: None,
        },
    };

    store.store_chunk(&chunk1).unwrap();
    store.store_chunk(&chunk2).unwrap();

    // 等待 FTS 索引更新
    std::thread::sleep(std::time::Duration::from_millis(100));

    // 搜索 "Rust"
    let results = store.fts_search("Rust", 10);
    assert!(results.is_ok(), "全文搜索失败: {:?}", results.err());

    let results = results.unwrap();
    println!("FTS 搜索结果: {:?}", results);
    assert!(!results.is_empty(), "搜索结果为空");

    // 检查结果中是否包含 chunk1（不一定是第一个，因为可能有残留数据）
    let found = results.iter().any(|(id, _)| id == &chunk1.id);
    assert!(found, "搜索结果应包含 chunk1");
}

#[test]
fn test_delete_memory_cascade() {
    let store = MemoryStore::open().unwrap();

    let memory = MemoryEntry {
        id: Uuid::new_v4().to_string(),
        content: "待删除的记忆".to_string(),
        metadata: Metadata {
            created_at: Some(100),
            source: Some(MemorySource::Memory),
            tags: Vec::new(),
            file_path: None,
        },
        created_at: 100,
        updated_at: 100,
    };

    // 存储记忆
    store.store_memory(&memory).unwrap();

    // 删除记忆
    let result = store.delete_memory_cascade(&memory.id);
    assert!(result.is_ok(), "删除记忆失败: {:?}", result.err());

    let deleted = result.unwrap();
    assert!(deleted, "记忆未被删除");

    // 验证记忆已删除
    let retrieved = store.get_memory(&memory.id).unwrap();
    assert!(retrieved.is_none(), "记忆仍然存在");
}

#[test]
fn test_list_memories() {
    let store = MemoryStore::open().unwrap();

    // 创建多个记忆
    for i in 0..3 {
        let memory = MemoryEntry {
            id: Uuid::new_v4().to_string(),
            content: format!("记忆内容 {}", i),
            metadata: Metadata {
                created_at: Some(100 + i as i64),
                source: Some(MemorySource::Memory),
                tags: vec![format!("tag{}", i)],
                file_path: None,
            },
            created_at: 100 + i as i64,
            updated_at: 100 + i as i64,
        };
        store.store_memory(&memory).unwrap();
    }

    // 列出记忆
    let memories = store.list_memories();
    assert!(memories.is_ok(), "列出记忆失败: {:?}", memories.err());

    let memories = memories.unwrap();
    assert!(!memories.is_empty(), "记忆列表为空");
}

#[test]
fn test_get_stats() {
    let store = MemoryStore::open().unwrap();

    // 创建测试数据
    let memory = MemoryEntry {
        id: Uuid::new_v4().to_string(),
        content: "统计测试".to_string(),
        metadata: Metadata {
            created_at: Some(100),
            source: Some(MemorySource::Memory),
            tags: Vec::new(),
            file_path: None,
        },
        created_at: 100,
        updated_at: 100,
    };
    store.store_memory(&memory).unwrap();

    let chunk = MemoryChunk {
        id: Uuid::new_v4().to_string(),
        content: "块内容".to_string(),
        embedding: None,
        metadata: ChunkMetadata {
            memory_id: memory.id.clone(),
            start_line: Some(1),
            end_line: Some(1),
            created_at: Some(100),
            source: Some(MemorySource::Memory),
            tags: Vec::new(),
            file_path: None,
        },
    };
    store.store_chunk(&chunk).unwrap();

    // 获取统计信息
    let stats = store.get_stats();
    assert!(stats.is_ok(), "获取统计信息失败: {:?}", stats.err());

    let stats = stats.unwrap();
    assert!(stats.total_memories > 0, "总记忆数应为正数");
    assert!(stats.total_chunks > 0, "总块数应为正数");
}

#[test]
fn test_get_chunks_with_embeddings() {
    let store = MemoryStore::open().unwrap();

    // 首先创建父记忆，避免外键约束失败
    let memory_id = Uuid::new_v4().to_string();
    let memory = MemoryEntry {
        id: memory_id.clone(),
        content: "测试记忆".to_string(),
        metadata: Metadata {
            created_at: Some(100),
            source: Some(MemorySource::Memory),
            tags: Vec::new(),
            file_path: None,
        },
        created_at: 100,
        updated_at: 100,
    };
    store.store_memory(&memory).unwrap();

    // 创建块和嵌入
    let chunk = MemoryChunk {
        id: Uuid::new_v4().to_string(),
        content: "带嵌入的块".to_string(),
        embedding: None,
        metadata: ChunkMetadata {
            memory_id: memory_id.clone(),
            start_line: Some(1),
            end_line: Some(1),
            created_at: Some(100),
            source: Some(MemorySource::Memory),
            tags: Vec::new(),
            file_path: None,
        },
    };

    store.store_chunk(&chunk).unwrap();

    let embedding = vec![0.1_f32, 0.2, 0.3];
    store.store_embedding(&chunk.id, &embedding).unwrap();

    // 获取带嵌入的块
    let results = store.get_chunks_with_embeddings();
    assert!(results.is_ok(), "获取带嵌入的块失败: {:?}", results.err());

    let results = results.unwrap();
    assert!(!results.is_empty(), "应该有至少一个带嵌入的块");

    // 验证结果中包含我们刚创建的块
    let found = results.iter().find(|(c, _)| c.id == chunk.id);
    assert!(found.is_some(), "结果应包含刚创建的块");

    let (chunk_with_id, vector) = found.unwrap();
    assert_eq!(chunk_with_id.id, chunk.id);
    assert_eq!(vector.len(), embedding.len());
}
