#!/usr/bin/env node
/**
 * 清理端口脚本 - 启动前自动清理被占用的端口
 */
import { execSync } from 'child_process'

const PORT = process.env.PORT || 1420

try {
  // macOS/Linux
  if (process.platform !== 'win32') {
    execSync(`lsof -ti:${PORT} | xargs kill -9 2>/dev/null || true`, {
      stdio: 'pipe',
      shell: '/bin/bash'
    })
  } else {
    // Windows
    execSync(`for /f "tokens=5" %a in ('netstat -ano ^| findstr :${PORT}') do taskkill /F /PID %a`, {
      stdio: 'pipe',
      shell: 'cmd.exe'
    })
  }
  console.log(`\x1b[36m✓ 端口 ${PORT} 已清理\x1b[0m`)
} catch (e) {
  // 端口本来就空闲，忽略错误
}
