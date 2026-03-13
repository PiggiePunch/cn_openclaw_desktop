// OpenClaw 自动安装管理器
//
// 功能：
// - 检测 ~/.openclaw/core/ 是否存在
// - 从 GitHub Release 下载最新版本
// - 安装依赖（pnpm install）
// - 初始化配置文件
// - 版本检查与更新

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command as StdCommand;
use std::sync::Arc;
use tokio::fs;
use tokio::sync::Mutex;

use crate::paths;

/// OpenClaw 安装状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallStatus {
    pub installed: bool,
    pub version: Option<String>,
    pub install_path: Option<PathBuf>,
    pub last_check: Option<String>,
    pub error: Option<String>,
}

impl Default for InstallStatus {
    fn default() -> Self {
        Self {
            installed: false,
            version: None,
            install_path: None,
            last_check: None,
            error: None,
        }
    }
}

/// OpenClaw 版本信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenClawVersion {
    pub tag_name: String,
    pub name: String,
    pub published_at: String,
    pub body: String,
    pub assets: Vec<OpenClawAsset>,
}

/// OpenClaw 发行版资源
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenClawAsset {
    pub name: String,
    pub browser_download_url: String,
    pub size: u64,
}

/// OpenClaw 安装管理器
pub struct OpenClawManager {
    install_dir: PathBuf,
    status: Arc<Mutex<InstallStatus>>,
}

impl OpenClawManager {
    /// 创建新的安装管理器
    pub fn new() -> Self {
        Self {
            install_dir: paths::openclaw_install_dir(),
            status: Arc::new(Mutex::new(InstallStatus::default())),
        }
    }

    /// 获取安装目录
    pub fn install_dir(&self) -> &PathBuf {
        &self.install_dir
    }

    /// 查找系统安装的 openclaw 可执行文件
    fn find_system_openclaw_path() -> Option<PathBuf> {
        #[cfg(unix)]
        {
            if let Ok(output) = StdCommand::new("which").arg("openclaw").output() {
                if output.status.success() {
                    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !path.is_empty() {
                        let pb = PathBuf::from(path);
                        return Some(pb.canonicalize().unwrap_or(pb));
                    }
                }
            }
        }

        #[cfg(windows)]
        {
            if let Ok(output) = StdCommand::new("where").arg("openclaw").output() {
                if output.status.success() {
                    if let Some(path) = String::from_utf8_lossy(&output.stdout).lines().next() {
                        let pb = PathBuf::from(path.trim());
                        return Some(pb.canonicalize().unwrap_or(pb));
                    }
                }
            }
        }

        None
    }

    /// Core 安装目录是否完整
    fn is_core_installed(&self) -> bool {
        // 检查目录是否存在
        if !self.install_dir.exists() {
            return false;
        }

        // 检查 openclaw.mjs 是否存在
        let mjs_path = self.install_dir.join("openclaw.mjs");
        if !mjs_path.exists() {
            return false;
        }

        // 检查 node_modules 是否存在
        let node_modules = self.install_dir.join("node_modules");
        node_modules.exists()
    }

    fn parse_cli_version(raw: &str) -> Option<String> {
        let first_line = raw.lines().next()?.trim();
        if first_line.is_empty() {
            return None;
        }

        // 示例: "OpenClaw 2026.3.11 (29dc654)"
        if let Some(rest) = first_line.strip_prefix("OpenClaw ") {
            if let Some(token) = rest.split_whitespace().next() {
                if !token.is_empty() {
                    return Some(token.to_string());
                }
            }
        }

        Some(first_line.to_string())
    }

    /// 检查是否已安装
    pub async fn is_installed(&self) -> bool {
        Self::find_system_openclaw_path().is_some() || self.is_core_installed()
    }

    /// 获取当前安装的版本
    pub async fn get_installed_version(&self) -> Option<String> {
        if let Some(exe) = Self::find_system_openclaw_path() {
            if let Ok(output) = StdCommand::new(exe).arg("--version").output() {
                if output.status.success() {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    if let Some(version) = Self::parse_cli_version(&stdout) {
                        return Some(version);
                    }
                }
            }
        }

        if !self.is_core_installed() {
            return None;
        }

        // 读取 package.json 获取版本
        let package_json = self.install_dir.join("package.json");
        if package_json.exists() {
            if let Ok(content) = fs::read_to_string(&package_json).await {
                if let Ok(pkg) = serde_json::from_str::<serde_json::Value>(&content) {
                    return pkg
                        .get("version")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                }
            }
        }

        Some("unknown".to_string())
    }

    /// 获取最新版本信息（从 GitHub API）
    pub async fn fetch_latest_version() -> Result<OpenClawVersion> {
        let url = "https://api.github.com/repos/openclaw/openclaw/releases/latest";

        let client = reqwest::Client::new();
        let response = client
            .get(url)
            .header("User-Agent", "OpenClaw-CN-Desktop")
            .header("Accept", "application/vnd.github.v3+json")
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!("获取版本信息失败: {}", response.status()));
        }

        let version: OpenClawVersion = response.json().await?;
        Ok(version)
    }

    /// 下载并解压 OpenClaw
    pub async fn download_and_install(&self) -> Result<InstallStatus> {
        // 首先尝试从 GitHub Release 下载
        match self.try_download_from_release().await {
            Ok(status) => return Ok(status),
            Err(e) => {
                println!("⚠️ 从 Release 下载失败: {}，尝试使用 git clone...", e);
            }
        }

        // 如果下载失败，使用 git clone 方式安装
        self.clone_and_install().await
    }

    /// 尝试从 GitHub Release 下载
    async fn try_download_from_release(&self) -> Result<InstallStatus> {
        println!("📦 尝试从 GitHub Release 下载 OpenClaw...");

        // 1. 获取最新版本信息
        let version = Self::fetch_latest_version().await?;
        println!("📌 最新版本: {}", version.tag_name);

        // 2. 找到适合当前平台的资源
        let asset = self.find_platform_asset(&version)?;
        println!("⬇️  下载: {}", asset.name);

        // 3. 创建安装目录
        fs::create_dir_all(&self.install_dir).await?;

        // 4. 下载文件
        let temp_path = std::env::temp_dir().join(&asset.name);

        let client = reqwest::Client::new();
        let response = client
            .get(&asset.browser_download_url)
            .header("User-Agent", "OpenClaw-CN-Desktop")
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!("下载失败: {}", response.status()));
        }

        // 保存到临时文件
        let bytes = response.bytes().await?;
        fs::write(&temp_path, bytes).await?;

        // 5. 解压
        println!("📂 解压中...");
        self.extract_archive(&temp_path).await?;

        // 6. 清理临时文件
        let _ = fs::remove_file(&temp_path).await;

        // 7. 安装依赖
        println!("📚 安装依赖...");
        self.install_dependencies().await?;

        // 8. 更新状态
        let status = InstallStatus {
            installed: true,
            version: Some(version.tag_name.clone()),
            install_path: Some(self.install_dir.clone()),
            last_check: Some(chrono::Utc::now().to_rfc3339()),
            error: None,
        };

        // 保存安装信息
        self.save_install_info(&status).await?;

        println!("✅ OpenClaw 安装完成!");
        Ok(status)
    }

    /// 使用 git clone 方式安装
    async fn clone_and_install(&self) -> Result<InstallStatus> {
        println!("📦 使用 git clone 方式安装 OpenClaw...");

        // 1. 创建安装目录
        fs::create_dir_all(&self.install_dir).await?;

        // 2. 使用 git clone 下载
        println!("⬇️  克隆 OpenClaw 仓库...");
        let output = std::process::Command::new("git")
            .args(["clone", "https://github.com/openclaw/openclaw.git", "."])
            .current_dir(&self.install_dir)
            .output()?;

        if !output.status.success() {
            return Err(anyhow::anyhow!(
                "Git clone 失败: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        // 3. 安装依赖
        println!("📚 安装依赖...");
        self.install_dependencies().await?;

        // 4. 获取版本
        let version_output = std::process::Command::new("git")
            .args(["describe", "--tags", "--always"])
            .current_dir(&self.install_dir)
            .output()?;

        let version = if version_output.status.success() {
            Some(
                String::from_utf8_lossy(&version_output.stdout)
                    .trim()
                    .to_string(),
            )
        } else {
            Some("latest".to_string())
        };

        // 5. 更新状态
        let status = InstallStatus {
            installed: true,
            version,
            install_path: Some(self.install_dir.clone()),
            last_check: Some(chrono::Utc::now().to_rfc3339()),
            error: None,
        };

        // 保存安装信息
        self.save_install_info(&status).await?;

        println!("✅ OpenClaw 安装完成!");
        Ok(status)
    }

    /// 查找适合当前平台的资源
    fn find_platform_asset<'a>(&self, version: &'a OpenClawVersion) -> Result<&'a OpenClawAsset> {
        let platform = std::env::consts::OS;
        let arch = std::env::consts::ARCH;

        // 构建文件名模式
        let pattern = format!("openclaw-{}-{}", platform, arch);

        for asset in &version.assets {
            if asset.name.contains(&pattern)
                && (asset.name.ends_with(".tar.gz") || asset.name.ends_with(".zip"))
            {
                return Ok(asset);
            }
        }

        Err(anyhow::anyhow!("未找到适合 {} {} 的发行版", platform, arch))
    }

    /// 解压归档文件
    async fn extract_archive(&self, archive_path: &PathBuf) -> Result<()> {
        let extension = archive_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");

        if archive_path.to_string_lossy().ends_with(".tar.gz") || extension == "gz" {
            // 解压 tar.gz
            let output = StdCommand::new("tar")
                .args(["-xzf", &archive_path.to_string_lossy()])
                .arg("-C")
                .arg(&self.install_dir)
                .output()?;

            if !output.status.success() {
                return Err(anyhow::anyhow!(
                    "解压失败: {}",
                    String::from_utf8_lossy(&output.stderr)
                ));
            }
        } else if extension == "zip" {
            // 解压 zip
            let output = StdCommand::new("unzip")
                .args(["-q", &archive_path.to_string_lossy()])
                .arg("-d")
                .arg(&self.install_dir)
                .output()?;

            if !output.status.success() {
                return Err(anyhow::anyhow!(
                    "解压失败: {}",
                    String::from_utf8_lossy(&output.stderr)
                ));
            }
        } else {
            return Err(anyhow::anyhow!("不支持的归档格式: {}", extension));
        }

        // 如果解压后有子目录，移动内容到安装目录
        let mut entries = fs::read_dir(&self.install_dir).await?;
        let mut dirs = Vec::new();

        while let Some(entry) = entries.next_entry().await? {
            if entry.path().is_dir() {
                dirs.push(entry.path());
            }
        }

        // 如果只有一个子目录且名字包含 openclaw，移动其内容
        if dirs.len() == 1 {
            let subdir = &dirs[0];
            if let Some(name) = subdir.file_name() {
                let name_str = name.to_string_lossy();
                if name_str.contains("openclaw") {
                    // 移动子目录内容到安装目录
                    self.move_contents(subdir, &self.install_dir).await?;
                    // 删除空子目录
                    let _ = fs::remove_dir(subdir).await;
                }
            }
        }

        Ok(())
    }

    /// 移动目录内容
    async fn move_contents(&self, from: &PathBuf, to: &PathBuf) -> Result<()> {
        let mut entries = fs::read_dir(from).await?;

        while let Some(entry) = entries.next_entry().await? {
            let src = entry.path();
            let dst = to.join(entry.file_name());

            if src.is_dir() {
                fs::create_dir_all(&dst).await?;
                // 递归移动（简化处理：直接重命名）
                if let Err(_) = fs::rename(&src, &dst).await {
                    // 如果重命名失败，忽略错误
                }
            } else {
                fs::rename(&src, &dst).await?;
            }
        }

        Ok(())
    }

    /// 安装依赖
    async fn install_dependencies(&self) -> Result<()> {
        // 检查 pnpm 是否安装
        let pnpm_check = StdCommand::new("pnpm").arg("--version").output()?;

        if !pnpm_check.status.success() {
            // 尝试使用 npm 安装 pnpm
            println!("📦 安装 pnpm...");
            let npm_install = StdCommand::new("npm")
                .args(["install", "-g", "pnpm"])
                .output()?;

            if !npm_install.status.success() {
                return Err(anyhow::anyhow!("安装 pnpm 失败"));
            }
        }

        // 运行 pnpm install
        println!("⏳ 运行 pnpm install...");
        let output = StdCommand::new("pnpm")
            .current_dir(&self.install_dir)
            .args(["install", "--prefer-offline"])
            .output()?;

        if !output.status.success() {
            return Err(anyhow::anyhow!(
                "依赖安装失败: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        Ok(())
    }

    /// 保存安装信息
    async fn save_install_info(&self, status: &InstallStatus) -> Result<()> {
        let info_file = paths::data_dir().join("install_info.json");
        fs::create_dir_all(info_file.parent().unwrap()).await?;

        let json = serde_json::to_string_pretty(status)?;
        fs::write(info_file, json).await?;

        Ok(())
    }

    /// 加载安装信息
    pub async fn load_install_info(&self) -> Result<InstallStatus> {
        let info_file = paths::data_dir().join("install_info.json");

        if !info_file.exists() {
            return Ok(InstallStatus::default());
        }

        let content = fs::read_to_string(info_file).await?;
        let status: InstallStatus = serde_json::from_str(&content)?;

        Ok(status)
    }

    /// 检查更新
    pub async fn check_update(&self) -> Result<Option<String>> {
        if !self.is_installed().await {
            return Ok(None);
        }

        let latest = Self::fetch_latest_version().await?;
        let current = self.get_installed_version().await;

        if let Some(current_ver) = current {
            if current_ver != latest.tag_name {
                return Ok(Some(latest.tag_name));
            }
        }

        Ok(None)
    }

    /// 更新 OpenClaw
    pub async fn update(&self) -> Result<InstallStatus> {
        // 备份配置
        let config_backup = self.backup_config().await?;

        // 重新安装
        let result = self.download_and_install().await;

        // 恢复配置
        if result.is_ok() {
            self.restore_config(config_backup).await?;
        }

        result
    }

    /// 备份配置
    async fn backup_config(&self) -> Result<PathBuf> {
        let config_file = paths::openclaw_config_file();
        let backup_file = std::env::temp_dir().join("openclaw_config_backup.json");

        if config_file.exists() {
            fs::copy(&config_file, &backup_file).await?;
        }

        Ok(backup_file)
    }

    /// 恢复配置
    async fn restore_config(&self, backup_file: PathBuf) -> Result<()> {
        let config_file = paths::openclaw_config_file();

        if backup_file.exists() {
            fs::copy(&backup_file, &config_file).await?;
            let _ = fs::remove_file(backup_file).await;
        }

        Ok(())
    }

    /// 初始化配置文件
    pub async fn init_config(&self) -> Result<()> {
        let config_file = paths::openclaw_config_file();

        if !config_file.exists() {
            // 创建默认配置
            let default_config = serde_json::json!({
                "version": "1.0.0",
                "gateway": {
                    "port": 18789,
                    "auth": {
                        "enabled": false
                    }
                },
                "ai": {
                    "provider": "qwen"
                },
                "channels": []
            });

            fs::create_dir_all(config_file.parent().unwrap()).await?;
            let json = serde_json::to_string_pretty(&default_config)?;
            fs::write(&config_file, json).await?;
        }

        Ok(())
    }

    /// 获取 OpenClaw 可执行文件路径
    pub fn get_executable_path(&self) -> PathBuf {
        if let Some(path) = Self::find_system_openclaw_path() {
            return path;
        }

        let mjs_path = self.install_dir.join("openclaw.mjs");

        if mjs_path.exists() {
            return mjs_path;
        }

        // 尝试其他路径
        let dist_mjs = self.install_dir.join("dist/openclaw.mjs");
        if dist_mjs.exists() {
            return dist_mjs;
        }

        self.install_dir.join("bin/openclaw")
    }
}

// 全局安装管理器实例
lazy_static::lazy_static! {
    pub static ref MANAGER: OpenClawManager = OpenClawManager::new();
}
