import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardContent } from './ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Badge } from './ui/badge'
import { Switch } from './ui/switch'
import { Label } from './ui/label'
import {
  Wrench,
  Search,
  Code,
  Globe,
  FileText,
  Settings,
  Zap,
  Clock,
  Database,
  Image,
  Loader2,
  RefreshCw,
  Terminal,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Eye,
  EyeOff,
  Save,
} from 'lucide-react'

// 🆕 使用新的服务层
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

// 工具分类配置
const TOOL_CATEGORIES = {
  file: { name: '文件', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
  web: { name: '网络', icon: Globe, color: 'text-green-600', bg: 'bg-green-50' },
  system: { name: '系统', icon: Settings, color: 'text-gray-600', bg: 'bg-gray-50' },
  code: { name: '代码', icon: Code, color: 'text-purple-600', bg: 'bg-purple-50' },
  data: { name: '数据', icon: Database, color: 'text-amber-600', bg: 'bg-amber-50' },
  media: { name: '媒体', icon: Image, color: 'text-pink-600', bg: 'bg-pink-50' },
  ai: { name: 'AI', icon: Zap, color: 'text-orange-600', bg: 'bg-orange-50' },
  schedule: { name: '定时', icon: Clock, color: 'text-cyan-600', bg: 'bg-cyan-50' },
  browser: { name: '浏览器', icon: Globe, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  session: { name: '会话', icon: Terminal, color: 'text-teal-600', bg: 'bg-teal-50' },
  other: { name: '其他', icon: Wrench, color: 'text-foreground-secondary', bg: 'bg-surface-elevated' }
}

// 根据工具名称推断分类
function inferCategory(toolName) {
  const name = toolName.toLowerCase()
  if (name.includes('browser') || name.includes('page') || name.includes('click') || name.includes('navigate')) return 'browser'
  if (name.includes('session') || name.includes('node') || name.includes('agent')) return 'session'
  if (name.includes('file') || name.includes('dir') || name.includes('path') || name.includes('fs_')) return 'file'
  if (name.includes('web') || name.includes('http') || name.includes('url') || name.includes('search') || name.includes('fetch')) return 'web'
  if (name.includes('exec') || name.includes('run') || name.includes('command') || name.includes('shell')) return 'system'
  if (name.includes('code') || name.includes('python') || name.includes('javascript') || name.includes('canvas')) return 'code'
  if (name.includes('memory') || name.includes('store') || name.includes('db') || name.includes('sqlite')) return 'data'
  if (name.includes('image') || name.includes('screenshot') || name.includes('media')) return 'media'
  if (name.includes('ai') || name.includes('llm') || name.includes('embed')) return 'ai'
  if (name.includes('cron') || name.includes('schedule') || name.includes('timer')) return 'schedule'
  return 'other'
}

// 获取分类统计
function getCategoryStats(tools) {
  const stats = {}
  Object.keys(TOOL_CATEGORIES).forEach(key => {
    stats[key] = tools.filter(t => inferCategory(t.name) === key).length
  })
  return stats
}

// 工具配置组件 - web_search
function WebSearchConfig({ config, onSave, saving }) {
  const [searchConfig, setSearchConfig] = useState(null)
  const [showApiKeys, setShowApiKeys] = useState({})

  useEffect(() => {
    if (config?.search) {
      setSearchConfig(config.search)
    } else {
      setSearchConfig({
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
  }, [config])

  if (!searchConfig) return <div className="py-4 text-center text-muted-foreground">加载配置中...</div>

  const providers = [
    { id: 'duckduckgo', name: 'DuckDuckGo', description: '免费搜索，无需 API Key', icon: '🦆' },
    { id: 'brave', name: 'Brave Search', description: '高质量搜索', icon: '🦁', needsKey: true },
    { id: 'perplexity', name: 'Perplexity AI', description: 'AI 综合回答', icon: '🔮', needsKey: true },
    { id: 'grok', name: 'Grok (xAI)', description: 'xAI 实时搜索', icon: '⚡', needsKey: true },
  ]

  const updateNested = (parent, field, value) => {
    setSearchConfig(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: value
      }
    }))
  }

  const handleSave = () => {
    onSave({ search: searchConfig })
  }

  return (
    <div className="space-y-4 mt-4">
      {/* 启用开关 */}
      <div className="flex items-center justify-between p-3 bg-surface-elevated rounded-lg">
        <div>
          <div className="font-medium text-sm">启用网络搜索</div>
          <div className="text-xs text-muted-foreground">允许 Agent 使用此工具</div>
        </div>
        <Switch
          checked={searchConfig.enabled ?? true}
          onCheckedChange={(checked) => setSearchConfig({ ...searchConfig, enabled: checked })}
        />
      </div>

      {/* 提供商选择 */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">搜索提供商</Label>
        <div className="grid grid-cols-2 gap-2">
          {providers.map(provider => (
            <div
              key={provider.id}
              onClick={() => setSearchConfig({ ...searchConfig, provider: provider.id })}
              className={`
                p-2.5 rounded-lg border-2 cursor-pointer transition-all
                ${searchConfig.provider === provider.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'}
              `}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{provider.icon}</span>
                <div>
                  <div className="font-medium text-xs">{provider.name}</div>
                  <div className="text-[10px] text-muted-foreground">{provider.description}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* API Key 配置 - Brave */}
      {searchConfig.provider === 'brave' && (
        <div className="space-y-2 p-3 bg-surface-elevated rounded-lg">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Brave Search API Key</Label>
            <a href="https://brave.com/search/api/" target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
              获取 Key <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
          <div className="relative">
            <Input
              type={showApiKeys.brave ? 'text' : 'password'}
              placeholder="输入 API Key"
              value={searchConfig.brave?.api_key || ''}
              onChange={(e) => updateNested('brave', 'api_key', e.target.value)}
              className="pr-8 h-8 text-xs"
            />
            <button
              type="button"
              onClick={() => setShowApiKeys(prev => ({ ...prev, brave: !prev.brave }))}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showApiKeys.brave ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}

      {/* API Key 配置 - Perplexity */}
      {searchConfig.provider === 'perplexity' && (
        <div className="space-y-3 p-3 bg-surface-elevated rounded-lg">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Perplexity API Key</Label>
            <a href="https://www.perplexity.ai/settings/api" target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
              获取 Key <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
          <div className="relative">
            <Input
              type={showApiKeys.perplexity ? 'text' : 'password'}
              placeholder="pplx-xxx 或 sk-or-xxx (OpenRouter)"
              value={searchConfig.perplexity?.api_key || ''}
              onChange={(e) => updateNested('perplexity', 'api_key', e.target.value)}
              className="pr-8 h-8 text-xs"
            />
            <button
              type="button"
              onClick={() => setShowApiKeys(prev => ({ ...prev, perplexity: !prev.perplexity }))}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showApiKeys.perplexity ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            pplx- 前缀使用直接 API，sk-or- 前缀使用 OpenRouter
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">Base URL</Label>
              <Input
                placeholder="https://openrouter.ai/api/v1"
                value={searchConfig.perplexity?.base_url || ''}
                onChange={(e) => updateNested('perplexity', 'base_url', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">模型</Label>
              <Input
                placeholder="perplexity/sonar-pro"
                value={searchConfig.perplexity?.model || ''}
                onChange={(e) => updateNested('perplexity', 'model', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
        </div>
      )}

      {/* API Key 配置 - Grok */}
      {searchConfig.provider === 'grok' && (
        <div className="space-y-3 p-3 bg-surface-elevated rounded-lg">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">xAI API Key</Label>
            <a href="https://console.x.ai/" target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
              获取 Key <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
          <div className="relative">
            <Input
              type={showApiKeys.grok ? 'text' : 'password'}
              placeholder="输入 xAI API Key"
              value={searchConfig.grok?.api_key || ''}
              onChange={(e) => updateNested('grok', 'api_key', e.target.value)}
              className="pr-8 h-8 text-xs"
            />
            <button
              type="button"
              onClick={() => setShowApiKeys(prev => ({ ...prev, grok: !prev.grok }))}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showApiKeys.grok ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">模型</Label>
              <Input
                placeholder="grok-4-1-fast"
                value={searchConfig.grok?.model || ''}
                onChange={(e) => updateNested('grok', 'model', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="flex items-end pb-1">
              <div className="flex items-center gap-2">
                <Switch
                  checked={searchConfig.grok?.inline_citations || false}
                  onCheckedChange={(checked) => updateNested('grok', 'inline_citations', checked)}
                />
                <Label className="text-[10px] cursor-pointer">内联引用</Label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 通用参数 */}
      <div className="grid grid-cols-3 gap-2 p-3 bg-surface-elevated rounded-lg">
        <div className="space-y-1">
          <Label className="text-[10px]">最大结果数</Label>
          <Input
            type="number"
            min={1}
            max={20}
            value={searchConfig.max_results || 10}
            onChange={(e) => setSearchConfig({ ...searchConfig, max_results: parseInt(e.target.value) || 10 })}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">超时（秒）</Label>
          <Input
            type="number"
            min={5}
            max={120}
            value={searchConfig.timeout_seconds || 30}
            onChange={(e) => setSearchConfig({ ...searchConfig, timeout_seconds: parseInt(e.target.value) || 30 })}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">缓存（分钟）</Label>
          <Input
            type="number"
            min={0}
            max={1440}
            value={searchConfig.cache_ttl_minutes || 60}
            onChange={(e) => setSearchConfig({ ...searchConfig, cache_ttl_minutes: parseInt(e.target.value) || 60 })}
            className="h-8 text-xs"
          />
        </div>
      </div>

      {/* 保存按钮 */}
      <DialogFooter>
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-1" />
          )}
          保存配置
        </Button>
      </DialogFooter>
    </div>
  )
}

export default function Tools() {
  const [tools, setTools] = useState([])
  const [filteredTools, setFilteredTools] = useState([])
  const [selectedTool, setSelectedTool] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [isLoading, setIsLoading] = useState(false)
  const [config, setConfig] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadTools()
    loadConfig()
  }, [])

  useEffect(() => {
    filterTools()
  }, [searchQuery, selectedCategory, tools])

  const loadTools = async () => {
    setIsLoading(true)
    const result = await api.tools.list()
    if (result.success) {
      setTools(result.data || [])
      setFilteredTools(result.data || [])
    } else {
      console.error('加载工具列表失败:', result.error)
      toast.error('加载失败', result.error)
    }
    setIsLoading(false)
  }

  const loadConfig = async () => {
    const result = await api.config.get()
    if (result.success) {
      setConfig(result.data)
    }
  }

  const handleSaveConfig = async (newConfig) => {
    setSaving(true)
    const result = await api.config.update(newConfig)
    if (result.success) {
      toast.success('保存成功', '工具配置已更新')
      loadConfig()
    } else {
      toast.error('保存失败', result.error)
    }
    setSaving(false)
  }

  const filterTools = () => {
    let filtered = tools
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(tool => inferCategory(tool.name) === selectedCategory)
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(tool =>
        tool.name.toLowerCase().includes(query) ||
        (tool.description && tool.description.toLowerCase().includes(query))
      )
    }
    setFilteredTools(filtered)
  }

  // 获取工具的配置状态
  const getToolStatus = (toolName) => {
    if (!config) return { status: 'unknown', message: '加载中...' }

    switch (toolName) {
      case 'web_search': {
        const search = config.search || {}
        if (!search.enabled) {
          return { status: 'disabled', message: '已禁用' }
        }
        const provider = search.provider || 'duckduckgo'
        if (provider === 'duckduckgo') {
          return { status: 'available', message: 'DuckDuckGo' }
        }
        if (provider === 'brave') {
          const hasKey = search.brave?.api_key?.length > 0
          return { status: hasKey ? 'available' : 'needs_config', message: hasKey ? 'Brave' : '需配置' }
        }
        if (provider === 'perplexity') {
          const hasKey = search.perplexity?.api_key?.length > 0
          return { status: hasKey ? 'available' : 'needs_config', message: hasKey ? 'Perplexity' : '需配置' }
        }
        if (provider === 'grok') {
          const hasKey = search.grok?.api_key?.length > 0
          return { status: hasKey ? 'available' : 'needs_config', message: hasKey ? 'Grok' : '需配置' }
        }
        return { status: 'available', message: provider }
      }
      case 'web_fetch': {
        return { status: 'available', message: '可用' }
      }
      default:
        return { status: 'available', message: '可用' }
    }
  }

  // 渲染工具配置面板
  const renderToolConfig = (toolName) => {
    switch (toolName) {
      case 'web_search':
        return (
          <WebSearchConfig
            config={config}
            onSave={handleSaveConfig}
            saving={saving}
          />
        )
      default:
        return null
    }
  }

  const categoryStats = getCategoryStats(tools)
  const activeCategories = Object.entries(categoryStats).filter(([, count]) => count > 0)

  return (
    <div className="space-y-4">
      {/* 顶部栏：搜索 + 统计 + 刷新 */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Input
            placeholder="搜索工具..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-9"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-tertiary" />
        </div>

        {/* 快捷统计 */}
        <Badge variant="secondary" className="gap-1">
          <Wrench className="w-3 h-3" />
          {tools.length} 工具
        </Badge>

        <Button size="sm" onClick={loadTools} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* 分类标签 */}
      <div className="flex gap-1.5 flex-wrap">
        <Button
          onClick={() => setSelectedCategory('all')}
          variant={selectedCategory === 'all' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 px-2.5 text-xs"
        >
          全部 ({tools.length})
        </Button>
        {activeCategories.map(([key, count]) => {
          const catConfig = TOOL_CATEGORIES[key]
          const Icon = catConfig.icon
          return (
            <Button
              key={key}
              onClick={() => setSelectedCategory(key)}
              variant={selectedCategory === key ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2.5 text-xs gap-1"
            >
              <Icon className="w-3 h-3" />
              {catConfig.name} ({count})
            </Button>
          )
        })}
      </div>

      {/* 工具网格列表 */}
      {isLoading ? (
        <div className="text-center py-12 text-foreground-secondary">
          <Loader2 className="w-8 h-8 mx-auto animate-spin mb-2" />
          <div>加载中...</div>
        </div>
      ) : filteredTools.length === 0 ? (
        <div className="text-center py-12 text-foreground-secondary">
          <Wrench className="w-12 h-12 mx-auto mb-4 text-foreground-tertiary" />
          <div className="text-lg font-medium text-foreground mb-1">没有找到匹配的工具</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {filteredTools.map(tool => {
            const category = inferCategory(tool.name)
            const catConfig = TOOL_CATEGORIES[category]
            const Icon = catConfig.icon
            const toolStatus = getToolStatus(tool.name)

            return (
              <Card
                key={tool.name}
                className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-200 group"
                onClick={() => setSelectedTool(tool)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-lg ${catConfig.bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-4 h-4 ${catConfig.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                          {tool.name}
                        </h3>
                        {/* 状态指示器 */}
                        {toolStatus.status === 'available' && (
                          <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                        )}
                        {toolStatus.status === 'needs_config' && (
                          <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                        )}
                        {toolStatus.status === 'disabled' && (
                          <XCircle className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-foreground-secondary truncate mt-0.5">
                        {tool.description || '暂无描述'}
                      </p>
                    </div>
                    <Badge
                      variant={toolStatus.status === 'available' ? 'default' : toolStatus.status === 'needs_config' ? 'secondary' : 'outline'}
                      className="text-[10px] px-1.5 py-0 h-5 flex-shrink-0"
                    >
                      {toolStatus.message}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* 工具详情/配置对话框 */}
      <Dialog open={!!selectedTool} onOpenChange={() => setSelectedTool(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-mono text-base">
              {selectedTool && (
                <>
                  {(() => {
                    const category = inferCategory(selectedTool.name)
                    const catConfig = TOOL_CATEGORIES[category]
                    const Icon = catConfig.icon
                    return (
                      <div className={`w-8 h-8 rounded-lg ${catConfig.bg} flex items-center justify-center`}>
                        <Icon className={`w-4 h-4 ${catConfig.color}`} />
                      </div>
                    )
                  })()}
                  {selectedTool.name}
                  {getToolStatus(selectedTool.name).status !== 'available' && (
                    <Badge variant="secondary" className="text-[10px]">
                      {getToolStatus(selectedTool.name).message}
                    </Badge>
                  )}
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedTool && (
            <div className="space-y-4">
              {/* 描述 */}
              <div>
                <h4 className="text-xs font-medium text-foreground-tertiary mb-1.5">描述</h4>
                <p className="text-sm text-foreground-secondary bg-surface-elevated p-3 rounded-lg">
                  {selectedTool.description || '暂无描述'}
                </p>
              </div>

              {/* 参数 Schema */}
              <div>
                <h4 className="text-xs font-medium text-foreground-tertiary mb-1.5">参数 Schema</h4>
                {selectedTool.parameters ? (
                  <pre className="bg-surface-elevated rounded-lg p-3 text-xs overflow-auto max-h-40 font-mono">
                    {JSON.stringify(selectedTool.parameters, null, 2)}
                  </pre>
                ) : (
                  <p className="text-sm text-foreground-tertiary">无参数</p>
                )}
              </div>

              {/* 工具配置面板 */}
              {renderToolConfig(selectedTool.name) && (
                <div>
                  <h4 className="text-xs font-medium text-foreground-tertiary mb-1.5 flex items-center gap-1">
                    <Settings className="w-3 h-3" />
                    工具配置
                  </h4>
                  {renderToolConfig(selectedTool.name)}
                </div>
              )}

              {/* 分类标签 */}
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {TOOL_CATEGORIES[inferCategory(selectedTool.name)].name}
                </Badge>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
