/**
 * SettingsPage - 统一设置页面
 * 使用 Tabs 整合所有系统配置功能
 */
import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Badge } from './ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import { Switch } from './ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog'
import { Label } from './ui/label'
import {
  RefreshCw,
  Sparkles,
  FolderOpen,
  Volume2,
  RotateCcw,
  Shield,
  Settings,
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Zap,
  Server,
  Search,
  Eye,
  EyeOff,
  ExternalLink,
  Globe,
  Play,
  Square,
  Loader2,
  Copy,
  BookOpen,
  Database,
} from 'lucide-react'

import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import TlsConfigPanel from './TlsConfigPanel'
import PatternLibrary from './PatternLibrary'

/**
 * Gateway 状态管理卡片
 */
function GatewaySettingsCard() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null) // 'start' | 'stop' | 'restart'

  useEffect(() => {
    loadStatus()
    // 定时刷新状态
    const interval = setInterval(loadStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadStatus = async () => {
    const result = await api.gateway.status()
    if (result.success) {
      setStatus(result.data)
    }
    setLoading(false)
  }

  const handleStart = async () => {
    setActionLoading('start')
    const result = await api.gateway.start()
    if (result.success) {
      toast.success('启动成功', 'Gateway 已启动')
      await loadStatus()
    } else {
      toast.error('启动失败', result.error)
    }
    setActionLoading(null)
  }

  const handleStop = async () => {
    setActionLoading('stop')
    const result = await api.gateway.stop()
    if (result.success) {
      toast.success('停止成功', 'Gateway 已停止')
      await loadStatus()
    } else {
      toast.error('停止失败', result.error)
    }
    setActionLoading(null)
  }

  const handleRestart = async () => {
    setActionLoading('restart')
    const result = await api.gateway.restart()
    if (result.success) {
      toast.success('重启成功', 'Gateway 已重启')
      await loadStatus()
    } else {
      toast.error('重启失败', result.error)
    }
    setActionLoading(null)
  }

  const getStatusInfo = () => {
    if (!status?.running) {
      return {
        icon: <XCircle className="w-5 h-5" />,
        text: '未运行',
        color: 'text-red-600',
        bg: 'bg-red-50',
        dot: 'bg-red-500',
        badge: 'destructive'
      }
    }
    if (status?.websocket_connected) {
      return {
        icon: <CheckCircle className="w-5 h-5" />,
        text: '运行中',
        color: 'text-green-600',
        bg: 'bg-green-50',
        dot: 'bg-green-500',
        badge: 'default'
      }
    }
    return {
      icon: <AlertTriangle className="w-5 h-5" />,
      text: '连接中...',
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
      dot: 'bg-yellow-500',
      badge: 'secondary'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  const statusInfo = getStatusInfo()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5" />
              Gateway 服务
            </CardTitle>
            <CardDescription>AI 对话网关服务状态管理</CardDescription>
          </div>
          <Badge variant={statusInfo.badge} className={statusInfo.badge === 'default' ? 'bg-green-600' : ''}>
            <div className={`w-2 h-2 rounded-full ${statusInfo.dot} mr-1.5`} />
            {statusInfo.text}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 状态详情 */}
        {status?.running && (
          <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-surface-elevated text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">WebSocket:</span>
              <Badge variant={status.websocket_connected ? 'default' : 'secondary'}>
                {status.websocket_connected ? '已连接' : '未连接'}
              </Badge>
            </div>
            {status?.port && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">端口:</span>
                <span className="font-mono">{status.port}</span>
              </div>
            )}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2">
          {!status?.running ? (
            <Button
              onClick={handleStart}
              disabled={actionLoading !== null}
              className="flex-1"
            >
              {actionLoading === 'start' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              启动服务
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleRestart}
                disabled={actionLoading !== null}
                className="flex-1"
              >
                {actionLoading === 'restart' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                重启
              </Button>
              <Button
                variant="destructive"
                onClick={handleStop}
                disabled={actionLoading !== null}
                className="flex-1"
              >
                {actionLoading === 'stop' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Square className="w-4 h-4 mr-2" />
                )}
                停止
              </Button>
            </>
          )}
        </div>

        {/* 提示信息 */}
        <p className="text-xs text-muted-foreground text-center">
          软件启动时会自动启动 Gateway 服务
        </p>
      </CardContent>
    </Card>
  )
}

/**
 * TTS 设置 Tab
 */
function TTSSettingsTab() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    setLoading(true)
    const result = await api.config.get()
    if (result.success) {
      setConfig(result.data?.tts || { enabled: false, provider: 'edge' })
    }
    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await api.config.update({ tts: config })
      if (result.success) {
        toast.success('保存成功', 'TTS 配置已更新')
      } else {
        toast.error('保存失败', result.error)
      }
    } catch (error) {
      console.error('保存配置失败:', error)
      toast.error('保存失败', error.message || '未知错误')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="w-5 h-5" />
            语音合成服务
          </CardTitle>
          <CardDescription>配置文字转语音功能</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">启用 TTS</div>
              <div className="text-sm text-muted-foreground">开启语音合成功能</div>
            </div>
            <Switch
              checked={config?.enabled || false}
              onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">提供商</div>
              <div className="text-sm text-muted-foreground">选择 TTS 服务提供商</div>
            </div>
            <select
              className="px-3 py-2 border rounded-lg"
              value={config?.provider || 'edge'}
              onChange={(e) => setConfig({ ...config, provider: e.target.value })}
            >
              <option value="edge">Edge TTS (免费)</option>
              <option value="openai">OpenAI TTS</option>
              <option value="elevenlabs">ElevenLabs</option>
            </select>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Settings className="w-4 h-4 mr-2" />
              )}
              保存配置
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-6">
          <div className="text-center text-muted-foreground">
            <Volume2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>更多 TTS 配置选项</p>
            <p className="text-sm mt-1">请在原 TTS 页面进行详细配置</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * 故障转移设置 Tab
 */
function FailoverSettingsTab() {
  const [states, setStates] = useState({})
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    loadStates()
  }, [])

  const loadStates = async () => {
    setLoading(true)
    const result = await api.failover.status()
    if (result.success && result.data?.providers) {
      const statesMap = {}
      for (const provider of result.data.providers) {
        statesMap[provider.provider] = provider
      }
      setStates(statesMap)
    }
    setLoading(false)
  }

  const handleResetAll = async () => {
    setResetting(true)
    const result = await api.failover.reset()
    if (result.success) {
      toast.success('重置成功', '所有提供商状态已重置')
      loadStates()
    } else {
      toast.error('重置失败', result.error)
    }
    setResetting(false)
  }

  const providers = Object.values(states)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5" />
                故障转移状态
              </CardTitle>
              <CardDescription>监控 AI 提供商的可用性</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadStates}>
                <RefreshCw className="w-4 h-4 mr-1" />
                刷新
              </Button>
              <Button variant="outline" size="sm" onClick={handleResetAll} disabled={resetting}>
                {resetting ? (
                  <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4 mr-1" />
                )}
                重置全部
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {providers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>暂无提供商状态</p>
            </div>
          ) : (
            <div className="space-y-3">
              {providers.map((provider) => (
                <div
                  key={provider.provider}
                  className="flex items-center justify-between p-3 rounded-lg bg-surface-elevated"
                >
                  <div className="flex items-center gap-3">
                    {provider.available ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                    <div>
                      <div className="font-medium capitalize">{provider.provider}</div>
                      <div className="text-xs text-muted-foreground">
                        {provider.available
                          ? `成功: ${provider.success_count || 0}`
                          : `失败: ${provider.failure_count || 0}`}
                      </div>
                    </div>
                  </div>
                  {provider.cooldown_until && (
                    <Badge variant="secondary">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      冷却中
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * 搜索/工具设置 Tab
 */
function SearchSettingsTab() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showApiKeys, setShowApiKeys] = useState({})

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    setLoading(true)
    const result = await api.config.get()
    if (result.success) {
      setConfig(result.data?.search || {
        enabled: true,
        provider: 'duckduckgo',
        max_results: 10,
        timeout_seconds: 30,
        cache_ttl_minutes: 60,
        brave: { api_key: '' },
        perplexity: { api_key: '', base_url: 'https://openrouter.ai/api/v1', model: 'perplexity/sonar-pro' },
        grok: { api_key: '', model: 'grok-4-1-fast', inline_citations: false },
      })
    }
    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await api.config.update({ search: config })
      if (result.success) {
        toast.success('保存成功', '搜索配置已更新')
      } else {
        toast.error('保存失败', result.error)
      }
    } catch (error) {
      console.error('保存配置失败:', error)
      toast.error('保存失败', error.message || '未知错误')
    } finally {
      setSaving(false)
    }
  }

  const toggleApiKeyVisibility = (field) => {
    setShowApiKeys(prev => ({ ...prev, [field]: !prev[field] }))
  }

  const updateNestedConfig = (parent, field, value) => {
    setConfig(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: value
      }
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const providers = [
    { id: 'duckduckgo', name: 'DuckDuckGo', description: '免费搜索，无需 API Key', icon: '🦆' },
    { id: 'brave', name: 'Brave Search', description: '高质量搜索，需要 API Key', icon: '🦁' },
    { id: 'perplexity', name: 'Perplexity AI', description: 'AI 综合回答 + 引用', icon: '🔮' },
    { id: 'grok', name: 'Grok (xAI)', description: 'xAI 实时搜索', icon: '⚡' },
  ]

  return (
    <div className="space-y-6">
      {/* 基础配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            网络搜索配置
          </CardTitle>
          <CardDescription>配置 Agent 的网络搜索能力</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 启用开关 */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">启用搜索</div>
              <div className="text-sm text-muted-foreground">允许 Agent 使用网络搜索</div>
            </div>
            <Switch
              checked={config?.enabled ?? true}
              onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
            />
          </div>

          {/* 提供商选择 */}
          <div className="space-y-2">
            <Label>搜索提供商</Label>
            <div className="grid grid-cols-2 gap-2">
              {providers.map(provider => (
                <div
                  key={provider.id}
                  onClick={() => setConfig({ ...config, provider: provider.id })}
                  className={`
                    p-3 rounded-lg border-2 cursor-pointer transition-all
                    ${config?.provider === provider.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'}
                  `}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{provider.icon}</span>
                    <div>
                      <div className="font-medium text-sm">{provider.name}</div>
                      <div className="text-xs text-muted-foreground">{provider.description}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 通用参数 */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>最大结果数</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={config?.max_results || 10}
                onChange={(e) => setConfig({ ...config, max_results: parseInt(e.target.value) || 10 })}
              />
            </div>
            <div className="space-y-2">
              <Label>超时（秒）</Label>
              <Input
                type="number"
                min={5}
                max={120}
                value={config?.timeout_seconds || 30}
                onChange={(e) => setConfig({ ...config, timeout_seconds: parseInt(e.target.value) || 30 })}
              />
            </div>
            <div className="space-y-2">
              <Label>缓存时间（分钟）</Label>
              <Input
                type="number"
                min={0}
                max={1440}
                value={config?.cache_ttl_minutes || 60}
                onChange={(e) => setConfig({ ...config, cache_ttl_minutes: parseInt(e.target.value) || 60 })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Brave Search 配置 */}
      {config?.provider === 'brave' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              🦁 Brave Search 配置
            </CardTitle>
            <CardDescription>
              获取 API Key: <a href="https://brave.com/search/api/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">brave.com/search/api <ExternalLink className="w-3 h-3" /></a>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="relative">
                <Input
                  type={showApiKeys.brave ? 'text' : 'password'}
                  placeholder="输入 Brave Search API Key"
                  value={config?.brave?.api_key || ''}
                  onChange={(e) => updateNestedConfig('brave', 'api_key', e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => toggleApiKeyVisibility('brave')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showApiKeys.brave ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Perplexity 配置 */}
      {config?.provider === 'perplexity' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              🔮 Perplexity AI 配置
            </CardTitle>
            <CardDescription>
              支持 Perplexity 直接 API 或 OpenRouter
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="relative">
                <Input
                  type={showApiKeys.perplexity ? 'text' : 'password'}
                  placeholder="pplx-xxx 或 sk-or-xxx"
                  value={config?.perplexity?.api_key || ''}
                  onChange={(e) => updateNestedConfig('perplexity', 'api_key', e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => toggleApiKeyVisibility('perplexity')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showApiKeys.perplexity ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                pplx- 前缀使用直接 API，sk-or- 前缀使用 OpenRouter
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Base URL</Label>
                <Input
                  placeholder="https://openrouter.ai/api/v1"
                  value={config?.perplexity?.base_url || ''}
                  onChange={(e) => updateNestedConfig('perplexity', 'base_url', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>模型</Label>
                <Input
                  placeholder="perplexity/sonar-pro"
                  value={config?.perplexity?.model || ''}
                  onChange={(e) => updateNestedConfig('perplexity', 'model', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grok 配置 */}
      {config?.provider === 'grok' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              ⚡ Grok (xAI) 配置
            </CardTitle>
            <CardDescription>
              获取 API Key: <a href="https://console.x.ai/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">console.x.ai <ExternalLink className="w-3 h-3" /></a>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>xAI API Key</Label>
              <div className="relative">
                <Input
                  type={showApiKeys.grok ? 'text' : 'password'}
                  placeholder="输入 xAI API Key"
                  value={config?.grok?.api_key || ''}
                  onChange={(e) => updateNestedConfig('grok', 'api_key', e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => toggleApiKeyVisibility('grok')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showApiKeys.grok ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>模型</Label>
                <Input
                  placeholder="grok-4-1-fast"
                  value={config?.grok?.model || ''}
                  onChange={(e) => updateNestedConfig('grok', 'model', e.target.value)}
                />
              </div>
              <div className="flex items-end pb-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={config?.grok?.inline_citations || false}
                    onCheckedChange={(checked) => updateNestedConfig('grok', 'inline_citations', checked)}
                  />
                  <Label className="cursor-pointer">内联引用</Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 保存按钮 */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Settings className="w-4 h-4 mr-2" />
          )}
          保存配置
        </Button>
      </div>
    </div>
  )
}

/**
 * 记忆系统设置 Tab
 */
function MemorySettingsTab() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showApiKeys, setShowApiKeys] = useState({})

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    setLoading(true)
    const result = await api.config.get()
    if (result.success) {
      // 提取嵌入配置
      const embedding = result.data?.ai_provider?.embedding || {
        enabled: false,
        provider: '',
        model: '',
        base_url: '',
        api_key: '',
        group_id: '',
      }
      setConfig({
        enabled: embedding.enabled,
        provider: embedding.provider || '',
        model: embedding.model || '',
        base_url: embedding.base_url || '',
        api_key: embedding.api_key || '',
        group_id: embedding.group_id || '',
      })
    }
    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const fullConfig = await api.config.get()
      if (fullConfig.success) {
        // 合并现有配置
        const newConfig = {
          ...fullConfig.data,
          ai_provider: {
            ...fullConfig.data?.ai_provider,
            embedding: {
              enabled: config.enabled,
              provider: config.provider || null,
              model: config.model || null,
              base_url: config.base_url || null,
              api_key: config.api_key || null,
              group_id: config.group_id || null,
            }
          }
        }
        const result = await api.config.set(newConfig)
        if (result.success) {
          await api.config.syncToGateway()
          toast.success('保存成功', '记忆系统配置已更新')
        } else {
          toast.error('保存失败', result.error)
        }
      }
    } catch (error) {
      console.error('保存配置失败:', error)
      toast.error('保存失败', error.message || '未知错误')
    } finally {
      setSaving(false)
    }
  }

  const toggleApiKeyVisibility = (field) => {
    setShowApiKeys(prev => ({ ...prev, [field]: !prev[field] }))
  }

  // 支持的嵌入提供商列表
  const providers = [
    {
      id: 'openai',
      name: 'OpenAI',
      model: 'text-embedding-3-small',
      description: 'OpenAI 官方嵌入模型',
      icon: '🔵',
      url: 'https://platform.openai.com/api-keys',
    },
    {
      id: 'google',
      name: 'Google Gemini',
      model: 'text-embedding-004',
      description: 'Google 嵌入模型',
      icon: '🌐',
      url: 'https://aistudio.google.com/app/apikey',
    },
    {
      id: 'voyage',
      name: 'Voyage AI',
      model: 'voyage-3',
      description: '高性能嵌入模型',
      icon: '🚀',
      url: 'https://voyageai.com/api-key/',
    },
    {
      id: 'qwen',
      name: '通义千问',
      model: 'text-embedding-v3',
      description: '阿里云通义千问嵌入模型',
      icon: '💙',
      url: 'https://dashscope.console.aliyun.com/',
    },
    {
      id: 'zhipu',
      name: '智谱 GLM',
      model: 'embedding-3',
      description: '智谱 GLM 嵌入模型',
      icon: '🟢',
      url: 'https://open.bigmodel.cn/',
    },
    {
      id: 'deepseek',
      name: 'DeepSeek',
      model: 'deepseek-embed',
      description: 'DeepSeek 嵌入模型',
      icon: '🔷',
      url: 'https://platform.deepseek.com/',
    },
    {
      id: 'minimax',
      name: 'MiniMax',
      model: 'embo-01',
      description: 'MiniMax 嵌入模型（需要 GroupId）',
      icon: '🟣',
      url: 'https://platform.minimax.io/',
      requiresGroupId: true,
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 说明卡片 */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-medium">向量嵌入服务</div>
              <div className="text-sm text-muted-foreground mt-1">
                用于记忆系统的语义搜索功能，让 AI 能够理解您记忆内容的含义而不仅仅是关键词匹配。
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 启用开关 */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">启用记忆向量搜索</div>
              <div className="text-sm text-muted-foreground">开启后支持语义搜索记忆内容</div>
            </div>
            <Switch
              checked={config?.enabled || false}
              onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* 提供商选择 */}
      {config?.enabled && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5" />
                选择嵌入提供商
              </CardTitle>
              <CardDescription>选择已配置 API Key 的嵌入服务商</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {providers.map(provider => (
                  <div
                    key={provider.id}
                    onClick={() => setConfig({
                      ...config,
                      provider: provider.id,
                      model: provider.model,
                    })}
                    className={`
                      p-4 rounded-lg border-2 cursor-pointer transition-all
                      ${config?.provider === provider.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'}
                    `}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{provider.icon}</span>
                      <span className="font-medium">{provider.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {provider.description}
                    </div>
                    <div className="mt-2 text-xs font-mono bg-muted px-2 py-1 rounded">
                      {provider.model}
                    </div>
                    {provider.requiresGroupId && (
                      <div className="mt-1 text-xs text-orange-600">
                        需要 GroupId
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* MiniMax 特殊配置 */}
          {config?.provider === 'minimax' && (
            <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  🟣 MiniMax 特殊配置
                </CardTitle>
                <CardDescription>
                  MiniMax 嵌入 API 需要额外的 GroupId 参数
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-lg text-sm">
                  <strong>如何获取 GroupId:</strong>
                  <ol className="list-decimal list-inside mt-2 space-y-1">
                    <li>访问 <a href="https://platform.minimax.io/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">MiniMax 开放平台</a></li>
                    <li>登录后进入「账户设置」→「组织管理」</li>
                    <li>复制您的 GroupId</li>
                  </ol>
                </div>
                <div className="space-y-2">
                  <Label>Group ID</Label>
                  <Input
                    placeholder="输入 MiniMax GroupId"
                    value={config?.group_id || ''}
                    onChange={(e) => setConfig({ ...config, group_id: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* 自定义配置 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                自定义配置
              </CardTitle>
              <CardDescription>覆盖默认设置（可选）</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>模型名称</Label>
                  <Input
                    placeholder={config?.provider ? providers.find(p => p.id === config.provider)?.model : '嵌入模型'}
                    value={config?.model || ''}
                    onChange={(e) => setConfig({ ...config, model: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <div className="relative">
                    <Input
                      type={showApiKeys.apiKey ? 'text' : 'password'}
                      placeholder="输入 API Key（可选，使用提供商已有的 Key）"
                      value={config?.api_key || ''}
                      onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => toggleApiKeyVisibility('apiKey')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showApiKeys.apiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    如留空，将使用当前 AI 提供商的 API Key
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>自定义 Base URL</Label>
                <Input
                  placeholder="留空使用默认 URL"
                  value={config?.base_url || ''}
                  onChange={(e) => setConfig({ ...config, base_url: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  用于 OpenAI 兼容接口的自定义端点
                </p>
              </div>
            </CardContent>
          </Card>

          {/* API Key 获取链接 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="w-5 h-5" />
                获取 API Key
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {providers.map(provider => (
                  <a
                    key={provider.id}
                    href={provider.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 rounded-lg border hover:bg-muted transition-colors"
                  >
                    <span>{provider.icon}</span>
                    <span className="text-sm">{provider.name}</span>
                    <ExternalLink className="w-3 h-3 ml-auto" />
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* 保存按钮 */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Settings className="w-4 h-4 mr-2" />
          )}
          保存配置
        </Button>
      </div>
    </div>
  )
}

/**
 * 权限设置 Tab
 */
function PermissionsSettingsTab() {
  const [permissions, setPermissions] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPermissions()
  }, [])

  const loadPermissions = async () => {
    setLoading(true)
    // 模拟权限数据
    setPermissions({
      fileSystem: { granted: true, label: '文件系统访问' },
      network: { granted: true, label: '网络访问' },
      shell: { granted: false, label: 'Shell 命令执行' },
      browser: { granted: true, label: '浏览器自动化' },
    })
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            系统权限
          </CardTitle>
          <CardDescription>管理应用所需的系统权限</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(permissions).map(([key, perm]) => (
              <div
                key={key}
                className="flex items-center justify-between p-3 rounded-lg bg-surface-elevated"
              >
                <div className="flex items-center gap-3">
                  {perm.granted ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  )}
                  <span className="font-medium">{perm.label}</span>
                </div>
                <Badge variant={perm.granted ? 'default' : 'secondary'}>
                  {perm.granted ? '已授权' : '未授权'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * 关于 Tab
 */
function AboutTab({ systemInfo, hasUpdate, onCheckUpdate }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>关于 OpenClaw</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">版本</span>
            <span className="font-mono">1.0.0</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">更新状态</span>
            {hasUpdate ? (
              <Badge className="bg-green-500">有新版本</Badge>
            ) : (
              <Badge variant="secondary">已是最新</Badge>
            )}
          </div>
          <Button variant="outline" className="w-full" onClick={onCheckUpdate}>
            <RefreshCw className="w-4 h-4 mr-2" />
            检查更新
          </Button>
        </CardContent>
      </Card>

      {systemInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              系统信息
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">操作系统</div>
                <div className="font-medium">{systemInfo.os} {systemInfo.arch}</div>
              </div>
              <div>
                <div className="text-muted-foreground">总内存</div>
                <div className="font-medium">{(systemInfo.total_memory_mb / 1024).toFixed(1)} GB</div>
              </div>
              <div>
                <div className="text-muted-foreground">可用内存</div>
                <div className="font-medium">{(systemInfo.available_memory_mb / 1024).toFixed(1)} GB</div>
              </div>
              <div>
                <div className="text-muted-foreground">CPU 使用率</div>
                <div className="font-medium">{(systemInfo.cpu_usage * 100).toFixed(1)}%</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/**
 * 主设置页面组件
 */
export default function SettingsPage({
  config,
  systemInfo,
  hasUpdate,
  onOpenAISettings,
  onCheckUpdate,
  onRefresh,
}) {
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')

  const handleReset = async () => {
    try {
      await api.config.resetAllData()
      // 清理 localStorage
      Object.keys(localStorage)
        .filter(key => key.startsWith('openclaw_') || key.startsWith('agent_'))
        .forEach(key => localStorage.removeItem(key))
      window.location.reload()
    } catch (e) {
      console.error('重置系统失败:', e)
      toast.error('重置失败', e.message)
    }
  }

  return (
    <div className="space-y-6">
      {/* AI 服务配置 - 独立卡片，始终显示 */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>AI 服务配置</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-foreground mb-1">模型管理界面</div>
                <div className="text-sm text-foreground-secondary">
                  支持 10+ AI 提供商（国内/国外） • 模型选择 • API Key 管理
                </div>
              </div>
              <Button
                onClick={onOpenAISettings}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                打开模型管理
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="secondary">通义千问</Badge>
              <Badge variant="secondary">智谱 GLM</Badge>
              <Badge variant="secondary">DeepSeek</Badge>
              <Badge variant="secondary">文心一言</Badge>
              <Badge variant="secondary">OpenAI</Badge>
              <Badge variant="secondary">Anthropic</Badge>
              <Badge variant="secondary">+ 更多</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tab 化设置区域 */}
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="general">通用</TabsTrigger>
          <TabsTrigger value="patterns">模式库</TabsTrigger>
          <TabsTrigger value="search">搜索</TabsTrigger>
          <TabsTrigger value="tts">语音</TabsTrigger>
          <TabsTrigger value="memory">记忆系统</TabsTrigger>
          <TabsTrigger value="failover">故障转移</TabsTrigger>
          <TabsTrigger value="permissions">权限</TabsTrigger>
          <TabsTrigger value="about">关于</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6 space-y-6">
          {/* Gateway 状态 + TLS 配置 并排 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GatewaySettingsCard />
            <TlsConfigPanel />
          </div>

          {/* 通用设置 */}
          <Card>
            <CardHeader>
              <CardTitle>应用设置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">开机自启动</div>
                  <div className="text-sm text-muted-foreground">系统启动时自动运行应用</div>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">系统托盘</div>
                  <div className="text-sm text-muted-foreground">最小化到系统托盘</div>
                </div>
                <Switch defaultChecked />
              </div>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => api.system.openLogsFolder()}
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                打开日志文件夹
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => setShowResetConfirm(true)}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                重置所有数据
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patterns" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                模式库管理
              </CardTitle>
              <CardDescription>
                管理智能体的学习模式，包括成功模式和反模式
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PatternLibrary />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search" className="mt-6">
          <SearchSettingsTab />
        </TabsContent>

        <TabsContent value="tts" className="mt-6">
          <TTSSettingsTab />
        </TabsContent>

        <TabsContent value="memory" className="mt-6">
          <MemorySettingsTab />
        </TabsContent>

        <TabsContent value="failover" className="mt-6">
          <FailoverSettingsTab />
        </TabsContent>

        <TabsContent value="permissions" className="mt-6">
          <PermissionsSettingsTab />
        </TabsContent>

        <TabsContent value="about" className="mt-6">
          <AboutTab
            systemInfo={systemInfo}
            hasUpdate={hasUpdate}
            onCheckUpdate={onCheckUpdate}
          />
        </TabsContent>
      </Tabs>

      {/* 重置确认对话框 */}
      <Dialog open={showResetConfirm} onOpenChange={(open) => {
        setShowResetConfirm(open)
        if (!open) setResetConfirmText('')
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确定要重置所有数据吗？</DialogTitle>
            <DialogDescription>
              这将删除：
              <ul className="list-disc list-inside mt-2">
                <li>所有智能体和会话</li>
                <li>所有配置和记忆</li>
                <li>本地缓存数据</li>
              </ul>
              <p className="mt-2 text-red-600 font-medium">此操作不可恢复！</p>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">
              请输入 <code className="bg-slate-100 px-1 rounded text-red-600 font-mono">RESET</code> 以确认
            </label>
            <Input
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              placeholder="输入 RESET"
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowResetConfirm(false)
              setResetConfirmText('')
            }}>取消</Button>
            <Button
              variant="destructive"
              disabled={resetConfirmText !== 'RESET'}
              onClick={handleReset}
            >
              确认重置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
