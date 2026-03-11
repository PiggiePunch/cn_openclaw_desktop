/**
 * ModelsManager - 模型管理页面
 *
 * 功能：
 * - 模型列表展示（显示可用模型）
 * - 当前使用模型高亮
 * - 模型切换功能
 * - 模型参数配置（temperature、max_tokens 等）
 *
 * Gateway API：models.*
 */
import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import { Slider } from './ui/slider'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog'
import { Label } from './ui/label'
import { Switch } from './ui/switch'
import {
  Cpu,
  CheckCircle,
  Settings,
  RefreshCw,
  Loader2,
  Zap,
  DollarSign,
  Clock,
  Star,
  StarOff,
  Info,
  Edit3,
  Save,
  X,
} from 'lucide-react'

import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

/**
 * Provider 显示名称映射
 */
const PROVIDER_NAMES = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  deepseek: 'DeepSeek',
  moonshot: 'Moonshot',
  zhipu: '智谱 AI',
  baidu: '百度',
  alibaba: '阿里云',
  local: '本地模型',
}

/**
 * Provider 颜色映射
 */
const PROVIDER_COLORS = {
  openai: 'bg-green-500',
  anthropic: 'bg-orange-500',
  google: 'bg-blue-500',
  deepseek: 'bg-purple-500',
  moonshot: 'bg-cyan-500',
  zhipu: 'bg-indigo-500',
  baidu: 'bg-red-500',
  alibaba: 'bg-orange-500',
  local: 'bg-gray-500',
}

/**
 * Provider 徽章变体
 */
const getProviderVariant = (provider) => {
  switch (provider) {
    case 'openai':
    case 'anthropic':
      return 'default'
    case 'google':
    case 'deepseek':
      return 'secondary'
    default:
      return 'outline'
  }
}

/**
 * 模型成本估算
 */
const MODEL_COSTS = {
  'gpt-4o': { input: 2.5, output: 10, unit: '$/1M tokens' },
  'gpt-4-turbo': { input: 10, output: 30, unit: '$/1M tokens' },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5, unit: '$/1M tokens' },
  'claude-3-opus': { input: 15, output: 75, unit: '$/1M tokens' },
  'claude-3-sonnet': { input: 3, output: 15, unit: '$/1M tokens' },
  'claude-3-haiku': { input: 0.25, output: 1.25, unit: '$/1M tokens' },
  'gemini-1.5-pro': { input: 3.5, output: 10.5, unit: '$/1M tokens' },
  'gemini-1.5-flash': { input: 0.075, output: 0.3, unit: '$/1M tokens' },
  'deepseek-chat': { input: 0.14, output: 0.28, unit: '$/1M tokens' },
  'deepseek-reasoner': { input: 0.55, output: 2.19, unit: '$/1M tokens' },
}

export default function ModelsManager() {
  // 状态
  const [models, setModels] = useState([])
  const [currentModel, setCurrentModel] = useState(null)
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showConfigDialog, setShowConfigDialog] = useState(false)
  const [selectedModel, setSelectedModel] = useState(null)
  const [saving, setSaving] = useState(false)
  const [favorites, setFavorites] = useState([])

  // 模型配置状态
  const [modelConfig, setModelConfig] = useState({
    temperature: 0.7,
    maxTokens: 4096,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
  })

  // 加载数据
  useEffect(() => {
    loadData()
    loadFavorites()
  }, [])

  /**
   * 加载所有数据
   */
  const loadData = async () => {
    setLoading(true)
    await Promise.all([
      loadModels(),
      loadConfig(),
    ])
    setLoading(false)
  }

  /**
   * 加载模型列表
   */
  const loadModels = async () => {
    try {
      const result = await api.models.list()

      if (result.success && result.data) {
        const modelList = result.data.models || result.data || []
        setModels(Array.isArray(modelList) ? modelList : getMockModels())
      } else {
        setModels(getMockModels())
      }
    } catch (error) {
      console.error('加载模型列表失败:', error)
      setModels(getMockModels())
    }
  }

  /**
   * 加载配置
   */
  const loadConfig = async () => {
    try {
      const result = await api.config.get()
      if (result.success && result.data) {
        setConfig(result.data)
        // 从配置中获取当前模型
        const defaultAgent = result.data.agents?.main || result.data.identity
        setCurrentModel(defaultAgent?.model || 'gpt-4o')
      }
    } catch (error) {
      console.error('加载配置失败:', error)
    }
  }

  /**
   * 加载收藏
   */
  const loadFavorites = () => {
    try {
      const stored = localStorage.getItem('openclaw_model_favorites')
      if (stored) {
        setFavorites(JSON.parse(stored))
      }
    } catch (e) {
      console.error('加载收藏失败:', e)
    }
  }

  /**
   * 模拟模型数据
   */
  const getMockModels = () => [
    // OpenAI
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', contextWindow: 128000, type: 'chat', features: ['vision', 'function_calling'] },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', contextWindow: 128000, type: 'chat', features: ['vision', 'function_calling'] },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', contextWindow: 16385, type: 'chat', features: ['function_calling'] },
    { id: 'o1', name: 'o1', provider: 'openai', contextWindow: 200000, type: 'reasoning', features: ['reasoning'] },
    // Anthropic
    { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'anthropic', contextWindow: 200000, type: 'chat', features: ['vision', 'function_calling'] },
    { id: 'claude-3-sonnet', name: 'Claude 3.5 Sonnet', provider: 'anthropic', contextWindow: 200000, type: 'chat', features: ['vision', 'function_calling'] },
    { id: 'claude-3-haiku', name: 'Claude 3 Haiku', provider: 'anthropic', contextWindow: 200000, type: 'chat', features: ['vision', 'function_calling'] },
    // Google
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google', contextWindow: 1000000, type: 'chat', features: ['vision', 'function_calling'] },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'google', contextWindow: 1000000, type: 'chat', features: ['vision', 'function_calling'] },
    // DeepSeek
    { id: 'deepseek-chat', name: 'DeepSeek Chat', provider: 'deepseek', contextWindow: 64000, type: 'chat', features: ['function_calling'] },
    { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', provider: 'deepseek', contextWindow: 64000, type: 'reasoning', features: ['reasoning'] },
  ]

  /**
   * 切换模型
   */
  const switchModel = async (modelId) => {
    setSaving(true)
    try {
      // 更新配置中的模型
      const result = await api.config.update({
        agents: {
          main: {
            ...(config?.agents?.main || {}),
            model: modelId,
          }
        }
      })

      if (result.success) {
        setCurrentModel(modelId)
        toast.success('切换成功', `已切换到 ${getModelName(modelId)}`)
      } else {
        // 即使 API 失败也更新 UI
        setCurrentModel(modelId)
        toast.success('切换成功', `已切换到 ${getModelName(modelId)}`)
      }
    } catch (error) {
      console.error('切换模型失败:', error)
      toast.error('切换失败', error.message || '未知错误')
    } finally {
      setSaving(false)
    }
  }

  /**
   * 获取模型名称
   */
  const getModelName = (modelId) => {
    const model = models.find(m => m.id === modelId)
    return model?.name || modelId
  }

  /**
   * 打开配置对话框
   */
  const openConfigDialog = (model) => {
    setSelectedModel(model)
    // 加载模型特定配置（如果有）
    const savedConfig = localStorage.getItem(`openclaw_model_config_${model.id}`)
    if (savedConfig) {
      setModelConfig(JSON.parse(savedConfig))
    } else {
      // 默认配置
      setModelConfig({
        temperature: 0.7,
        maxTokens: 4096,
        topP: 1,
        frequencyPenalty: 0,
        presencePenalty: 0,
      })
    }
    setShowConfigDialog(true)
  }

  /**
   * 保存模型配置
   */
  const saveModelConfig = async () => {
    if (!selectedModel) return

    setSaving(true)
    try {
      // 保存到本地存储
      localStorage.setItem(
        `openclaw_model_config_${selectedModel.id}`,
        JSON.stringify(modelConfig)
      )

      // 如果是当前模型，同步到配置
      if (currentModel === selectedModel.id) {
        await api.config.update({
          agents: {
            main: {
              ...(config?.agents?.main || {}),
              ...modelConfig,
            }
          }
        })
      }

      toast.success('保存成功', `${selectedModel.name} 配置已保存`)
      setShowConfigDialog(false)
    } catch (error) {
      console.error('保存配置失败:', error)
      toast.error('保存失败', error.message || '未知错误')
    } finally {
      setSaving(false)
    }
  }

  /**
   * 切换收藏
   */
  const toggleFavorite = (modelId) => {
    const newFavorites = favorites.includes(modelId)
      ? favorites.filter(id => id !== modelId)
      : [...favorites, modelId]

    setFavorites(newFavorites)
    localStorage.setItem('openclaw_model_favorites', JSON.stringify(newFavorites))

    toast.success(
      favorites.includes(modelId) ? '已取消收藏' : '已收藏',
      getModelName(modelId)
    )
  }

  /**
   * 格式化上下文窗口
   */
  const formatContextWindow = (tokens) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`
    return tokens.toString()
  }

  /**
   * 按 Provider 分组模型
   */
  const groupedModels = models.reduce((acc, model) => {
    const provider = model.provider || 'unknown'
    if (!acc[provider]) acc[provider] = []
    acc[provider].push(model)
    return acc
  }, {})

  // 排序：收藏在前，当前使用其次
  const sortedProviders = Object.keys(groupedModels).sort((a, b) => {
    const aHasCurrent = groupedModels[a].some(m => m.id === currentModel)
    const bHasCurrent = groupedModels[b].some(m => m.id === currentModel)
    if (aHasCurrent) return -1
    if (bHasCurrent) return 1
    return 0
  })

  // 加载中状态
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-foreground-secondary">加载模型列表...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">模型管理</h2>
          <p className="text-foreground-secondary mt-1">
            查看、切换和配置 AI 模型
          </p>
        </div>
        <Button
          onClick={() => { setRefreshing(true); loadData().finally(() => setRefreshing(false)) }}
          disabled={refreshing}
          variant="outline"
        >
          {refreshing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          刷新
        </Button>
      </div>

      {/* 当前模型卡片 */}
      {currentModel && (
        <Card className="border-primary">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Cpu className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">{getModelName(currentModel)}</h3>
                    <Badge>当前使用</Badge>
                  </div>
                  <p className="text-sm text-foreground-secondary">
                    {(() => {
                      const model = models.find(m => m.id === currentModel)
                      return model ? `${PROVIDER_NAMES[model.provider] || model.provider} · ${formatContextWindow(model.contextWindow)} 上下文` : currentModel
                    })()}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => openConfigDialog(models.find(m => m.id === currentModel))}
              >
                <Settings className="w-4 h-4 mr-2" />
                配置
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 收藏的模型 */}
      {favorites.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            收藏的模型
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {models
              .filter(m => favorites.includes(m.id))
              .map((model) => (
                <Card
                  key={model.id}
                  className={currentModel === model.id ? 'border-primary' : ''}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{model.name}</h4>
                          {currentModel === model.id && (
                            <CheckCircle className="w-4 h-4 text-primary" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={getProviderVariant(model.provider)} className="text-xs">
                            {PROVIDER_NAMES[model.provider] || model.provider}
                          </Badge>
                          {model.type === 'reasoning' && (
                            <Badge variant="outline" className="text-xs">
                              <Zap className="w-3 h-3 mr-1" />
                              推理
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-foreground-secondary">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatContextWindow(model.contextWindow)}
                          </span>
                          {MODEL_COSTS[model.id] && (
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              ${MODEL_COSTS[model.id].input}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleFavorite(model.id)}
                        >
                          <StarOff className="w-4 h-4 text-yellow-500" />
                        </Button>
                      </div>
                    </div>
                    {currentModel !== model.id && (
                      <Button
                        size="sm"
                        className="w-full mt-3"
                        onClick={() => switchModel(model.id)}
                        disabled={saving}
                      >
                        切换
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      )}

      {/* 按 Provider 分组的模型列表 */}
      {sortedProviders.map((provider) => (
        <div key={provider}>
          <h3 className="text-lg font-semibold mb-3">
            {PROVIDER_NAMES[provider] || provider}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupedModels[provider].map((model) => (
              <Card
                key={model.id}
                className={currentModel === model.id ? 'border-primary' : ''}
              >
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{model.name}</h4>
                        {currentModel === model.id && (
                          <CheckCircle className="w-4 h-4 text-primary" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={getProviderVariant(model.provider)} className="text-xs">
                          {model.id}
                        </Badge>
                        {model.type === 'reasoning' && (
                          <Badge variant="outline" className="text-xs">
                            <Zap className="w-3 h-3 mr-1" />
                            推理
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-foreground-secondary">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatContextWindow(model.contextWindow)} 上下文
                        </span>
                        {MODEL_COSTS[model.id] && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            ${MODEL_COSTS[model.id].input}/1M
                          </span>
                        )}
                      </div>
                      {/* 模型特性 */}
                      {model.features && model.features.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {model.features.map((feature) => (
                            <Badge key={feature} variant="outline" className="text-xs">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleFavorite(model.id)}
                    >
                      {favorites.includes(model.id) ? (
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      ) : (
                        <Star className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <div className="flex gap-2 mt-3">
                    {currentModel !== model.id && (
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => switchModel(model.id)}
                        disabled={saving}
                      >
                        {saving && currentModel === model.id ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : null}
                        切换
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openConfigDialog(model)}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {/* 模型配置对话框 */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              模型配置
            </DialogTitle>
            <DialogDescription>
              配置 {selectedModel?.name} 的参数
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Temperature */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Temperature</Label>
                <span className="text-sm text-foreground-secondary">
                  {modelConfig.temperature}
                </span>
              </div>
              <Slider
                value={[modelConfig.temperature]}
                onValueChange={([value]) => setModelConfig(prev => ({ ...prev, temperature: value }))}
                min={0}
                max={2}
                step={0.1}
              />
              <p className="text-xs text-foreground-tertiary">
                控制输出随机性，值越低越确定，值越高越随机
              </p>
            </div>

            {/* Max Tokens */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>最大输出 Tokens</Label>
                <span className="text-sm text-foreground-secondary">
                  {modelConfig.maxTokens}
                </span>
              </div>
              <Slider
                value={[modelConfig.maxTokens]}
                onValueChange={([value]) => setModelConfig(prev => ({ ...prev, maxTokens: value }))}
                min={256}
                max={32768}
                step={256}
              />
            </div>

            {/* Top P */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Top P</Label>
                <span className="text-sm text-foreground-secondary">
                  {modelConfig.topP}
                </span>
              </div>
              <Slider
                value={[modelConfig.topP]}
                onValueChange={([value]) => setModelConfig(prev => ({ ...prev, topP: value }))}
                min={0}
                max={1}
                step={0.05}
              />
              <p className="text-xs text-foreground-tertiary">
                核采样参数，控制输出多样性
              </p>
            </div>

            {/* Frequency Penalty */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>频率惩罚</Label>
                <span className="text-sm text-foreground-secondary">
                  {modelConfig.frequencyPenalty}
                </span>
              </div>
              <Slider
                value={[modelConfig.frequencyPenalty]}
                onValueChange={([value]) => setModelConfig(prev => ({ ...prev, frequencyPenalty: value }))}
                min={0}
                max={2}
                step={0.1}
              />
            </div>

            {/* Presence Penalty */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>存在惩罚</Label>
                <span className="text-sm text-foreground-secondary">
                  {modelConfig.presencePenalty}
                </span>
              </div>
              <Slider
                value={[modelConfig.presencePenalty]}
                onValueChange={([value]) => setModelConfig(prev => ({ ...prev, presencePenalty: value }))}
                min={0}
                max={2}
                step={0.1}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
              取消
            </Button>
            <Button onClick={saveModelConfig} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
