import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Button } from './ui/button'
import { Label } from './ui/label'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { ScrollArea } from './ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import AISettings from './AISettings'
import ChatDrawer from './ChatDrawer'
// 新的消息渲染组件
import { MessageGroup } from './chat/MessageGroup'
import { groupMessages } from './chat/messageGrouping'
import {
  CircleDot,
  MessageSquare,
  Settings,
  Loader2,
  Send,
  Bot,
  Zap,
} from 'lucide-react'
// 导入聊天样式
import './chat/chat.css'

// 🆕 使用新的服务层和工具
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { useTauriEvents } from '@/hooks/useTauriEvent'
import { useAppStore } from '@/hooks/useAppStore'

// 从session_key获取显示名称
function getSessionDisplayName(sessionKey) {
  if (!sessionKey) return '未选择会话'
  if (sessionKey === 'main' || sessionKey === 'agent:main:main') {
    return '默认助手'
  }
  // Gateway 格式: agent:{agentId}:main 或 agent:{agentId}
  if (sessionKey.startsWith('agent:')) {
    const parts = sessionKey.replace('agent:', '').split(':')
    const agentId = parts[0]
    return agentId === 'main' ? '默认助手' : `智能体-${agentId}`
  }
  return sessionKey
}

// 规范化 session_key 格式（Gateway 要求至少 3 部分）
// agent:Bot1 → agent:Bot1:main
// agent:Bot1:main → agent:Bot1:main (不变)
// main → main (不变)
function normalizeSessionKey(sessionKey) {
  if (!sessionKey) return 'main'
  if (sessionKey === 'main') return 'main'

  // 检查是否是 agent: 格式
  if (sessionKey.startsWith('agent:')) {
    const parts = sessionKey.split(':').filter(Boolean)
    // 如果只有 2 部分 (agent:id)，补全为 3 部分 (agent:id:main)
    if (parts.length === 2) {
      return `${sessionKey}:main`
    }
  }

  return sessionKey
}

// 格式化消息时间
function formatMessageTime(timestamp) {
  if (!timestamp) return ''

  const ts = parseInt(timestamp)
  // 检查时间戳是否有效（必须是正数，且不能是 1970 年）
  if (isNaN(ts) || ts <= 0) return ''

  const msgDate = new Date(ts)
  // 检查日期是否有效
  if (isNaN(msgDate.getTime())) return ''

  const today = new Date()
  const isToday = msgDate.toDateString() === today.toDateString()

  if (isToday) {
    return msgDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } else {
    return msgDate.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
}

export default function Chat({ switchToAgent }) {
  // 消息状态
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // 流式消息状态
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)

  // 🔥 智能体状态显示（思考中/使用工具/回复中）
  const [agentStatus, setAgentStatus] = useState('')

  // 流式/非流式聊天模式开关（默认开启流式）
  const [useStreaming, setUseStreaming] = useState(() => {
    try {
      const stored = localStorage.getItem('openclaw_use_streaming')
      return stored !== 'false' // 默认 true，只有明确设为 'false' 才关闭
    } catch (e) {
      return true
    }
  })

  // Gateway 会话状态
  const [gatewaySessions, setGatewaySessions] = useState([])
  // 从 localStorage 恢复上次选择的会话
  const [currentSessionKey, setCurrentSessionKey] = useState(() => {
    try {
      const stored = localStorage.getItem('openclaw_current_session')
      return stored || 'main'
    } catch (e) {
      return 'main'
    }
  })
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)

  // 配置状态
  const [showAISettings, setShowAISettings] = useState(false)
  const [config, setConfig] = useState(null)
  const [currentModel, setCurrentModel] = useState('qwen-plus')
  const [currentProvider, setCurrentProvider] = useState('qwen')

  // 创建智能体对话框
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newAgentName, setNewAgentName] = useState('')
  const [createError, setCreateError] = useState('')

  // 删除确认对话框
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTargetSession, setDeleteTargetSession] = useState(null)
  const [deleteTargetName, setDeleteTargetName] = useState('')

  // 智能体元数据（名称）
  const [agentMetadata, setAgentMetadata] = useState({})

  // 🔥 智能体名称缓存（从 Workspace 加载的真实名称）
  const [agentNames, setAgentNames] = useState({})

  // Gateway 状态
  const [gatewayStatus, setGatewayStatus] = useState(null)

  // 🔥 记忆同步状态
  const [memorySyncEnabled, setMemorySyncEnabled] = useState(() => {
    try {
      return localStorage.getItem('openclaw_memory_sync_enabled') !== 'false'
    } catch (e) {
      return true
    }
  })
  const [memoryContextEnabled, setMemoryContextEnabled] = useState(() => {
    try {
      return localStorage.getItem('openclaw_memory_context_enabled') !== 'false'
    } catch (e) {
      return true
    }
  })
  // 🔥 同步间隔（消息条数）
  const [memorySyncInterval, setMemorySyncInterval] = useState(() => {
    try {
      const stored = localStorage.getItem('openclaw_memory_sync_interval')
      return stored ? parseInt(stored, 10) : 5
    } catch (e) {
      return 5
    }
  })
  // 🔥 搜索相似度阈值 (0-1)
  const [memorySearchThreshold, setMemorySearchThreshold] = useState(() => {
    try {
      const stored = localStorage.getItem('openclaw_memory_search_threshold')
      return stored ? parseFloat(stored) : 0.3
    } catch (e) {
      return 0.3
    }
  })
  // 🔥 搜索结果数量限制
  const [memorySearchLimit, setMemorySearchLimit] = useState(() => {
    try {
      const stored = localStorage.getItem('openclaw_memory_search_limit')
      return stored ? parseInt(stored, 10) : 3
    } catch (e) {
      return 3
    }
  })
  const [lastSyncMessageCount, setLastSyncMessageCount] = useState(0)

  // 🔥 消息队列（支持连续发送多条消息）
  const [messageQueue, setMessageQueue] = useState([])
  const messageQueueRef = useRef([]) // 使用 ref 避免闭包问题

  // 🔥 未读消息计数（每个会话的未读数）
  const [unreadCounts, setUnreadCounts] = useState({})
  const unreadCountsRef = useRef({}) // 使用 ref 避免闭包问题

  // 🔥 记录当前会话是否获得焦点（已读）
  const [focusedSession, setFocusedSession] = useState(currentSessionKey)

  const messagesEndRef = useRef(null)
  const scrollAreaRef = useRef(null)  // ScrollArea 引用

  // 🔥 强制滚动到底部
  const scrollToBottom = useCallback((behavior = 'instant') => {
    // 使用 setTimeout 确保 DOM 完全渲染
    setTimeout(() => {
      // 方法1: 通过 scrollIntoView 滚动
      messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' })

      // 方法2: 直接操作 ScrollArea 的 viewport
      if (scrollAreaRef.current) {
        const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
        if (viewport) {
          viewport.scrollTop = viewport.scrollHeight
        }
      }
    }, 0)
  }, [])

  // 加载配置
  useEffect(() => {
    const loadConfig = async () => {
      // 🆕 使用统一 API 服务层
      const result = await api.config.get()
      if (result.success) {
        const cfg = result.data
        setConfig(cfg)

        // 读取当前提供商和模型
        const provider = cfg?.ai_provider?.current || 'qwen'
        setCurrentProvider(provider)

        const providerConfig = cfg?.ai_provider?.[provider]
        if (providerConfig?.custom_models && providerConfig.custom_models.length > 0) {
          setCurrentModel(providerConfig.custom_models[0])
        } else {
          setCurrentModel(providerConfig?.model || 'qwen-plus')
        }
      } else {
        console.error('加载配置失败:', result.error)
        toast.error('加载配置失败', result.error)
      }
    }
    loadConfig()
  }, [])

  // 检查 Gateway 状态
  useEffect(() => {
    const checkGateway = async () => {
      // 🆕 使用统一 API 服务层
      const result = await api.gateway.status()
      if (result.success) {
        setGatewayStatus(result.data)
      } else {
        console.error('检查 Gateway 状态失败:', result.error)
        setGatewayStatus({ running: false })
      }
    }

    checkGateway()
    const interval = setInterval(checkGateway, 30000)
    return () => clearInterval(interval)
  }, [])

  // 🔥 用于事件处理的 ref（避免闭包问题）
  const lastUsageRef = useRef(null)
  const isLoadingHistoryRef = useRef(false)
  const currentSessionKeyRef = useRef(currentSessionKey)
  const historyLoadTimeoutRef = useRef(null) // 🔥 用于 setTimeout cleanup

  // 保持 ref 同步
  useEffect(() => {
    currentSessionKeyRef.current = currentSessionKey
  }, [currentSessionKey])

  // 🔥 同步 unreadCounts 到 ref
  useEffect(() => {
    unreadCountsRef.current = unreadCounts
  }, [unreadCounts])

  // 🔥 同步 messageQueue 到 ref
  useEffect(() => {
    messageQueueRef.current = messageQueue
  }, [messageQueue])

  // 🔥 焦点变化时清空当前会话的未读数
  useEffect(() => {
    setFocusedSession(currentSessionKey)
    // 切换到某会话时，清空该会话的未读数
    if (currentSessionKey && unreadCountsRef.current[currentSessionKey] > 0) {
      setUnreadCounts(prev => ({
        ...prev,
        [currentSessionKey]: 0
      }))
    }
  }, [currentSessionKey])

  // 🔥 使用 ref 保存 messages，避免闭包问题
  const messagesRef = useRef([])
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // 🔥 组件卸载时清理 timeout
  useEffect(() => {
    return () => {
      if (historyLoadTimeoutRef.current) {
        clearTimeout(historyLoadTimeoutRef.current)
        historyLoadTimeoutRef.current = null
      }
    }
  }, [])

  // 🔥 监听外部智能体切换请求（从 SubAgentManager 跳转）
  useEffect(() => {
    if (switchToAgent) {
      const sessionKey = switchToAgent === 'main' ? 'main' : `agent:${switchToAgent}:main`
      console.log('🔄 外部切换智能体请求:', switchToAgent, '→ sessionKey:', sessionKey)
      handleSelectSession(sessionKey)
    }
  }, [switchToAgent])

  // 🔥 处理流式聊天事件
  const handleChatChunk = useCallback((event) => {
    try {
      const { content, is_last, tool_calls, usage } = event.payload

      // 🔥 保存 usage 信息
      if (usage) {
        lastUsageRef.current = usage
      }

      if (tool_calls && tool_calls.length > 0) {
        // 🔥 工具调用时更新状态
        setAgentStatus('using_tool')
        // 工具调用信息
        const toolCallContent = formatToolCallsStatic(tool_calls)
        setStreamingContent(prev => prev + toolCallContent)
      } else if (content) {
        // 🔥 收到普通内容时更新状态为回复中
        setAgentStatus('responding')
        // 普通文本内容
        setStreamingContent(prev => prev + content)
      }

      if (is_last) {
        // 🔥 优化：流式结束后，先清空流式内容，保持 isStreaming 状态
        // 等历史加载完成后再重置 isStreaming，避免过渡期显示异常
        setStreamingContent('')
        setAgentStatus('') // 🔥 清空状态

        // 🔥 清理之前的 timeout（防止重复）
        if (historyLoadTimeoutRef.current) {
          clearTimeout(historyLoadTimeoutRef.current)
        }

        // 延迟加载历史，确保后端已保存
        historyLoadTimeoutRef.current = setTimeout(async () => {
          if (isLoadingHistoryRef.current) return // 防止重复加载
          isLoadingHistoryRef.current = true

          try {
            // 刷新会话历史（从后端加载最新消息）
            await loadSessionHistory(currentSessionKeyRef.current)

            // 🔥 检查是否有待处理的消息队列
            const hasQueuedMessages = messageQueueRef.current.length > 0
            console.log('🔄 流式结束，检查队列:', hasQueuedMessages ? messageQueueRef.current.length : '无')

            // 🔥 如果队列中有消息，先处理下一条，不重置 isLoading
            if (hasQueuedMessages) {
              if (messageQueueRef.current.length > 0) {
                await processNextMessage()
              }
            } else {
              // 历史加载完成后，才重置流式状态
              setIsStreaming(false)
              setIsLoading(false)
            }

            // 重置 usage
            lastUsageRef.current = null

            // 刷新会话列表
            loadGatewaySessions()

            // 🔥 自动触发记忆同步（按配置间隔）
            if (memorySyncEnabled) {
              const currentMessageCount = messagesRef.current.length + 2 // 用户消息 + 助手回复
              if (currentMessageCount - lastSyncMessageCount >= memorySyncInterval) {
                console.log('🔄 自动触发记忆同步，消息数:', currentMessageCount)
                api.memory.sync().then(result => {
                  if (result.success && result.data?.imported > 0) {
                    console.log('✅ 记忆同步完成，导入:', result.data.imported)
                  }
                }).catch(err => {
                  console.warn('记忆同步失败（静默）:', err)
                })
                setLastSyncMessageCount(currentMessageCount)
              }
            }
          } catch (err) {
            console.error('[handleChatChunk] 加载历史失败:', err)
            // 即使失败也要重置状态，防止 UI 卡住
            setIsStreaming(false)
            setIsLoading(false)
          } finally {
            isLoadingHistoryRef.current = false
            historyLoadTimeoutRef.current = null
          }
        }, 300)
      }
    } catch (err) {
      console.error('[handleChatChunk] 处理聊天事件失败:', err)
      // 重置状态，防止 UI 卡住
      setIsStreaming(false)
      setIsLoading(false)
      setAgentStatus('')
    }
  }, [])

  // 🔥 处理智能体主动消息事件
  const handleProactiveMessage = useCallback((event) => {
    try {
      const { message, timestamp, session_key } = event.payload
      console.log('🤖 收到智能体主动消息:', message, timestamp, session_key)

      // 如果消息属于当前会话，直接添加到消息列表
      const targetSession = session_key || 'main'
      const normalizedTarget = normalizeSessionKey(targetSession)
      const normalizedCurrent = normalizeSessionKey(currentSessionKeyRef.current)

      if (normalizedTarget === normalizedCurrent) {
        // 添加主动消息到当前会话（标记为 assistant 角色并添加特殊标记）
        const proactiveMessage = {
          role: 'assistant',
          content: `💭 *智能体主动提醒*\n\n${message}`,
          timestamp: timestamp || Date.now(),
          is_proactive: true // 特殊标记，用于样式区分
        }

        setMessages(prev => [...prev, proactiveMessage])
      } else {
        // 🔥 如果不是当前会话，增加未读计数
        console.log(`📩 智能体在会话 ${targetSession} 发送了主动消息，增加未读计数`)
        setUnreadCounts(prev => ({
          ...prev,
          [normalizedTarget]: (prev[normalizedTarget] || 0) + 1
        }))
      }
    } catch (err) {
      console.error('[handleProactiveMessage] 处理主动消息失败:', err)
    }
  }, [])

  // 🔥 使用 useTauriEvents 监听事件
  useTauriEvents({
    'chat:chunk': handleChatChunk,
    'proactive-message': handleProactiveMessage,
  }, [handleChatChunk, handleProactiveMessage])

  // 🔥 监听会话更新事件（来自 SessionMemory 的删除操作）
  useEffect(() => {
    const handleSessionUpdated = async (event) => {
      try {
        const { sessionKey } = event.detail || {}
        console.log('📢 收到会话更新事件:', sessionKey)

        // 如果更新的是当前会话，刷新历史
        if (sessionKey === currentSessionKey || sessionKey === `agent:${currentSessionKey.split(':')[1]}:main`) {
          console.log('🔄 刷新当前会话历史:', currentSessionKey)
          await loadSessionHistory(currentSessionKey)
        }

        // 同时刷新会话列表
        loadGatewaySessions()
      } catch (err) {
        console.error('[handleSessionUpdated] 处理会话更新失败:', err)
      }
    }

    const handleSessionDeleted = async (event) => {
      try {
        const { sessionKey } = event.detail || {}
        console.log('📢 收到会话删除事件:', sessionKey)

        // 刷新会话列表
        loadGatewaySessions()

        // 如果删除的是当前会话，切换到默认
        if (sessionKey === currentSessionKey) {
          console.log('🔄 当前会话被删除，切换到默认')
          handleSelectSession('main')
        }
      } catch (err) {
        console.error('[handleSessionDeleted] 处理会话删除失败:', err)
      }
    }

    window.addEventListener('session-updated', handleSessionUpdated)
    window.addEventListener('session-deleted', handleSessionDeleted)

    return () => {
      window.removeEventListener('session-updated', handleSessionUpdated)
      window.removeEventListener('session-deleted', handleSessionDeleted)
    }
  }, [currentSessionKey])

  // 🔥 监听记忆设置变更
  useEffect(() => {
    const handleMemorySettingsChanged = (event) => {
      const { memorySyncEnabled, memoryContextEnabled, memorySyncInterval, memorySearchThreshold, memorySearchLimit } = event.detail || {}
      if (memorySyncEnabled !== undefined) {
        setMemorySyncEnabled(memorySyncEnabled)
      }
      if (memoryContextEnabled !== undefined) {
        setMemoryContextEnabled(memoryContextEnabled)
      }
      if (memorySyncInterval !== undefined) {
        setMemorySyncInterval(memorySyncInterval)
      }
      if (memorySearchThreshold !== undefined) {
        setMemorySearchThreshold(memorySearchThreshold)
      }
      if (memorySearchLimit !== undefined) {
        setMemorySearchLimit(memorySearchLimit)
      }
      console.log('📝 记忆设置已更新:', { memorySyncEnabled, memoryContextEnabled, memorySyncInterval, memorySearchThreshold, memorySearchLimit })
    }

    window.addEventListener('memory-settings-changed', handleMemorySettingsChanged)

    return () => {
      window.removeEventListener('memory-settings-changed', handleMemorySettingsChanged)
    }
  }, [])

  // 静态版本的格式化工具调用（在 useEffect 中使用）
  const formatToolCallsStatic = (toolCalls) => {
    let content = '**正在调用工具...**\n\n'
    for (const toolCall of toolCalls) {
      // 🔧 兼容两种格式：
      // 1. ToolCall 格式：{ name, arguments }
      // 2. ToolCallDelta 格式（流式）：{ function: { name, arguments } }
      const name = toolCall.name || toolCall.function?.name || 'unknown'
      const rawArgs = toolCall.arguments || toolCall.function?.arguments || '{}'

      content += `**工具**: \`${name}\`\n\n`
      try {
        const args = typeof rawArgs === 'string'
          ? JSON.parse(rawArgs)
          : rawArgs
        content += `**参数**:\n\`\`\`json\n${JSON.stringify(args, null, 2)}\n\`\`\`\n\n`
      } catch {
        content += `**参数**: ${rawArgs}\n\n`
      }
    }
    content += '*工具执行中...*\n\n'
    return content
  }

  // 加载 Gateway 会话列表
  const loadGatewaySessions = async () => {
    try {
      setIsLoadingSessions(true)
      // 🆕 使用统一 API 服务层
      const result = await api.sessions.list()
      if (result.success) {
        // 🔥 按智能体去重：每个智能体只显示一个条目（优先显示 main 会话）
        const agentMap = new Map()

        console.log('📋 原始会话列表:', result.data)

        for (const session of result.data) {
          // 🔥 严格过滤掉重复的默认助手：main, agent:main, agent:main:main
          if (session.session_key === 'main' ||
              session.session_key === 'agent:main' ||
              session.session_key === 'agent:main:main') {
            // 如果没有 main 会话记录，保存 main；否则跳过
            if (!agentMap.has('main')) {
              agentMap.set('main', { ...session, session_key: 'main' })
            }
            continue
          }

          // 解析其他智能体的 agent_id
          let agentId = 'main'
          if (session.session_key.startsWith('agent:')) {
            const parts = session.session_key.replace('agent:', '').split(':')
            agentId = parts[0] || 'main'
          }

          // 如果该智能体还没有记录，或者当前会话是 main 会话，则使用此会话
          if (!agentMap.has(agentId) || session.session_key.endsWith(':main')) {
            agentMap.set(agentId, session)
          }
        }

        const uniqueSessions = Array.from(agentMap.values())
        // 🔥 排序：main 智能体在最上面，其他按创建顺序
        uniqueSessions.sort((a, b) => {
          if (a.session_key === 'main') return -1
          if (b.session_key === 'main') return 1
          return 0
        })
        setGatewaySessions(uniqueSessions)
        console.log('加载 Gateway 会话（去重后）:', uniqueSessions.length, '个')

        // 🔥 加载所有智能体的名称缓存
        await loadAgentNames(uniqueSessions)
      } else {
        console.error('加载 Gateway 会话失败:', result.error)
        setGatewaySessions([])
      }
    } catch (err) {
      console.error('[loadGatewaySessions] 加载会话列表失败:', err)
      setGatewaySessions([])
    } finally {
      setIsLoadingSessions(false)
    }
  }

  // 🔥 批量加载智能体名称到缓存
  const loadAgentNames = async (sessions) => {
    try {
      const names = {}

      // 🔥 修复：main 智能体也应该从 Workspace 加载名称，而不是从 localStorage
      // 先尝试从 Workspace 加载 main 的名称
      try {
        const mainResult = await api.workspace.load('main')
        if (mainResult.success && mainResult.data?.identity?.name) {
          names['main'] = mainResult.data.identity.name
        }
      } catch (e) {
        console.warn('[loadAgentNames] 加载 main 智能体名称失败:', e)
      }

      // 并行加载所有自定义智能体的名称（每个 promise 独立 try-catch）
      const loadPromises = sessions.map(async (session) => {
        try {
          const sessionKey = session.session_key
          if (!sessionKey || sessionKey === 'main') return

          // 从 sessionKey 提取 agentId
          let agentId = null
          if (sessionKey.startsWith('agent:')) {
            const parts = sessionKey.replace('agent:', '').split(':')
            agentId = parts[0]
          }

          if (!agentId || agentId === 'main') return

          // 🆕 使用统一 API 服务层
          const result = await api.workspace.load(agentId)
          if (result.success && result.data?.identity?.name) {
            names[sessionKey] = result.data.identity.name
          }
        } catch (err) {
          // 单个加载失败不影响其他
          console.warn('[loadAgentNames] 加载智能体名称失败:', err)
        }
      })

      await Promise.all(loadPromises)
      setAgentNames(names)
      console.log('🔥 已加载智能体名称缓存:', names)
    } catch (err) {
      console.error('[loadAgentNames] 批量加载失败:', err)
    }
  }

  // 初始加载会话和历史消息
  useEffect(() => {
    loadGatewaySessions()
    loadAgentMetadata()
    // 加载上次选择的会话历史（如果有的话）
    const savedSession = localStorage.getItem('openclaw_current_session') || 'main'
    loadSessionHistory(savedSession)
  }, [])

  // 加载会话历史
  const loadSessionHistory = async (sessionKey) => {
    try {
      const normalizedKey = normalizeSessionKey(sessionKey)
      // 🆕 使用统一 API 服务层
      const result = await api.sessions.getMessages(normalizedKey)
      if (result.success) {
        const formattedMessages = result.data.map(msg => {
          // 解析时间戳，可能是字符串或数字
          let ts = null
          if (msg.timestamp) {
            const parsed = parseInt(msg.timestamp)
            // 只有当时间戳是有效的正数时才使用
            if (!isNaN(parsed) && parsed > 0) {
              ts = parsed
            }
          }
          return {
            role: msg.role,
            content: msg.content,
            timestamp: ts,
            usage: msg.usage || null  // 🔥 包含 token 使用量
          }
        })
        setMessages(formattedMessages)
        // 🔥 消息加载完成后滚动到底部
        setTimeout(() => scrollToBottom('instant'), 100)
        // 🔥 调试：打印每条消息的 usage 信息
        console.log('加载会话历史:', sessionKey, formattedMessages.length, '条消息')
        formattedMessages.forEach((msg, idx) => {
          if (msg.usage) {
            console.log(`  消息[${idx}] ${msg.role}: ${msg.usage.total_tokens} tokens`)
          }
        })
      } else {
        console.log('会话暂无历史消息:', sessionKey, result.error)
        setMessages([])
      }
    } catch (err) {
      console.error('[loadSessionHistory] 加载失败:', err)
      // 发生错误时设置空消息，防止 UI 崩溃
      setMessages([])
    }
  }

  // 加载智能体元数据（仅保留 provider/model 配置，名称从 Workspace 读取）
  const loadAgentMetadata = () => {
    try {
      const stored = localStorage.getItem('agent_model_config')
      if (stored) {
        setAgentMetadata(JSON.parse(stored))
      }
    } catch (e) {
      console.error('加载智能体配置失败:', e)
    }
  }

  // 保存智能体配置（仅 provider/model）
  const saveAgentModelConfig = (sessionKey, provider, model) => {
    const existingMeta = agentMetadata[sessionKey] || {}
    const newMetadata = {
      ...agentMetadata,
      [sessionKey]: {
        ...existingMeta,
        updatedAt: Date.now(),
        ...(provider !== undefined && { provider }),
        ...(model !== undefined && { model }),
      }
    }
    setAgentMetadata(newMetadata)
    localStorage.setItem('agent_model_config', JSON.stringify(newMetadata))
  }

  // 保存当前智能体的模型配置
  const saveCurrentAgentModel = (provider, model) => {
    saveAgentModelConfig(currentSessionKey, provider, model)
  }

  // 删除智能体配置
  const deleteAgentMetadata = (sessionKey) => {
    const newMetadata = { ...agentMetadata }
    delete newMetadata[sessionKey]
    setAgentMetadata(newMetadata)
    localStorage.setItem('agent_model_config', JSON.stringify(newMetadata))
  }

  // 更新智能体元数据（名称保存到 Workspace，其他保存到 localStorage）
  const updateAgentMetadata = async (sessionKey, name, color, avatar) => {
    // 从 sessionKey 提取 agentId
    let agentId = 'main'
    if (sessionKey && sessionKey.startsWith('agent:')) {
      const parts = sessionKey.replace('agent:', '').split(':')
      agentId = parts[0] || 'main'
    }

    // 名称保存到 Workspace
    if (name !== null && name !== undefined) {
      const result = await api.identity.update(agentId, name, color || '🤖', avatar, null)
      if (result.success) {
        console.log('智能体名称已保存到 Workspace:', name)
      } else {
        console.error('保存智能体名称失败:', result.error)
        toast.error('保存失败', result.error)
      }
    }

    // 颜色和头像保存到 localStorage（如果需要）
    if (color !== undefined || avatar !== undefined) {
      const existingMeta = agentMetadata[sessionKey] || {}
      const newMetadata = {
        ...agentMetadata,
        [sessionKey]: {
          ...existingMeta,
          updatedAt: Date.now(),
          ...(color !== undefined && { color }),
          ...(avatar !== undefined && { avatar }),
        }
      }
      setAgentMetadata(newMetadata)
      localStorage.setItem('agent_model_config', JSON.stringify(newMetadata))
    }
  }

  // 获取智能体显示名称（从 Workspace 读取）
  const getAgentDisplayName = async (sessionKey) => {
    // 从 sessionKey 提取 agentId
    let agentId = 'main'
    if (sessionKey && sessionKey.startsWith('agent:')) {
      const parts = sessionKey.replace('agent:', '').split(':')
      agentId = parts[0] || 'main'
    }

    // 🆕 使用统一 API 服务层从 Workspace 读取名称
    const result = await api.workspace.load(agentId)
    if (result.success && result.data?.identity?.name) {
      return result.data.identity.name
    }

    // 回退到默认名称
    return agentId === 'main' ? '小助手' : `智能体-${agentId}`
  }

  // 🔥 同步版本（优先使用名称缓存）
  const getAgentDisplayNameSync = (sessionKey) => {
    // 优先使用缓存的真实名称
    if (agentNames[sessionKey]) {
      return agentNames[sessionKey]
    }

    // 回退到默认值
    let agentId = 'main'
    if (sessionKey && sessionKey.startsWith('agent:')) {
      const parts = sessionKey.replace('agent:', '').split(':')
      agentId = parts[0] || 'main'
    }
    return agentId === 'main' ? '小助手' : `智能体-${agentId.slice(0, 6)}`
  }

  // 🔥 自动滚动到底部（消息变化时）
  useEffect(() => {
    if (messages.length > 0) {
      // 使用 setTimeout 确保 DOM 渲染完成后再滚动
      const timer = setTimeout(() => {
        scrollToBottom('instant')
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [messages, scrollToBottom])

  // 🔥 流式输出时实时滚动到底部
  useEffect(() => {
    if (isStreaming && streamingContent) {
      // 使用 requestAnimationFrame 确保在下一帧渲染时滚动，性能更好
      const rafId = requestAnimationFrame(() => {
        scrollToBottom('instant')
      })
      return () => cancelAnimationFrame(rafId)
    }
  }, [streamingContent, isStreaming, scrollToBottom])

  // 切换会话
  const handleSelectSession = async (sessionKey) => {
    // 🔥 移除 isLoading 检查，允许随时切换会话
    if (sessionKey === currentSessionKey) {
      // 即使是相同会话，也清空未读数
      setUnreadCounts(prev => ({
        ...prev,
        [sessionKey]: 0
      }))
      return
    }

    try {
      console.log('切换到会话:', sessionKey)
      setCurrentSessionKey(sessionKey)
      // 持久化会话选择到 localStorage
      localStorage.setItem('openclaw_current_session', sessionKey)
      setMessages([])

      // 🔥 清空该会话的未读计数
      setUnreadCounts(prev => ({
        ...prev,
        [sessionKey]: 0
      }))

      // 恢复该智能体的模型配置
      const meta = agentMetadata[sessionKey]
      if (meta?.provider && meta?.model) {
        setCurrentProvider(meta.provider)
        setCurrentModel(meta.model)
      } else {
        // 没有配置则使用默认
        const provider = config?.ai_provider?.current || 'qwen'
        setCurrentProvider(provider)
        const providerConfig = config?.ai_provider?.[provider]
        if (providerConfig?.custom_models && providerConfig.custom_models.length > 0) {
          setCurrentModel(providerConfig.custom_models[0])
        } else {
          setCurrentModel(providerConfig?.model || 'qwen-plus')
        }
      }

      // 加载会话历史
      await loadSessionHistory(sessionKey)
    } catch (err) {
      console.error('[handleSelectSession] 切换会话失败:', err)
    }
  }

  // 创建新智能体
  const handleCreateSession = async () => {
    // 清除之前的错误
    setCreateError('')

    // 🔥 只验证名称，不再要求输入 ID
    if (!newAgentName.trim()) {
      setCreateError('请输入智能体名称')
      return
    }

    const displayName = newAgentName.trim()

    setIsLoading(true)
    try {
      // 🔥 使用 agent_create 命令创建智能体（会自动注册到注册表并创建 workspace）
      console.log('🚀 创建新智能体, 名称:', displayName)

      // 🆕 使用统一 API 服务层
      const createResult = await api.agents.create({
        name: displayName,
        workspace: null, // 使用默认路径
        emoji: '🤖',
        avatar: null
      })

      console.log('✅ 智能体创建成功:', createResult.data)

      // 🔥 使用后端返回的真实 agent_id
      const realAgentId = createResult.data?.agent_id
      if (!realAgentId) {
        throw new Error('创建智能体失败：未返回 agent_id')
      }

      // 🔥 使用真实的 agent_id 构建 sessionKey
      const sessionKey = `agent:${realAgentId}:main`
      console.log('🔑 使用真实的 agent_id:', realAgentId, ', sessionKey:', sessionKey)

      // 🔥 创建默认会话（确保会话文件存在）
      console.log('📝 创建默认会话...')
      const sessionResult = await api.sessions.create(realAgentId, 'main')
      if (!sessionResult.success) {
        console.warn('创建默认会话失败:', sessionResult.error)
      } else {
        console.log('✅ 默认会话创建成功')
      }

      // 🔥 智能体名称已通过 IDENTITY.md 存储，无需发送自我介绍消息

      // 🔥 立即更新名称缓存
      setAgentNames(prev => ({
        ...prev,
        [sessionKey]: displayName
      }))

      setShowCreateDialog(false)
      setNewAgentName('')

      // 刷新会话列表
      await loadGatewaySessions()

      // 🔥 切换到新创建的会话
      setCurrentSessionKey(sessionKey)
      localStorage.setItem('openclaw_current_session', sessionKey)

      console.log('✅ 创建智能体成功')
    } catch (error) {
      console.error('创建智能体失败:', error)
      setCreateError('创建失败: ' + error)
    } finally {
      setIsLoading(false)
    }
  }

  // 删除智能体 - 显示确认对话框
  const handleDeleteSession = (sessionKey) => {
    console.log('🗑️ 尝试删除智能体:', sessionKey)

    if (sessionKey === 'main') {
      // 使用自定义提示而不是 alert
      return
    }

    const displayName = getAgentDisplayNameSync(sessionKey)
    setDeleteTargetSession(sessionKey)
    setDeleteTargetName(displayName)
    setShowDeleteConfirm(true)
  }

  // 确认删除
  const confirmDelete = async () => {
    if (!deleteTargetSession) return

    setShowDeleteConfirm(false)
    setIsLoading(true)

    // 🔥 从 sessionKey 提取 agentId
    let agentId = 'main'
    if (deleteTargetSession.startsWith('agent:')) {
      const parts = deleteTargetSession.replace('agent:', '').split(':')
      agentId = parts[0] || 'main'
    }

    console.log('🗑️ 删除智能体, sessionKey:', deleteTargetSession, ', agentId:', agentId)

    try {
      // 🔥 delete_gateway_session 会删除整个智能体目录（包括所有会话和 Workspace）
      const deleteResult = await api.sessions.delete(deleteTargetSession)
      if (!deleteResult.success) {
        console.error('删除智能体失败:', deleteResult.error)
        alert('删除失败: ' + deleteResult.error)
        setIsLoading(false)
        return
      }

      console.log('✅ 智能体删除成功')

      // 🔥 同时从智能体管理列表中删除（这样就不需要再手动删第二次了）
      if (agentId !== 'main') {
        try {
          await api.agents.delete(agentId)
          console.log('✅ 智能体从管理列表中删除成功')
        } catch (agentDeleteErr) {
          console.warn('从管理列表删除失败（可能已被删除）:', agentDeleteErr)
        }
      }

      // 🔥 清理所有缓存
      deleteAgentMetadata(deleteTargetSession)
      setAgentNames(prev => {
        const newNames = { ...prev }
        delete newNames[deleteTargetSession]
        return newNames
      })

      await loadGatewaySessions()

      // 如果删除的是当前会话，切换回默认
      if (deleteTargetSession === currentSessionKey) {
        handleSelectSession('main')
      }

      console.log('✅ 智能体删除完成')
    } catch (err) {
      console.error('删除智能体失败:', err)
    }

    setIsLoading(false)
    setDeleteTargetSession(null)
    setDeleteTargetName('')
  }

  // 🔥 处理消息队列中的下一条消息
  const processNextMessage = useCallback(async () => {
    const queue = messageQueueRef.current
    if (queue.length === 0) {
      setIsLoading(false)
      setIsStreaming(false)
      setAgentStatus('')
      return
    }

    // 取出一条消息
    const nextMessage = queue[0]
    const remainingQueue = queue.slice(1)

    // 更新队列
    messageQueueRef.current = remainingQueue
    setMessageQueue(remainingQueue)

    console.log('⏳ 处理队列中的下一条消息，剩余:', remainingQueue.length)

    // 执行发送
    await executeSendMessage(nextMessage.input, nextMessage.sessionKey, nextMessage.provider, nextMessage.model, true)
  }, [])

  // 🔥 实际执行发送消息的逻辑
  const executeSendMessage = async (inputText, sessionKey, provider, model, isFromQueue = false) => {
    const normalizedSessionKey = normalizeSessionKey(sessionKey)

    // 🔥 记忆上下文增强：搜索相关记忆
    let memoryContext = null
    if (memoryContextEnabled) {
      try {
        const searchResult = await api.memory.searchGateway(inputText, memorySearchLimit)
        if (searchResult.success && searchResult.data?.results?.length > 0) {
          const filteredResults = searchResult.data.results.filter(r => {
            const score = r.score || 0
            return score >= memorySearchThreshold
          })
          memoryContext = filteredResults
            .map(r => r.snippet || r.content)
            .filter(Boolean)
            .slice(0, memorySearchLimit)
            .join('\n\n---\n\n')
        }
      } catch (err) {
        console.warn('记忆搜索失败（静默）:', err)
      }
    }

    const enhancedMessage = memoryContext
      ? `[相关记忆上下文]\n${memoryContext}\n\n[用户问题]\n${inputText}`
      : inputText

    if (useStreaming) {
      // 流式聊天模式
      console.log('🚀 发送流式消息到 Gateway, session_key:', sessionKey, '→ normalized:', normalizedSessionKey, 'provider:', provider, 'model:', model)
      const result = await api.chat.sendStream({
        message: enhancedMessage,
        sessionKey: normalizedSessionKey,
        provider: provider,
        model: model
      })
      if (!result.success) {
        const errorMessage = result.error || '未知错误'
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `**抱歉，执行任务时遇到了问题：**\n\n\`\`\`\n${errorMessage}\n\`\`\`\n\n**建议**:\n1. 检查 Gateway 是否运行\n2. 检查设置中的 API Key 配置\n3. 尝试切换其他 AI 提供商`,
          timestamp: Date.now()
        }])
        // 消息处理完成，继续处理队列
        if (messageQueueRef.current.length > 0) {
          await processNextMessage()
        } else {
          setIsLoading(false)
          setIsStreaming(false)
          setAgentStatus('')
        }
      }
    } else {
      // 非流式聊天模式
      console.log('📨 发送非流式消息到 Gateway, session_key:', sessionKey, '→ normalized:', normalizedSessionKey, 'provider:', provider, 'model:', model)
      const result = await api.chat.send({
        message: enhancedMessage,
        sessionKey: normalizedSessionKey,
        provider: provider,
        model: model
      })

      if (result.success && result.data && result.data.length > 0) {
        const assistantMessage = result.data[0]
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: assistantMessage.content || '',
          timestamp: Date.now(),
          usage: assistantMessage.usage || null
        }])

        // 自动触发记忆同步
        if (memorySyncEnabled) {
          const currentMessageCount = messagesRef.current.length + 1
          if (currentMessageCount - lastSyncMessageCount >= memorySyncInterval) {
            api.memory.sync().catch(err => console.warn('记忆同步失败（静默）:', err))
            setLastSyncMessageCount(currentMessageCount)
          }
        }
      }
      // 消息处理完成，继续处理队列
      if (messageQueueRef.current.length > 0) {
        await processNextMessage()
      } else {
        setIsLoading(false)
        setAgentStatus('')
      }
    }
  }

  // 🔥 发送消息（支持队列和连续发送）
  const sendMessage = async () => {
    const inputText = input.trim()
    if (!inputText) return

    // 如果正在处理消息，加入队列
    if (isLoading) {
      console.log('⏳ 消息加入队列，当前队列长度:', messageQueueRef.current.length + 1)
      const queuedMessage = {
        input: inputText,
        sessionKey: currentSessionKey,
        provider: currentProvider,
        model: currentModel
      }
      messageQueueRef.current = [...messageQueueRef.current, queuedMessage]
      setMessageQueue([...messageQueueRef.current])
      setInput('')
      return
    }

    // 添加用户消息到界面
    const userMessage = { role: 'user', content: inputText, timestamp: Date.now() }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setAgentStatus('thinking')

    if (useStreaming) {
      setIsStreaming(true)
      setStreamingContent('')
    }

    // 检查 Gateway 状态
    if (!gatewayStatus?.running || !gatewayStatus?.websocket_connected) {
      const reason = !gatewayStatus?.running ? 'Gateway 未运行' : 'Gateway WebSocket 未连接'
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `**Gateway 不可用**: ${reason}\n\n请先点击左侧"启动 Gateway"按钮。`,
        timestamp: Date.now()
      }])
      setIsLoading(false)
      setIsStreaming(false)
      setAgentStatus('')
      return
    }

    // 执行发送
    await executeSendMessage(inputText, currentSessionKey, currentProvider, currentModel)
  }

  // 格式化工具调用显示
  const formatToolCalls = (toolCalls) => {
    let content = '**正在调用工具...**\n\n'
    for (const toolCall of toolCalls) {
      // 🔧 兼容两种格式：
      // 1. ToolCall 格式：{ name, arguments }
      // 2. ToolCallDelta 格式（流式）：{ function: { name, arguments } }
      const name = toolCall.name || toolCall.function?.name || 'unknown'
      const rawArgs = toolCall.arguments || toolCall.function?.arguments || '{}'

      content += `**工具**: \`${name}\`\n\n`
      try {
        const args = typeof rawArgs === 'string'
          ? JSON.parse(rawArgs)
          : rawArgs
        content += `**参数**:\n\`\`\`json\n${JSON.stringify(args, null, 2)}\n\`\`\`\n\n`
      } catch {
        content += `**参数**: ${rawArgs}\n\n`
      }
    }
    content += '*工具执行中...*'
    return content
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // 提供商显示信息
  const providerInfo = {
    qwen: { name: '通义千问', color: 'text-orange-500', bgColor: 'bg-orange-500' },
    deepseek: { name: 'DeepSeek', color: 'text-blue-500', bgColor: 'bg-blue-500' },
    ernie: { name: '文心一言', color: 'text-red-500', bgColor: 'bg-red-500' },
    zhipu: { name: '智谱 GLM', color: 'text-purple-500', bgColor: 'bg-purple-500' },
    moonshot: { name: '月之暗面', color: 'text-indigo-500', bgColor: 'bg-indigo-500' },
    doubao: { name: '豆包', color: 'text-amber-500', bgColor: 'bg-amber-500' },
    openai: { name: 'OpenAI', color: 'text-green-500', bgColor: 'bg-green-500' },
    anthropic: { name: 'Anthropic', color: 'text-rose-500', bgColor: 'bg-rose-500' },
    google: { name: 'Google', color: 'text-sky-500', bgColor: 'bg-sky-500' },
  }

  // 获取已启用的提供商列表
  const getEnabledProviders = () => {
    if (!config?.ai_provider) return []
    const providers = []
    for (const [id, cfg] of Object.entries(config.ai_provider)) {
      if (id === 'current' || id === 'embedding') continue
      if (cfg?.enabled && cfg?.api_key) {
        providers.push({
          id,
          name: providerInfo[id]?.name || id,
          color: providerInfo[id]?.color || 'text-gray-500',
          bgColor: providerInfo[id]?.bgColor || 'bg-gray-500',
          models: cfg.custom_models || (cfg.model ? [cfg.model] : [])
        })
      }
    }
    return providers
  }

  // 获取当前提供商的所有模型
  const getAvailableModels = () => {
    if (!config?.ai_provider?.[currentProvider]) return []
    const providerConfig = config.ai_provider[currentProvider]
    return providerConfig.custom_models || (providerConfig.model ? [providerConfig.model] : [])
  }

  const enabledProviders = getEnabledProviders()
  const availableModels = getAvailableModels()
  const currentProviderInfo = providerInfo[currentProvider] || { name: currentProvider, color: 'text-gray-500' }

  return (
    <div className="h-full flex flex-col bg-surface">
      {/* 主内容区域 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧控制面板 */}
        <ChatDrawer
          gatewaySessions={gatewaySessions}
          currentSessionKey={currentSessionKey}
          onSelectSession={handleSelectSession}
          onCreateSession={() => setShowCreateDialog(true)}
          onDeleteSession={handleDeleteSession}
          onUpdateMetadata={updateAgentMetadata}
          isLoading={isLoadingSessions}
          agentMetadata={agentMetadata}
          agentNames={agentNames}
          unreadCounts={unreadCounts}
        />

        {/* 主聊天区域 */}
        <div className="flex-1 flex flex-col bg-background min-w-0 overflow-hidden">
          {/* 顶部工具栏 - 与 Sidebar/ChatDrawer 高度对齐 */}
          <div className="flex-shrink-0 h-14 md:h-16 flex items-center px-2 sm:px-3 md:px-4 border-b border-border">
            <div className="flex items-center justify-between gap-1.5 sm:gap-2">
              {/* 左侧：智能体 + 模型选择 */}
              <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                {/* 当前智能体 */}
                <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
                  <Bot className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                  <span className="font-semibold text-sm md:text-base truncate max-w-[100px] md:max-w-[200px]">
                    {getAgentDisplayNameSync(currentSessionKey)}
                  </span>
                </div>

                <span className="text-border hidden sm:block">|</span>

                {/* 提供商选择 */}
                <Select
                  value={currentProvider}
                  onValueChange={(value) => {
                    setCurrentProvider(value)
                    const providerConfig = config?.ai_provider?.[value]
                    let newModel = ''
                    if (providerConfig?.custom_models && providerConfig.custom_models.length > 0) {
                      newModel = providerConfig.custom_models[0]
                    } else {
                      newModel = providerConfig?.model || ''
                    }
                    setCurrentModel(newModel)
                    saveCurrentAgentModel(value, newModel)
                  }}
                >
                  <SelectTrigger className="w-[90px] md:w-[120px] h-7 md:h-8 text-xs md:text-sm">
                    <SelectValue placeholder="提供商" />
                  </SelectTrigger>
                  <SelectContent>
                    {enabledProviders.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${p.bgColor}`} />
                          <span>{p.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                    {enabledProviders.length === 0 && (
                      <SelectItem value="_none" disabled>请先配置</SelectItem>
                    )}
                  </SelectContent>
                </Select>

                {/* 模型选择 - 中等屏幕以上显示 */}
                <Select
                  value={currentModel}
                  onValueChange={(value) => {
                    setCurrentModel(value)
                    saveCurrentAgentModel(currentProvider, value)
                  }}
                  disabled={availableModels.length <= 1}
                >
                  <SelectTrigger className="hidden sm:flex w-[130px] md:w-[150px] h-7 md:h-8 text-xs md:text-sm font-mono">
                    <SelectValue placeholder="模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* 流式模式开关 - 大屏幕显示 */}
                <button
                  onClick={() => {
                    const newValue = !useStreaming
                    setUseStreaming(newValue)
                    localStorage.setItem('openclaw_use_streaming', String(newValue))
                  }}
                  className={`hidden md:flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                    useStreaming
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-foreground-secondary hover:bg-muted/80'
                  }`}
                  title={useStreaming ? '当前：流式输出（逐字显示）' : '当前：非流式输出（一次性显示）'}
                >
                  <Zap className={`w-3.5 h-3.5 ${useStreaming ? 'text-primary' : ''}`} />
                  {useStreaming ? '流式' : '标准'}
                </button>
              </div>

              {/* 设置按钮 */}
              <Button
                onClick={() => setShowAISettings(true)}
                variant="ghost"
                size="sm"
                className="h-7 md:h-8 px-2 md:px-3"
              >
                <Settings className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">模型设置</span>
              </Button>
            </div>
          </div>

          {/* 欢迎界面 */}
          {messages.length === 0 && (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-center">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-surface-elevated flex items-center justify-center mb-4 md:mb-6 mx-auto">
                  <MessageSquare className="w-8 h-8 md:w-10 md:h-10 text-foreground-secondary" />
                </div>
                <div className="text-lg md:text-xl font-semibold mb-2 text-foreground px-4">
                  与「{getAgentDisplayNameSync(currentSessionKey)}」开始对话
                </div>
                <div className="text-sm text-foreground-secondary px-4">
                  输入你的问题，AI 助手会为你解答
                </div>
              </div>
            </div>
          )}

          {/* 消息区域 */}
          {messages.length > 0 && (() => {
            // 计算消息分组
            const groupedMessages = groupMessages(messages)
            const lastGroup = groupedMessages[groupedMessages.length - 1]
            const agentName = getAgentDisplayNameSync(currentSessionKey)

            return (
              <ScrollArea ref={scrollAreaRef} className="flex-1 p-2 sm:p-3 md:p-4 lg:p-5 xl:p-6">
                <div className="w-full max-w-full mx-auto px-1 sm:px-2 md:px-3">
                  {/* 使用分组后的消息渲染 */}
                  {groupedMessages.map((group, idx) => (
                    <MessageGroup
                      key={group.id}
                      group={group}
                      agentName={agentName}
                      isStreaming={isStreaming && idx === groupedMessages.length - 1 && group.role === 'assistant'}
                      streamingContent={isStreaming && idx === groupedMessages.length - 1 && group.role === 'assistant' ? streamingContent : ''}
                    />
                  ))}

                  {/* 流式输出内容（单独显示，最后一组不是 assistant 时） */}
                  {isStreaming && streamingContent && messages.length > 0 && messages[messages.length - 1]?.role !== 'assistant' && (
                    <MessageGroup
                      key="streaming"
                      group={{
                        id: 'streaming',
                        role: 'assistant',
                        messages: [],
                        firstTime: Date.now(),
                        lastTime: Date.now()
                      }}
                      agentName={agentName}
                      isStreaming={true}
                      streamingContent={streamingContent}
                    />
                  )}

                  {/* 🔥 加载状态（流式和非流式通用）- 显示动态状态 */}
                  {isLoading && (
                    <div className="message-group message-group--assistant">
                      <div className="message-group__avatar">
                        <div className="chat-avatar assistant">
                          <Bot className="w-5 h-5" />
                        </div>
                      </div>
                      <div className="message-group__content">
                        <div className="message-bubble">
                          <div className="flex items-center gap-2">
                            <div className="streaming-indicator">
                              <span></span>
                              <span></span>
                              <span></span>
                            </div>
                            <span className="text-sm text-foreground-secondary">
                              {agentStatus === 'using_tool' && '正在使用工具...'}
                              {agentStatus === 'responding' && '正在回复...'}
                              {agentStatus === 'thinking' && '正在思考...'}
                              {!agentStatus && '处理中...'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div ref={messagesEndRef} />
              </ScrollArea>
            )
          })()}

          {/* 输入区域 - 与 Sidebar/ChatDrawer 高度对齐 */}
          <div className="min-h-14 md:min-h-16 flex items-center px-2 sm:px-3 md:px-4 border-t border-border">
            <div className="flex gap-2 sm:gap-2.5 md:gap-3 items-end w-full max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="输入消息... (Shift+Enter 换行)"
                className="flex-1 resize-none min-h-[36px] sm:min-h-[40px] md:min-h-[44px] max-h-[120px] sm:max-h-[150px] md:max-h-[200px] text-sm md:text-base"
                rows={1}
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="h-9 sm:h-10 md:h-11 px-2.5 sm:px-3 md:px-4"
              >
                <Send className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">发送</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* AI 设置弹窗 */}
      {showAISettings && (
        <AISettings
          onClose={() => setShowAISettings(false)}
          onConfigSaved={async () => {
            setShowAISettings(false)
            // 重新加载配置
            const result = await api.config.get()
            if (result.success) {
              const cfg = result.data
              setConfig(cfg)
              const provider = cfg?.ai_provider?.current || 'qwen'
              setCurrentProvider(provider)
              const providerConfig = cfg?.ai_provider?.[provider]
              if (providerConfig?.custom_models && providerConfig.custom_models.length > 0) {
                setCurrentModel(providerConfig.custom_models[0])
              } else {
                setCurrentModel(providerConfig?.model || 'qwen-plus')
              }
            }
          }}
        />
      )}

      {/* 创建智能体对话框 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建新智能体</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>智能体名称 <span className="text-destructive">*</span></Label>
              <Input
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                placeholder="例如：代码助手、翻译专家"
              />
              <p className="text-xs text-foreground-tertiary">
                给智能体起个好记的名字，ID 会根据名称自动生成
              </p>
            </div>
            <div className="text-sm text-foreground-secondary">
              <p>每个智能体拥有独立的对话上下文</p>
              <p>可以用于不同场景的 AI 对话</p>
            </div>
            {/* 错误提示 */}
            {createError && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {createError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateDialog(false)
              setNewAgentName('')
              setCreateError('')
            }}>
              取消
            </Button>
            <Button onClick={handleCreateSession} disabled={!newAgentName.trim() || isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  创建中...
                </>
              ) : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-foreground">
              确定要删除智能体 <strong>"{deleteTargetName}"</strong> 吗？
            </p>
            <p className="text-sm text-foreground-secondary mt-2">
              删除后对话历史将无法恢复。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowDeleteConfirm(false)
              setDeleteTargetSession(null)
              setDeleteTargetName('')
            }}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
