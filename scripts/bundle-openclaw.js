#!/usr/bin/env node
/**
 * OpenClaw 打包脚本
 *
 * 将原版 OpenClaw 和 Node.js 运行时打包到 Tauri 资源目录
 *
 * 使用方法：
 *   node scripts/bundle-openclaw.js [--openclaw-path=/path/to/openclaw] [--node-version=20]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 配置
const config = {
  // 资源目录
  resourcesDir: path.join(__dirname, '../src-tauri/resources/openclaw'),

  // Node.js 版本（用于下载）
  nodeVersion: process.env.NODE_VERSION || '20.11.0',

  // Node.js 下载地址模板
  nodeDownloadUrl: {
    darwin: {
      x64: 'https://nodejs.org/dist/v${version}/node-v${version}-darwin-x64.tar.gz',
      arm64: 'https://nodejs.org/dist/v${version}/node-v${version}-darwin-arm64.tar.gz',
    },
    win32: {
      x64: 'https://nodejs.org/dist/v${version}/node-v${version}-win-x64.zip',
    },
    linux: {
      x64: 'https://nodejs.org/dist/v${version}/node-v${version}-linux-x64.tar.gz',
      arm64: 'https://nodejs.org/dist/v${version}/node-v${version}-linux-arm64.tar.gz',
    },
  },

  // OpenClaw 源目录（默认从同级目录查找）
  openclawPaths: [
    path.join(__dirname, '../../../openclaw'),
    path.join(__dirname, '../../openclaw'),
    path.join(__dirname, '../openclaw'),
  ],
};

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 解析命令行参数
function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      args[key] = value || true;
    }
  });
  return args;
}

// 查找 OpenClaw 源目录
function findOpenClawPath(customPath) {
  if (customPath && fs.existsSync(customPath)) {
    return customPath;
  }

  for (const p of config.openclawPaths) {
    const fullPath = path.resolve(p);
    if (fs.existsSync(path.join(fullPath, 'openclaw.mjs')) ||
        fs.existsSync(path.join(fullPath, 'package.json'))) {
      return fullPath;
    }
  }

  return null;
}

// 下载 Node.js
async function downloadNodeJS(version, platform, arch) {
  const urlTemplate = config.nodeDownloadUrl[platform]?.[arch];
  if (!urlTemplate) {
    throw new Error(`不支持的平台: ${platform}-${arch}`);
  }

  const url = urlTemplate.replace(/\$\{version\}/g, version);
  const nodeDir = path.join(config.resourcesDir, 'node');

  log(`下载 Node.js v${version} (${platform}-${arch})...`, 'blue');
  log(`URL: ${url}`, 'blue');

  // 创建目录
  if (!fs.existsSync(nodeDir)) {
    fs.mkdirSync(nodeDir, { recursive: true });
  }

  // 下载并解压
  const tempFile = path.join(nodeDir, `node-${version}.tar.gz`);
  const isWindows = platform === 'win32';

  try {
    // 使用 curl 下载
    execSync(`curl -L -o "${tempFile}" "${url}"`, { stdio: 'inherit' });

    // 解压
    if (isWindows) {
      // Windows 使用 unzip
      execSync(`unzip -o "${tempFile}" -d "${nodeDir}"`, { stdio: 'inherit' });
      const extractedDir = path.join(nodeDir, `node-v${version}-win-x64`);
      // 复制 node.exe
      fs.copyFileSync(
        path.join(extractedDir, 'node.exe'),
        path.join(nodeDir, 'node.exe')
      );
    } else {
      // macOS/Linux 使用 tar
      execSync(`tar -xzf "${tempFile}" -C "${nodeDir}"`, { stdio: 'inherit' });
      const extractedDir = path.join(nodeDir, `node-v${version}-${platform}-${arch}`);
      // 复制 node 可执行文件
      fs.copyFileSync(
        path.join(extractedDir, 'bin', 'node'),
        path.join(nodeDir, 'node')
      );
      // 设置执行权限
      fs.chmodSync(path.join(nodeDir, 'node'), '755');
    }

    // 清理临时文件
    fs.unlinkSync(tempFile);
    if (isWindows) {
      fs.rmSync(path.join(nodeDir, `node-v${version}-win-x64`), { recursive: true });
    } else {
      fs.rmSync(path.join(nodeDir, `node-v${version}-${platform}-${arch}`), { recursive: true });
    }

    log('✅ Node.js 下载完成', 'green');
  } catch (error) {
    log(`❌ 下载 Node.js 失败: ${error.message}`, 'red');
    throw error;
  }
}

// 复制 OpenClaw
function copyOpenClaw(sourcePath) {
  log('复制 OpenClaw 文件...', 'blue');

  const filesToCopy = [
    'openclaw.mjs',
    'package.json',
    'pnpm-lock.yaml',
  ];

  const dirsToCopy = [
    'dist',
    'node_modules',
  ];

  // 复制文件
  for (const file of filesToCopy) {
    const src = path.join(sourcePath, file);
    const dest = path.join(config.resourcesDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      log(`  ✓ ${file}`, 'green');
    }
  }

  // 复制目录
  for (const dir of dirsToCopy) {
    const src = path.join(sourcePath, dir);
    const dest = path.join(config.resourcesDir, dir);
    if (fs.existsSync(src)) {
      if (fs.existsSync(dest)) {
        fs.rmSync(dest, { recursive: true });
      }
      fs.cpSync(src, dest, { recursive: true });
      log(`  ✓ ${dir}/`, 'green');
    }
  }

  log('✅ OpenClaw 复制完成', 'green');
}

// 验证打包结果
function verifyBundle() {
  log('验证打包...', 'blue');

  const requiredFiles = [
    'openclaw.mjs',
    'package.json',
    'dist',
  ];

  let valid = true;
  for (const file of requiredFiles) {
    const fullPath = path.join(config.resourcesDir, file);
    if (!fs.existsSync(fullPath)) {
      log(`  ❌ 缺少: ${file}`, 'red');
      valid = false;
    } else {
      log(`  ✓ ${file}`, 'green');
    }
  }

  // 检查 Node.js
  const nodeExe = process.platform === 'win32' ? 'node.exe' : 'node';
  const nodePath = path.join(config.resourcesDir, 'node', nodeExe);
  if (fs.existsSync(nodePath)) {
    log(`  ✓ node/${nodeExe}`, 'green');
  } else {
    log(`  ⚠️  node/${nodeExe} 不存在（将使用系统 Node.js）`, 'yellow');
  }

  return valid;
}

// 主函数
async function main() {
  log('🚀 OpenClaw 打包脚本', 'green');
  log('==================', 'green');

  const args = parseArgs();

  // 查找 OpenClaw
  const openclawPath = findOpenClawPath(args['openclaw-path']);
  if (!openclawPath) {
    log('❌ 找不到 OpenClaw 源目录', 'red');
    log('请使用 --openclaw-path 参数指定路径', 'yellow');
    process.exit(1);
  }
  log(`OpenClaw 源目录: ${openclawPath}`, 'blue');

  // 复制 OpenClaw
  copyOpenClaw(openclawPath);

  // 下载 Node.js（如果需要）
  if (args['download-node'] !== false) {
    const version = args['node-version'] || config.nodeVersion;
    const platform = process.platform;
    const arch = process.arch;

    try {
      await downloadNodeJS(version, platform, arch);
    } catch (error) {
      log(`⚠️  Node.js 下载失败，将使用系统 Node.js`, 'yellow');
    }
  }

  // 验证
  if (verifyBundle()) {
    log('\n✅ 打包完成！', 'green');
  } else {
    log('\n⚠️  打包完成，但有缺失文件', 'yellow');
  }
}

main().catch(error => {
  log(`\n❌ 打包失败: ${error.message}`, 'red');
  process.exit(1);
});
