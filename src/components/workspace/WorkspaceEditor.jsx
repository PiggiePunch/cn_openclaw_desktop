// 智能体管理编辑器
//
// 提供智能体的完整配置编辑界面
// 包含 8 个 Markdown 文件的编辑和身份信息表单
// 三栏布局：智能体列表 | 文件列表 | 编辑器

import React, { useState, useEffect } from 'react'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Save,
  FolderOpen,
  FileText,
  User,
  Heart,
  Zap,
  Brain,
  Bot,
  BookOpen,
  Settings,
  Check,
  X,
  Loader2,
  MessageSquare,
  Plus,
  Trash2,
  ChevronRight,
  Users,
  Network,
  Hash,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import SubAgentManager from '@/components/SubAgentManager'
import A2ACommunication from '@/components/A2ACommunication'

// Workspace 文件配置
const WORKSPACE_FILES = [
  { name: 'IDENTITY.md', label: '身份信息', icon: User, description: '智能体名称、图标、描述' },
  { name: 'SOUL.md', label: '人格定义', icon: Heart, description: '核心人格特质和回应风格' },
  { name: 'AGENTS.md', label: '行为准则', icon: Bot, description: '智能体行为规则和工作方式' },
  { name: 'TOOLS.md', label: '工具备注', icon: Settings, description: '工具使用说明和偏好' },
  { name: 'USER.md', label: '用户备注', icon: FileText, description: '关于用户的备注信息' },
  { name: 'HEARTBEAT.md', label: '心跳任务', icon: Zap, description: '定期执行的任务' },
  { name: 'BOOTSTRAP.md', label: '引导说明', icon: BookOpen, description: '启动时的引导信息' },
  { name: 'MEMORY.md', label: '记忆备注', icon: Brain, description: '记忆系统配置' },
  { name: 'CHANNELS.md', label: '通道绑定', icon: Hash, description: '配置接收哪些通道的消息' },
]

// 身份信息编辑器
function IdentityEditor({ identity, onSave, saving }) {
  const [formData, setFormData] = useState({
    name: identity?.name || '',
    emoji: identity?.emoji || '🤖',
    avatar: identity?.avatar || '',
    description: identity?.description || '',
  })

  useEffect(() => {
    if (identity) {
      setFormData({
        name: identity.name || '',
        emoji: identity.emoji || '🤖',
        avatar: identity.avatar || '',
        description: identity.description || '',
      })
    }
  }, [identity])

  const handleSave = async () => {
    const content = `---
name: ${formData.name}
emoji: "${formData.emoji}"
${formData.avatar ? `avatar: "${formData.avatar}"\n` : ''}${formData.description ? `description: "${formData.description}"` : ''}
---

# 身份信息

这个文件定义了智能体的基本身份信息。`
    await onSave(content, formData.name)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">智能体名称</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="例如：小助手"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emoji">Emoji 图标</Label>
          <Input
            id="emoji"
            value={formData.emoji}
            onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
            placeholder="例如：🤖"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="avatar">头像 URL（可选）</Label>
        <Input
          id="avatar"
          value={formData.avatar}
          onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
          placeholder="头像图片 URL 或 base64"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">描述</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="简短描述这个智能体的用途..."
          rows={3}
        />
      </div>
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          保存身份信息
        </Button>
      </div>
    </div>
  )
}

// 通道绑定编辑器
function ChannelsEditor({ channels, onSave, saving }) {
  const [selectedChannels, setSelectedChannels] = useState([])

  useEffect(() => {
    if (channels) {
      setSelectedChannels(channels)
    } else {
      setSelectedChannels([])
    }
  }, [channels])

  const availableChannels = [
    { id: 'telegram', label: 'Telegram', description: 'Telegram 机器人' },
    { id: 'discord', label: 'Discord', description: 'Discord 机器人' },
    { id: 'slack', label: 'Slack', description: 'Slack 机器人' },
    { id: 'feishu', label: '飞书', description: '飞书机器人' },
    { id: 'wechat', label: '微信', description: '微信监控' },
  ]

  const handleToggle = (channelId) => {
    setSelectedChannels(prev =>
      prev.includes(channelId)
        ? prev.filter(c => c !== channelId)
        : [...prev, channelId]
    )
  }

  const handleSave = async () => {
    // 保存到 Agent 配置
    await onSave(selectedChannels)
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground mb-4">
        选择此智能体要接收的消息通道。当收到来自这些通道的消息时，会路由到此智能体。
      </div>

      <div className="grid grid-cols-2 gap-3">
        {availableChannels.map((channel) => (
          <button
            key={channel.id}
            onClick={() => handleToggle(channel.id)}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
              selectedChannels.includes(channel.id)
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <div className={`w-5 h-5 rounded flex items-center justify-center ${
              selectedChannels.includes(channel.id)
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted'
            }`}>
              {selectedChannels.includes(channel.id) && <Check className="w-3 h-3" />}
            </div>
            <div>
              <div className="font-medium text-sm">{channel.label}</div>
              <div className="text-xs text-muted-foreground">{channel.description}</div>
            </div>
          </button>
        ))}
      </div>

      {selectedChannels.length === 0 && (
        <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
          未选择任何通道。此智能体将不会接收任何通道消息。
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          保存通道配置
        </Button>
      </div>
    </div>
  )
}

// 主编辑器组件
export default function WorkspaceEditor({ onSwitchAgent }) {
  const [agentId, setAgentId] = useState('main')
  const [selectedFile, setSelectedFile] = useState('IDENTITY.md')
  const [fileContent, setFileContent] = useState('')
  const [workspaceConfig, setWorkspaceConfig] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState(null)
  const [agents, setAgents] = useState([])
  const [resetting, setResetting] = useState(false)

  // 对话框状态
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [newAgentName, setNewAgentName] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Tab 状态（必须在条件返回之前定义）
  const [activeTab, setActiveTab] = useState('agents')

  // 加载 Workspace 配置
  const loadWorkspace = async () => {
    setLoading(true)
    try {
      // 统一从 workspace 文件读取配置（CHANNELS.md 是通道配置的权威数据源）
      let config = {
        identity: {
          name: agentId === 'main' ? '默认助手' : agentId,
          emoji: '🤖',
        },
        channels: [],
        files: [],
      }

      // 始终读取 CHANNELS.md 获取通道配置（不依赖 selectedFile）
      let channelsFromFile = []
      try {
        const contentResult = await api.workspace.readFile(agentId, 'CHANNELS.md')
        if (contentResult.success && contentResult.data) {
          // 解析 YAML 格式的 channels
          const match = contentResult.data.match(/^---\nchannels:\s*(.+)\n---/s)
          if (match) {
            channelsFromFile = JSON.parse(match[1])
          }
        }
      } catch (e) {
        console.error('解析 CHANNELS.md 失败:', e)
      }

      // 如果 CHANNELS.md 没有通道数据，fallback 到 workspace.load（旧数据兼容）
      if (!channelsFromFile || channelsFromFile.length === 0) {
        try {
          const legacyResult = await api.workspace.load(agentId)
          if (legacyResult.success && legacyResult.data?.channels) {
            channelsFromFile = legacyResult.data.channels
          }
        } catch (e) {
          console.error('读取旧通道配置失败:', e)
        }
      }

      config = { ...config, channels: channelsFromFile }
      setWorkspaceConfig(config)

      // 读取其他文件内容（仅当不是 CHANNELS.md 时）
      if (selectedFile !== 'CHANNELS.md') {
        const contentResult = await api.workspace.readFile(agentId, selectedFile)
        if (contentResult.success) {
          setFileContent(contentResult.data)
        } else {
          setFileContent('')
        }
      }
    } catch (error) {
      console.error('加载 Workspace 异常:', error)
      setWorkspaceConfig({
        identity: {
          name: agentId === 'main' ? '默认助手' : agentId,
          emoji: '🤖',
        },
        channels: [],
        files: [],
      })
      setFileContent('')
    } finally {
      setLoading(false)
    }
  }

  // 加载智能体列表
  const loadAgents = async () => {
    const result = await api.agents.list()
    if (result.success) {
      const rawAgents = Array.isArray(result.data) ? result.data : []
      const normalized = rawAgents
        .map((entry) => {
          if (Array.isArray(entry)) {
            const [id, identity] = entry
            if (!id) return null
            return { id, identity: identity || {} }
          }

          if (entry && typeof entry === 'object' && entry.id) {
            return {
              id: entry.id,
              identity: {
                name: entry.name || entry.display_name || entry.id,
                emoji: entry.emoji || '🤖',
                description: entry.description || '',
                ...entry.identity,
              },
            }
          }

          return null
        })
        .filter(Boolean)
      const hasMain = normalized.some((agent) => agent.id === 'main')
      setAgents(hasMain
        ? normalized
        : [{
          id: 'main',
          identity: {
            name: '默认助手',
            emoji: '🤖',
            description: '',
          },
        }, ...normalized]
      )
    } else {
      console.error('加载智能体列表失败:', result.error)
      setAgents([{
        id: 'main',
        identity: {
          name: '默认助手',
          emoji: '🤖',
          description: '',
        },
      }])
    }
  }

  useEffect(() => {
    loadWorkspace()
    loadAgents()
  }, [agentId])

  useEffect(() => {
    const loadFile = async () => {
      const result = await api.workspace.readFile(agentId, selectedFile)
      if (result.success) {
        setFileContent(result.data)
      } else {
        console.error('加载文件失败:', result.error)
        setFileContent('')
      }
    }
    if (!loading) {
      loadFile()
    }
  }, [selectedFile])

  // 保存文件
  const handleSave = async () => {
    setSaving(true)
    setSaveStatus(null)
    const result = await api.workspace.saveFile(agentId, selectedFile, fileContent)
    if (result.success) {
      setSaveStatus('saved')
      await loadWorkspace()
      setTimeout(() => setSaveStatus(null), 2000)
    } else {
      console.error('保存文件失败:', result.error)
      setSaveStatus('error')
    }
    setSaving(false)
  }

  // 创建新智能体
  const handleCreateAgent = async () => {
    if (!newAgentName.trim()) return

    setCreating(true)
    const result = await api.agents.create({
      name: newAgentName.trim(),
      workspace: null, // 使用默认路径
      emoji: '🤖',
      avatar: '',
    })
    if (result.success) {
      console.log('创建智能体成功:', result.data)
      const newAgentId =
        result.data?.agent_id ||
        result.data?.agentId ||
        result.data?.id ||
        ''
      await loadAgents()
      if (newAgentId) {
        setAgentId(newAgentId)
      }
      setShowCreateDialog(false)
      setNewAgentName('')
    } else {
      console.error('创建智能体失败:', result.error)
      alert('创建智能体失败: ' + result.error)
    }
    setCreating(false)
  }

  // 删除智能体
  const handleDeleteAgent = async () => {
    if (agentId === 'main') {
      alert('不能删除默认智能体')
      return
    }

    setDeleting(true)
    const result = await api.agents.delete(agentId)
    if (result.success) {
      console.log('删除智能体成功:', agentId)
      await loadAgents()
      setAgentId('main')
      setShowDeleteDialog(false)
    } else {
      console.error('删除智能体失败:', result.error)
      alert('删除智能体失败: ' + result.error)
    }
    setDeleting(false)
  }

  // 重置模板
  const handleResetTemplates = async () => {
    if (!confirm('确定要重置模板吗？\n\n这将用最新的默认模板覆盖所有文件（保留智能体名称）。\n你编辑过的内容将会丢失！')) {
      return
    }

    setResetting(true)
    const result = await api.workspace.resetTemplates(agentId)
    if (result.success) {
      await loadWorkspace()
      alert('模板已重置到最新版本！')
    } else {
      console.error('重置模板失败:', result.error)
      alert('重置模板失败: ' + result.error)
    }
    setResetting(false)
  }

  // 获取文件图标
  const getFileIcon = (fileName) => {
    const config = WORKSPACE_FILES.find((f) => f.name === fileName)
    return config?.icon || FileText
  }

  // 获取文件描述
  const getFileDescription = (fileName) => {
    const config = WORKSPACE_FILES.find((f) => f.name === fileName)
    return config?.description || ''
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  // 智能体配置内容（原三栏布局）
  const renderAgentConfig = () => (
    <div className="flex gap-3 h-full">
      {/* 左栏：智能体列表 */}
      <Card className="w-52 flex-shrink-0 shadow-sm flex flex-col">
        <CardHeader className="pb-2 px-3 pt-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="w-4 h-4" />
              智能体
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setShowCreateDialog(true)}
              title="新建智能体"
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-2 space-y-1">
              {agents.map((agent) => {
                const id = agent.id
                const identity = agent.identity || {}
                const isSelected = agentId === id
                return (
                  <button
                    key={id}
                    onClick={() => setAgentId(id)}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all ${
                      isSelected
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'hover:bg-surface-elevated'
                    }`}
                  >
                    <span className="text-lg leading-none">{identity?.emoji || '🤖'}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate ${isSelected ? '' : 'text-foreground'}`}>
                        {identity?.name || id}
                      </div>
                      {identity?.description && !isSelected && (
                        <div className="text-xs text-foreground-secondary truncate">
                          {identity.description}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <ChevronRight className="w-4 h-4 flex-shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* 中栏：文件列表 */}
      <Card className="w-48 flex-shrink-0 shadow-sm flex flex-col">
        <CardHeader className="pb-2 px-3 pt-3 flex-shrink-0">
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="w-4 h-4" />
            配置文件
          </CardTitle>
          <CardDescription className="text-xs">
            {workspaceConfig?.identity?.name || agentId}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 flex-1 min-h-0 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {WORKSPACE_FILES.map((file) => {
                const Icon = file.icon
                const isSelected = selectedFile === file.name
                return (
                  <button
                    key={file.name}
                    onClick={() => setSelectedFile(file.name)}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors ${
                      isSelected
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-surface-elevated'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-foreground-secondary'}`} />
                    <span className="text-sm">{file.label}</span>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
          {/* 底部操作区 */}
          <div className="p-2 border-t border-border-subtle space-y-1.5">
            <Button
              variant="default"
              size="sm"
              className="w-full h-8"
              onClick={() => onSwitchAgent?.(agentId)}
            >
              <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
              开始对话
            </Button>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={handleResetTemplates}
                disabled={resetting}
              >
                {resetting ? '重置中...' : '重置'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={loadWorkspace}
                disabled={loading}
              >
                {loading ? '刷新中...' : '刷新'}
              </Button>
              {agentId !== 'main' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  title="删除智能体"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 右栏：编辑器 */}
      <Card className="flex-1 flex flex-col shadow-sm min-w-0">
        <CardHeader className="pb-2 px-4 pt-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {(() => {
                  const Icon = getFileIcon(selectedFile)
                  return <Icon className="w-4 h-4" />
                })()}
                {WORKSPACE_FILES.find((f) => f.name === selectedFile)?.label || selectedFile}
              </CardTitle>
              <CardDescription className="text-xs">{getFileDescription(selectedFile)}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {saveStatus === 'saved' && (
                <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                  <Check className="w-3 h-3 mr-1" />
                  已保存
                </Badge>
              )}
              {saveStatus === 'error' && (
                <Badge variant="outline" className="text-red-600 border-red-600 text-xs">
                  <X className="w-3 h-3 mr-1" />
                  保存失败
                </Badge>
              )}
              {selectedFile !== 'IDENTITY.md' && (
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  保存
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0 px-4 pb-4">
          {selectedFile === 'IDENTITY.md' ? (
            <IdentityEditor
              identity={workspaceConfig?.identity}
              onSave={async (content, newName) => {
                setFileContent(content)
                setSaving(true)
                const saveResult = await api.workspace.saveFile(agentId, 'IDENTITY.md', content)
                if (saveResult.success) {
                  if (agentId === 'main' && newName) {
                    const cfgResult = await api.config.get()
                    if (cfgResult.success) {
                      const cfg = cfgResult.data
                      cfg.user = {
                        ...(cfg.user || {}),
                        agent_name: newName,
                      }
                      await api.config.set(cfg)
                    }
                  }
                  setSaveStatus('saved')
                  await loadWorkspace()
                  setTimeout(() => setSaveStatus(null), 2000)
                } else {
                  console.error('保存失败:', saveResult.error)
                  setSaveStatus('error')
                }
                setSaving(false)
              }}
              saving={saving}
            />
          ) : selectedFile === 'CHANNELS.md' ? (
            <ChannelsEditor
              channels={workspaceConfig?.channels}
              onSave={async (channels) => {
                setSaving(true)
                try {
                  // 调用后端 API 保存通道配置
                  const result = await api.workspace.saveFile(agentId, 'CHANNELS.md', `---\nchannels: ${JSON.stringify(channels)}\n---`)
                  if (result.success) {
                    // 通道配置已保存到 WORKSPACE 文件，无需额外调用 agents.update
                    setSaveStatus('saved')
                    await loadWorkspace()
                    setTimeout(() => setSaveStatus(null), 2000)
                  } else {
                    console.error('保存失败:', result.error)
                    setSaveStatus('error')
                  }
                } catch (e) {
                  console.error('保存失败:', e)
                  setSaveStatus('error')
                }
                setSaving(false)
              }}
              saving={saving}
            />
          ) : (
            <Textarea
              value={fileContent}
              onChange={(e) => setFileContent(e.target.value)}
              placeholder="在此输入 Markdown 内容..."
              className="flex-1 font-mono text-sm resize-none"
              style={{ minHeight: '500px' }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 'calc(100vh - 200px)' }}>
      {/* 顶部 Tab 导航 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
        <TabsList className="w-fit mb-3">
          <TabsTrigger value="agents" className="flex items-center gap-1.5">
            <Bot className="w-4 h-4" />
            智能体配置
          </TabsTrigger>
          <TabsTrigger value="subagent" className="flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            子 Agent
          </TabsTrigger>
          <TabsTrigger value="a2a" className="flex items-center gap-1.5">
            <Network className="w-4 h-4" />
            A2A 通信
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="flex-1 mt-0">
          {renderAgentConfig()}
        </TabsContent>

        <TabsContent value="subagent" className="flex-1 mt-0 overflow-auto">
          <SubAgentManager />
        </TabsContent>

        <TabsContent value="a2a" className="flex-1 mt-0 overflow-auto">
          <A2ACommunication />
        </TabsContent>
      </Tabs>

      {/* 创建智能体对话框 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>创建新智能体</DialogTitle>
            <DialogDescription>
              为你的新智能体起一个名字，ID 会根据名称自动生成
            </DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <Label className="text-xs text-foreground-secondary mb-1.5 block">智能体名称</Label>
            <Input
              value={newAgentName}
              onChange={(e) => setNewAgentName(e.target.value)}
              placeholder="例如：代码助手、翻译专家"
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(false)}>取消</Button>
            <Button size="sm" onClick={handleCreateAgent} disabled={!newAgentName.trim() || creating}>
              {creating ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>删除智能体</DialogTitle>
            <DialogDescription>
              确定要删除智能体「{workspaceConfig?.identity?.name || agentId}」吗？
              <p className="mt-2 text-red-600 text-sm">此操作将删除该智能体的所有数据，不可恢复！</p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowDeleteDialog(false)}>取消</Button>
            <Button variant="destructive" size="sm" onClick={handleDeleteAgent} disabled={deleting}>
              {deleting ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
