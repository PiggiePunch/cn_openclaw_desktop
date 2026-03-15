# 发布流程（建议）

## 1. 发布前检查

1. 确认 `main` 分支可构建
2. 更新 `CHANGELOG.md`
3. 检查关键功能回归（聊天、智能体、定时任务、通道）
4. 确认版本号（`package.json` 与 `src-tauri/tauri.conf.json`）

## 2. 构建

```bash
pnpm build
pnpm tauri:build
```

调试构建：

```bash
pnpm tauri:build:debug
```

## 3. 打 Tag 与发布说明

建议使用语义化版本：

- `v1.0.1`（补丁）
- `v1.1.0`（功能）
- `v2.0.0`（破坏性变更）

发布说明建议包含：

- 新增能力
- 兼容性变化
- 迁移注意事项
- 已知问题

## 4. 发布后验证

- 新安装流程是否成功
- 自动更新/安装器行为是否符合预期
- 首次启动后 Gateway 状态与页面可用性

