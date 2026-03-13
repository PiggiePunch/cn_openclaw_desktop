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
  const [agentNames, setAgentNames] = useState({})
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)

  const stripAssistantEnvelopeTags = (content) => {
    if (typeof content !== 'string' || !content) return content
    return content.replace(/<\/?\s*final\b[^>]*>/gi, '')
  }

  const normalizeSessionKey = (sessionKey) => {
    if (!sessionKey) return 'main'
    const raw = String(sessionKey).trim()
    if (!raw) return 'main'
    const lowered = raw.toLowerCase()
    if (lowered === 'main' || lowered === 'agent:main' || lowered === 'agent:main:main') {
      return 'main'
    }
    if (raw.startsWith('agent:')) {
      const parts = raw.split(':').filter(Boolean)
      if (parts.length === 2) return `${raw}:main`
    }
    return raw
  }

  const parseAgentIdFromSessionKey = (sessionKey) => {
    const normalized = normalizeSessionKey(sessionKey)
    if (typeof normalized !== 'string' || !normalized) return 'main'
    if (normalized === 'main' || normalized.startsWith('agent:main')) return 'main'

    if (normalized.startsWith('agent:')) {
      const parts = normalized.split(':')
      return parts[1] || 'main'
    }
    return 'main'
  }

  const extractTextFromMessage = (msg) => {
    const source = msg?.content ?? msg
    if (typeof source === 'string') return source
    if (Array.isArray(source)) {
      return source
        .map((block) => (block?.type === 'text' ? block.text : ''))
        .filter(Boolean)
        .join('\n')
    }
    if (typeof source?.text === 'string') return source.text
    return ''
  }

  const normalizePreviewText = (msg) => {
    const text = extractTextFromMessage(msg)
    if (msg?.role === 'assistant') {
      return stripAssistantEnvelopeTags(text)
    }
    return text
  }

  const getAgentDisplayName = (agentId) => {
    if (agentId === 'main') {
      return agentNames.main || '默认助手'
    }
    return agentNames[agentId] || `智能体-${agentId}`
  }

  const normalizeSessionItem = (item, index) => {
    if (typeof item === 'string') {
      const sessionKey = normalizeSessionKey(item)
      const agentId = parseAgentIdFromSessionKey(sessionKey)
      return {
        id: sessionKey || `session-${index}`,
        session_key: sessionKey,
        sessionKey,
        agent_id: agentId,
        title: sessionKey === 'main' ? '默认会话' : sessionKey,
        preview: '',
        created_at: null,
        updated_at: null,
        message_count: 0,
      }
    }

    if (!item || typeof item !== 'object') return null

    const sessionKey = normalizeSessionKey(
      item.session_key ||
      item.sessionKey ||
      item.key ||
      item.id ||
      '',
    )

    const id = sessionKey || normalizeSessionKey(item.id) || `session-${index}`
    const agentId = item.agent_id || item.agentId || parseAgentIdFromSessionKey(sessionKey)
    const countRaw = item.message_count ?? item.messageCount ?? item.count ?? item.total_messages ?? 0
    const count = Number.isFinite(Number(countRaw)) ? Number(countRaw) : 0

    return {
      ...item,
      id,
      session_key: sessionKey,
      sessionKey,
      agent_id: agentId,
      title: item.title || item.name || item.label || (sessionKey === 'main' ? '默认会话' : sessionKey),
      preview: item.preview || '',
      created_at: item.created_at || item.createdAt || null,
      updated_at: item.updated_at || item.updatedAt || null,
      message_count: count,
    }
  }

  // 加载会话列表
  const loadSessions = async () => {
    setLoading(true)
    try {
      const [sessionsResult, agentsResult] = await Promise.all([
        api.sessions.list(),
        api.agents.list(),
      ])

      if (agentsResult.success && Array.isArray(agentsResult.data)) {
        const names = {}
        for (const agent of agentsResult.data) {
          const id = String(agent?.id || '').trim()
          if (!id) continue
          const name = agent?.identity?.name || agent?.name || agent?.display_name || id
          names[id] = name
        }
        setAgentNames(names)
      }

      if (!sessionsResult.success) {
        console.error('加载会话列表失败:', sessionsResult.error)
        setSessions([])
        return
      }

      const rawSessions = Array.isArray(sessionsResult.data)
        ? sessionsResult.data
        : (sessionsResult.data?.sessionKeys || sessionsResult.data?.sessions || [])
      const normalized = Array.isArray(rawSessions)
        ? rawSessions.map((item, index) => normalizeSessionItem(item, index)).filter(Boolean)
        : []

      const dedupMap = new Map()
      for (const session of normalized) {
        const key = session.session_key || session.id
        if (!key) continue
        if (!dedupMap.has(key) || key.endsWith(':main')) {
          dedupMap.set(key, session)
        }
      }

      const dedupedSessions = Array.from(dedupMap.values())
      const enrichedSessions = await Promise.all(
        dedupedSessions.map(async (session) => {
          const sessionKey = normalizeSessionKey(session.session_key || session.id)
          let preview = session.preview
          let messageCount = Number(session.message_count || 0)
          let latestTimestamp = session.updated_at || session.created_at || null

          if (!preview || messageCount === 0 || !latestTimestamp) {
            try {
              const historyResult = await api.sessions.getMessages(sessionKey)
              if (historyResult.success && Array.isArray(historyResult.data)) {
                const history = historyResult.data
                messageCount = history.length
                if (history.length > 0) {
                  const last = history[history.length - 1]
                  preview = normalizePreviewText(last) || preview
                  latestTimestamp =
                    last?.timestamp ||
                    last?.created_at ||
                    last?.createdAt ||
                    latestTimestamp
                }
              }
            } catch (error) {
              // ignore
            }
          }

          return {
            ...session,
            id: sessionKey,
            session_key: sessionKey,
            sessionKey,
            message_count: Number.isFinite(Number(messageCount)) ? Number(messageCount) : 0,
            preview: preview || '',
            updated_at: latestTimestamp || session.updated_at || null,
          }
        }),
      )

      enrichedSessions.sort((a, b) => {
        const ta = new Date(a.updated_at || a.created_at || 0).getTime() || 0
        const tb = new Date(b.updated_at || b.created_at || 0).getTime() || 0
        return tb - ta
      })

      setSessions(enrichedSessions)
    } catch (error) {
      console.error('加载会话列表失败:', error)
      setSessions([])
    } finally {
      setLoading(false)
    }
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
                  {getAgentDisplayName(session.agent_id || 'main')}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {Number(session.message_count) > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {session.message_count} 条消息
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(session.session_key || session.id)}
                    disabled={deleting === (session.session_key || session.id)}
                  >
                    {deleting === (session.session_key || session.id) ? (
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
              <p className="text-xs text-muted-foreground/70 mt-2 font-mono">
                {session.session_key}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
