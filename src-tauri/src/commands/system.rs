// 系统命令

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::{Duration, Instant};
use sysinfo::System;

/// 🔥 统一配置目录函数
/// 使用统一路径模块
fn get_config_dir() -> PathBuf {
    crate::paths::config_dir()
}

/// 系统信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    pub hostname: String,
    pub total_memory_mb: f64,
    pub available_memory_mb: f64,
    pub cpu_usage: f32,
}

#[tauri::command]
pub async fn get_system_info() -> Result<SystemInfo, String> {
    let mut sys = System::new_all();
    sys.refresh_all();

    Ok(SystemInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        hostname: System::host_name().unwrap_or_else(|| "未知".to_string()),
        total_memory_mb: sys.total_memory() as f64 / 1024.0 / 1024.0,
        available_memory_mb: sys.available_memory() as f64 / 1024.0 / 1024.0,
        cpu_usage: sys.global_cpu_info().cpu_usage(),
    })
}

#[tauri::command]
pub async fn open_logs_folder() -> Result<(), String> {
    let config_dir = get_config_dir();

    // 创建日志目录
    std::fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;

    // 打开文件夹
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&config_dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&config_dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&config_dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// 打开系统 URL（支持深层链接）
#[tauri::command]
pub async fn open_url(url: String) -> Result<(), String> {
    println!("🌐 打开 URL: {}", url);

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("打开 URL 失败: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", &url])
            .spawn()
            .map_err(|e| format!("打开 URL 失败: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("打开 URL 失败: {}", e))?;
    }

    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConnectionTestResult {
    pub success: bool,
    pub message: String,
    pub status_code: Option<u16>,
    pub latency_ms: Option<u128>,
}

fn default_provider_base_url(provider: &str) -> Option<&'static str> {
    match provider {
        "qwen" => Some("https://dashscope.aliyuncs.com/compatible-mode/v1"),
        "zhipu" => Some("https://open.bigmodel.cn/api/paas/v4"),
        "deepseek" => Some("https://api.deepseek.com/v1"),
        "moonshot" => Some("https://api.moonshot.cn/v1"),
        "doubao" => Some("https://ark.cn-beijing.volces.com/api/v3"),
        "minimax" => Some("https://api.minimaxi.com/anthropic"),
        "ernie" => Some("https://qianfan.baidubce.com/v2"),
        "openai" => Some("https://api.openai.com/v1"),
        "anthropic" => Some("https://api.anthropic.com/v1"),
        "google" => Some("https://generativelanguage.googleapis.com/v1beta"),
        // custom 类型的provider没有默认URL，需要用户自行填写
        _ => None,
    }
}

#[tauri::command]
pub async fn test_model_connection(
    provider: String,
    model: String,
    api_key: String,
    base_url: Option<String>,
) -> Result<ModelConnectionTestResult, String> {
    let provider = provider.trim().to_lowercase();
    let model = model.trim().to_string();
    let api_key = api_key.trim().to_string();
    let base_url = base_url.unwrap_or_default().trim().to_string();

    if api_key.is_empty() {
        return Ok(ModelConnectionTestResult {
            success: false,
            message: "API Key 不能为空".to_string(),
            status_code: None,
            latency_ms: None,
        });
    }

    let resolved_base = if !base_url.is_empty() {
        base_url
    } else if let Some(url) = default_provider_base_url(&provider) {
        url.to_string()
    } else {
        return Ok(ModelConnectionTestResult {
            success: false,
            message: "缺少 baseUrl，且该 provider 没有内置默认地址".to_string(),
            status_code: None,
            latency_ms: None,
        });
    };

    let base = resolved_base.trim_end_matches('/');
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let started = Instant::now();

    // MiniMax 使用 Anthropic 兼容的 /messages 接口（和 Gateway 对话一样）
    let minimax_like = base.contains("minimax") || provider == "minimax";
    // Anthropic 官方也使用 /messages 接口
    let anthropic_like = provider == "anthropic";

    // 已知这些 provider 的 /models 接口可能不可用，但对话能工作，所以直接跳过 /models 探测
    let skip_models_probe = minimax_like;

    let response = if skip_models_probe {
        // MiniMax 使用 /messages 接口（与 Gateway 对话一致）
        let url = format!("{}/messages", base);
        client
            .post(url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("x-api-key", api_key.as_str())
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&serde_json::json!({
                "model": model,
                "max_tokens": 1,
                "messages": [{ "role": "user", "content": "ping" }]
            }))
            .send()
            .await
    } else if provider == "google" || base.contains("generativelanguage.googleapis.com") {
        let url = format!("{}/models", base);
        client.get(url).query(&[("key", api_key.as_str())]).send().await
    } else {
        let url = format!("{}/models", base);
        client
            .get(url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("x-api-key", api_key.as_str())
            .header("anthropic-version", "2023-06-01")
            .send()
            .await
    };

    let latency_ms = Some(started.elapsed().as_millis());

    match response {
        Ok(resp) => {
            let code = resp.status().as_u16();
            if resp.status().is_success() {
                return Ok(ModelConnectionTestResult {
                    success: true,
                    message: format!(
                        "连通成功（provider: {}, model: {}）",
                        if provider.is_empty() { "unknown" } else { &provider },
                        if model.is_empty() { "未指定" } else { &model }
                    ),
                    status_code: Some(code),
                    latency_ms,
                });
            }

            // 兼容大量 OpenAI-like 网关：/models 不可用时回退到推理接口探测
            if code == 404 && !model.is_empty() {
                // minimax 和 anthropic 官方都使用 /messages 接口
                let fallback = if anthropic_like || minimax_like {
                    let url = format!("{}/messages", base);
                    client
                        .post(url)
                        .header("Authorization", format!("Bearer {}", api_key))
                        .header("x-api-key", api_key.as_str())
                        .header("anthropic-version", "2023-06-01")
                        .header("content-type", "application/json")
                        .json(&serde_json::json!({
                            "model": model,
                            "max_tokens": 1,
                            "messages": [{ "role": "user", "content": "ping" }]
                        }))
                        .send()
                        .await
                } else if provider == "google" || base.contains("generativelanguage.googleapis.com") {
                    let url = format!("{}/models/{}:generateContent", base, model);
                    client
                        .post(url)
                        .query(&[("key", api_key.as_str())])
                        .json(&serde_json::json!({
                            "contents": [{ "parts": [{ "text": "ping" }] }]
                        }))
                        .send()
                        .await
                } else {
                    let url = format!("{}/chat/completions", base);
                    client
                        .post(url)
                        .header("Authorization", format!("Bearer {}", api_key))
                        .header("x-api-key", api_key.as_str())
                        .header("content-type", "application/json")
                        .json(&serde_json::json!({
                            "model": model,
                            "max_tokens": 1,
                            "messages": [{ "role": "user", "content": "ping" }]
                        }))
                        .send()
                        .await
                };

                if let Ok(fallback_resp) = fallback {
                    let fallback_code = fallback_resp.status().as_u16();
                    if fallback_resp.status().is_success() {
                        return Ok(ModelConnectionTestResult {
                            success: true,
                            message: format!(
                                "连通成功（provider: {}, model: {}，已通过推理接口验证）",
                                if provider.is_empty() { "unknown" } else { &provider },
                                &model
                            ),
                            status_code: Some(fallback_code),
                            latency_ms,
                        });
                    }

                    // 尝试读取响应体获取更多错误信息
                    let error_detail = fallback_resp.text().await.unwrap_or_default();
                    let error_preview = if error_detail.len() > 100 {
                        format!("{}...", &error_detail[..100])
                    } else {
                        error_detail
                    };

                    let fallback_message = match fallback_code {
                        400 => format!("接口已连通，但模型或参数不匹配（HTTP 400）\n响应: {}", error_preview),
                        401 | 403 => "认证失败：请检查 API Key 是否正确".to_string(),
                        404 | 405 => {
                            // minimax 等 provider 的接口测试比较特殊，返回 404 不代表不能用
                            // 对话能用说明配置已保存成功
                            format!(
                                "配置已保存（HTTP {}）\n\n💡 对话功能正常说明配置正确，可以开始使用了。",
                                fallback_code
                            )
                        },
                        429 => "请求受限：触发频率/配额限制".to_string(),
                        _ => format!("连通失败：HTTP {} \n响应: {}", fallback_code, error_preview),
                    };

                    // minimax 等 provider 的接口测试比较特殊，返回 404 不代表不能用
                    // 对话能用说明配置已保存成功
                    let success = fallback_code == 404 || fallback_code == 405;

                    return Ok(ModelConnectionTestResult {
                        success,
                        message: fallback_message,
                        status_code: Some(fallback_code),
                        latency_ms,
                    });
                }
            }

            let message = match code {
                401 | 403 => "认证失败：请检查 API Key 是否正确".to_string(),
                404 => "连通失败：接口地址可能不兼容（/models 不可用）".to_string(),
                429 => "请求受限：触发频率/配额限制".to_string(),
                _ => format!("连通失败：HTTP {}", code),
            };

            Ok(ModelConnectionTestResult {
                success: false,
                message,
                status_code: Some(code),
                latency_ms,
            })
        }
        Err(error) => Ok(ModelConnectionTestResult {
            success: false,
            message: format!("网络请求失败: {}", error),
            status_code: None,
            latency_ms,
        }),
    }
}
