import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import {
  MessageSquare,
  RefreshCw,
  Loader2,
  Trash2,
  Clock,
} from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

/**
 * SessionMemory - 会话历史组件
 * 显示和管理 Agent 的对话历史记录
 */
export default function SessionMemory() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)

  const parseAgentIdFromSessionKey = (sessionKey) => {
    if (typeof sessionKey !== 'string' || !sessionKey) return 'unknown'
    if (sessionKey === 'main' || sessionKey.startsWith('agent:main')) return 'main'

    if (sessionKey.startsWith('agent:')) {
      const parts = sessionKey.split(':')
      return parts[1] || 'unknown'
    }

    const slashParts = sessionKey.split('/')
    return slashParts[0] || 'unknown'
  }

  const normalizeSessionItem = (item, index) => {
    if (typeof item === 'string') {
      return {
        id: item || `session-${index}`,
        agent_id: parseAgentIdFromSessionKey(item),
        preview: item,
      }
    }

    if (!item || typeof item !== 'object') return null

    const sessionKey =
      item.session_key ||
      item.sessionKey ||
      item.key ||
      item.id ||
      ''

    const id = sessionKey || item.id || `session-${index}`
    const agentId = item.agent_id || item.agentId || parseAgentIdFromSessionKey(sessionKey)

    return {
      ...item,
      id,
      agent_id: agentId,
      preview: item.preview || sessionKey || item.title || '',
      created_at: item.created_at || item.createdAt || null,
      updated_at: item.updated_at || item.updatedAt || null,
      message_count: item.message_count || item.messageCount || 0,
    }
  }

  // 加载会话列表
  const loadSessions = async () => {
    setLoading(true)
    // 使用 api.sessions.list() - 不传 agentId 则获取所有会话
    const result = await api.sessions.list()
    if (result.success) {
      const rawSessions = Array.isArray(result.data)
        ? result.data
        : (result.data?.sessionKeys || result.data?.sessions || [])
      const normalized = Array.isArray(rawSessions)
        ? rawSessions.map((item, index) => normalizeSessionItem(item, index)).filter(Boolean)
        : []
      setSessions(normalized)
    } else {
      console.error('加载会话列表失败:', result.error)
      setSessions([])
    }
    setLoading(false)
  }

  // 删除会话
  const handleDelete = async (sessionKey) => {
    setDeleting(sessionKey)
    const result = await api.sessions.delete(sessionKey)
    if (result.success) {
      toast.success('删除成功', '会话已删除')
      loadSessions()
    } else {
      console.error('删除会话失败:', result.error)
      toast.error('删除失败', result.error)
    }
    setDeleting(null)
  }

  useEffect(() => {
    loadSessions()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">加载中...</span>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12">
          <MessageSquare className="w-12 h-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">暂无对话历史</p>
          <p className="text-sm text-muted-foreground/70 mt-1">开始新对话后将在此显示</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* 操作栏 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          共 {sessions.length} 个会话
        </div>
        <Button variant="outline" size="sm" onClick={loadSessions} disabled={loading}>
          {loading ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3 mr-1" />
          )}
          刷新
        </Button>
      </div>

      {/* 会话列表 */}
      <div className="space-y-3">
        {sessions.map((session) => (
          <Card key={session.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  {session.agent_id || '未知 Agent'}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {session.message_count && (
                    <Badge variant="outline" className="text-xs">
                      {session.message_count} 条消息
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(session.id)}
                    disabled={deleting === session.id}
                  >
                    {deleting === session.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {session.created_at && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(session.created_at).toLocaleString('zh-CN')}
                  </span>
                )}
                {session.updated_at && session.updated_at !== session.created_at && (
                  <span>更新于 {new Date(session.updated_at).toLocaleString('zh-CN')}</span>
                )}
              </div>
              {session.preview && (
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                  {session.preview}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
