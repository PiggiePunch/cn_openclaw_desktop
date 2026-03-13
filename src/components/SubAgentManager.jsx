import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Alert, AlertDescription } from './ui/alert'
import {
  Users,
  Plus,
  Trash2,
  Play,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Activity,
  Sparkles,
  FileText,
  Search,
  Globe,
  Wrench,
  Eye,
  AlertCircle,
} from 'lucide-react'

// 🆕 使用新的服务层
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

// 状态配置
const STATUS_CONFIG = {
  initializing: { color: 'text-blue-600', bg: 'bg-blue-50', label: '初始化', icon: Loader2 },
  ready: { color: 'text-green-600', bg: 'bg-green-50', label: '就绪', icon: CheckCircle2 },
  running: { color: 'text-yellow-600', bg: 'bg-yellow-50', label: '运行中', icon: Activity },
  completed: { color: 'text-gray-600', bg: 'bg-gray-50', label: '已完成', icon: CheckCircle2 },
  failed: { color: 'text-red-600', bg: 'bg-red-50', label: '失败', icon: XCircle },
  terminated: { color: 'text-gray-400', bg: 'bg-gray-100', label: '已终止', icon: XCircle },
}

// 默认预设模板（作为备用）
const DEFAULT_PRESETS = [
  {
    id: 'web-scraper',
    name: '网页抓取助手',
    description: '专门用于抓取网页内容',
    system_prompt: '你是一个网页抓取助手，可以使用浏览器工具访问网页并提取信息。',
    tools: ['browser_navigate', 'browser_snapshot', 'browser_get_text'],
    timeout_ms: 60000,
  },
  {
    id: 'data-analyst',
    name: '数据分析助手',
    description: '用于分析和处理数据',
    system_prompt: '你是一个数据分析助手，可以帮助处理和分析各种数据。',
    tools: ['fs_read', 'fs_write', 'memory_search'],
    timeout_ms: 120000,
  },
  {
    id: 'search-assistant',
    name: '搜索助手',
    description: '用于网络搜索和信息收集',
    system_prompt: '你是一个搜索助手，可以帮助搜索网络信息并整理结果。',
    tools: ['web_search', 'web_fetch', 'memory_store'],
    timeout_ms: 90000,
  },
]

// 类型图标
const getTypeIcon = (tools) => {
  const toolsStr = (tools || []).join(',').toLowerCase()
  if (toolsStr.includes('browser')) return Globe
  if (toolsStr.includes('memory') || toolsStr.includes('file')) return FileText
  if (toolsStr.includes('search')) return Search
  return Wrench
}

// 从 session_key 解析 agent_id（用于 Gateway 智能体）
const parseAgentId = (sessionKey) => {
  if (!sessionKey) return ''
  if (sessionKey === 'main' || sessionKey === 'agent:main:main') return 'main'
  // Gateway 格式: agent:{agentId}:main 或 agent:{agentId}:{sessionId}
  if (sessionKey.startsWith('agent:')) {
    const parts = sessionKey.replace('agent:', '').split(':')
    return parts[0] || ''
  }
  return sessionKey
}

const normalizeArray = (value, preferredKeys = []) => {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== 'object') return []

  for (const key of preferredKeys) {
    if (Array.isArray(value[key])) return value[key]
  }

  return Object.values(value).filter(item => item && typeof item === 'object')
}

export default function SubAgentManager() {
  const [agents, setAgents] = useState([])
  const [stats, setStats] = useState(null)
  const [presets, setPresets] = useState([])
  const [selectedPreset, setSelectedPreset] = useState(null)
  const [showSpawnDialog, setShowSpawnDialog] = useState(false)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSpawning, setIsSpawning] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('agents')

  const [newAgent, setNewAgent] = useState({
    name: '',
    description: '',
    system_prompt: '',
    tools: '',
    timeout_ms: 60000,
    initial_message: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setError(null)
    await Promise.all([loadAgents(), loadStats(), loadPresets()])
  }

  const loadAgents = async () => {
    setIsLoading(true)

    // 只加载子 Agent（临时智能体）
    const subAgentsResult = await api.subagents.list()
    const rawSubAgents = normalizeArray(subAgentsResult.data, ['subagents', 'agents', 'items', 'list'])

    // SubAgent 子智能体
    const typedSubAgents = rawSubAgents.map((agent, index) => ({
      ...agent,
      id: typeof agent?.id === 'string' && agent.id.trim() ? agent.id.trim() : `subagent-${index}`,
      config: {
        ...(agent?.config || {}),
        tools: Array.isArray(agent?.config?.tools) ? agent.config.tools : [],
      },
      _type: 'subagent',
    }))

    setAgents(typedSubAgents)

    if (!subAgentsResult.success) {
      console.error('加载子 Agent 列表失败:', subAgentsResult.error)
    }
    setIsLoading(false)
  }

  const loadStats = async () => {
    // 🆕 使用统一 API 服务层
    const result = await api.subagents.stats()
    if (result.success) {
      setStats(result.data)
    } else {
      console.error('加载统计信息失败:', result.error)
    }
  }

  const loadPresets = async () => {
    console.log('正在加载预设模板...')
    // 🆕 使用统一 API 服务层
    const result = await api.subagents.presets()
    console.log('预设模板加载结果:', result)
    const presetList = normalizeArray(result.data, ['presets', 'items', 'list'])
      .map((preset, index) => ({
        id: preset?.id || `preset-${index}`,
        name: preset?.name || `预设 ${index + 1}`,
        description: preset?.description || '',
        system_prompt: preset?.system_prompt || '',
        tools: Array.isArray(preset?.tools) ? preset.tools : [],
        timeout_ms: Number.isFinite(preset?.timeout_ms) ? preset.timeout_ms : 60000,
      }))

    // 确保数据有效，否则使用默认预设
    if (result.success && presetList.length > 0) {
      setPresets(presetList)
    } else {
      console.log('API返回空数据，使用默认预设')
      setPresets(DEFAULT_PRESETS)
    }
  }

  const spawnAgent = async () => {
    if (!newAgent.name || !newAgent.initial_message.trim()) return
    setIsSpawning(true)
    setError(null)
    // 🆕 使用统一 API 服务层
    const result = await api.subagents.spawn({
      name: newAgent.name,
      description: newAgent.description,
      systemPrompt: newAgent.system_prompt,
      tools: newAgent.tools.split(',').map(t => t.trim()).filter(t => t),
      timeoutMs: newAgent.timeout_ms,
      initialMessage: newAgent.initial_message,
    })
    if (result.success && result.data?.success) {
      setShowSpawnDialog(false)
      resetForm()
      await loadData()
      toast.success('创建成功', '子 Agent 已启动')
    } else {
      const errMsg = result.data?.error || result.error || '创建失败'
      setError(errMsg)
      toast.error('创建失败', errMsg)
    }
    setIsSpawning(false)
  }

  const spawnFromPreset = (preset) => {
    console.log('点击预设模板:', preset)
    setSelectedPreset(preset)
    setNewAgent({
      name: preset.name,
      description: preset.description,
      system_prompt: preset.system_prompt,
      tools: (Array.isArray(preset.tools) ? preset.tools : []).join(', '),
      timeout_ms: preset.timeout_ms,
      initial_message: '',
    })
    console.log('准备打开创建对话框...')
    setShowSpawnDialog(true)
    console.log('showSpawnDialog 已设置为 true')
  }

  // 终止子 Agent
  const deleteAgent = async (agent) => {
    const agentName = agent.config?.name || agent.id
    if (!confirm(`确定要终止子 Agent「${agentName}」吗？`)) return
    setIsLoading(true)
    const result = await api.subagents.terminate(agent.id)
    if (result.success) {
      console.log('✅ 已终止子 Agent:', agent.id)
      await loadData()
      toast.success('终止成功', `子 Agent「${agentName}」已终止`)
    } else {
      console.error('终止子 Agent 失败:', result.error)
      toast.error('终止失败', result.error)
    }
    setIsLoading(false)
  }

  // 保留 terminateAgent 用于向后兼容
  const terminateAgent = async (agentId) => {
    const list = Array.isArray(agents) ? agents : []
    const agent = list.find(a => a.id === agentId)
    if (agent) {
      await deleteAgent(agent)
    }
  }

  const cleanupAgents = async () => {
    if (!confirm('确定要清理所有已完成的子 Agent 吗？')) return
    setIsLoading(true)
    // 🆕 使用统一 API 服务层
    const result = await api.subagents.cleanup()
    if (result.success) {
      await loadData()
      toast.success('清理完成', '已完成的子 Agent 已清理')
    } else {
      console.error('清理子 Agent 失败:', result.error)
      toast.error('清理失败', result.error)
    }
    setIsLoading(false)
  }

  const resetForm = () => {
    setNewAgent({
      name: '',
      description: '',
      system_prompt: '',
      tools: '',
      timeout_ms: 60000,
      initial_message: '',
    })
    setSelectedPreset(null)
    setError(null)
  }

  const safeAgents = Array.isArray(agents) ? agents : []
  const filteredAgents = safeAgents.filter(agent =>
    String(agent?.config?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(agent?.id || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {/* 顶部栏 */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Input
            placeholder="搜索智能体..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10 h-9"
          />
          <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-tertiary" />
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Users className="w-3 h-3" />
            {stats?.total || safeAgents.length}
          </Badge>
          <Badge variant="secondary" className="gap-1 text-yellow-600">
            <Activity className="w-3 h-3" />
            {stats?.running || 0} 运行
          </Badge>
        </div>

        <Button size="sm" variant="outline" onClick={cleanupAgents} disabled={safeAgents.length === 0}>
          <Trash2 className="w-4 h-4 mr-1" />
          清理
        </Button>
        <Button size="sm" variant="outline" onClick={loadData} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
        <Button size="sm" onClick={() => setShowSpawnDialog(true)}>
          <Plus className="w-4 h-4 mr-1" />
          创建
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 主内容 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="h-8">
          <TabsTrigger value="agents" className="text-xs h-7 px-3">
            <Users className="w-3 h-3 mr-1" />
            智能体 ({safeAgents.length})
          </TabsTrigger>
          <TabsTrigger value="presets" className="text-xs h-7 px-3">
            <Sparkles className="w-3 h-3 mr-1" />
            预设模板 ({presets.length})
          </TabsTrigger>
        </TabsList>

        {/* 智能体列表 */}
        <TabsContent value="agents" className="mt-0">
          {isLoading ? (
            <div className="text-center py-12 text-foreground-secondary">
              <Loader2 className="w-8 h-8 mx-auto animate-spin mb-2" />
              <div>加载中...</div>
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="text-center py-12 text-foreground-secondary">
              <Users className="w-16 h-16 mx-auto mb-4 text-foreground-tertiary" />
              <div className="text-lg font-medium text-foreground mb-1">暂无智能体</div>
              <div className="text-sm">在聊天页面创建会话智能体，或点击「预设模板」创建子 Agent</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredAgents.map(agent => {
                const statusConfig = STATUS_CONFIG[agent.status] || STATUS_CONFIG.initializing
                const StatusIcon = statusConfig.icon
                const TypeIcon = getTypeIcon(agent.config?.tools)

                return (
                  <Card
                    key={agent.id}
                    className="group hover:shadow-md hover:border-primary/30 transition-all duration-200"
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2.5">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10">
                          <TypeIcon className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-sm truncate">{agent.config?.name || '未命名'}</span>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${statusConfig.color}`}>
                              {statusConfig.label === '初始化' || statusConfig.label === '运行中' ? (
                                <StatusIcon className="w-2.5 h-2.5 animate-spin" />
                              ) : (
                                <StatusIcon className="w-2.5 h-2.5" />
                              )}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-foreground-secondary line-clamp-1 mt-0.5">
                            {agent.config?.description || '无描述'}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-foreground-tertiary">
                            <span className="font-mono">{agent.id?.slice(0, 10)}...</span>
                            <span>•</span>
                            <span>{agent.config?.tools?.length || 0} 工具</span>
                          </div>
                          {agent.error && (
                            <p className="text-[10px] text-red-600 mt-1 line-clamp-1">{agent.error}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-border-subtle">
                        <Button onClick={() => { setSelectedAgent(agent); setShowDetailDialog(true) }} variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <Eye className="w-3 h-3" />
                        </Button>
                        {(agent.status === 'running' || agent.status === 'ready') && (
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteAgent(agent)
                            }}
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            title="终止 Agent"
                          >
                            <XCircle className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* 预设模板 */}
        <TabsContent value="presets" className="mt-0">
          {presets.length === 0 ? (
            <div className="text-center py-12 text-foreground-secondary">
              <Sparkles className="w-16 h-16 mx-auto mb-4 text-foreground-tertiary" />
              <div>加载预设模板失败</div>
              <Button size="sm" variant="outline" onClick={loadPresets} className="mt-2">
                重试
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {presets.map(preset => {
                const TypeIcon = getTypeIcon(preset.tools)
                return (
                  <Card
                    key={preset.id}
                    className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-200 group"
                    onClick={() => spawnFromPreset(preset)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                          <TypeIcon className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{preset.name}</div>
                          <p className="text-[11px] text-foreground-secondary line-clamp-2 mt-0.5">
                            {preset.description}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {preset.tools.slice(0, 3).map(tool => (
                              <Badge key={tool} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                {tool}
                              </Badge>
                            ))}
                            {preset.tools.length > 3 && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                +{preset.tools.length - 3}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* 创建对话框 */}
      <Dialog open={showSpawnDialog} onOpenChange={(open) => { setShowSpawnDialog(open); if (!open) resetForm() }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedPreset ? `使用模板: ${selectedPreset.name}` : '创建子 Agent'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-foreground-tertiary">名称 *</Label>
              <Input value={newAgent.name} onChange={e => setNewAgent({ ...newAgent, name: e.target.value })} placeholder="名称" className="mt-1 h-9" />
            </div>
            <div>
              <Label className="text-xs text-foreground-tertiary">描述</Label>
              <Input value={newAgent.description} onChange={e => setNewAgent({ ...newAgent, description: e.target.value })} placeholder="描述" className="mt-1 h-9" />
            </div>
            <div>
              <Label className="text-xs text-foreground-tertiary">系统提示词</Label>
              <Textarea value={newAgent.system_prompt} onChange={e => setNewAgent({ ...newAgent, system_prompt: e.target.value })} placeholder="角色和任务..." rows={2} className="mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-foreground-tertiary">工具（逗号分隔）</Label>
              <Input value={newAgent.tools} onChange={e => setNewAgent({ ...newAgent, tools: e.target.value })} placeholder="browser_navigate, memory_search" className="mt-1 h-9" />
            </div>
            <div>
              <Label className="text-xs text-foreground-tertiary">初始消息 *</Label>
              <Textarea value={newAgent.initial_message} onChange={e => setNewAgent({ ...newAgent, initial_message: e.target.value })} placeholder="初始任务..." rows={2} className="mt-1 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setShowSpawnDialog(false); resetForm() }}>取消</Button>
            <Button size="sm" onClick={spawnAgent} disabled={!newAgent.name || !newAgent.initial_message.trim() || isSpawning}>
              {isSpawning ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
              创建并运行
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 详情对话框 */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono text-xs">{selectedAgent?.id}</DialogTitle>
          </DialogHeader>
          {selectedAgent && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-foreground-tertiary">名称:</span> {selectedAgent.config?.name || '-'}</div>
                <div><span className="text-foreground-tertiary">超时:</span> {selectedAgent.config?.timeout_ms || 0}ms</div>
              </div>
              <div>
                <span className="text-foreground-tertiary">工具:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(selectedAgent.config?.tools || []).map(tool => (
                    <Badge key={tool} variant="secondary" className="text-xs">{tool}</Badge>
                  ))}
                </div>
              </div>
              {selectedAgent.config?.system_prompt && (
                <div>
                  <span className="text-foreground-tertiary text-xs">系统提示词:</span>
                  <div className="mt-1 p-2 bg-surface-elevated rounded text-xs max-h-24 overflow-auto">
                    {selectedAgent.config.system_prompt}
                  </div>
                </div>
              )}
              {selectedAgent.result && (
                <div>
                  <span className="text-foreground-tertiary text-xs">结果:</span>
                  <div className="mt-1 p-2 bg-green-50 rounded text-xs max-h-24 overflow-auto">{selectedAgent.result}</div>
                </div>
              )}
              {selectedAgent.error && (
                <div>
                  <span className="text-foreground-tertiary text-xs">错误:</span>
                  <div className="mt-1 p-2 bg-red-50 text-red-600 rounded text-xs">{selectedAgent.error}</div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button size="sm" onClick={() => setShowDetailDialog(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
