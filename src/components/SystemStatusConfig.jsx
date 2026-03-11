import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Heart, MessageSquare, Ghost, FileText, Clock, Globe } from 'lucide-react'
import api from '@/lib/api'

/**
 * 系统状态配置对话框（对齐原版 OpenClaw）
 *
 * 两大功能模块：
 * 1. 心跳任务 (HeartbeatRunner) - 读取 HEARTBEAT.md 执行定时 AI 任务
 * 2. 主动交互 (ProactiveManager) - 包含 Ghost Reminder
 */
export default function SystemStatusConfig({ open, onOpenChange }) {
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('heartbeat')

  // ========================================
  // 心跳任务配置（对齐原版 OpenClaw）
  // ========================================
  const [heartbeatConfig, setHeartbeatConfig] = useState({
    enabled: true,
    every_mins: 30,
    prompt: 'Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.',
    target_session: 'main',
    active_hours_start: 9,
    active_hours_end: 22,
    model: '',
    ack_max_chars: 300,  // 对齐原版默认值
  })

  // ========================================
  // 主动交互配置
  // ========================================
  const [proactiveConfig, setProactiveConfig] = useState({
    enabled: true,
    interval_mins: 30,
    target_session: 'main',
    active_hours_start: 9,
    active_hours_end: 22,
    prompt: '检查是否有需要提醒用户的待办事项或重要信息',
  })

  // Ghost Reminder 配置
  const [ghostConfig, setGhostConfig] = useState({
    enabled: true,
    idle_threshold_mins: 60,
    reminder_interval_mins: 30,
    max_reminders: 3,
    reminder_prompt: '用户已经有一段时间没有交互了，考虑主动问候或提供帮助',
  })

  // ========================================
  // HTTP API 状态
  // ========================================
  const [httpApiStatus, setHttpApiStatus] = useState({
    enabled: false,
    running: false,
    bind_addr: '127.0.0.1',
    port: 18790,
    base_url: '',
    endpoints: [],
    auth_enabled: false,
  })

  // 加载当前配置
  useEffect(() => {
    if (open) {
      loadConfig()
    }
  }, [open])

  const loadConfig = async () => {
    setLoading(true)
    try {
      const [heartbeatRes, proactiveRes, httpApiRes] = await Promise.all([
        api.heartbeat.status(),
        api.proactive.status(),
        api.gateway.httpApiStatus().catch(() => null),
      ])

      // 解析心跳任务配置
      if (heartbeatRes.success && heartbeatRes.data?.heartbeat) {
        const hb = heartbeatRes.data.heartbeat
        setHeartbeatConfig({
          enabled: hb.enabled ?? true,
          every_mins: parseInt(hb.every) || 30,
          prompt: hb.prompt ?? '检查 HEARTBEAT.md 中的任务...',
          target_session: hb.target ?? 'main',
          active_hours_start: 9,
          active_hours_end: 22,
          model: hb.model ?? '',
          ack_max_chars: hb.ack_max_chars ?? 200,
        })
      }

      // 解析主动交互配置
      if (proactiveRes.success && proactiveRes.data) {
        const data = proactiveRes.data
        setProactiveConfig({
          enabled: data.proactive_enabled ?? true,
          interval_mins: data.interval_mins ?? 30,
          target_session: data.target_session ?? 'main',
          active_hours_start: data.active_hours?.[0] ?? 9,
          active_hours_end: data.active_hours?.[1] ?? 22,
          prompt: data.prompt ?? '检查是否有需要提醒用户的待办事项或重要信息',
        })
        setGhostConfig({
          enabled: data.ghost_enabled ?? true,
          idle_threshold_mins: data.idle_threshold_mins ?? 60,
          reminder_interval_mins: 30,
          max_reminders: 3,
          reminder_prompt: '用户已经有一段时间没有交互了，考虑主动问候或提供帮助',
        })
      }

      // 解析 HTTP API 状态
      if (httpApiRes) {
        setHttpApiStatus(httpApiRes)
      }
    } catch (e) {
      console.error('加载配置失败:', e)
    }
    setLoading(false)
  }

  const saveHeartbeatConfig = async () => {
    setLoading(true)
    try {
      await api.heartbeat.configure({
        heartbeat: {
          enabled: heartbeatConfig.enabled,
          every_mins: heartbeatConfig.every_mins,
          prompt: heartbeatConfig.prompt,
          target_session: heartbeatConfig.target_session,
          active_hours: [heartbeatConfig.active_hours_start, heartbeatConfig.active_hours_end],
          model: heartbeatConfig.model || null,
          ack_max_chars: heartbeatConfig.ack_max_chars,
        },
      })
      onOpenChange(false)
    } catch (e) {
      console.error('保存心跳配置失败:', e)
    }
    setLoading(false)
  }

  const saveProactiveConfig = async () => {
    setLoading(true)
    try {
      await api.proactive.configure({
        proactive: {
          enabled: proactiveConfig.enabled,
          interval_mins: proactiveConfig.interval_mins,
          target_session: proactiveConfig.target_session,
          active_hours: [proactiveConfig.active_hours_start, proactiveConfig.active_hours_end],
          prompt: proactiveConfig.prompt,
        },
        ghost: {
          enabled: ghostConfig.enabled,
          idle_threshold_mins: ghostConfig.idle_threshold_mins,
          reminder_interval_mins: ghostConfig.reminder_interval_mins,
          max_reminders: ghostConfig.max_reminders,
          reminder_prompt: ghostConfig.reminder_prompt,
        },
      })
      onOpenChange(false)
    } catch (e) {
      console.error('保存配置失败:', e)
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5" />
            系统状态配置
          </DialogTitle>
          <DialogDescription>
            配置心跳任务和主动交互参数（对齐原版 OpenClaw）
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="heartbeat" className="flex items-center gap-2">
              <Heart className="w-4 h-4" />
              心跳任务
            </TabsTrigger>
            <TabsTrigger value="proactive" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              主动交互
            </TabsTrigger>
            <TabsTrigger value="httpapi" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              HTTP API
            </TabsTrigger>
          </TabsList>

          {/* ========================================
              心跳任务配置（对齐原版 OpenClaw）
              ======================================== */}
          <TabsContent value="heartbeat" className="space-y-4 mt-4">
            <div className="bg-surface-elevated rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileText className="w-4 h-4" />
                HEARTBEAT.md 驱动
              </div>
              <p className="text-xs text-muted-foreground">
                心跳任务会定期读取工作区的 HEARTBEAT.md 文件，将内容作为任务指令发送给 AI。
                AI 根据内容决定是否需要主动联系用户或执行任务。如果 AI 回复 HEARTBEAT_OK，则表示无需操作。
              </p>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="heartbeat-enabled">启用心跳任务</Label>
              <Switch
                id="heartbeat-enabled"
                checked={heartbeatConfig.enabled}
                onCheckedChange={(checked) =>
                  setHeartbeatConfig({ ...heartbeatConfig, enabled: checked })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hb-interval">检查间隔（分钟）</Label>
                <Input
                  id="hb-interval"
                  type="number"
                  min={1}
                  value={heartbeatConfig.every_mins}
                  onChange={(e) =>
                    setHeartbeatConfig({
                      ...heartbeatConfig,
                      every_mins: parseInt(e.target.value) || 30,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  AI 会每隔这个时间读取 HEARTBEAT.md
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hb-session">目标会话</Label>
                <Input
                  id="hb-session"
                  value={heartbeatConfig.target_session}
                  onChange={(e) =>
                    setHeartbeatConfig({
                      ...heartbeatConfig,
                      target_session: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  活跃开始时间
                </Label>
                <Select
                  value={String(heartbeatConfig.active_hours_start)}
                  onValueChange={(v) =>
                    setHeartbeatConfig({
                      ...heartbeatConfig,
                      active_hours_start: parseInt(v),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {i}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>活跃结束时间</Label>
                <Select
                  value={String(heartbeatConfig.active_hours_end)}
                  onValueChange={(v) =>
                    setHeartbeatConfig({
                      ...heartbeatConfig,
                      active_hours_end: parseInt(v),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {i}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hb-prompt">心跳提示词</Label>
              <Textarea
                id="hb-prompt"
                value={heartbeatConfig.prompt}
                onChange={(e) =>
                  setHeartbeatConfig({ ...heartbeatConfig, prompt: e.target.value })
                }
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                每次心跳时，这个提示词会和 HEARTBEAT.md 内容一起发送给 AI
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hb-model">模型覆盖（可选）</Label>
                <Input
                  id="hb-model"
                  value={heartbeatConfig.model}
                  onChange={(e) =>
                    setHeartbeatConfig({ ...heartbeatConfig, model: e.target.value })
                  }
                  placeholder="如: qwen-plus"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hb-ack">确认消息最大字符</Label>
                <Input
                  id="hb-ack"
                  type="number"
                  min={50}
                  max={500}
                  value={heartbeatConfig.ack_max_chars}
                  onChange={(e) =>
                    setHeartbeatConfig({
                      ...heartbeatConfig,
                      ack_max_chars: parseInt(e.target.value) || 200,
                    })
                  }
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button onClick={saveHeartbeatConfig} disabled={loading}>
                {loading ? '保存中...' : '保存心跳配置'}
              </Button>
            </div>
          </TabsContent>

          {/* ========================================
              主动交互配置（含 Ghost Reminder）
              ======================================== */}
          <TabsContent value="proactive" className="space-y-4 mt-4">
            {/* 主动交互 */}
            <div className="space-y-4 pb-4 border-b">
              <h4 className="font-medium flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                定期主动检查
              </h4>

              <div className="flex items-center justify-between">
                <Label htmlFor="proactive-enabled">启用主动交互</Label>
                <Switch
                  id="proactive-enabled"
                  checked={proactiveConfig.enabled}
                  onCheckedChange={(checked) =>
                    setProactiveConfig({ ...proactiveConfig, enabled: checked })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="interval">检查间隔（分钟）</Label>
                  <Input
                    id="interval"
                    type="number"
                    min={1}
                    value={proactiveConfig.interval_mins}
                    onChange={(e) =>
                      setProactiveConfig({
                        ...proactiveConfig,
                        interval_mins: parseInt(e.target.value) || 30,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="session">目标会话</Label>
                  <Input
                    id="session"
                    value={proactiveConfig.target_session}
                    onChange={(e) =>
                      setProactiveConfig({
                        ...proactiveConfig,
                        target_session: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>活跃开始时间</Label>
                  <Select
                    value={String(proactiveConfig.active_hours_start)}
                    onValueChange={(v) =>
                      setProactiveConfig({
                        ...proactiveConfig,
                        active_hours_start: parseInt(v),
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {i}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>活跃结束时间</Label>
                  <Select
                    value={String(proactiveConfig.active_hours_end)}
                    onValueChange={(v) =>
                      setProactiveConfig({
                        ...proactiveConfig,
                        active_hours_end: parseInt(v),
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {i}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prompt">主动检查提示词</Label>
                <Input
                  id="prompt"
                  value={proactiveConfig.prompt}
                  onChange={(e) =>
                    setProactiveConfig({ ...proactiveConfig, prompt: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Agent 会定期使用此提示词主动检查并可能发起交互
                </p>
              </div>
            </div>

            {/* Ghost Reminder */}
            <div className="space-y-4 pt-4">
              <h4 className="font-medium flex items-center gap-2">
                <Ghost className="w-4 h-4" />
                Ghost 提醒（长时间无交互）
              </h4>

              <div className="flex items-center justify-between">
                <Label htmlFor="ghost-enabled">启用 Ghost 提醒</Label>
                <Switch
                  id="ghost-enabled"
                  checked={ghostConfig.enabled}
                  onCheckedChange={(checked) =>
                    setGhostConfig({ ...ghostConfig, enabled: checked })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="idle-threshold">无交互阈值（分钟）</Label>
                  <Input
                    id="idle-threshold"
                    type="number"
                    min={1}
                    value={ghostConfig.idle_threshold_mins}
                    onChange={(e) =>
                      setGhostConfig({
                        ...ghostConfig,
                        idle_threshold_mins: parseInt(e.target.value) || 60,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    超过此时间无交互将触发提醒
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reminder-interval">提醒间隔（分钟）</Label>
                  <Input
                    id="reminder-interval"
                    type="number"
                    min={1}
                    value={ghostConfig.reminder_interval_mins}
                    onChange={(e) =>
                      setGhostConfig({
                        ...ghostConfig,
                        reminder_interval_mins: parseInt(e.target.value) || 30,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-reminders">最大提醒次数</Label>
                <Input
                  id="max-reminders"
                  type="number"
                  min={1}
                  max={10}
                  value={ghostConfig.max_reminders}
                  onChange={(e) =>
                    setGhostConfig({
                      ...ghostConfig,
                      max_reminders: parseInt(e.target.value) || 3,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  每次会话最多提醒次数
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reminder-prompt">提醒提示词</Label>
                <Input
                  id="reminder-prompt"
                  value={ghostConfig.reminder_prompt}
                  onChange={(e) =>
                    setGhostConfig({ ...ghostConfig, reminder_prompt: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="mr-2">
                取消
              </Button>
              <Button onClick={saveProactiveConfig} disabled={loading}>
                {loading ? '保存中...' : '保存主动交互配置'}
              </Button>
            </div>
          </TabsContent>

          {/* ========================================
              HTTP API 配置
              ======================================== */}
          <TabsContent value="httpapi" className="space-y-4 mt-4">
            <div className="bg-surface-elevated rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Globe className="w-4 h-4" />
                OpenAI 兼容 HTTP API
              </div>
              <p className="text-xs text-muted-foreground">
                提供标准 OpenAI API 接口，允许外部应用（如 Cursor、Continue）通过 HTTP 调用 OpenClaw。
              </p>
            </div>

            {/* 状态展示 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface-elevated rounded-lg p-4">
                <div className="text-xs text-muted-foreground mb-1">服务状态</div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${httpApiStatus.running ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="font-medium">{httpApiStatus.running ? '运行中' : '未启动'}</span>
                </div>
              </div>
              <div className="bg-surface-elevated rounded-lg p-4">
                <div className="text-xs text-muted-foreground mb-1">认证状态</div>
                <span className="font-medium">{httpApiStatus.auth_enabled ? '已启用' : '未启用'}</span>
              </div>
            </div>

            {/* 配置信息 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">Base URL</span>
                <code className="text-sm bg-surface-elevated px-2 py-1 rounded">
                  {httpApiStatus.base_url || `http://${httpApiStatus.bind_addr}:${httpApiStatus.port}`}
                </code>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">端口</span>
                <span className="text-sm">{httpApiStatus.port}</span>
              </div>
            </div>

            {/* 可用端点 */}
            <div className="space-y-2">
              <Label>可用端点</Label>
              <div className="bg-surface-elevated rounded-lg p-3 space-y-1">
                {(httpApiStatus.endpoints || []).map((endpoint, i) => (
                  <code key={i} className="block text-sm text-green-600">{endpoint}</code>
                ))}
              </div>
            </div>

            {/* 使用说明 */}
            <div className="space-y-2">
              <Label>使用示例</Label>
              <div className="bg-surface-elevated rounded-lg p-3">
                <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
{`# Chat Completions
curl -X POST ${httpApiStatus.base_url || `http://127.0.0.1:${httpApiStatus.port}`}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{"model": "qwen", "messages": [{"role": "user", "content": "Hello"}]}'

# 在 Cursor 中配置
Base URL: ${httpApiStatus.base_url || `http://127.0.0.1:${httpApiStatus.port}`}/v1
API Key: (任意值，本地不验证)
Model: qwen`}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                关闭
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
