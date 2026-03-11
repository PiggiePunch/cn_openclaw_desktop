/**
 * 主动消息组件
 *
 * 配置 Agent 主动发送消息行为
 * 支持服务状态查看、配置编辑、手动触发和启停控制
 */
import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Badge } from './ui/badge'
import { Switch } from './ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import {
  Send,
  Play,
  Pause,
  RefreshCw,
  Settings,
  Clock,
  MessageSquare,
  Zap,
  Loader2,
  Bot,
  History,
  Save,
} from 'lucide-react'

// 使用统一 API 服务层
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

// 默认配置
const DEFAULT_CONFIG = {
  enabled: false,
  interval_minutes: 60,
  max_messages_per_interval: 1,
  rules: [],
  channels: [],
  message_template: '你好！有什么可以帮助你的吗？',
  use_ai_generation: false,
  ai_prompt: '',
}

export default function ProactiveMessaging() {
  // 状态
  const [status, setStatus] = useState(null)
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [isLoading, setIsLoading] = useState(false)
  const [isTriggering, setIsTriggering] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [history, setHistory] = useState([])

  // 表单数据
  const [formData, setFormData] = useState(DEFAULT_CONFIG)

  useEffect(() => {
    loadStatus()
    loadConfig()
  }, [])

  // 加载服务状态
  const loadStatus = async () => {
    setIsLoading(true)
    const result = await api.proactive.status()
    if (result.success) {
      setStatus(result.data)
    } else {
      console.error('加载主动消息状态失败:', result.error)
    }
    setIsLoading(false)
  }

  // 加载配置
  const loadConfig = async () => {
    setIsLoading(true)
    const result = await api.proactive.status()
    if (result.success && result.data?.config) {
      const loadedConfig = result.data.config
      setConfig(loadedConfig)
      setFormData({
        ...DEFAULT_CONFIG,
        ...loadedConfig,
      })
    }
    setIsLoading(false)
  }

  // 保存配置
  const handleSaveConfig = async () => {
    setIsSaving(true)
    const result = await api.proactive.configure(formData)
    if (result.success) {
      setConfig(formData)
      toast.success('保存成功', '配置已更新')
      loadStatus()
    } else {
      console.error('保存配置失败:', result.error)
      toast.error('保存失败', result.error)
    }
    setIsSaving(false)
  }

  // 启动服务
  const handleStart = async () => {
    setIsLoading(true)
    const result = await api.proactive.start()
    if (result.success) {
      toast.success('启动成功', '主动消息服务已启动')
      loadStatus()
    } else {
      console.error('启动失败:', result.error)
      toast.error('启动失败', result.error)
    }
    setIsLoading(false)
  }

  // 停止服务
  const handleStop = async () => {
    setIsLoading(true)
    const result = await api.proactive.stop()
    if (result.success) {
      toast.success('停止成功', '主动消息服务已停止')
      loadStatus()
    } else {
      console.error('停止失败:', result.error)
      toast.error('停止失败', result.error)
    }
    setIsLoading(false)
  }

  // 手动触发
  const handleTrigger = async () => {
    setIsTriggering(true)
    const result = await api.proactive.trigger()
    if (result.success) {
      toast.success('触发成功', '主动消息已发送')
      // 添加到历史记录
      if (result.data) {
        setHistory(prev => [
          {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            message: result.data.message || '消息已发送',
            status: 'success',
          },
          ...prev.slice(0, 19), // 保留最近 20 条
        ])
      }
    } else {
      console.error('触发失败:', result.error)
      toast.error('触发失败', result.error)
    }
    setIsTriggering(false)
  }

  // 切换服务状态
  const handleToggle = async () => {
    if (status?.running) {
      await handleStop()
    } else {
      await handleStart()
    }
  }

  // 格式化时间
  const formatTime = (isoString) => {
    if (!isoString) return '-'
    return new Date(isoString).toLocaleString('zh-CN')
  }

  // 运行中状态
  const isRunning = status?.running || false

  return (
    <div className="space-y-6 p-6">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">主动消息</h2>
          <p className="text-muted-foreground">配置 Agent 主动发送消息行为</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { loadStatus(); loadConfig(); }}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTrigger}
            disabled={isTriggering || !isRunning}
          >
            {isTriggering ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            手动触发
          </Button>
          <Button
            size="sm"
            onClick={handleToggle}
            disabled={isLoading}
            variant={isRunning ? 'destructive' : 'default'}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : isRunning ? (
              <Pause className="h-4 w-4 mr-2" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {isRunning ? '停止服务' : '启动服务'}
          </Button>
        </div>
      </div>

      {/* 服务状态卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            服务状态
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">运行状态:</span>
              <Badge variant={isRunning ? 'default' : 'secondary'}>
                {isRunning ? '运行中' : '已停止'}
              </Badge>
            </div>
            {status?.last_run_at && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">上次运行:</span>
                <span className="text-sm">{formatTime(status.last_run_at)}</span>
              </div>
            )}
            {status?.next_run_at && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">下次运行:</span>
                <span className="text-sm">{formatTime(status.next_run_at)}</span>
              </div>
            )}
            {status?.messages_sent !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">已发送消息:</span>
                <Badge variant="outline">{status.messages_sent}</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 配置编辑 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            配置设置
          </CardTitle>
          <CardDescription>配置主动消息的发送规则和内容</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 基本设置 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>启用主动消息</Label>
                <p className="text-xs text-muted-foreground">开启后将按配置自动发送消息</p>
              </div>
              <Switch
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>发送间隔 (分钟)</Label>
                <Input
                  type="number"
                  min={1}
                  value={formData.interval_minutes}
                  onChange={(e) => setFormData({ ...formData, interval_minutes: parseInt(e.target.value) || 60 })}
                  placeholder="60"
                />
                <p className="text-xs text-muted-foreground">两次主动消息之间的最小间隔</p>
              </div>

              <div className="space-y-2">
                <Label>单次最大消息数</Label>
                <Input
                  type="number"
                  min={1}
                  value={formData.max_messages_per_interval}
                  onChange={(e) => setFormData({ ...formData, max_messages_per_interval: parseInt(e.target.value) || 1 })}
                  placeholder="1"
                />
                <p className="text-xs text-muted-foreground">每个间隔内最多发送的消息数量</p>
              </div>
            </div>
          </div>

          {/* 消息内容设置 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>使用 AI 生成消息</Label>
                <p className="text-xs text-muted-foreground">启用后将使用 AI 动态生成消息内容</p>
              </div>
              <Switch
                checked={formData.use_ai_generation}
                onCheckedChange={(checked) => setFormData({ ...formData, use_ai_generation: checked })}
              />
            </div>

            {formData.use_ai_generation ? (
              <div className="space-y-2">
                <Label>AI 生成提示词</Label>
                <Textarea
                  placeholder="输入提示词，AI 将根据此生成主动消息内容..."
                  value={formData.ai_prompt}
                  onChange={(e) => setFormData({ ...formData, ai_prompt: e.target.value })}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  例如：根据当前时间和用户习惯，生成一条友好的问候消息
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>消息模板</Label>
                <Textarea
                  placeholder="输入要主动发送的消息内容..."
                  value={formData.message_template}
                  onChange={(e) => setFormData({ ...formData, message_template: e.target.value })}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  支持变量：{'{time}'}、{'{date}'}、{'{user_name}'}
                </p>
              </div>
            )}
          </div>

          {/* 渠道设置 */}
          <div className="space-y-2">
            <Label>适用渠道 (留空表示全部)</Label>
            <Input
              placeholder="telegram, discord, wechat"
              value={formData.channels?.join(', ') || ''}
              onChange={(e) => setFormData({
                ...formData,
                channels: e.target.value.split(',').map(c => c.trim()).filter(Boolean)
              })}
            />
            <p className="text-xs text-muted-foreground">
              指定发送消息的渠道，多个渠道用逗号分隔
            </p>
          </div>

          {/* 保存按钮 */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setFormData({ ...DEFAULT_CONFIG, ...config })}
            >
              重置
            </Button>
            <Button onClick={handleSaveConfig} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              保存配置
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 最近发送历史 */}
      {(history.length > 0 || status?.recent_messages?.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              最近发送记录
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(status?.recent_messages || history).map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="flex items-start gap-3 p-3 bg-surface-elevated rounded-lg"
                >
                  <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{item.message || item.content || '-'}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{formatTime(item.timestamp || item.sent_at)}</span>
                      {item.channel && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                          {item.channel}
                        </Badge>
                      )}
                      {item.status && (
                        <Badge
                          variant={item.status === 'success' ? 'default' : 'destructive'}
                          className="text-[10px] px-1 py-0 h-4"
                        >
                          {item.status === 'success' ? '成功' : '失败'}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
