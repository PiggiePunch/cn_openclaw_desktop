import { useState, useEffect } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Badge } from './ui/badge'
import MemoryManager from './MemoryManager'
import SessionMemory from './SessionMemory'
import {
  RefreshCw,
  Download,
  Search,
  Brain,
  MessageSquare,
  Lightbulb,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react'

// 🆕 使用新的服务层
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

/**
 * 反思记录组件
 */
function ReflectionRecords() {
  const [reflections, setReflections] = useState([])
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)

  const loadReflections = async () => {
    setLoading(true)
    // 🆕 使用统一 API 服务层
    const result = await api.reflection.getHistory()
    if (result.success) {
      setReflections(result.data?.reflections || [])
    } else {
      console.error('加载反思记录失败:', result.error)
      setReflections([])
    }
    setLoading(false)
  }

  const handleTriggerReflection = async () => {
    setTriggering(true)
    // 🆕 使用统一 API 服务层
    const result = await api.reflection.trigger([])
    if (result.success) {
      toast.success('触发成功', '反思分析已触发')
      loadReflections()
    } else {
      console.error('触发反思失败:', result.error)
      toast.error('触发失败', result.error)
    }
    setTriggering(false)
  }

  useEffect(() => {
    loadReflections()
  }, [])

  return (
    <div className="space-y-4">
      {/* 操作栏 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          记录 Agent 的自我反思和改进建议
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadReflections} disabled={loading}>
            {loading ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3 mr-1" />
            )}
            刷新
          </Button>
          <Button size="sm" onClick={handleTriggerReflection} disabled={triggering}>
            {triggering ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3 mr-1" />
            )}
            触发反思
          </Button>
        </div>
      </div>

      {/* 反思列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">加载中...</span>
        </div>
      ) : reflections.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <Lightbulb className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">暂无反思记录</p>
            <p className="text-sm text-muted-foreground/70 mt-1">点击"触发反思"开始分析</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reflections.map((reflection, index) => (
            <Card key={reflection.id || index} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    {reflection.quality_score >= 0.7 ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : reflection.quality_score >= 0.4 ? (
                      <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    )}
                    {reflection.title || `反思 #${index + 1}`}
                  </CardTitle>
                  {reflection.quality_score !== undefined && (
                    <Badge
                      variant={
                        reflection.quality_score >= 0.7
                          ? 'default'
                          : reflection.quality_score >= 0.4
                          ? 'secondary'
                          : 'destructive'
                      }
                    >
                      质量: {(reflection.quality_score * 100).toFixed(0)}%
                    </Badge>
                  )}
                </div>
                {reflection.created_at && (
                  <CardDescription className="text-xs">
                    {new Date(reflection.created_at).toLocaleString('zh-CN')}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {reflection.summary || reflection.content || '无摘要'}
                </p>
                {reflection.improvements && reflection.improvements.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {reflection.improvements.slice(0, 3).map((imp, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {imp}
                      </Badge>
                    ))}
                    {reflection.improvements.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{reflection.improvements.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * 记忆中心 - 整合长期记忆、对话历史和反思记录的统一入口
 */
export default function MemoryCenter() {
  const [activeTab, setActiveTab] = useState('session') // 默认显示对话历史
  const [isSyncing, setIsSyncing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false) // 是否已执行过搜索

  // 会话转记忆功能
  const handleSyncSessions = async () => {
    setIsSyncing(true)
    // 🆕 使用统一 API 服务层
    const result = await api.memory.sync()
    if (result.success) {
      const data = result.data
      // result 是 SyncResult 结构：{ imported, agents_checked, sessions_dirs_found, details, errors }
      if (data.imported > 0) {
        // 成功导入数据
        const detailMsg = data.details
          .filter(d => d.imported > 0)
          .map(d => `${d.agent_id}: ${d.imported} 条`)
          .join('、')

        toast.success('同步成功', `成功导入 ${data.imported} 条会话记录${detailMsg ? ` (${detailMsg})` : ''}`)
      } else if (data.errors && data.errors.length > 0) {
        // 没有导入数据，但有错误信息
        toast.warning('未导入数据', data.errors[0])
      } else {
        // 其他情况
        toast.info('同步完成', `检查了 ${data.agents_checked} 个 agent，找到 ${data.sessions_dirs_found} 个 sessions 目录`)
      }
    } else {
      console.error('同步失败:', result.error)
      toast.error('同步失败', result.error)
    }
    setIsSyncing(false)
  }

  // 🔥 向量搜索功能
  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    setHasSearched(true)
    // 🆕 使用统一 API 服务层
    const result = await api.memory.searchGateway(searchQuery, 10)
    if (result.success) {
      setSearchResults(result.data?.results || [])
    } else {
      console.error('搜索失败:', result.error)
      toast.error('搜索失败', result.error)
    }
    setIsSearching(false)
  }

  // 清除搜索
  const clearSearch = () => {
    setSearchResults([])
    setSearchQuery('')
    setHasSearched(false)
  }

  // 回车键搜索
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  return (
    <div className="space-y-4">
      {/* 🔥 向量搜索栏 - 全局显示 */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索记忆（向量搜索）..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-9"
          />
        </div>
        <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()}>
          {isSearching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* 搜索结果 */}
      {hasSearched && (
        <Card className="bg-blue-50/50 dark:bg-blue-900/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Search className="w-4 h-4" />
                {searchResults.length > 0 ? `搜索结果 (${searchResults.length})` : '无搜索结果'}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSearch}
              >
                <X className="w-3 h-3 mr-1" />
                清除
              </Button>
            </div>
          </CardHeader>
          {searchResults.length > 0 && (
            <CardContent>
              <div className="space-y-2">
                {searchResults.map((result, index) => (
                  <div
                    key={result.id || index}
                    className="p-2 rounded-lg bg-white dark:bg-gray-800 text-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2">{result.content || result.summary}</p>
                      {result.score !== undefined && (
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          {(result.score * 100).toFixed(0)}%
                        </Badge>
                      )}
                    </div>
                    {result.metadata && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {result.metadata.source || '未知来源'}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Tabs 导航 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="session">
              <span className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                对话历史
              </span>
            </TabsTrigger>
            <TabsTrigger value="long-term">
              <span className="flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5" />
                长期记忆
              </span>
            </TabsTrigger>
            <TabsTrigger value="reflection">
              <span className="flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5" />
                反思记录
              </span>
            </TabsTrigger>
          </TabsList>

          {/* 会话转记忆按钮 - 仅在对话历史 Tab 显示 */}
          {activeTab === 'session' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncSessions}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Download className="w-3 h-3 mr-1" />
              )}
              会话转记忆
            </Button>
          )}
        </div>

        {/* 对话历史 Tab */}
        <TabsContent value="session" className="mt-4">
          <SessionMemory />
        </TabsContent>

        {/* 长期记忆 Tab */}
        <TabsContent value="long-term" className="mt-4">
          <MemoryManager />
        </TabsContent>

        {/* 🔥 反思记录 Tab */}
        <TabsContent value="reflection" className="mt-4">
          <ReflectionRecords />
        </TabsContent>
      </Tabs>
    </div>
  )
}
