import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog'
import {
  Search,
  Plus,
  BookOpen,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Lightbulb,
  Wrench,
  MessageSquare,
  Zap,
  Layers,
  Trash2,
  Eye,
  Filter,
} from 'lucide-react'

// 🆕 使用新的服务层
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

// Pattern 类型枚举
const PatternType = {
  Success: 'success',
  Anti: 'anti',
}

// Pattern 分类枚举
const PatternCategory = {
  Structural: 'structural',
  ErrorHandling: 'error_handling',
  ToolUsage: 'tool_usage',
  Communication: 'communication',
  Efficiency: 'efficiency',
}

// 分类图标映射
const categoryIcons = {
  [PatternCategory.Structural]: Layers,
  [PatternCategory.ErrorHandling]: AlertTriangle,
  [PatternCategory.ToolUsage]: Wrench,
  [PatternCategory.Communication]: MessageSquare,
  [PatternCategory.Efficiency]: Zap,
}

// 分类中文名称
const categoryLabels = {
  [PatternCategory.Structural]: '结构模式',
  [PatternCategory.ErrorHandling]: '错误处理',
  [PatternCategory.ToolUsage]: '工具使用',
  [PatternCategory.Communication]: '沟通模式',
  [PatternCategory.Efficiency]: '效率模式',
}

// 类型中文名称
const typeLabels = {
  [PatternType.Success]: '成功模式',
  [PatternType.Anti]: '反模式',
}

/**
 * 模式库管理组件
 */
export default function PatternLibrary() {
  const [patterns, setPatterns] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeType, setActiveType] = useState('all')
  const [activeCategory, setActiveCategory] = useState('all')
  const [selectedPattern, setSelectedPattern] = useState(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showDetailDialog, setShowDetailDialog] = useState(false)

  // 新模式表单
  const [newPattern, setNewPattern] = useState({
    name: '',
    pattern_type: PatternType.Success,
    category: PatternCategory.Structural,
    description: '',
    example: '',
    counter_example: '',
    tags: '',
  })

  // 加载模式列表
  const loadPatterns = async () => {
    setLoading(true)
    // 🆕 使用新的 patterns.list API
    const result = await api.patterns.list({ limit: 200 })
    if (result.success) {
      setPatterns(result.data?.patterns || [])
    } else {
      console.error('加载模式失败:', result.error)
      toast.error('加载失败', result.error)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadPatterns()
  }, [])

  // 筛选模式
  const filteredPatterns = patterns.filter((pattern) => {
    // 类型筛选
    if (activeType !== 'all' && pattern.pattern_type !== activeType) {
      return false
    }
    // 分类筛选
    if (activeCategory !== 'all' && pattern.category !== activeCategory) {
      return false
    }
    // 搜索筛选
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        pattern.name.toLowerCase().includes(query) ||
        pattern.description.toLowerCase().includes(query) ||
        pattern.tags?.some((tag) => tag.toLowerCase().includes(query))
      )
    }
    return true
  })

  // 添加新模式
  const handleAddPattern = async () => {
    if (!newPattern.name || !newPattern.description) {
      toast.warning('信息不完整', '请填写名称和描述')
      return
    }

    const patternData = {
      id: `pattern-${Date.now()}`,
      name: newPattern.name,
      pattern_type: newPattern.pattern_type,
      category: newPattern.category,
      description: newPattern.description,
      example: newPattern.example || null,
      counter_example: newPattern.counter_example || null,
      evidence_count: 0,
      tags: newPattern.tags
        ? newPattern.tags.split(',').map((t) => t.trim())
        : [],
    }

    // 🆕 使用统一 API 服务层
    const result = await api.reflection.addPattern(patternData)
    if (result.success) {
      toast.success('添加成功', `模式 "${newPattern.name}" 已添加`)
      setShowAddDialog(false)
      setNewPattern({
        name: '',
        pattern_type: PatternType.Success,
        category: PatternCategory.Structural,
        description: '',
        example: '',
        counter_example: '',
        tags: '',
      })
      loadPatterns()
    } else {
      console.error('添加模式失败:', result.error)
      toast.error('添加失败', result.error)
    }
  }

  // 查看模式详情
  const handleViewPattern = (pattern) => {
    setSelectedPattern(pattern)
    setShowDetailDialog(true)
  }

  // 渲染模式卡片
  const renderPatternCard = (pattern) => {
    const isAnti = pattern.pattern_type === PatternType.Anti
    const CategoryIcon = categoryIcons[pattern.category] || Lightbulb

    return (
      <Card
        key={pattern.id}
        className={`cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-normal group ${
          isAnti ? 'border-l-4 border-l-red-400' : 'border-l-4 border-l-green-400'
        }`}
        onClick={() => handleViewPattern(pattern)}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  isAnti ? 'bg-red-100' : 'bg-green-100'
                }`}
              >
                {isAnti ? (
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                )}
              </div>
              <div>
                <CardTitle className="text-base">{pattern.name}</CardTitle>
                <div className="flex items-center gap-1.5 mt-1">
                  <CategoryIcon className="w-3 h-3 text-foreground-secondary" />
                  <span className="text-xs text-foreground-secondary">
                    {categoryLabels[pattern.category] || pattern.category}
                  </span>
                </div>
              </div>
            </div>
            <Badge variant={isAnti ? 'destructive' : 'default'} className="text-xs">
              {isAnti ? '反模式' : '成功'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <p className="text-sm text-foreground-secondary line-clamp-2">
            {pattern.description}
          </p>
          {pattern.tags && pattern.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {pattern.tags.slice(0, 3).map((tag, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {pattern.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{pattern.tags.length - 3}
                </Badge>
              )}
            </div>
          )}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-subtle">
            <span className="text-xs text-foreground-tertiary">
              证据次数: {pattern.evidence_count || 0}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={(e) => {
                e.stopPropagation()
                handleViewPattern(pattern)
              }}
            >
              <Eye className="w-3 h-3 mr-1" />
              详情
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            模式库
          </h2>
          <p className="text-sm text-foreground-secondary mt-1">
            管理智能体的成功模式和反模式，持续学习和优化
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadPatterns} disabled={loading}>
            {loading ? (
              <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-1" />
            )}
            刷新
          </Button>
          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4 mr-1" />
            添加模式
          </Button>
        </div>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-secondary" />
          <Input
            placeholder="搜索模式名称、描述或标签..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Tabs value={activeType} onValueChange={setActiveType}>
            <TabsList className="h-9">
              <TabsTrigger value="all" className="text-xs px-3">
                全部
              </TabsTrigger>
              <TabsTrigger value={PatternType.Success} className="text-xs px-3">
                <CheckCircle className="w-3 h-3 mr-1" />
                成功
              </TabsTrigger>
              <TabsTrigger value={PatternType.Anti} className="text-xs px-3">
                <AlertTriangle className="w-3 h-3 mr-1" />
                反模式
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* 分类筛选 */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeCategory === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveCategory('all')}
        >
          <Filter className="w-3 h-3 mr-1" />
          全部分类
        </Button>
        {Object.entries(PatternCategory).map(([key, value]) => {
          const Icon = categoryIcons[value]
          return (
            <Button
              key={value}
              variant={activeCategory === value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveCategory(value)}
            >
              {Icon && <Icon className="w-3 h-3 mr-1" />}
              {categoryLabels[value]}
            </Button>
          )
        })}
      </div>

      {/* 模式统计 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <div className="text-2xl font-bold text-green-700">
                  {patterns.filter((p) => p.pattern_type === PatternType.Success).length}
                </div>
                <div className="text-xs text-green-600">成功模式</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <div>
                <div className="text-2xl font-bold text-red-700">
                  {patterns.filter((p) => p.pattern_type === PatternType.Anti).length}
                </div>
                <div className="text-xs text-red-600">反模式</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              <div>
                <div className="text-2xl font-bold text-blue-700">{patterns.length}</div>
                <div className="text-xs text-blue-600">总模式数</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-purple-600" />
              <div>
                <div className="text-2xl font-bold text-purple-700">
                  {patterns.reduce((sum, p) => sum + (p.evidence_count || 0), 0)}
                </div>
                <div className="text-xs text-purple-600">总证据数</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 模式列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2 text-foreground-secondary">加载中...</span>
        </div>
      ) : filteredPatterns.length === 0 ? (
        <Card className="py-12">
          <CardContent className="flex flex-col items-center">
            <BookOpen className="w-12 h-12 text-foreground-tertiary mb-4" />
            <p className="text-foreground-secondary">
              {searchQuery || activeType !== 'all' || activeCategory !== 'all'
                ? '没有找到匹配的模式'
                : '暂无模式，点击上方"添加模式"开始'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPatterns.map(renderPatternCard)}
        </div>
      )}

      {/* 添加模式对话框 */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>添加新模式</DialogTitle>
            <DialogDescription>
              记录智能体的成功经验或需要避免的反模式
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">模式名称 *</label>
              <Input
                placeholder="如：并行执行独立任务"
                value={newPattern.name}
                onChange={(e) => setNewPattern({ ...newPattern, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">类型</label>
                <Tabs
                  value={newPattern.pattern_type}
                  onValueChange={(v) => setNewPattern({ ...newPattern, pattern_type: v })}
                >
                  <TabsList className="w-full">
                    <TabsTrigger value={PatternType.Success} className="flex-1 text-xs">
                      成功
                    </TabsTrigger>
                    <TabsTrigger value={PatternType.Anti} className="flex-1 text-xs">
                      反模式
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">分类</label>
                <select
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                  value={newPattern.category}
                  onChange={(e) => setNewPattern({ ...newPattern, category: e.target.value })}
                >
                  {Object.entries(PatternCategory).map(([key, value]) => (
                    <option key={value} value={value}>
                      {categoryLabels[value]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">描述 *</label>
              <textarea
                className="w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
                placeholder="详细描述这个模式的内容和作用"
                value={newPattern.description}
                onChange={(e) => setNewPattern({ ...newPattern, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">示例</label>
              <textarea
                className="w-full min-h-[60px] px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
                placeholder="提供具体的示例场景或代码"
                value={newPattern.example}
                onChange={(e) => setNewPattern({ ...newPattern, example: e.target.value })}
              />
            </div>
            {newPattern.pattern_type === PatternType.Anti && (
              <div className="space-y-2">
                <label className="text-sm font-medium">正确做法</label>
                <textarea
                  className="w-full min-h-[60px] px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
                  placeholder="描述应该如何避免这个反模式"
                  value={newPattern.counter_example}
                  onChange={(e) =>
                    setNewPattern({ ...newPattern, counter_example: e.target.value })
                  }
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">标签</label>
              <Input
                placeholder="用逗号分隔，如：并行, 效率, 任务"
                value={newPattern.tags}
                onChange={(e) => setNewPattern({ ...newPattern, tags: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              取消
            </Button>
            <Button onClick={handleAddPattern}>添加模式</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 模式详情对话框 */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-[600px]">
          {selectedPattern && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  {selectedPattern.pattern_type === PatternType.Anti ? (
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  )}
                  <DialogTitle>{selectedPattern.name}</DialogTitle>
                </div>
                <DialogDescription>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge
                      variant={selectedPattern.pattern_type === PatternType.Anti ? 'destructive' : 'default'}
                    >
                      {typeLabels[selectedPattern.pattern_type]}
                    </Badge>
                    <Badge variant="outline">
                      {categoryLabels[selectedPattern.category] || selectedPattern.category}
                    </Badge>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <h4 className="text-sm font-medium text-foreground-secondary mb-2">描述</h4>
                  <p className="text-sm">{selectedPattern.description}</p>
                </div>
                {selectedPattern.example && (
                  <div>
                    <h4 className="text-sm font-medium text-foreground-secondary mb-2">示例</h4>
                    <pre className="text-sm bg-surface-elevated p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                      {selectedPattern.example}
                    </pre>
                  </div>
                )}
                {selectedPattern.counter_example && (
                  <div>
                    <h4 className="text-sm font-medium text-green-600 mb-2">正确做法</h4>
                    <pre className="text-sm bg-green-50 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                      {selectedPattern.counter_example}
                    </pre>
                  </div>
                )}
                {selectedPattern.tags && selectedPattern.tags.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-foreground-secondary mb-2">标签</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedPattern.tags.map((tag, idx) => (
                        <Badge key={idx} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border-subtle">
                  <div>
                    <span className="text-xs text-foreground-tertiary">证据次数</span>
                    <div className="font-semibold">{selectedPattern.evidence_count || 0}</div>
                  </div>
                  <div>
                    <span className="text-xs text-foreground-tertiary">创建时间</span>
                    <div className="font-semibold text-sm">
                      {selectedPattern.created_at
                        ? new Date(selectedPattern.created_at).toLocaleDateString('zh-CN')
                        : '-'}
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
                  关闭
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
