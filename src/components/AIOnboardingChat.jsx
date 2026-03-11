import React, { useState, useRef, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { Textarea } from './ui/textarea'
import {
  Loader2,
  Send,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  Bot,
  User,
  Edit3,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import api from '@/lib/api'
import {
  ONBOARDING_SYSTEM_PROMPT,
  QUICK_OPTIONS,
  parseConfigFromResponse,
  validateConfig,
  generateFullSoul,
  generateFullAgents,
  generateFullUser,
  generateFullIdentity,
} from './onboarding-prompts'

// 消息组件
function ChatMessage({ message }) {
  const isUser = message.role === 'user'

  // 解析消息中的快速选项
  const renderContent = () => {
    let content = message.content

    // 处理代码块（配置预览）
    if (content.includes('```agent-config') || content.includes('```json')) {
      const parts = content.split(/(```(?:agent-config|json)[\s\S]*?```)/g)
      return parts.map((part, index) => {
        if (part.startsWith('```')) {
          // 隐藏 JSON 代码块，配置会单独展示
          return null
        }
        return <span key={index}>{part}</span>
      })
    }

    return content
  }

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-primary text-white' : 'bg-primary/10 text-primary'
        }`}
      >
        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
      </div>
      <div
        className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
          isUser
            ? 'bg-primary text-white rounded-tr-none'
            : 'bg-muted rounded-tl-none'
        }`}
      >
        <div className="whitespace-pre-wrap leading-relaxed">{renderContent()}</div>
      </div>
    </div>
  )
}

// 配置预览组件
function ConfigPreview({ config, userName, onEdit, onConfirm, onRegenerate, isRegenerating }) {
  const [expanded, setExpanded] = useState(false)

  if (!config) return null

  const validation = validateConfig(config)

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{config.identity?.emoji || '🤖'}</span>
            <div>
              <div className="font-medium text-sm">{config.identity?.name || '智能助手'}</div>
              <div className="text-xs text-muted-foreground">
                {config.identity?.description || '你的专属智能助手'}
              </div>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            {validation.valid ? '✓ 配置完整' : `缺少: ${validation.missing.join(', ')}`}
          </Badge>
        </div>

        {/* 展开/收起详情 */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 text-xs text-muted-foreground"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3 h-3 mr-1" /> 收起详情
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3 mr-1" /> 查看详情
            </>
          )}
        </Button>

        {expanded && (
          <div className="mt-2 space-y-2 text-xs">
            {config.soul && (
              <div className="p-2 bg-background rounded border">
                <div className="font-medium text-muted-foreground mb-1">人格定义 (SOUL.md)</div>
                <pre className="whitespace-pre-wrap text-[11px] max-h-24 overflow-auto">
                  {config.soul.slice(0, 300)}...
                </pre>
              </div>
            )}
            {config.agents && (
              <div className="p-2 bg-background rounded border">
                <div className="font-medium text-muted-foreground mb-1">行为准则 (AGENTS.md)</div>
                <pre className="whitespace-pre-wrap text-[11px] max-h-24 overflow-auto">
                  {config.agents.slice(0, 300)}...
                </pre>
              </div>
            )}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8"
            onClick={onRegenerate}
            disabled={isRegenerating}
          >
            {isRegenerating ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3 mr-1" />
            )}
            重新生成
          </Button>
          <Button variant="outline" size="sm" className="flex-1 h-8" onClick={onEdit}>
            <Edit3 className="w-3 h-3 mr-1" />
            手动调整
          </Button>
          <Button size="sm" className="flex-1 h-8" onClick={onConfirm} disabled={!validation.valid}>
            <CheckCircle2 className="w-3 h-3 mr-1" />
            确认使用
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// 快速选项组件
function QuickOptions({ options, onSelect, disabled }) {
  if (!options || options.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {options.map((option) => (
        <Button
          key={option.id}
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-xs"
          onClick={() => onSelect(option.value)}
          disabled={disabled}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}

// 手动编辑配置对话框
function ConfigEditDialog({ config, userName, onSave, onCancel, open }) {
  const [editingConfig, setEditingConfig] = useState(config || {})

  useEffect(() => {
    if (config) {
      setEditingConfig(config)
    }
  }, [config])

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg max-h-[80vh] overflow-hidden">
        <CardContent className="p-4">
          <h3 className="font-medium mb-3">手动调整配置</h3>

          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {/* 基本信息 */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">名称</label>
                <Input
                  value={editingConfig.identity?.name || ''}
                  onChange={(e) =>
                    setEditingConfig({
                      ...editingConfig,
                      identity: { ...editingConfig.identity, name: e.target.value },
                    })
                  }
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">形象</label>
                <Input
                  value={editingConfig.identity?.emoji || '🤖'}
                  onChange={(e) =>
                    setEditingConfig({
                      ...editingConfig,
                      identity: { ...editingConfig.identity, emoji: e.target.value },
                    })
                  }
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">一句话介绍</label>
              <Input
                value={editingConfig.identity?.description || ''}
                onChange={(e) =>
                  setEditingConfig({
                    ...editingConfig,
                    identity: { ...editingConfig.identity, description: e.target.value },
                  })
                }
                className="h-8 text-sm"
              />
            </div>

            {/* 人格定义 */}
            <div>
              <label className="text-xs text-muted-foreground">人格定义 (SOUL.md)</label>
              <Textarea
                value={editingConfig.soul || ''}
                onChange={(e) =>
                  setEditingConfig({ ...editingConfig, soul: e.target.value })
                }
                rows={4}
                className="text-xs"
              />
            </div>

            {/* 行为准则 */}
            <div>
              <label className="text-xs text-muted-foreground">行为准则 (AGENTS.md)</label>
              <Textarea
                value={editingConfig.agents || ''}
                onChange={(e) =>
                  setEditingConfig({ ...editingConfig, agents: e.target.value })
                }
                rows={4}
                className="text-xs"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm" className="flex-1" onClick={onCancel}>
              取消
            </Button>
            <Button size="sm" className="flex-1" onClick={() => onSave(editingConfig)}>
              保存修改
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// 主组件
export default function AIOnboardingChat({ onComplete, userName: initialUserName }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [config, setConfig] = useState(null)
  const [userName, setUserName] = useState(initialUserName || '')
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [sessionId] = useState(`onboarding-${Date.now()}`)
  const messagesEndRef = useRef(null)

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 发送初始问候
  useEffect(() => {
    startConversation()
  }, [])

  const startConversation = async () => {
    setIsLoading(true)
    try {
      // 调用 AI 生成初始问候
      const result = await api.gateway.chat(sessionId, [
        { role: 'system', content: ONBOARDING_SYSTEM_PROMPT },
        { role: 'user', content: '开始引导我创建智能体配置' },
      ])

      if (result.success && result.data?.content) {
        setMessages([{ role: 'assistant', content: result.data.content }])
      }
    } catch (e) {
      console.error('启动对话失败:', e)
      // 降级：显示默认问候
      setMessages([
        {
          role: 'assistant',
          content:
            '你好！我是 OpenClaw 的引导助手。\n\n在开始之前，我想先了解一下你。我该怎么称呼你呢？',
        },
      ])
    }
    setIsLoading(false)
  }

  const sendMessage = async (content) => {
    if (!content.trim() || isLoading) return

    const userMessage = content.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    try {
      // 构建消息历史
      const chatMessages = [
        { role: 'system', content: ONBOARDING_SYSTEM_PROMPT },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage },
      ]

      const result = await api.gateway.chat(sessionId, chatMessages)

      if (result.success && result.data?.content) {
        const aiResponse = result.data.content
        setMessages((prev) => [...prev, { role: 'assistant', content: aiResponse }])

        // 尝试解析配置
        const parsedConfig = parseConfigFromResponse(aiResponse)
        if (parsedConfig) {
          setConfig(parsedConfig)
        }

        // 尝试从对话中提取用户名
        if (!userName && userMessage.length < 10) {
          // 可能是用户名
          setUserName(userMessage.replace(/我叫|叫我|我是|名字是/g, '').trim())
        }
      }
    } catch (e) {
      console.error('发送消息失败:', e)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '抱歉，出了点问题。请再试一次。',
        },
      ])
    }
    setIsLoading(false)
  }

  const handleRegenerate = async () => {
    setIsRegenerating(true)
    await sendMessage('请根据我们之前的对话，重新生成一份不同的配置')
    setIsRegenerating(false)
  }

  const handleEdit = () => {
    setShowEditDialog(true)
  }

  const handleSaveEdit = (editedConfig) => {
    setConfig(editedConfig)
    setShowEditDialog(false)
  }

  const handleConfirm = async () => {
    if (!config) return

    // 生成完整的配置文件内容
    const fullConfig = {
      ...config,
      soulFull: generateFullSoul(config, userName),
      agentsFull: generateFullAgents(config),
      userFull: generateFullUser(config, userName),
      identityFull: generateFullIdentity(config),
    }

    // 调用完成回调
    onComplete?.({
      config: fullConfig,
      userName,
      agentName: config.identity?.name,
      agentEmoji: config.identity?.emoji,
    })
  }

  // 智能显示快速选项
  const getQuickOptions = () => {
    const lastMessage = messages[messages.length - 1]
    if (!lastMessage || lastMessage.role !== 'assistant') return null

    const content = lastMessage.content.toLowerCase()

    // 检测是否在询问用途
    if (
      content.includes('做什么') ||
      content.includes('用途') ||
      content.includes('场景') ||
      content.includes('用来')
    ) {
      return QUICK_OPTIONS.purposes
    }

    // 检测是否在询问风格
    if (
      content.includes('风格') ||
      content.includes('喜欢') ||
      content.includes('偏好') ||
      content.includes('性格')
    ) {
      return QUICK_OPTIONS.styles
    }

    // 检测是否在询问详细程度
    if (content.includes('详细') || content.includes('简洁') || content.includes('多少')) {
      return QUICK_OPTIONS.verbosity
    }

    return null
  }

  const quickOptions = getQuickOptions()

  return (
    <div className="flex flex-col h-full">
      {/* 对话区域 */}
      <div className="flex-1 overflow-y-auto px-1 py-2 space-y-3">
        {messages.map((message, index) => (
          <ChatMessage key={index} message={message} />
        ))}

        {isLoading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="bg-muted px-3 py-2 rounded-lg rounded-tl-none">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 配置预览 */}
      {config && (
        <div className="mt-2">
          <ConfigPreview
            config={config}
            userName={userName}
            onEdit={handleEdit}
            onConfirm={handleConfirm}
            onRegenerate={handleRegenerate}
            isRegenerating={isRegenerating}
          />
        </div>
      )}

      {/* 快速选项 */}
      {quickOptions && !isLoading && (
        <div className="mt-2">
          <QuickOptions options={quickOptions} onSelect={sendMessage} disabled={isLoading} />
        </div>
      )}

      {/* 输入区域 */}
      <div className="mt-2 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
          placeholder="输入消息..."
          disabled={isLoading}
          className="flex-1 h-9 text-sm"
        />
        <Button
          size="sm"
          className="h-9 px-3"
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isLoading}
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>

      {/* 手动编辑对话框 */}
      <ConfigEditDialog
        config={config}
        userName={userName}
        open={showEditDialog}
        onSave={handleSaveEdit}
        onCancel={() => setShowEditDialog(false)}
      />
    </div>
  )
}
