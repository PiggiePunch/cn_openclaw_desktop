// AI 接口配置组件 - 简化版 + 上下移动排序

import { useState, useEffect } from 'react'
import { open } from '@tauri-apps/plugin-shell'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Switch } from './ui/switch'
import { cn } from '@/lib/utils'
import {
  CircleDot,
  Eye,
  EyeOff,
  Save,
  Loader2,
  Check,
  ExternalLink,
  Sparkles,
  Globe,
  Zap,
  Play,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  Plus,
  Trash2,
  Settings,
  ChevronUp,
  ChevronDown as ChevronDownIcon,
} from 'lucide-react'

// 默认提供商配置
const DEFAULT_PROVIDERS = [
  { id: 'qwen', name: '通义千问', icon: Sparkles, bgColor: 'bg-orange-500', category: 'domestic', defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', helpUrl: 'https://help.aliyun.com/zh/dashscope/developer/quick-start.html' },
  { id: 'zhipu', name: '智谱 GLM', icon: Zap, bgColor: 'bg-purple-500', category: 'domestic', defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4', helpUrl: 'https://open.bigmodel.cn/usercenter/apikeys' },
  { id: 'deepseek', name: 'DeepSeek', icon: Globe, bgColor: 'bg-blue-500', category: 'domestic', defaultBaseUrl: 'https://api.deepseek.com/v1', helpUrl: 'https://platform.deepseek.com/api_keys' },
  { id: 'ernie', name: '文心一言', icon: CircleDot, bgColor: 'bg-red-500', category: 'domestic', requiresSecretKey: true, helpUrl: 'https://cloud.baidu.com/product/wenxinworkshop/application' },
  { id: 'moonshot', name: '月之暗面', icon: CircleDot, bgColor: 'bg-indigo-500', category: 'domestic', defaultBaseUrl: 'https://api.moonshot.cn/v1', helpUrl: 'https://platform.moonshot.cn/console/api-keys' },
  { id: 'doubao', name: '豆包', icon: CircleDot, bgColor: 'bg-amber-500', category: 'domestic', defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3', helpUrl: 'https://console.volcengine.com/ark' },
  { id: 'minimax', name: 'MiniMax', icon: CircleDot, bgColor: 'bg-cyan-500', category: 'domestic', defaultBaseUrl: 'https://api.minimaxi.com/anthropic', helpUrl: 'https://www.minimaxi.com/' },
  { id: 'openai', name: 'OpenAI', icon: CircleDot, bgColor: 'bg-green-500', category: 'international', defaultBaseUrl: 'https://api.openai.com/v1', helpUrl: 'https://platform.openai.com/api-keys' },
  { id: 'anthropic', name: 'Anthropic', icon: CircleDot, bgColor: 'bg-rose-500', category: 'international', defaultBaseUrl: 'https://api.anthropic.com/v1', helpUrl: 'https://console.anthropic.com/settings/keys' },
  { id: 'google', name: 'Google Gemini', icon: CircleDot, bgColor: 'bg-sky-500', category: 'international', defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta', helpUrl: 'https://aistudio.google.com/app/apikey' },
  { id: 'custom', name: '自定义/OpenAI 兼容', icon: Settings, bgColor: 'bg-gray-500', category: 'custom', defaultBaseUrl: '', helpUrl: '' },
]

// 默认嵌入模型映射（与后端 config.rs 保持一致）
const DEFAULT_EMBEDDING_MODELS = {
  qwen: 'text-embedding-v3',
  openai: 'text-embedding-3-small',
  zhipu: 'embedding-3',
  deepseek: 'deepseek-embed',
  google: 'text-embedding-004',
  minimax: 'embo-01',
}

// 获取实际使用的嵌入模型（智能推断）
const getEffectiveEmbeddingModel = (config) => {
  const embedding = config?.ai_provider?.embedding
  const currentProvider = embedding?.provider || config?.ai_provider?.current

  // 1. 优先级：embedding.model（用户覆盖）
  if (embedding?.model) return { model: embedding.model, source: 'user' }

  // 2. 提供商的 embedding_model
  const providerConfig = config?.ai_provider?.[currentProvider]
  if (providerConfig?.embedding_model) return { model: providerConfig.embedding_model, source: 'provider' }

  // 3. 内置默认值
  const defaultModel = DEFAULT_EMBEDDING_MODELS[currentProvider]
  if (defaultModel) return { model: defaultModel, source: 'auto' }

  return { model: null, source: 'none' }
}

// 复制到剪贴板
const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text)
}

const collectProviderModels = (providerConfig) => {
  if (!providerConfig || typeof providerConfig !== 'object') return []
  const models = []
  const addModel = (value) => {
    const modelId = typeof value === 'string' ? value.trim() : ''
    if (!modelId || models.includes(modelId)) return
    models.push(modelId)
  }
  if (Array.isArray(providerConfig.custom_models)) {
    providerConfig.custom_models.forEach(addModel)
  }
  if (typeof providerConfig.model === 'string') {
    addModel(providerConfig.model)
  }
  return models
}

const resolveCurrentProvider = (aiProvider, preferredId = '', orderedProviderIds = []) => {
  if (!aiProvider || typeof aiProvider !== 'object') return ''

  const isUsable = (providerId) => {
    const cfg = aiProvider?.[providerId]
    if (!cfg || typeof cfg !== 'object') return false
    if (cfg.enabled === false) return false
    const hasApiKey = typeof cfg.api_key === 'string' && cfg.api_key.trim().length > 0
    const hasModel = collectProviderModels(cfg).length > 0
    return hasApiKey && hasModel
  }

  const candidates = [
    typeof aiProvider.current === 'string' ? aiProvider.current.trim() : '',
    typeof preferredId === 'string' ? preferredId.trim() : '',
    ...orderedProviderIds,
    ...Object.keys(aiProvider).filter((id) => id !== 'current' && id !== 'embedding'),
  ]

  for (const providerId of candidates) {
    if (providerId && isUsable(providerId)) return providerId
  }

  return ''
}

// 提供商行组件
function ProviderRow({
  provider, index, total, config, updateConfig, showPassword, setShowPassword,
  expandedProviders, setExpandedProviders, onMoveUp, onMoveDown
}) {
  const cfg = config?.ai_provider?.[provider.id] || {}
  const isEnabled = cfg.enabled || false
  const apiKey = cfg.api_key || ''
  const baseUrl = cfg.base_url || provider.defaultBaseUrl || ''
  const models = cfg.custom_models || []
  const isConfigured = apiKey.length > 10 && models.length > 0
  const Icon = provider.icon
  const isExpanded = expandedProviders.includes(provider.id)

  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [copied, setCopied] = useState(null)

  const toggleExpand = () => {
    setExpandedProviders(prev =>
      isExpanded ? prev.filter(id => id !== provider.id) : [...prev, provider.id]
    )
  }

  const handleTest = async () => {
    const model = models[0] || ''
    if (!apiKey || !model) {
      setTestResult({ success: false, message: '请填写 Key 和模型' })
      return
    }
    setTesting(true)
    setTestResult(null)
    const result = await api.testConnection(provider.id, model, apiKey, baseUrl || null)
    if (result.success) {
      setTestResult(result.data)
    } else {
      setTestResult({ success: false, message: result.error })
    }
    setTesting(false)
  }

  const handleCopy = (text, field) => {
    if (!text) return
    copyToClipboard(text)
    setCopied(field)
    setTimeout(() => setCopied(null), 1500)
  }

  const addModel = () => {
    const newModels = [...models, '']
    updateConfig(provider.id, 'custom_models', newModels)
  }

  const updateModel = (idx, value) => {
    const newModels = [...models]
    newModels[idx] = value
    updateConfig(provider.id, 'custom_models', newModels)
  }

  const removeModel = (idx) => {
    const newModels = models.filter((_, i) => i !== idx)
    updateConfig(provider.id, 'custom_models', newModels)
  }

  return (
    <div className={cn(
      "border rounded-lg transition-all",
      isEnabled ? "border-primary/30 bg-primary/5" : "border-border"
    )}>
      {/* 标题行 */}
      <div className="flex items-center gap-1 px-1 py-2">
        {/* 上下移动按钮 */}
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => onMoveUp(index)}
            disabled={index === 0}
            className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onMoveDown(index)}
            disabled={index === total - 1}
            className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronDownIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 点击展开区域 */}
        <div
          className="flex items-center gap-2 flex-1 cursor-pointer"
          onClick={toggleExpand}
        >
          {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}

          <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-white", provider.bgColor)}>
            <Icon className="w-4 h-4" />
          </div>

          <span className="font-medium text-sm flex-1">{provider.name}</span>

          {isConfigured && isEnabled && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <Check className="w-3 h-3" />已配置
            </span>
          )}
        </div>

        {/* 开关 */}
        <div onClick={e => e.stopPropagation()}>
          <Switch
            checked={isEnabled}
            onChange={(checked) => updateConfig(provider.id, 'enabled', checked)}
          />
        </div>
      </div>

      {/* 展开内容 */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border/50 ml-8" onClick={e => e.stopPropagation()}>
          {/* API Key */}
          <div className="space-y-1">
            <Label className="text-xs">API Key</Label>
            <div className="flex gap-1">
              <Input
                type={showPassword[provider.id] ? "text" : "password"}
                value={apiKey}
                onChange={(e) => updateConfig(provider.id, 'api_key', e.target.value)}
                placeholder="sk-..."
                className="h-8 text-sm flex-1"
              />
              <Button
                variant="ghost" size="icon" className="h-8 w-8"
                onClick={() => setShowPassword(p => ({ ...p, [provider.id]: !p[provider.id] }))}
              >
                {showPassword[provider.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost" size="icon" className="h-8 w-8"
                onClick={() => handleCopy(apiKey, 'key')}
              >
                {copied === 'key' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Secret Key */}
          {provider.requiresSecretKey && (
            <div className="space-y-1">
              <Label className="text-xs">Secret Key</Label>
              <div className="flex gap-1">
                <Input
                  type="password"
                  value={cfg.secret_key || ''}
                  onChange={(e) => updateConfig(provider.id, 'secret_key', e.target.value)}
                  placeholder="Secret Key"
                  className="h-8 text-sm flex-1"
                />
                <Button
                  variant="ghost" size="icon" className="h-8 w-8"
                  onClick={() => handleCopy(cfg.secret_key, 'secret')}
                >
                  {copied === 'secret' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          )}

          {/* Base URL */}
          <div className="space-y-1">
            <Label className="text-xs">
              API 地址
              {provider.defaultBaseUrl && (
                <span className="text-muted-foreground ml-1">(留空用默认)</span>
              )}
            </Label>
            <div className="flex gap-1">
              <Input
                value={cfg.base_url || ''}
                onChange={(e) => updateConfig(provider.id, 'base_url', e.target.value)}
                placeholder={provider.defaultBaseUrl || '填写中转地址'}
                className="h-8 text-sm flex-1"
              />
              <Button
                variant="ghost" size="icon" className="h-8 w-8"
                onClick={() => handleCopy(cfg.base_url || baseUrl, 'baseUrl')}
              >
                {copied === 'baseUrl' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            {provider.id === 'custom' && (
              <p className="text-xs text-muted-foreground">💡 支持 NewAPI、OneAPI 等中转</p>
            )}
          </div>

          {/* 模型列表 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">模型名称</Label>
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={addModel}>
                <Plus className="w-3 h-3 mr-1" /> 添加
              </Button>
            </div>
            {(models.length > 0 ? models : ['']).map((model, idx) => (
              <div key={idx} className="flex gap-1">
                <Input
                  value={model}
                  onChange={(e) => updateModel(idx, e.target.value)}
                  placeholder="模型名称"
                  className="h-8 text-sm flex-1"
                />
                <Button
                  variant="ghost" size="icon" className="h-8 w-8"
                  onClick={() => handleCopy(model, `model-${idx}`)}
                >
                  {copied === `model-${idx}` ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
                {models.length > 1 && (
                  <Button
                    variant="ghost" size="icon" className="h-8 w-8 text-red-500"
                    onClick={() => removeModel(idx)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* 嵌入模型 */}
          <div className="space-y-1">
            <Label className="text-xs">
              嵌入模型
              <span className="text-muted-foreground ml-1">(用于记忆向量搜索，可选)</span>
            </Label>
            <Input
              value={cfg.embedding_model || ''}
              onChange={(e) => updateConfig(provider.id, 'embedding_model', e.target.value || null)}
              placeholder="如 text-embedding-3-small"
              className="h-8 text-sm"
            />
          </div>

          {/* Group ID - 仅 MiniMax 需要 */}
          {provider.id === 'minimax' && (
            <div className="space-y-1">
              <Label className="text-xs">
                Group ID
                <span className="text-muted-foreground ml-1">(MiniMax 嵌入 API 必需)</span>
              </Label>
              <Input
                value={cfg.group_id || ''}
                onChange={(e) => updateConfig(provider.id, 'group_id', e.target.value || null)}
                placeholder="从 MiniMax 开放平台获取"
                className="h-8 text-sm"
              />
            </div>
          )}

          {/* 测试 */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <Button
                variant="outline" size="sm" className="h-7 text-xs"
                onClick={handleTest} disabled={testing || !apiKey || !models[0]}
              >
                {testing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
                测试
              </Button>
              {testResult && (
                <span className={cn("text-xs flex items-center gap-1", testResult.success ? "text-green-600" : "text-red-500")}>
                  {testResult.success ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {testResult.message}
                </span>
              )}
            </div>
            {provider.helpUrl && (
              <button
                onClick={() => open(provider.helpUrl)}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" /> 获取 Key
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// 主组件
export default function AISettings({ onClose, onConfigSaved }) {
  const [config, setConfig] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState({})
  const [expandedProviders, setExpandedProviders] = useState([])
  const [activeTab, setActiveTab] = useState('domestic')
  const [lastEditedProvider, setLastEditedProvider] = useState('')

  // 提供商顺序（持久化到 localStorage）
  const [providerOrder, setProviderOrder] = useState(() => {
    try {
      const saved = localStorage.getItem('openclaw_provider_order')
      return saved ? JSON.parse(saved) : DEFAULT_PROVIDERS.map(p => p.id)
    } catch {
      return DEFAULT_PROVIDERS.map(p => p.id)
    }
  })

  useEffect(() => { loadConfig() }, [])

  const loadConfig = async () => {
    const result = await api.config.get()
    if (result.success) {
      setConfig(result.data)
    } else {
      console.error('加载配置失败:', result.error)
    }
  }

  const saveConfig = async () => {
    setSaving(true)
    const nextCurrentProvider = resolveCurrentProvider(
      config?.ai_provider,
      lastEditedProvider,
      providerOrder,
    )
    const configToSave = {
      ...config,
      ai_provider: {
        ...(config?.ai_provider || {}),
        ...(nextCurrentProvider ? { current: nextCurrentProvider } : {}),
      },
    }

    const setResult = await api.config.set(configToSave)
    if (setResult.success) {
      setConfig(configToSave)
      await api.config.syncToGateway()
      // 保存顺序
      localStorage.setItem('openclaw_provider_order', JSON.stringify(providerOrder))
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('openclaw:config-updated'))
      }
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
      onConfigSaved?.()
    } else {
      alert('保存失败: ' + setResult.error)
    }
    setSaving(false)
  }

  const updateConfig = (provider, field, value) => {
    setLastEditedProvider(provider)
    setConfig(prev => ({
      ...prev,
      ai_provider: {
        ...prev.ai_provider,
        [provider]: { ...(prev.ai_provider?.[provider] || {}), [field]: value }
      }
    }))
  }

  // 根据排序获取提供商列表
  const getOrderedProviders = (category) => {
    const filtered = DEFAULT_PROVIDERS.filter(p => p.category === category)
    return [...filtered].sort((a, b) => {
      const idxA = providerOrder.indexOf(a.id)
      const idxB = providerOrder.indexOf(b.id)
      if (idxA === -1) return 1
      if (idxB === -1) return -1
      return idxA - idxB
    })
  }

  // 移动提供商
  const moveProvider = (index, direction) => {
    const providers = getOrderedProviders(activeTab)
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= providers.length) return

    // 获取当前分类的 ID 列表
    const categoryIds = providers.map(p => p.id)

    // 交换位置
    const newCategoryOrder = [...categoryIds]
    ;[newCategoryOrder[index], newCategoryOrder[newIndex]] = [newCategoryOrder[newIndex], newCategoryOrder[index]]

    // 更新完整顺序
    const otherIds = providerOrder.filter(id => !categoryIds.includes(id))
    setProviderOrder([...newCategoryOrder, ...otherIds])
  }

  if (!config) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8"><Loader2 className="w-4 h-4 animate-spin" /></div>
      </div>
    )
  }

  const providers = getOrderedProviders(activeTab)
  const allEnabled = DEFAULT_PROVIDERS.filter(p => config?.ai_provider?.[p.id]?.enabled).length

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* 标题 */}
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">AI 模型配置</h2>
            <span className="text-xs text-muted-foreground">↑↓ 可排序</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">已启用 {allEnabled} 个</span>
            <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
            <Button size="sm" onClick={saveConfig} disabled={saving} className={cn(saveSuccess && "bg-green-500")}>
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : saveSuccess ? <Check className="w-4 h-4 mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              {saving ? '保存中' : saveSuccess ? '已保存' : '保存'}
            </Button>
          </div>
        </div>

        {/* Tab 切换 */}
        <div className="px-4 pt-3">
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            {['domestic', 'international', 'custom'].map(tab => {
              const count = DEFAULT_PROVIDERS.filter(p => p.category === tab).length
              const label = tab === 'domestic' ? `国内 (${count})` : tab === 'international' ? `国外 (${count})` : '自定义'
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn("flex-1 py-1.5 text-sm rounded-md transition-colors", activeTab === tab ? "bg-white shadow-sm" : "hover:bg-white/50")}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* 提供商列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {providers.map((p, index) => (
            <ProviderRow
              key={p.id}
              provider={p}
              index={index}
              total={providers.length}
              config={config}
              updateConfig={updateConfig}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              expandedProviders={expandedProviders}
              setExpandedProviders={setExpandedProviders}
              onMoveUp={() => moveProvider(index, 'up')}
              onMoveDown={() => moveProvider(index, 'down')}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
