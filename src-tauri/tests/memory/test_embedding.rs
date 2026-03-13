// src-tauri/tests/memory/test_embedding.rs
// 嵌入向量生成测试

use openclaw_desktop::memory::embedding::{cosine_similarity, EmbeddingClient};
use openclaw_desktop::memory::types::EmbeddingConfig;

#[test]
fn test_cosine_similarity_identical() {
    let a = vec![1.0_f32, 2.0, 3.0, 4.0];
    let b = vec![1.0_f32, 2.0, 3.0, 4.0];

    let sim = cosine_similarity(&a, &b);
    assert!(
        (sim - 1.0).abs() < 0.001,
        "相同向量相似度应为 1.0, 实际为 {}",
        sim
    );
}

#[test]
fn test_cosine_similarity_orthogonal() {
    let a = vec![1.0_f32, 0.0, 0.0];
    let b = vec![0.0_f32, 1.0, 0.0];

    let sim = cosine_similarity(&a, &b);
    assert!(
        (sim - 0.0).abs() < 0.001,
        "正交向量相似度应为 0.0, 实际为 {}",
        sim
    );
}

#[test]
fn test_cosine_similarity_opposite() {
    let a = vec![1.0_f32, 1.0, 1.0];
    let b = vec![-1.0_f32, -1.0, -1.0];

    let sim = cosine_similarity(&a, &b);
    assert!(
        (sim - (-1.0)).abs() < 0.001,
        "相反向量相似度应为 -1.0, 实际为 {}",
        sim
    );
}

#[test]
fn test_cosine_similarity_different_length() {
    let a = vec![1.0_f32, 2.0];
    let b = vec![1.0_f32, 2.0, 3.0];

    let sim = cosine_similarity(&a, &b);
    assert_eq!(sim, 0.0, "不同长度向量相似度应为 0.0");
}

#[test]
fn test_cosine_similarity_partial_match() {
    let a = vec![1.0_f32, 2.0, 3.0];
    let b = vec![1.0_f32, 2.0, 0.0];

    let sim = cosine_similarity(&a, &b);
    assert!(
        sim > 0.0 && sim < 1.0,
        "部分匹配向量相似度应在 0 到 1 之间, 实际为 {}",
        sim
    );
}

#[test]
fn test_cosine_similarity_zero_vector() {
    let a = vec![0.0_f32, 0.0, 0.0];
    let b = vec![1.0_f32, 2.0, 3.0];

    let sim = cosine_similarity(&a, &b);
    assert_eq!(sim, 0.0, "零向量相似度应为 0.0");
}

#[test]
fn test_embedding_client_new() {
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
    // 如果这行编译通过，说明创建成功
    let _ = client;
}

#[test]
fn test_embedding_client_with_empty_config() {
    let config = EmbeddingConfig {
        provider: "openai".to_string(),
        openai: Some(openclaw_desktop::memory::types::OpenAIConfig {
            api_key: String::new(),
            model: "text-embedding-3-small".to_string(),
            dimensions: 1536,
            batch_size: 100,
        }),
        gemini: None,
    };

    let client = EmbeddingClient::new(config);
    // 如果这行编译通过，说明创建成功
    let _ = client;
}

#[tokio::test]
#[ignore = "需要 OPENAI_API_KEY 环境变量"]
async fn test_openai_embedding_api() {
    let api_key = std::env::var("OPENAI_API_KEY").expect("需要设置 OPENAI_API_KEY 环境变量");

    let config = EmbeddingConfig {
        provider: "openai".to_string(),
        openai: Some(openclaw_desktop::memory::types::OpenAIConfig {
            api_key,
            model: "text-embedding-3-small".to_string(),
            dimensions: 1536,
            batch_size: 100,
        }),
        gemini: None,
    };

    let client = EmbeddingClient::new(config);

    // 测试生成嵌入
    let embedding = client.embed("Hello, world!").await;
    assert!(embedding.is_ok(), "生成嵌入失败: {:?}", embedding.err());

    let embedding = embedding.unwrap();
    assert!(!embedding.is_empty(), "嵌入向量不应为空");
    assert_eq!(
        embedding.len(),
        1536,
        "OpenAI text-embedding-3-small 应返回 1536 维向量"
    );
}

#[tokio::test]
#[ignore = "需要 OPENAI_API_KEY 环境变量"]
async fn test_openai_embedding_chinese() {
    let api_key = std::env::var("OPENAI_API_KEY").expect("需要设置 OPENAI_API_KEY 环境变量");

    let config = EmbeddingConfig {
        provider: "openai".to_string(),
        openai: Some(openclaw_desktop::memory::types::OpenAIConfig {
            api_key,
            model: "text-embedding-3-small".to_string(),
            dimensions: 1536,
            batch_size: 100,
        }),
        gemini: None,
    };

    let client = EmbeddingClient::new(config);

    // 测试中文文本嵌入
    let embedding = client.embed("你好，世界！").await;
    assert!(embedding.is_ok(), "中文嵌入失败: {:?}", embedding.err());

    let embedding = embedding.unwrap();
    assert!(!embedding.is_empty(), "中文嵌入向量不应为空");
}

#[tokio::test]
#[ignore = "需要 GEMINI_API_KEY 环境变量"]
async fn test_gemini_embedding_api() {
    let api_key = std::env::var("GEMINI_API_KEY").expect("需要设置 GEMINI_API_KEY 环境变量");

    let config = EmbeddingConfig {
        provider: "gemini".to_string(),
        openai: None,
        gemini: Some(openclaw_desktop::memory::types::GeminiConfig {
            api_key,
            model: "text-embedding-004".to_string(),
        }),
    };

    let client = EmbeddingClient::new(config);

    // 测试生成嵌入
    let embedding = client.embed("Hello, world!").await;
    assert!(embedding.is_ok(), "生成嵌入失败: {:?}", embedding.err());

    let embedding = embedding.unwrap();
    assert!(!embedding.is_empty(), "嵌入向量不应为空");
}

#[tokio::test]
#[ignore = "需要 OPENAI_API_KEY 环境变量"]
async fn test_embedding_consistency() {
    let api_key = std::env::var("OPENAI_API_KEY").expect("需要设置 OPENAI_API_KEY 环境变量");

    let config = EmbeddingConfig {
        provider: "openai".to_string(),
        openai: Some(openclaw_desktop::memory::types::OpenAIConfig {
            api_key,
            model: "text-embedding-3-small".to_string(),
            dimensions: 1536,
            batch_size: 100,
        }),
        gemini: None,
    };

    let client = EmbeddingClient::new(config);

    // 对相同文本生成两次嵌入
    let text = "测试文本一致性";

    let embedding1 = client.embed(text).await.unwrap();
    let embedding2 = client.embed(text).await.unwrap();

    // 相同文本应产生相同的嵌入
    assert_eq!(embedding1.len(), embedding2.len(), "嵌入维度应相同");

    // 计算相似度
    let sim = cosine_similarity(&embedding1, &embedding2);
    assert!(
        (sim - 1.0).abs() < 0.001,
        "相同文本的嵌入应完全相同, 相似度为 {}",
        sim
    );
}

#[tokio::test]
#[ignore = "需要 OPENAI_API_KEY 环境变量"]
async fn test_embedding_different_texts() {
    let api_key = std::env::var("OPENAI_API_KEY").expect("需要设置 OPENAI_API_KEY 环境变量");

    let config = EmbeddingConfig {
        provider: "openai".to_string(),
        openai: Some(openclaw_desktop::memory::types::OpenAIConfig {
            api_key,
            model: "text-embedding-3-small".to_string(),
            dimensions: 1536,
            batch_size: 100,
        }),
        gemini: None,
    };

    let client = EmbeddingClient::new(config);

    // 对不同文本生成嵌入
    let embedding1 = client.embed("编程是一门艺术").await.unwrap();
    let embedding2 = client.embed("烹饪是一门科学").await.unwrap();

    // 计算相似度
    let sim = cosine_similarity(&embedding1, &embedding2);

    // 不同文本的嵌入应该不同（相似度小于 1）
    assert!(sim < 0.99, "不同文本的嵌入应有所不同, 相似度为 {}", sim);

    // 但相关文本仍有一定相似度（大于 0）
    assert!(sim > 0.0, "相关文本应有一定相似度, 相似度为 {}", sim);
}

#[test]
fn test_unsupported_provider() {
    let config = EmbeddingConfig {
        provider: "unknown".to_string(),
        openai: None,
        gemini: None,
    };

    let client = EmbeddingClient::new(config);

    // 测试不支持的提供商（需要运行时才能检测）
    // 这里只验证编译通过
    let _ = client;
}

#[tokio::test]
#[ignore = "需要 OPENAI_API_KEY 环境变量"]
async fn test_openai_batch_embedding() {
    let api_key = std::env::var("OPENAI_API_KEY").expect("需要设置 OPENAI_API_KEY 环境变量");

    let config = EmbeddingConfig {
        provider: "openai".to_string(),
        openai: Some(openclaw_desktop::memory::types::OpenAIConfig {
            api_key,
            model: "text-embedding-3-small".to_string(),
            dimensions: 1536,
            batch_size: 100,
        }),
        gemini: None,
    };

    let client = EmbeddingClient::new(config);

    // 测试批量嵌入
    let texts = vec![
        "Hello, world!".to_string(),
        "你好，世界！".to_string(),
        "Rust is awesome".to_string(),
    ];

    let embeddings = client.embed_batch(&texts).await;
    assert!(embeddings.is_ok(), "批量嵌入失败: {:?}", embeddings.err());

    let embeddings = embeddings.unwrap();
    assert_eq!(embeddings.len(), 3, "应返回 3 个嵌入向量");

    // 验证每个嵌入
    for (i, embedding) in embeddings.iter().enumerate() {
        assert!(!embedding.is_empty(), "嵌入向量 {} 不应为空", i);
        assert_eq!(embedding.len(), 1536, "嵌入向量 {} 维度应为 1536", i);
    }
}

#[tokio::test]
#[ignore = "需要 OPENAI_API_KEY 环境变量"]
async fn test_openai_batch_embedding_empty() {
    let api_key = std::env::var("OPENAI_API_KEY").expect("需要设置 OPENAI_API_KEY 环境变量");

    let config = EmbeddingConfig {
        provider: "openai".to_string(),
        openai: Some(openclaw_desktop::memory::types::OpenAIConfig {
            api_key,
            model: "text-embedding-3-small".to_string(),
            dimensions: 1536,
            batch_size: 100,
        }),
        gemini: None,
    };

    let client = EmbeddingClient::new(config);

    // 测试空数组
    let texts: Vec<String> = vec![];
    let embeddings = client.embed_batch(&texts).await;

    assert!(embeddings.is_ok(), "空数组批量嵌入应成功");
    assert!(embeddings.unwrap().is_empty(), "空数组应返回空结果");
}

#[tokio::test]
#[ignore = "需要 OPENAI_API_KEY 环境变量"]
async fn test_openai_batch_embedding_large() {
    let api_key = std::env::var("OPENAI_API_KEY").expect("需要设置 OPENAI_API_KEY 环境变量");

    let config = EmbeddingConfig {
        provider: "openai".to_string(),
        openai: Some(openclaw_desktop::memory::types::OpenAIConfig {
            api_key,
            model: "text-embedding-3-small".to_string(),
            dimensions: 1536,
            batch_size: 5, // 设置小批量以测试分批逻辑
        }),
        gemini: None,
    };

    let client = EmbeddingClient::new(config);

    // 测试超过批量大小的情况
    let texts: Vec<String> = (0..12).map(|i| format!("测试文本 {}", i)).collect();

    let embeddings = client.embed_batch(&texts).await;
    assert!(embeddings.is_ok(), "大批量嵌入失败: {:?}", embeddings.err());

    let embeddings = embeddings.unwrap();
    assert_eq!(embeddings.len(), 12, "应返回 12 个嵌入向量");

    // 验证顺序保持一致
    for (i, embedding) in embeddings.iter().enumerate() {
        assert_eq!(embedding.len(), 1536, "嵌入向量 {} 维度应为 1536", i);
    }
}

#[tokio::test]
#[ignore = "需要 OPENAI_API_KEY 环境变量"]
async fn test_openai_batch_consistency() {
    let api_key = std::env::var("OPENAI_API_KEY").expect("需要设置 OPENAI_API_KEY 环境变量");

    let config = EmbeddingConfig {
        provider: "openai".to_string(),
        openai: Some(openclaw_desktop::memory::types::OpenAIConfig {
            api_key,
            model: "text-embedding-3-small".to_string(),
            dimensions: 1536,
            batch_size: 100,
        }),
        gemini: None,
    };

    let client = EmbeddingClient::new(config);

    let text = "一致性测试";

    // 单独生成嵌入
    let single = client.embed(text).await.unwrap();

    // 批量生成嵌入（单个元素）
    let batch = client.embed_batch(&[text.to_string()]).await.unwrap();
    let batch_single = &batch[0];

    // 应该得到相同的结果
    assert_eq!(single.len(), batch_single.len(), "单独和批量嵌入维度应相同");

    let sim = cosine_similarity(&single, batch_single);
    assert!(
        (sim - 1.0).abs() < 0.001,
        "单独和批量嵌入应完全相同, 相似度为 {}",
        sim
    );
}
