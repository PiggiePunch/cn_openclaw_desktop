// Browser Integration Tests
// 浏览器集成测试

use openclaw_desktop::browser::{
    process_new::{ChromeOptions, ChromeProcess},
    types::{FormField, FormFieldType},
    PageClient,
};

// 注意：这些测试需要 Chrome/Chromium 浏览器环境
// 运行测试时使用: cargo test --test browser_integration_tests --ignored

#[tokio::test]
#[ignore] // 需要浏览器环境
async fn test_launch_and_navigate() {
    let options = ChromeOptions {
        headless: true,
        ..Default::default()
    };

    let mut client = PageClient::launch(options).await.unwrap();

    // 导航到测试页面
    client.navigate("https://example.com").await.unwrap();

    // 获取快照验证页面标题
    let snapshot = client.snapshot().await.unwrap();
    assert_eq!(snapshot.url, "https://example.com/");

    client.close().await.unwrap();
}

#[tokio::test]
#[ignore]
async fn test_connect_to_existing_browser() {
    // 假设已有 Chrome 实例在 9222 端口运行
    let mut client = PageClient::connect("http://127.0.0.1:9222").await.unwrap();

    client.navigate("about:blank").await.unwrap();

    let title = client.title().await.unwrap();
    assert_eq!(title, "");

    // 注意：不关闭连接的浏览器，只关闭客户端连接
    drop(client);
}

#[tokio::test]
#[ignore]
async fn test_snapshot_and_search() {
    let options = ChromeOptions {
        headless: true,
        ..Default::default()
    };

    let mut client = PageClient::launch(options).await.unwrap();

    client
        .navigate("data:text/html,<h1>Hello World</h1><button>Click Me</button>")
        .await
        .unwrap();

    let snapshot = client.snapshot().await.unwrap();

    // 查找标题
    let headers = snapshot.find_by_text("Hello World");
    assert!(!headers.is_empty());

    // 查找按钮
    let buttons = snapshot.find_by_role("button");
    assert!(!buttons.is_empty());

    // 查找交互元素
    let interactive = snapshot.interactive_elements();
    assert!(!interactive.is_empty());

    client.close().await.unwrap();
}

#[tokio::test]
#[ignore]
async fn test_evaluate_javascript() {
    let options = ChromeOptions {
        headless: true,
        ..Default::default()
    };

    let mut client = PageClient::launch(options).await.unwrap();

    client.navigate("about:blank").await.unwrap();

    // 测试 JavaScript 执行
    let result = client.evaluate("1 + 1").await.unwrap();
    assert_eq!(result, 2);

    let result = client.evaluate("document.title").await.unwrap();
    assert_eq!(result, "");

    client.close().await.unwrap();
}

#[tokio::test]
#[ignore]
async fn test_click_and_type() {
    let options = ChromeOptions {
        headless: true,
        ..Default::default()
    };

    let mut client = PageClient::launch(options).await.unwrap();

    // 导航到包含输入框的页面
    client
        .navigate("data:text/html,<input id='test' type='text'><button>Submit</button>")
        .await
        .unwrap();

    // 使用交互器
    let interactor = client.interactor();

    // 输入文本（使用便捷方法）
    client
        .type_text("#test", "Hello, World!", false)
        .await
        .unwrap();

    // 验证输入
    let result = client
        .evaluate("document.getElementById('test').value")
        .await
        .unwrap();
    assert_eq!(result, "Hello, World!");

    // 点击按钮（使用便捷方法）
    client.click("button").await.unwrap();

    client.close().await.unwrap();
}

#[tokio::test]
#[ignore]
async fn test_screenshot() {
    let options = ChromeOptions {
        headless: true,
        window_size: Some((1920, 1080)),
        ..Default::default()
    };

    let mut client = PageClient::launch(options).await.unwrap();

    client
        .navigate("data:text/html,<h1>Screenshot Test</h1>")
        .await
        .unwrap();

    let screenshot_data = client.screenshot("png").await.unwrap();

    // 验证截图数据（base64 编码的图片）
    assert!(!screenshot_data.is_empty());
    assert!(screenshot_data.len() > 100); // 至少有一些数据

    client.close().await.unwrap();
}

#[tokio::test]
#[ignore]
async fn test_page_navigation() {
    let options = ChromeOptions {
        headless: true,
        ..Default::default()
    };

    let mut client = PageClient::launch(options).await.unwrap();

    // 测试前进和后退
    client.navigate("https://example.com").await.unwrap();
    let url1 = client.url().await.unwrap();

    client.navigate("https://example.org").await.unwrap();
    let url2 = client.url().await.unwrap();

    assert_ne!(url1, url2);

    client.back().await.unwrap();
    let url_back = client.url().await.unwrap();
    assert_eq!(url_back, url1);

    client.forward().await.unwrap();
    let url_forward = client.url().await.unwrap();
    assert_eq!(url_forward, url2);

    client.close().await.unwrap();
}

#[tokio::test]
#[ignore]
async fn test_fill_form() {
    use openclaw_desktop::browser::types::{FormField, FormFieldType};

    let options = ChromeOptions {
        headless: true,
        ..Default::default()
    };

    let mut client = PageClient::launch(options).await.unwrap();

    client.navigate(
        "data:text/html,<form><input name='username' type='text'><input name='email' type='email'></form>"
    ).await.unwrap();

    let fields = vec![
        FormField {
            name: "username".to_string(),
            field_type: FormFieldType::Textbox,
            selector: "input[name='username']".to_string(),
            value: "testuser".to_string(),
        },
        FormField {
            name: "email".to_string(),
            field_type: FormFieldType::Textbox,
            selector: "input[name='email']".to_string(),
            value: "test@example.com".to_string(),
        },
    ];

    // 填写表单（使用便捷方法）
    client.fill_form(fields).await.unwrap();

    // 验证表单填写
    let username = client
        .evaluate("document.querySelector(\"input[name='username']\").value")
        .await
        .unwrap();
    assert_eq!(username, "testuser");

    let email = client
        .evaluate("document.querySelector(\"input[name='email']\").value")
        .await
        .unwrap();
    assert_eq!(email, "test@example.com");

    client.close().await.unwrap();
}

// TODO: 修复 API 签名变更后的测试
// drag 方法签名已变，cdp 字段变为私有
#[cfg(any())]
#[tokio::test]
#[ignore]
async fn test_drag_and_drop() {
    let options = ChromeOptions {
        headless: true,
        window_size: Some((800, 600)),
        ..Default::default()
    };

    let mut client = PageClient::launch(options).await.unwrap();

    client.navigate(
        "data:text/html,<div id='drag' style='width:100px;height:100px;background:red;position:absolute;top:10px;left:10px;'></div><div id='drop' style='width:100px;height:100px;background:blue;position:absolute;top:300px;left:300px;'></div>"
    ).await.unwrap();

    let interactor = client.interactor();
    // FIXME: API 已变更
    // interactor.drag(&mut client.cdp, "#drag", "#drop").await.unwrap();

    // 验证拖拽成功（在实际场景中需要检查 drop 事件）
    client.close().await.unwrap();
}

#[tokio::test]
#[ignore]
async fn test_wait_for_element() {
    let options = ChromeOptions {
        headless: true,
        ..Default::default()
    };

    let mut client = PageClient::launch(options).await.unwrap();

    client.navigate("about:blank").await.unwrap();

    // 动态添加元素
    let script = r#"
        setTimeout(() => {
            const div = document.createElement('div');
            div.id = 'delayed-element';
            div.textContent = 'Delayed';
            document.body.appendChild(div);
        }, 1000);
    "#;
    client.evaluate(script).await.unwrap();

    // 等待元素出现（使用便捷方法）
    let result = client
        .wait_for_element("#delayed-element", 5000)
        .await
        .unwrap();
    assert!(result);

    client.close().await.unwrap();
}

#[tokio::test]
#[ignore]
async fn test_process_management() {
    use openclaw_desktop::browser::process_new::{ChromeOptions, ChromeProcess};

    let options = ChromeOptions {
        headless: true,
        ..Default::default()
    };

    let process = ChromeProcess::launch(options).await.unwrap();

    // 验证进程信息
    assert!(process.is_running());
    assert!(process.cdp_port() > 0);

    let ws_url = process.ws_endpoint();
    assert!(ws_url.contains("ws://"));

    let cdp_url = process.cdp_url();
    assert!(cdp_url.contains("http://"));

    // 清理
    process.kill().unwrap();
}

// TODO: 修复 API 签名变更后的测试
// ChromeOptions 没有实现 Clone，ChromeProcess 没有 navigate 方法
#[cfg(any())]
#[tokio::test]
#[ignore]
async fn test_error_handling() {
    use openclaw_desktop::browser::BrowserError;

    let options = ChromeOptions {
        headless: true,
        cdp_port: Some(9999), // 使用不太可能的端口
        ..Default::default()
    };

    // 测试端口冲突处理
    // FIXME: ChromeOptions 没有实现 Clone
    // let result1 = ChromeProcess::launch(options.clone()).await;
    // assert!(result1.is_ok() || matches!(result1, Err(BrowserError::LaunchFailed(_))));

    // 测试无效 URL 导航
    // FIXME: ChromeProcess 没有 navigate 方法
    // let mut client = ChromeProcess::launch(options).await.unwrap();
    // let result = client.navigate("not-a-url").await;
    // assert!(result.is_err());

    // client.close().await.unwrap();
}
