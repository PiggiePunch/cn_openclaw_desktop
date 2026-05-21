#!/usr/bin/env node
/**
 * OpenClaw 下载脚本
 *
 * 在 pnpm install 后自动运行，从 GitHub Release 下载 OpenClaw 源码
 *
 * 环境变量：
 *   - OPENCLAW_VERSION: 指定版本号（默认从 package.json 读取）
 *   - OPENCLAW_SKIP: 跳过下载（用于离线开发）
 *   - OPENCLAW_MIRROR: 使用镜像源（如 ghproxy.com）
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// 配置
const OPENCLAW_VERSION = process.env.OPENCLAW_VERSION || '1.0.0';
const RESOURCES_DIR = path.join(__dirname, '../src-tauri/resources/openclaw');
const OPENCLAW_REPO = 'openclaw/openclaw'; // GitHub 仓库

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 检查 openclaw 是否已存在
function isOpenClawInstalled() {
  const indexPath = path.join(RESOURCES_DIR, 'openclaw.mjs');
  const pkgPath = path.join(RESOURCES_DIR, 'package.json');

  return fs.existsSync(indexPath) && fs.existsSync(pkgPath);
}

// 从本地开发目录复制（开发模式）
function copyFromLocalDev() {
  const localPaths = [
    path.join(__dirname, '../../../openclaw'),
    path.join(__dirname, '../../openclaw'),
    path.join(__dirname, '../openclaw'),
    path.resolve(process.env.HOME, '.openclaw/core'),
  ];

  for (const localPath of localPaths) {
    if (fs.existsSync(path.join(localPath, 'openclaw.mjs'))) {
      log(`\n📦 发现本地 OpenClaw: ${localPath}`, 'cyan');

      // 创建目标目录
      fs.mkdirSync(RESOURCES_DIR, { recursive: true });

      // 复制文件（排除 node_modules 和 .git）
      try {
        execSync(`rsync -av --exclude='node_modules' --exclude='.git' --exclude='target' --exclude='dist' "${localPath}/" "${RESOURCES_DIR}/"`, {
          stdio: 'inherit'
        });
        log('✅ 本地复制完成！', 'green');
        return true;
      } catch (err) {
        log(`⚠️  复制失败: ${err.message}`, 'yellow');
      }
    }
  }

  return false;
}

// 从 GitHub Release 下载
async function downloadFromGitHub() {
  const mirror = process.env.OPENCLAW_MIRROR || '';
  const baseUrl = mirror
    ? `${mirror}/https://github.com/${OPENCLAW_REPO}`
    : `https://github.com/${OPENCLAW_REPO}`;

  // 尝试多个下载源
  const downloadUrls = [
    `${baseUrl}/releases/download/v${OPENCLAW_VERSION}/openclaw-v${OPENCLAW_VERSION}.tar.gz`,
    `${baseUrl}/archive/refs/tags/v${OPENCLAW_VERSION}.tar.gz`,
    `${baseUrl}/archive/refs/heads/main.tar.gz`, // 最后尝试 main 分支
  ];

  for (const url of downloadUrls) {
    try {
      log(`\n⬇️  尝试下载: ${url}`, 'cyan');

      // 创建目录
      fs.mkdirSync(RESOURCES_DIR, { recursive: true });

      // 下载并解压
      const tempFile = path.join(RESOURCES_DIR, '../openclaw-temp.tar.gz');
      await downloadFile(url, tempFile);

      // 解压
      execSync(`tar -xzf "${tempFile}" -C "${RESOURCES_DIR}/../" --strip-components=1`, {
        stdio: 'inherit'
      });

      // 清理临时文件
      fs.unlinkSync(tempFile);

      log('✅ 下载完成！', 'green');
      return true;
    } catch (err) {
      log(`⚠️  下载失败: ${err.message}`, 'yellow');
    }
  }

  return false;
}

// 下载文件
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);

    const request = (urlStr) => {
      https.get(urlStr, {
        headers: { 'User-Agent': 'OpenClaw-CN-Desktop/1.0.0' },
        timeout: 60000,
      }, (response) => {
        // 处理重定向
        if (response.statusCode === 301 || response.statusCode === 302) {
          request(response.headers.location);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        const totalSize = parseInt(response.headers['content-length'], 10);
        let downloaded = 0;

        response.on('data', (chunk) => {
          downloaded += chunk.length;
          const percent = totalSize ? Math.round((downloaded / totalSize) * 100) : 0;
          process.stdout.write(`\r${colors.dim}下载中... ${percent}%${colors.reset}`);
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          console.log(''); // 换行
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      }).on('timeout', () => {
        fs.unlink(dest, () => {});
        reject(new Error('请求超时'));
      });
    };

    request(url);
  });
}

// 安装依赖
function installDependencies() {
  if (!fs.existsSync(path.join(RESOURCES_DIR, 'package.json'))) {
    return;
  }

  log('\n📦 安装 OpenClaw 依赖...', 'cyan');

  try {
    // 检测包管理器
    const hasPnpm = fs.existsSync(path.join(__dirname, '../pnpm-lock.yaml'));
    const cmd = hasPnpm ? 'pnpm install' : 'npm install';

    execSync(cmd, {
      cwd: RESOURCES_DIR,
      stdio: 'inherit'
    });

    log('✅ 依赖安装完成！', 'green');
  } catch (err) {
    log(`⚠️  依赖安装失败: ${err.message}`, 'yellow');
    log('   你可以手动运行: cd src-tauri/resources/openclaw && pnpm install', 'yellow');
  }
}

// 主函数
async function main() {
  log('\n🦀 OpenClaw CN Desktop - 资源准备\n', 'cyan');
  log(`版本: v${OPENCLAW_VERSION}`, 'dim');
  log(`目标: ${RESOURCES_DIR}`, 'dim');

  // 跳过检查
  if (process.env.OPENCLAW_SKIP === 'true') {
    log('\n⏭️  跳过下载（OPENCLAW_SKIP=true）', 'yellow');
    return;
  }

  // 检查是否已安装
  if (isOpenClawInstalled()) {
    log('\n✅ OpenClaw 已安装，跳过下载', 'green');
    return;
  }

  log('\n📦 OpenClaw 未安装，开始准备...\n', 'yellow');

  // 尝试本地复制（开发模式）
  if (copyFromLocalDev()) {
    installDependencies();
    return;
  }

  // 从 GitHub 下载
  log('📥 从 GitHub 下载 OpenClaw...', 'cyan');

  if (await downloadFromGitHub()) {
    installDependencies();
    return;
  }

  // 失败
  log('\n❌ OpenClaw 下载失败！', 'red');
  log('\n请手动安装：', 'yellow');
  log('  1. 克隆 OpenClaw 仓库到 src-tauri/resources/openclaw/');
  log('  2. 或设置 OPENCLAW_SKIP=true 跳过此步骤');
  log('  3. 或设置 OPENCLAW_MIRROR=https://ghproxy.com 使用镜像');

  process.exit(1);
}

main().catch((err) => {
  log(`\n❌ 错误: ${err.message}`, 'red');
  process.exit(1);
});
