import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Alert, AlertTitle, AlertDescription } from './ui/alert'
import {
  Wrench,
  Search,
  Plus,
  Trash2,
  Edit,
  Code,
  Globe,
  Terminal,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Zap,
  Settings,
  Play,
  Copy,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

// 工具类别配置
const TOOL_CATEGORIES = {
  browser: { icon: Globe, color: 'text-blue-600', bg: 'bg-blue-50', label: '浏览器' },
  fs: { icon: FileText, color: 'text-green-600', bg: 'bg-green-50', label: '文件系统' },
  exec: { icon: Terminal, color: 'text-purple-600', bg: 'bg-purple-50', label: '命令执行' },
  web: { icon: Globe, color: 'text-cyan-600', bg: 'bg-cyan-50', label: '网络' },
  memory: { icon: FileText, color: 'text-orange-600', bg: 'bg-orange-50', label: '记忆' },
  cron: { icon: Settings, color: 'text-pink-600', bg: 'bg-pink-50', label: '定时任务' },
  sessions: { icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-50', label: '会话' },
  canvas: { icon: Code, color: 'text-teal-600', bg: 'bg-teal-50', label: 'Canvas' },
  node: { icon: Zap, color: 'text-yellow-600', bg: 'bg-yellow-50', label: '节点' },
  skill: { icon: Wrench, color: 'text-rose-600', bg: 'bg-rose-50', label: 'Skill' },
  channel: { icon: Globe, color: 'text-lime-600', bg: 'bg-lime-50', label: '通道' },
  interaction: { icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50', label: '交互' },
  self_evolution: { icon: Zap, color: 'text-violet-600', bg: 'bg-violet-50', label: '自我进化' },
  custom: { icon: Wrench, color: 'text-gray-600', bg: 'bg-gray-100', label: '自定义' },
}

// handler_type 配置
const HANDLER_TYPES = [
  { value: 'exec', label: 'Shell 命令', description: '执行 shell 命令，支持参数替换' },
  { value: 'http', label: 'HTTP 请求', description: '发送 HTTP 请求到指定 URL' },
  { value: 'script', label: '脚本执行', description: '执行 Python/JavaScript/Shell 脚本' },
  { value: 'skill', label: 'Skill 调用', description: '调用已安装的 Skill' },
]

export default function ToolManager() {
  const [tools, setTools] = useState([])
  const [dynamicTools, setDynamicTools] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [expandedCategories, setExpandedCategories] = useState({})

  // 创建/编辑对话框
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingTool, setEditingTool] = useState(null)
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    handler_type: 'exec',
    handler_config: '{}',
    parameters_schema: '{"type": "object", "properties": {}}',
  })
  const [isSaving, setIsSaving] = useState(false)

  // 详情对话框
  const [selectedTool, setSelectedTool] = useState(null)
  const [showDetailDialog, setShowDetailDialog] = useState(false)

  // 测试对话框
  const [showTestDialog, setShowTestDialog] = useState(false)
  const [testArgs, setTestArgs] = useState('{}')
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  // 加载工具列表
  const loadTools = async () => {
    setIsLoading(true)
    try {
      const result = await api.tools.list()
      if (result.success && result.data) {
        setTools(result.data)
      }
    } catch (err) {
      console.error('加载工具列表失败:', err)
      toast({ title: '加载失败', description: err.message, variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadTools()
  }, [])

  // 按类别分组工具
  const groupedTools = React.useMemo(() => {
    const groups = {}
    const filtered = tools.filter(tool => {
      const matchesSearch = searchQuery
        ? tool.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tool.description?.toLowerCase().includes(searchQuery.toLowerCase())
        : true

      const matchesCategory = selectedCategory === 'all' ||
        tool.name?.startsWith(selectedCategory + '_') ||
        tool.name?.startsWith('custom_')

      return matchesSearch && matchesCategory
    })

    filtered.forEach(tool => {
      let category = 'custom'
      if (tool.name?.startsWith('custom_')) {
        category = 'custom'
      } else {
        const prefix = tool.name?.split('_')[0]
        if (TOOL_CATEGORIES[prefix]) {
          category = prefix
        }
      }

      if (!groups[category]) {
        groups[category] = []
      }
      groups[category].push(tool)
    })

    return groups
  }, [tools, searchQuery, selectedCategory])

  // 切换类别展开
  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }))
  }

  // 创建工具
  const handleCreate = () => {
    setEditingTool(null)
    setCreateForm({
      name: 'custom_',
      description: '',
      handler_type: 'exec',
      handler_config: '{"command": ""}',
      parameters_schema: '{"type": "object", "properties": {}, "required": []}',
    })
    setShowCreateDialog(true)
  }

  // 编辑工具
  const handleEdit = (tool) => {
    setEditingTool(tool)
    setCreateForm({
      name: tool.name,
      description: tool.description || '',
      handler_type: tool.handler_type || 'exec',
      handler_config: JSON.stringify(tool.handler_config || {}, null, 2),
      parameters_schema: JSON.stringify(tool.parameters_schema || { type: 'object' }, null, 2),
    })
    setShowCreateDialog(true)
  }

  // 保存工具
  const handleSave = async () => {
    if (!createForm.name.startsWith('custom_')) {
      toast({ title: '名称错误', description: '工具名称必须以 custom_ 开头', variant: 'destructive' })
      return
    }

    setIsSaving(true)
    try {
      const handlerConfig = JSON.parse(createForm.handler_config)
      const parametersSchema = JSON.parse(createForm.parameters_schema)

      const params = {
        name: createForm.name,
        description: createForm.description,
        handler_type: createForm.handler_type,
        handler_config: handlerConfig,
        parameters_schema: parametersSchema,
      }

      let result
      if (editingTool) {
        result = await api.tools.update(params)
      } else {
        result = await api.tools.register(params)
      }

      if (result.success) {
        toast({ title: editingTool ? '更新成功' : '创建成功', description: `工具 ${createForm.name} 已保存` })
        setShowCreateDialog(false)
        loadTools()
      } else {
        throw new Error(result.error || '保存失败')
      }
    } catch (err) {
      toast({ title: '保存失败', description: err.message, variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  // 删除工具
  const handleDelete = async (toolName) => {
    if (!confirm(`确定要删除工具 ${toolName} 吗？`)) return

    try {
      const result = await api.tools.delete(toolName)
      if (result.success) {
        toast({ title: '删除成功', description: `工具 ${toolName} 已删除` })
        loadTools()
      } else {
        throw new Error(result.error || '删除失败')
      }
    } catch (err) {
      toast({ title: '删除失败', description: err.message, variant: 'destructive' })
    }
  }

  // 查看工具详情
  const handleViewDetail = async (tool) => {
    try {
      const result = await api.tools.get(tool.name)
      if (result.success && result.data) {
        setSelectedTool(result.data)
        setShowDetailDialog(true)
      }
    } catch (err) {
      toast({ title: '获取详情失败', description: err.message, variant: 'destructive' })
    }
  }

  // 测试工具
  const handleTest = (tool) => {
    setSelectedTool(tool)
    setTestArgs('{}')
    setTestResult(null)
    setShowTestDialog(true)
  }

  // 执行测试
  const executeTest = async () => {
    if (!selectedTool) return

    setIsTesting(true)
    setTestResult(null)
    try {
      const args = JSON.parse(testArgs)
      const result = await api.tools.call(selectedTool.name, args)
      setTestResult(result)
    } catch (err) {
      setTestResult({ error: err.message })
    } finally {
      setIsTesting(false)
    }
  }

  // 复制工具配置
  const copyToolConfig = (tool) => {
    const config = {
      name: tool.name,
      description: tool.description,
      handler_type: tool.handler_type || 'exec',
      handler_config: tool.handler_config || {},
      parameters_schema: tool.parameters || tool.parameters_schema || {},
    }
    navigator.clipboard.writeText(JSON.stringify(config, null, 2))
    toast({ title: '已复制', description: '工具配置已复制到剪贴板' })
  }

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5" />
          <h2 className="text-lg font-semibold">工具管理</h2>
          <Badge variant="secondary">{tools.length} 个工具</Badge>
        </div>
        <Button onClick={handleCreate} size="sm">
          <Plus className="w-4 h-4 mr-1" />
          新建工具
        </Button>
      </div>

      {/* 搜索和过滤 */}
      <div className="p-4 border-b space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索工具..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setSelectedCategory('all')}
          >
            全部
          </Badge>
          {Object.entries(TOOL_CATEGORIES).map(([key, config]) => (
            <Badge
              key={key}
              variant={selectedCategory === key ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setSelectedCategory(key)}
            >
              {config.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* 工具列表 */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedTools).map(([category, categoryTools]) => {
              const config = TOOL_CATEGORIES[category] || TOOL_CATEGORIES.custom
              const CategoryIcon = config.icon
              const isExpanded = expandedCategories[category]

              return (
                <div key={category} className="border rounded-lg">
                  <div
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleCategory(category)}
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      <CategoryIcon className={`w-4 h-4 ${config.color}`} />
                      <span className="font-medium">{config.label}</span>
                      <Badge variant="secondary" className="text-xs">
                        {categoryTools.length}
                      </Badge>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t divide-y">
                      {categoryTools.map((tool) => (
                        <div
                          key={tool.name}
                          className="p-3 hover:bg-muted/30 flex items-center justify-between"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <code className="text-sm font-mono">{tool.name}</code>
                              {tool.name?.startsWith('custom_') && (
                                <Badge variant="outline" className="text-xs">自定义</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {tool.description || '暂无描述'}
                            </p>
                          </div>

                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewDetail(tool)}
                              title="查看详情"
                            >
                              <FileText className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleTest(tool)}
                              title="测试"
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => copyToolConfig(tool)}
                              title="复制配置"
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                            {tool.name?.startsWith('custom_') && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(tool)}
                                  title="编辑"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(tool.name)}
                                  title="删除"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {Object.keys(groupedTools).length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                没有找到匹配的工具
              </div>
            )}
          </div>
        )}
      </div>

      {/* 创建/编辑对话框 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTool ? '编辑工具' : '创建新工具'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">工具名称 *</Label>
              <Input
                id="name"
                value={createForm.name}
                onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="custom_my_tool"
                disabled={!!editingTool}
              />
              <p className="text-xs text-muted-foreground">必须以 custom_ 开头</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">描述</Label>
              <Input
                id="description"
                value={createForm.description}
                onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="工具的功能描述"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="handler_type">处理器类型</Label>
              <select
                id="handler_type"
                value={createForm.handler_type}
                onChange={(e) => setCreateForm(prev => ({ ...prev, handler_type: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                {HANDLER_TYPES.map(ht => (
                  <option key={ht.value} value={ht.value}>{ht.label}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label>处理器配置 (JSON)</Label>
              <Textarea
                value={createForm.handler_config}
                onChange={(e) => setCreateForm(prev => ({ ...prev, handler_config: e.target.value }))}
                rows={5}
                className="font-mono text-sm"
                placeholder={createForm.handler_type === 'exec'
                  ? '{"command": "echo ${message}"}'
                  : createForm.handler_type === 'http'
                  ? '{"url": "https://api.example.com/${id}", "method": "GET"}'
                  : '{}'}
              />
              <p className="text-xs text-muted-foreground">
                {createForm.handler_type === 'exec' && '使用 ${param} 语法替换参数'}
                {createForm.handler_type === 'http' && '支持 GET, POST, PUT, DELETE 方法'}
                {createForm.handler_type === 'script' && 'script: 脚本内容, language: python/javascript/bash'}
                {createForm.handler_type === 'skill' && 'skill_name: 要调用的 Skill 名称'}
              </p>
            </div>

            <div className="grid gap-2">
              <Label>参数 Schema (JSON)</Label>
              <Textarea
                value={createForm.parameters_schema}
                onChange={(e) => setCreateForm(prev => ({ ...prev, parameters_schema: e.target.value }))}
                rows={5}
                className="font-mono text-sm"
                placeholder='{"type": "object", "properties": {"message": {"type": "string"}}}'
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editingTool ? '更新' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 详情对话框 */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>工具详情</DialogTitle>
          </DialogHeader>

          {selectedTool && (
            <div className="space-y-4 py-4">
              <div className="grid gap-2">
                <Label>名称</Label>
                <code className="p-2 bg-muted rounded text-sm">{selectedTool.name}</code>
              </div>

              <div className="grid gap-2">
                <Label>描述</Label>
                <p className="text-sm">{selectedTool.description || '暂无描述'}</p>
              </div>

              <div className="grid gap-2">
                <Label>参数</Label>
                <pre className="p-2 bg-muted rounded text-sm overflow-x-auto">
                  {JSON.stringify(selectedTool.parameters || selectedTool.parameters_schema, null, 2)}
                </pre>
              </div>

              {selectedTool.handler_type && (
                <div className="grid gap-2">
                  <Label>处理器类型</Label>
                  <Badge>{selectedTool.handler_type}</Badge>
                </div>
              )}

              {selectedTool.handler_config && (
                <div className="grid gap-2">
                  <Label>处理器配置</Label>
                  <pre className="p-2 bg-muted rounded text-sm overflow-x-auto">
                    {JSON.stringify(selectedTool.handler_config, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 测试对话框 */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>测试工具: {selectedTool?.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>参数 (JSON)</Label>
              <Textarea
                value={testArgs}
                onChange={(e) => setTestArgs(e.target.value)}
                rows={5}
                className="font-mono text-sm"
                placeholder='{"key": "value"}'
              />
            </div>

            {testResult && (
              <div className="grid gap-2">
                <Label>结果</Label>
                <pre className={`p-2 rounded text-sm overflow-x-auto ${
                  testResult.error ? 'bg-destructive/10 text-destructive' : 'bg-muted'
                }`}>
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestDialog(false)}>
              关闭
            </Button>
            <Button onClick={executeTest} disabled={isTesting}>
              {isTesting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              执行测试
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
