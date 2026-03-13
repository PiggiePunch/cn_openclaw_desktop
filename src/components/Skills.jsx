import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Card, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Alert, AlertTitle, AlertDescription } from './ui/alert'
import {
  Wrench,
  Search,
  Play,
  Pause,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Zap,
  Sparkles,
  Code,
  Globe,
  MessageSquare,
  FileText,
  Languages,
  Calendar,
  Loader2,
  Eye,
  TrendingUp,
  MoreHorizontal,
  Plus,
  Download,
  FolderOpen,
  Edit,
} from 'lucide-react'

// 🆕 使用新的服务层
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

// Skill 类别图标映射
const CATEGORY_ICONS = {
  Development: { icon: Code, color: 'text-blue-600', bg: 'bg-blue-50', label: '开发' },
  Web: { icon: Globe, color: 'text-green-600', bg: 'bg-green-50', label: '网络' },
  Communication: { icon: MessageSquare, color: 'text-purple-600', bg: 'bg-purple-50', label: '通讯' },
  Productivity: { icon: FileText, color: 'text-orange-600', bg: 'bg-orange-50', label: '效率' },
  Utility: { icon: Wrench, color: 'text-gray-600', bg: 'bg-gray-50', label: '工具' },
  Translation: { icon: Languages, color: 'text-cyan-600', bg: 'bg-cyan-50', label: '翻译' },
  Automation: { icon: Calendar, color: 'text-pink-600', bg: 'bg-pink-50', label: '自动化' },
  AI: { icon: Sparkles, color: 'text-indigo-600', bg: 'bg-indigo-50', label: 'AI' },
  DataProcessing: { icon: TrendingUp, color: 'text-teal-600', bg: 'bg-teal-50', label: '数据处理' },
  FileSystem: { icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50', label: '文件系统' },
  CodeExecution: { icon: Play, color: 'text-rose-600', bg: 'bg-rose-50', label: '代码执行' },
  System: { icon: Wrench, color: 'text-slate-600', bg: 'bg-slate-50', label: '系统' },
  Entertainment: { icon: Zap, color: 'text-yellow-600', bg: 'bg-yellow-50', label: '娱乐' },
}

// Skill 状态配置
const STATUS_CONFIG = {
  Ready: { color: 'text-green-600', bg: 'bg-green-50', label: '就绪', icon: CheckCircle2 },
  Running: { color: 'text-yellow-600', bg: 'bg-yellow-50', label: '运行中', icon: Loader2 },
  Paused: { color: 'text-gray-600', bg: 'bg-gray-50', label: '已暂停', icon: Pause },
  Failed: { color: 'text-red-600', bg: 'bg-red-50', label: '失败', icon: XCircle },
}

const normalizeArray = (value, preferredKeys = []) => {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== 'object') return []

  for (const key of preferredKeys) {
    if (Array.isArray(value[key])) return value[key]
  }

  return Object.values(value).filter(item => item && typeof item === 'object')
}

export default function Skills() {
  const [skills, setSkills] = useState([])
  const [stats, setStats] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  // 详情对话框
  const [selectedSkill, setSelectedSkill] = useState(null)
  const [showDetailDialog, setShowDetailDialog] = useState(false)

  // 执行对话框
  const [showExecuteDialog, setShowExecuteDialog] = useState(false)
  const [executeParams, setExecuteParams] = useState('{}')
  const [isExecuting, setIsExecuting] = useState(false)
  const [executeResult, setExecuteResult] = useState(null)

  // 创建 Skill 对话框
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    instructions: '',
    category: 'Utility',
  })
  const [isCreating, setIsCreating] = useState(false)

  // 安装 Skill 对话框
  const [showInstallDialog, setShowInstallDialog] = useState(false)
  const [installForm, setInstallForm] = useState({
    source: '',
    sourceType: 'url', // url | local
  })
  const [isInstalling, setIsInstalling] = useState(false)

  // 编辑 Skill 对话框
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editForm, setEditForm] = useState({
    skill_id: '',
    name: '',
    description: '',
    instructions: '',
    category: 'Utility',
    is_builtin: false,
  })
  const [isEditing, setIsEditing] = useState(false)

  // ClawHub 对话框
  const [showClawHubDialog, setShowClawHubDialog] = useState(false)
  const [clawHubQuery, setClawHubQuery] = useState('')
  const [clawHubResults, setClawHubResults] = useState([])
  const [isClawHubSearching, setIsClawHubSearching] = useState(false)
  const [clawHubInstalling, setClawHubInstalling] = useState(null)

  useEffect(() => {
    initSkills()
  }, [])

  // 搜索防抖
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (isInitialized) loadSkills()
    }, 500)
    return () => clearTimeout(timeoutId)
  }, [searchQuery, selectedCategory])

  const initSkills = async () => {
    setIsLoading(true)
    // Gateway 不支持 skills.init 方法，直接加载数据
    console.log('Skills 平台初始化，直接加载数据')
    setIsInitialized(true)
    await loadData()
    setIsLoading(false)
  }

  const loadData = async () => {
    await Promise.all([loadSkills(), loadStats()])
  }

  const loadSkills = async () => {
    setIsLoading(true)
    const params = {}
    if (selectedCategory !== 'all') {
      params.category = selectedCategory
    }
    if (searchQuery) {
      params.search = searchQuery
    }
    // 🆕 使用统一 API 服务层
    const result = await api.skills.list(params)
    if (result.success) {
      setSkills(normalizeArray(result.data, ['skills', 'items', 'list']))
    } else {
      console.error('加载 Skills 列表失败:', result.error)
      setSkills([])
    }
    setIsLoading(false)
  }

  const loadStats = async () => {
    // 🆕 使用统一 API 服务层
    const result = await api.skills.stats()
    if (result.success) {
      setStats(result.data)
    } else {
      console.error('加载统计数据失败:', result.error)
    }
  }

  const executeSkill = async () => {
    if (!selectedSkill) return
    setIsExecuting(true)
    let params = {}
    try {
      params = JSON.parse(executeParams || '{}')
    } catch {
      toast.error('参数格式错误', '请输入有效的 JSON 格式')
      setIsExecuting(false)
      return
    }

    // 🆕 使用统一 API 服务层
    const result = await api.skills.execute(selectedSkill.id, params, null)
    if (result.success) {
      setExecuteResult(result.data)
      setShowExecuteDialog(false)
      setExecuteParams('{}')
      await loadData()
    } else {
      setExecuteResult({
        success: false,
        result: null,
        error: result.error,
        duration_ms: 0,
      })
      toast.error('执行失败', result.error)
    }
    setIsExecuting(false)
  }

  const pauseSkill = async (skillId) => {
    // 🆕 使用统一 API 服务层
    const result = await api.skills.pause(skillId)
    if (result.success) {
      await loadSkills()
    } else {
      toast.error('暂停失败', result.error)
    }
  }

  const resumeSkill = async (skillId) => {
    // 🆕 使用统一 API 服务层
    const result = await api.skills.resume(skillId)
    if (result.success) {
      await loadSkills()
    } else {
      toast.error('恢复失败', result.error)
    }
  }

  const unregisterSkill = async (skillId) => {
    if (!confirm('确定要卸载此 Skill 吗？此操作不可撤销。')) return
    setIsLoading(true)
    // 🆕 使用统一 API 服务层
    const result = await api.skills.unregister(skillId)
    if (result.success) {
      await loadData()
      toast.success('卸载成功', 'Skill 已成功卸载')
    } else {
      toast.error('卸载失败', result.error)
    }
    setIsLoading(false)
  }

  // 创建 Skill
  const handleCreateSkill = async () => {
    if (!createForm.name || !createForm.description || !createForm.instructions) {
      toast.warning('请填写完整信息', '名称、描述和指令为必填项')
      return
    }
    // 验证名称格式
    if (!/^[a-z0-9-]+$/.test(createForm.name)) {
      toast.warning('名称格式错误', '只能包含小写字母、数字和连字符')
      return
    }
    setIsCreating(true)
    // 🆕 使用统一 API 服务层
    const result = await api.skills.create({
      name: createForm.name,
      description: createForm.description,
      instructions: createForm.instructions,
      category: createForm.category,
      destination: 'workspace',
    })
    if (result.success) {
      console.log('创建 Skill 成功:', result.data)
      setShowCreateDialog(false)
      setCreateForm({ name: '', description: '', instructions: '', category: 'Utility' })
      await loadData()
      toast.success('创建成功', 'Skill 已成功创建')
    } else {
      console.error('创建 Skill 失败:', result.error)
      toast.error('创建失败', result.error)
    }
    setIsCreating(false)
  }

  // 安装 Skill
  const handleInstallSkill = async () => {
    if (!installForm.source) {
      toast.warning('请输入安装源', '需要提供 Skill 的来源地址')
      return
    }
    setIsInstalling(true)
    // 🆕 使用统一 API 服务层
    const result = await api.skills.install(installForm.source, installForm.sourceType)
    if (result.success) {
      console.log('安装 Skill 成功:', result.data)
      setShowInstallDialog(false)
      setInstallForm({ source: '', sourceType: 'url' })
      await loadData()
      toast.success('安装成功', 'Skill 已成功安装')
    } else {
      console.error('安装 Skill 失败:', result.error)
      toast.error('安装失败', result.error)
    }
    setIsInstalling(false)
  }

  // 打开编辑对话框
  const handleOpenEdit = async () => {
    if (!selectedSkill) return

    setIsEditing(true)
    const result = await api.skills.getContent(selectedSkill.id)
    if (result.success) {
      const data = result.data
      setEditForm({
        skill_id: selectedSkill.id,
        name: data.name || '',
        description: data.description || '',
        instructions: data.instructions || '',
        category: data.category || 'Utility',
        is_builtin: data.is_builtin || false,
      })
      setShowDetailDialog(false)
      setShowEditDialog(true)
    } else {
      toast.error('获取内容失败', result.error)
    }
    setIsEditing(false)
  }

  // 保存编辑
  const handleEditSkill = async () => {
    if (!editForm.name || !editForm.description || !editForm.instructions) {
      toast.warning('请填写完整信息', '名称、描述和指令为必填项')
      return
    }
    // 验证名称格式
    if (!/^[a-z0-9-]+$/.test(editForm.name)) {
      toast.warning('名称格式错误', '只能包含小写字母、数字和连字符')
      return
    }

    setIsEditing(true)
    const result = await api.skills.updateContent({
      skill_id: editForm.skill_id,
      name: editForm.name,
      description: editForm.description,
      category: editForm.category,
      instructions: editForm.instructions,
    })
    if (result.success) {
      console.log('更新 Skill 成功:', result.data)
      setShowEditDialog(false)
      setEditForm({ skill_id: '', name: '', description: '', instructions: '', category: 'Utility', is_builtin: false })
      await loadData()
      toast.success('保存成功', 'Skill 已更新')
    } else {
      console.error('更新 Skill 失败:', result.error)
      toast.error('保存失败', result.error)
    }
    setIsEditing(false)
  }

  // ClawHub 搜索（支持空搜索，显示全部）
  const handleClawHubSearch = async (autoLoad = false) => {
    // 如果是自动加载且已有结果，不重复加载
    if (autoLoad && clawHubResults.length > 0) return

    setIsClawHubSearching(true)
    const result = await api.skills.clawhubSearch(clawHubQuery || '')
    if (result.success) {
      setClawHubResults(normalizeArray(result.data, ['skills', 'items', 'list']))
    } else {
      if (!autoLoad) {
        toast.error('搜索失败', result.error)
      }
      setClawHubResults([])
    }
    setIsClawHubSearching(false)
  }

  // 打开 ClawHub 对话框时自动加载列表
  const handleOpenClawHub = () => {
    setShowClawHubDialog(true)
    // 自动加载可用技能列表
    if (clawHubResults.length === 0) {
      handleClawHubSearch(true)
    }
  }

  // ClawHub 安装
  const handleClawHubInstall = async (slug) => {
    setClawHubInstalling(slug)
    const result = await api.skills.clawhubInstall(slug)
    if (result.success) {
      toast.success('安装成功', `Skill '${slug}' 已安装`)
      await loadData()
    } else {
      toast.error('安装失败', result.error)
    }
    setClawHubInstalling(null)
  }

  const getCategoryKey = (categoryStr) => {
    if (!categoryStr) return 'Utility'
    if (categoryStr.includes('Development')) return 'Development'
    if (categoryStr.includes('Web')) return 'Web'
    if (categoryStr.includes('Communication')) return 'Communication'
    if (categoryStr.includes('Productivity')) return 'Productivity'
    if (categoryStr.includes('Translation')) return 'Translation'
    if (categoryStr.includes('Automation')) return 'Automation'
    if (categoryStr.includes('AI') || categoryStr.includes('artificial_intelligence')) return 'AI'
    if (categoryStr.includes('DataProcessing') || categoryStr.includes('Data') || categoryStr.includes('data_processing')) return 'DataProcessing'
    if (categoryStr.includes('FileSystem') || categoryStr.includes('file_system')) return 'FileSystem'
    if (categoryStr.includes('CodeExecution') || categoryStr.includes('code_execution')) return 'CodeExecution'
    if (categoryStr.includes('System') || categoryStr.includes('system')) return 'System'
    if (categoryStr.includes('Entertainment') || categoryStr.includes('entertainment')) return 'Entertainment'
    return 'Utility'
  }

  const getStatusKey = (statusStr) => {
    if (!statusStr) return 'Ready'
    if (statusStr.includes('Ready')) return 'Ready'
    if (statusStr.includes('Running')) return 'Running'
    if (statusStr.includes('Paused')) return 'Paused'
    if (statusStr.includes('Failed')) return 'Failed'
    return 'Ready'
  }

  const categories = ['all', 'AI', 'Web', 'Productivity', 'Utility', 'FileSystem', 'DataProcessing', 'Entertainment']

  return (
    <div className="space-y-4">
      {/* 顶部栏：搜索 + 统计 + 刷新 */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Input
            placeholder="搜索 Skills..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10 h-9"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-tertiary" />
        </div>

        {/* 快捷统计 */}
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="w-3 h-3" />
            {stats?.total || skills.length} 总数
          </Badge>
          <Badge variant="secondary" className="gap-1 text-green-600">
            <CheckCircle2 className="w-3 h-3" />
            {stats?.by_status?.Ready || 0} 就绪
          </Badge>
        </div>

        <Button size="sm" onClick={() => loadData()} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          刷新
        </Button>

        {/* 创建和安装按钮 */}
        <Button size="sm" onClick={() => setShowCreateDialog(true)} variant="outline">
          <Plus className="w-4 h-4 mr-1" />
          创建
        </Button>
        <Button size="sm" onClick={() => setShowInstallDialog(true)} variant="outline">
          <Download className="w-4 h-4 mr-1" />
          安装
        </Button>
        <Button size="sm" onClick={handleOpenClawHub} variant="outline">
          <Globe className="w-4 h-4 mr-1" />
          发现
        </Button>
      </div>

      {/* 分类标签 */}
      <div className="flex gap-1.5 flex-wrap">
        {categories.map(cat => (
          <Button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            variant={selectedCategory === cat ? 'default' : 'ghost'}
            size="sm"
            className="h-7 px-2.5 text-xs"
          >
            {cat === 'all' ? '全部' : CATEGORY_ICONS[cat]?.label || cat}
          </Button>
        ))}
      </div>

      {!isInitialized && (
        <Alert variant="warning">
          <Zap className="w-4 h-4" />
          <AlertTitle>Skills 平台未初始化</AlertTitle>
          <AlertDescription>Skills 平台尚未初始化，正在尝试初始化...</AlertDescription>
        </Alert>
      )}

      {/* Skills 网格列表 */}
      {isLoading ? (
        <div className="text-center py-12 text-foreground-secondary">
          <Loader2 className="w-8 h-8 mx-auto animate-spin mb-2" />
          <div>加载中...</div>
        </div>
      ) : skills.length === 0 ? (
        <div className="text-center py-12 text-foreground-secondary">
          <Sparkles className="w-16 h-16 mx-auto mb-4 text-foreground-tertiary" />
          <div className="text-lg font-medium text-foreground mb-1">暂无 Skills</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {skills.map(skill => {
            const categoryKey = getCategoryKey(skill.category)
            const categoryConfig = CATEGORY_ICONS[categoryKey] || CATEGORY_ICONS.Utility
            const CategoryIcon = categoryConfig.icon
            const skillStatus = typeof skill?.status === 'string' ? skill.status : 'Ready'
            const statusKey = getStatusKey(skillStatus)
            const statusConfig = STATUS_CONFIG[statusKey] || STATUS_CONFIG.Ready
            const StatusIcon = statusConfig.icon

            return (
              <Card
                key={skill.id}
                className="group hover:shadow-md hover:border-primary/30 transition-all duration-200"
              >
                <CardContent className="p-3">
                  {/* 头部：图标 + 名称 + 徽章 */}
                  <div className="flex items-start gap-2.5 mb-2">
                    <div className={`w-9 h-9 rounded-lg ${categoryConfig.bg} flex items-center justify-center flex-shrink-0`}>
                      <CategoryIcon className={`w-4.5 h-4.5 ${categoryConfig.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-sm truncate">{skill.name}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 h-4 ${statusConfig.color} ${statusConfig.bg}`}
                        >
                          {statusKey === 'Running' ? (
                            <StatusIcon className="w-2.5 h-2.5 animate-spin" />
                          ) : (
                            <StatusIcon className="w-2.5 h-2.5" />
                          )}
                        </Badge>
                        {skill.is_builtin && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">内置</Badge>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 h-4 mt-1 ${categoryConfig.color}`}
                      >
                        {categoryConfig.label}
                      </Badge>
                    </div>
                  </div>

                  {/* 描述 */}
                  <p className="text-xs text-foreground-secondary line-clamp-2 mb-2 min-h-[32px]">
                    {skill.description}
                  </p>

                  {/* 底部：统计 + 操作 */}
                  <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
                    <div className="flex items-center gap-2 text-[10px] text-foreground-tertiary">
                      <span>v{skill.version}</span>
                      <span>•</span>
                      <span>{skill.execution_count || 0}次</span>
                      <span>•</span>
                      <span>{skill.avg_duration_ms || 0}ms</span>
                    </div>
                    <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedSkill(skill)
                          setShowExecuteDialog(true)
                        }}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        disabled={skillStatus.includes('Running') || skillStatus.includes('Paused')}
                      >
                        <Play className="w-3 h-3" />
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedSkill(skill)
                          setShowDetailDialog(true)
                        }}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                      >
                        <Eye className="w-3 h-3" />
                      </Button>
                      {skillStatus.includes('Ready') && (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation()
                            pauseSkill(skill.id)
                          }}
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                        >
                          <Pause className="w-3 h-3" />
                        </Button>
                      )}
                      {skillStatus.includes('Paused') && (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation()
                            resumeSkill(skill.id)
                          }}
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-green-600"
                        >
                          <Play className="w-3 h-3" />
                        </Button>
                      )}
                      {!skill.is_builtin && (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation()
                            unregisterSkill(skill.id)
                          }}
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Skill 详情对话框 */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedSkill && (
                <>
                  {(() => {
                    const categoryConfig = CATEGORY_ICONS[getCategoryKey(selectedSkill.category)] || CATEGORY_ICONS.Utility
                    const CategoryIcon = categoryConfig.icon
                    return (
                      <div className={`w-8 h-8 rounded-lg ${categoryConfig.bg} flex items-center justify-center`}>
                        <CategoryIcon className={`w-4 h-4 ${categoryConfig.color}`} />
                      </div>
                    )
                  })()}
                  {selectedSkill.name}
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedSkill && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-foreground-tertiary">描述</Label>
                <div className="mt-1 p-2.5 bg-surface-elevated rounded text-sm">
                  {selectedSkill.description}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-foreground-tertiary">版本</Label>
                  <div className="mt-1 text-sm font-medium">v{selectedSkill.version}</div>
                </div>
                <div>
                  <Label className="text-xs text-foreground-tertiary">执行次数</Label>
                  <div className="mt-1 text-sm font-medium">{selectedSkill.execution_count || 0}</div>
                </div>
                <div>
                  <Label className="text-xs text-foreground-tertiary">平均耗时</Label>
                  <div className="mt-1 text-sm font-medium">{selectedSkill.avg_duration_ms || 0}ms</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {CATEGORY_ICONS[getCategoryKey(selectedSkill.category)]?.label || '未分类'}
                </Badge>
                <Badge variant="outline" className={`${STATUS_CONFIG[getStatusKey(selectedSkill.status)]?.color}`}>
                  {STATUS_CONFIG[getStatusKey(selectedSkill.status)]?.label}
                </Badge>
                {selectedSkill.is_builtin && <Badge variant="secondary">内置</Badge>}
              </div>
              {selectedSkill.author && (
                <div>
                  <Label className="text-xs text-foreground-tertiary">作者</Label>
                  <div className="mt-1 text-sm">{selectedSkill.author}</div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {!selectedSkill?.is_builtin && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenEdit}
                className="mr-auto"
              >
                <Edit className="w-3 h-3 mr-1" />
                编辑
              </Button>
            )}
            <Button size="sm" onClick={() => setShowDetailDialog(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 执行 Skill 对话框 */}
      <Dialog open={showExecuteDialog} onOpenChange={setShowExecuteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>执行: {selectedSkill?.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label className="text-xs text-foreground-tertiary">参数 (JSON)</Label>
              <Textarea
                value={executeParams}
                onChange={e => setExecuteParams(e.target.value)}
                placeholder='{"key": "value"}'
                rows={3}
                className="mt-1 font-mono text-xs"
              />
              <p className="text-[10px] text-foreground-tertiary mt-1">留空使用默认参数</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => {
              setShowExecuteDialog(false)
              setExecuteParams('{}')
            }}>
              取消
            </Button>
            <Button size="sm" onClick={executeSkill} disabled={isExecuting}>
              {isExecuting ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  执行中...
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 mr-1" />
                  执行
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 执行结果对话框 */}
      {executeResult && (
        <Dialog open={!!executeResult} onOpenChange={() => setExecuteResult(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>执行结果</DialogTitle>
            </DialogHeader>

            <div className={`p-3 rounded-lg border ${executeResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                {executeResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600" />
                )}
                <Badge variant={executeResult.success ? 'success' : 'destructive'} className="text-xs">
                  {executeResult.success ? '成功' : '失败'}
                </Badge>
                <span className="text-[10px] text-foreground-secondary ml-auto">
                  {executeResult.duration_ms}ms
                </span>
              </div>
              {executeResult.result && (
                <pre className="text-xs bg-white p-2 rounded overflow-auto max-h-32">
                  {JSON.stringify(executeResult.result, null, 2)}
                </pre>
              )}
              {executeResult.error && (
                <div className="text-xs text-red-600 mt-1">{executeResult.error}</div>
              )}
            </div>

            <DialogFooter>
              <Button size="sm" onClick={() => setExecuteResult(null)}>关闭</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* 创建 Skill 对话框 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              创建新 Skill
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs text-foreground-tertiary">
                名称 <span className="text-destructive">*</span>
              </Label>
              <Input
                value={createForm.name}
                onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="my-skill-name（小写字母、数字、连字符）"
                className="mt-1"
              />
              <p className="text-[10px] text-foreground-tertiary mt-1">
                只能包含小写字母、数字和连字符，例如：data-processor
              </p>
            </div>

            <div>
              <Label className="text-xs text-foreground-tertiary">
                描述 <span className="text-destructive">*</span>
              </Label>
              <Input
                value={createForm.description}
                onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="简要描述这个 Skill 的功能..."
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs text-foreground-tertiary">类别</Label>
              <select
                value={createForm.category}
                onChange={e => setCreateForm({ ...createForm, category: e.target.value })}
                className="mt-1 w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="AI">AI</option>
                <option value="Web">网络</option>
                <option value="Development">开发</option>
                <option value="Productivity">效率</option>
                <option value="Utility">工具</option>
                <option value="FileSystem">文件系统</option>
                <option value="DataProcessing">数据处理</option>
                <option value="Automation">自动化</option>
              </select>
            </div>

            <div>
              <Label className="text-xs text-foreground-tertiary">
                指令（Markdown）<span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={createForm.instructions}
                onChange={e => setCreateForm({ ...createForm, instructions: e.target.value })}
                placeholder={`# Skill 指令

描述这个 Skill 应该如何工作...

## 使用场景
- 场景1
- 场景2

## 工作流程
1. 步骤1
2. 步骤2`}
                rows={10}
                className="mt-1 font-mono text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => {
              setShowCreateDialog(false)
              setCreateForm({ name: '', description: '', instructions: '', category: 'Utility' })
            }}>
              取消
            </Button>
            <Button size="sm" onClick={handleCreateSkill} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  创建中...
                </>
              ) : (
                <>
                  <Plus className="w-3 h-3 mr-1" />
                  创建
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 安装 Skill 对话框 */}
      <Dialog open={showInstallDialog} onOpenChange={setShowInstallDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              安装 Skill
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs text-foreground-tertiary">安装来源</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  size="sm"
                  variant={installForm.sourceType === 'url' ? 'default' : 'outline'}
                  onClick={() => setInstallForm({ ...installForm, sourceType: 'url' })}
                  className="flex-1"
                >
                  <Globe className="w-3 h-3 mr-1" />
                  URL
                </Button>
                <Button
                  size="sm"
                  variant={installForm.sourceType === 'local' ? 'default' : 'outline'}
                  onClick={() => setInstallForm({ ...installForm, sourceType: 'local' })}
                  className="flex-1"
                >
                  <FolderOpen className="w-3 h-3 mr-1" />
                  本地路径
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-xs text-foreground-tertiary">
                {installForm.sourceType === 'url' ? 'Skill URL' : '本地路径'}
              </Label>
              <Input
                value={installForm.source}
                onChange={e => setInstallForm({ ...installForm, source: e.target.value })}
                placeholder={installForm.sourceType === 'url'
                  ? 'https://example.com/skill.zip 或 .skill 文件链接'
                  : '/path/to/skill-directory'
                }
                className="mt-1"
              />
              <p className="text-[10px] text-foreground-tertiary mt-1">
                {installForm.sourceType === 'url'
                  ? '支持 .skill 文件或 .zip 压缩包'
                  : '输入 Skill 目录的完整路径'
                }
              </p>
            </div>

            <Alert variant="info" className="bg-blue-50 border-blue-200">
              <Zap className="w-4 h-4 text-blue-600" />
              <AlertTitle className="text-blue-800">安全提示</AlertTitle>
              <AlertDescription className="text-blue-700 text-xs">
                从外部安装 Skill 时请注意来源可信度，避免安装未知来源的 Skill。
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => {
              setShowInstallDialog(false)
              setInstallForm({ source: '', sourceType: 'url' })
            }}>
              取消
            </Button>
            <Button size="sm" onClick={handleInstallSkill} disabled={isInstalling}>
              {isInstalling ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  安装中...
                </>
              ) : (
                <>
                  <Download className="w-3 h-3 mr-1" />
                  安装
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑 Skill 对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              编辑 Skill
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs text-foreground-tertiary">
                名称 <span className="text-destructive">*</span>
              </Label>
              <Input
                value={editForm.name}
                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="my-skill-name（小写字母、数字、连字符）"
                className="mt-1"
              />
              <p className="text-[10px] text-foreground-tertiary mt-1">
                只能包含小写字母、数字和连字符
              </p>
            </div>

            <div>
              <Label className="text-xs text-foreground-tertiary">
                描述 <span className="text-destructive">*</span>
              </Label>
              <Input
                value={editForm.description}
                onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="简要描述这个 Skill 的功能..."
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs text-foreground-tertiary">类别</Label>
              <select
                value={editForm.category}
                onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                className="mt-1 w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="AI">AI</option>
                <option value="Web">网络</option>
                <option value="Development">开发</option>
                <option value="Productivity">效率</option>
                <option value="Utility">工具</option>
                <option value="FileSystem">文件系统</option>
                <option value="DataProcessing">数据处理</option>
                <option value="Automation">自动化</option>
              </select>
            </div>

            <div>
              <Label className="text-xs text-foreground-tertiary">
                指令（Markdown）<span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={editForm.instructions}
                onChange={e => setEditForm({ ...editForm, instructions: e.target.value })}
                placeholder={`# Skill 指令

描述这个 Skill 应该如何工作...`}
                rows={10}
                className="mt-1 font-mono text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowEditDialog(false)}>
              取消
            </Button>
            <Button size="sm" onClick={handleEditSkill} disabled={isEditing}>
              {isEditing ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Edit className="w-3 h-3 mr-1" />
                  保存
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ClawHub 发现对话框 */}
      <Dialog open={showClawHubDialog} onOpenChange={setShowClawHubDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              发现 Skills
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={clawHubQuery}
                onChange={e => setClawHubQuery(e.target.value)}
                placeholder="搜索 Skills..."
                onKeyDown={e => e.key === 'Enter' && handleClawHubSearch()}
                className="flex-1"
              />
              <Button size="sm" onClick={handleClawHubSearch} disabled={isClawHubSearching}>
                {isClawHubSearching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
            </div>

            {clawHubResults.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 max-h-80 overflow-auto">
                {clawHubResults.map(skill => (
                  <Card key={skill.slug} className="p-3">
                    <div className="font-medium text-sm truncate">{skill.name}</div>
                    <div className="text-xs text-foreground-secondary mt-1 line-clamp-2">
                      {skill.description}
                    </div>
                    <Button
                      size="sm"
                      className="mt-2 w-full"
                      onClick={() => handleClawHubInstall(skill.slug)}
                      disabled={clawHubInstalling === skill.slug}
                    >
                      {clawHubInstalling === skill.slug ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          安装中...
                        </>
                      ) : (
                        <>
                          <Download className="w-3 h-3 mr-1" />
                          安装
                        </>
                      )}
                    </Button>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-foreground-secondary">
                {isClawHubSearching ? '正在加载...' : '暂无可用 Skills'}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button size="sm" onClick={() => {
              setShowClawHubDialog(false)
              setClawHubResults([])
              setClawHubQuery('')
            }}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
