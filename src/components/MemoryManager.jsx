import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import {
  Brain,
  RefreshCw,
  Loader2,
  Trash2,
  Search,
  Plus,
  Clock,
} from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

/**
 * MemoryManager - 长期记忆管理组件
 * 管理和查看 Agent 的长期记忆存储
 */
export default function MemoryManager() {
  const [memories, setMemories] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  // 加载记忆列表
  const loadMemories = async () => {
    setLoading(true)
    const result = await api.memory.list()
    if (result.success) {
      setMemories(result.data?.memories || [])
    } else {
      console.error('加载记忆列表失败:', result.error)
      setMemories([])
    }
    setLoading(false)
  }

  // 删除记忆
  const handleDelete = async (memoryId) => {
    setDeleting(memoryId)
    const result = await api.memory.delete(memoryId)
    if (result.success) {
      toast.success('删除成功', '记忆已删除')
      loadMemories()
    } else {
      console.error('删除记忆失败:', result.error)
      toast.error('删除失败', result.error)
    }
    setDeleting(null)
  }

  // 搜索记忆
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadMemories()
      return
    }

    setIsSearching(true)
    const result = await api.memory.searchGateway(searchQuery, 20)
    if (result.success) {
      setMemories(result.data?.results || [])
    } else {
      console.error('搜索记忆失败:', result.error)
      toast.error('搜索失败', result.error)
    }
    setIsSearching(false)
  }

  // 回车键搜索
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  useEffect(() => {
    loadMemories()
  }, [])

  return (
    <div className="space-y-4">
      {/* 搜索栏 */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索长期记忆..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-9"
          />
        </div>
        <Button onClick={handleSearch} disabled={isSearching}>
          {isSearching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </Button>
        <Button variant="outline" onClick={loadMemories} disabled={loading}>
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">加载中...</span>
        </div>
      ) : memories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <Brain className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">暂无长期记忆</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              通过对话或手动添加记忆后将在此显示
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            共 {memories.length} 条记忆
          </div>
          {memories.map((memory, index) => (
            <Card key={memory.id || index} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Brain className="w-4 h-4" />
                    {memory.metadata?.source || '记忆'}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {memory.score !== undefined && (
                      <Badge variant="outline" className="text-xs">
                        {(memory.score * 100).toFixed(0)}%
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(memory.id)}
                      disabled={deleting === memory.id}
                    >
                      {deleting === memory.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{memory.content || memory.summary}</p>
                {memory.metadata?.created_at && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                    <Clock className="w-3 h-3" />
                    {new Date(memory.metadata.created_at).toLocaleString('zh-CN')}
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
