/**
 * MessageGroup - 消息分组组件
 * 实现微信风格的消息组显示
 */
import { useCallback, useState } from 'react'
import { Check, Copy, ChevronDown, ChevronRight, Wrench } from 'lucide-react'
import { MessageAvatar } from './MessageAvatar'
import { MessageContent } from './MessageContent'
import { extractThinking } from './ThinkingBlock'
import { ToolCard, extractToolCalls } from './ToolCard'
import { getGroupDisplayName, formatGroupTime } from './messageGrouping'

/**
 * 格式化 token 数量（使用 k 单位）
 */
function formatTokens(count) {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`
  }
  return String(count)
}

function extractSystemText(content) {
  if (typeof content === 'string') {
    return content.trim()
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (!item || typeof item !== 'object') return ''
        if (typeof item.text === 'string') return item.text
        if (typeof item.content === 'string') return item.content
        if (typeof item.message === 'string') return item.message
        if (typeof item.summary === 'string') return item.summary
        if (typeof item.error === 'string') return item.error
        return ''
      })
      .filter(Boolean)
      .join('\n')
      .trim()
  }

  if (content && typeof content === 'object') {
    if (typeof content.text === 'string') return content.text.trim()
    if (typeof content.content === 'string') return content.content.trim()
    if (typeof content.message === 'string') return content.message.trim()
    if (typeof content.summary === 'string') return content.summary.trim()
    if (typeof content.error === 'string') return content.error.trim()
    return ''
  }

  return ''
}

function isUsefulSystemText(text) {
  const normalized = String(text || '').trim()
  if (!normalized) return false
  if (['{}', '[]', 'null', 'undefined'].includes(normalized)) return false
  if (normalized === '**正在调用工具...**' || normalized === '*工具执行中...*') return false
  return true
}

function isRenderableMessage(message) {
  if (!message) return false
  const { thinking, mainContent } = extractThinking(message.content)
  const contentToDisplay = thinking ? mainContent : message.content
  const hasContent = typeof contentToDisplay === 'string' && contentToDisplay.trim().length > 0
  const hasToolCalls = extractToolCalls(message).length > 0
  return hasContent || hasToolCalls
}

/**
 * 单条消息气泡
 */
function MessageBubble({ message, isStreaming, showTime }) {
  const [copied, setCopied] = useState(false)
  const { thinking, mainContent } = extractThinking(message.content)
  const toolCalls = extractToolCalls(message)

  // 决定显示哪个内容：
  // - 如果有思考过程，显示分离后的 mainContent（思考块不显示，直接隐藏）
  // - 否则显示原始 message.content
  const contentToDisplay = thinking ? mainContent : message.content

  // 🔥 检查是否有实际可显示的内容
  const hasContent = contentToDisplay && contentToDisplay.trim().length > 0
  const hasToolCalls = toolCalls.length > 0

  // 🔥 如果没有内容且没有工具调用，不渲染气泡（避免空白占位）
  if (!hasContent && !hasToolCalls) {
    return null
  }

  // 是否显示底部信息（时间或 token）
  const hasFooter = showTime || (message.usage && message.usage.total_tokens > 0)

  // 🔥 是否为主动消息（智能体主动发起）
  const isProactive = message.is_proactive
  const copyText = typeof contentToDisplay === 'string' ? contentToDisplay.trim() : ''
  const canCopy = !isStreaming && copyText.length > 0

  const handleCopy = useCallback(async () => {
    if (!canCopy) return
    try {
      await navigator.clipboard.writeText(copyText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (error) {
      console.error('复制消息失败:', error)
    }
  }, [canCopy, copyText])

  return (
    <div className={`message-bubble group ${isStreaming ? 'streaming' : ''} ${isProactive ? 'proactive' : ''}`}>
      {/* 思考过程 - 不显示，直接隐藏 */}
      {/* {thinking && <ThinkingBlock content={thinking} />} */}

      {canCopy && (
        <button
          type="button"
          onClick={handleCopy}
          className="message-bubble__copy"
          title={copied ? '已复制' : '复制消息'}
          aria-label={copied ? '已复制' : '复制消息'}
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      )}

      {/* 主动消息标签 */}
      {isProactive && (
        <div className="proactive-badge">
          <span className="proactive-badge__icon">💭</span>
          <span className="proactive-badge__text">主动提醒</span>
        </div>
      )}

      {/* 消息内容 */}
      {contentToDisplay && (
        <MessageContent content={contentToDisplay} isStreaming={isStreaming} />
      )}

      {/* 工具调用卡片 */}
      {toolCalls.length > 0 && (
        <div className="tool-cards-container">
          {toolCalls.map((tool, idx) => (
            <ToolCard
              key={idx}
              name={tool.name}
              args={tool.args}
              result={tool.result}
            />
          ))}
        </div>
      )}

      {/* 🔥 底部：时间 + token */}
      {hasFooter && (
        <div className="message-bubble__footer mt-1">
          {showTime && (
            <span className="text-xs text-muted-foreground/60">
              {showTime}
            </span>
          )}
          {message.usage && message.usage.total_tokens > 0 && (
            <span className="text-xs text-muted-foreground/60">
              {formatTokens(message.usage.total_tokens)} tokens
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * 消息组组件（微信风格）
 */
export function MessageGroup({
  group,
  agentName,
  isStreaming = false,
  streamingContent = ''
}) {
  const [systemExpanded, setSystemExpanded] = useState(false)
  const displayName = getGroupDisplayName(group, agentName)
  const showTime = formatGroupTime(group.lastTime)
  const isSystemGroup = group.role !== 'user' && group.role !== 'assistant'

  // 🔥 优化流式输出逻辑：
  // 1. 如果有 streamingContent，显示流式内容（替代最后一条 assistant 消息）
  // 2. 如果 isStreaming 但没有 streamingContent（过渡期），显示加载状态
  // 3. 否则显示正常消息
  const hasStreamingContent = isStreaming && streamingContent
  const isInTransition = isStreaming && !streamingContent && group.role === 'assistant'

  // 流式输出时，隐藏最后一条消息（避免重复显示）
  const messagesToShow = hasStreamingContent && group.role === 'assistant'
    ? group.messages.slice(0, -1)  // 排除最后一条
    : group.messages
  const renderableMessages = messagesToShow.filter(isRenderableMessage)

  if (isSystemGroup) {
    const systemEntries = group.messages
      .map((message, idx) => {
        const text = extractSystemText(message?.content)
        return {
          id: idx,
          text,
          usage: message?.usage,
          timestamp: message?.timestamp,
        }
      })
      .filter((entry) => isUsefulSystemText(entry.text))

    if (systemEntries.length === 0) {
      return null
    }

    return (
      <div className={`message-group message-group--${group.role}`}>
        <div className="message-group__avatar">
          <MessageAvatar
            role={group.role}
            name={displayName}
          />
        </div>

        <div className="message-group__content">
          <div className="message-group__header">
            <span className="message-group__name">{displayName}</span>
          </div>

          <div className="message-group__bubbles">
            <button
              type="button"
              onClick={() => setSystemExpanded(prev => !prev)}
              className="tool-card tool-card--clickable w-full text-left"
            >
              <div className="tool-card__header">
                <div className="tool-card__title">
                  {systemExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                  <Wrench className="w-3.5 h-3.5 tool-card__icon" />
                  <span>{`系统操作 ${systemEntries.length} 条`}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {systemExpanded ? '收起' : '已折叠'}
                </span>
              </div>
            </button>

            {systemExpanded && (
              <div className="tool-cards-container mt-2">
                {systemEntries.length === 0 ? (
                  <div className="tool-card">
                    <div className="text-xs text-muted-foreground">无可展示内容</div>
                  </div>
                ) : (
                  systemEntries.map((entry) => (
                    <div key={entry.id} className="tool-card">
                      <div className="tool-card__header">
                        <span className="text-xs text-muted-foreground">
                          {entry.timestamp ? formatGroupTime(entry.timestamp) : showTime || '系统消息'}
                        </span>
                        {entry.usage?.total_tokens > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {formatTokens(entry.usage.total_tokens)} tokens
                          </span>
                        )}
                      </div>
                      <div className="tool-card__detail">
                        <code>{entry.text}</code>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 🔥 如果是过渡期且组内没有消息，只显示加载状态
  if (isInTransition && group.messages.length === 0) {
    return (
      <div className={`message-group message-group--${group.role}`}>
        <div className="message-group__avatar">
          <MessageAvatar
            role={group.role}
            name={agentName}
          />
        </div>
        <div className="message-group__content">
          {/* 名称在顶部 */}
          <div className="message-group__header">
            <span className="message-group__name">{displayName}</span>
          </div>
          <div className="message-bubble streaming">
            <div className="streaming-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (renderableMessages.length === 0 && !hasStreamingContent && !isInTransition) {
    return null
  }

  return (
    <div className={`message-group message-group--${group.role}`}>
      {/* 头像 - 顶部对齐 */}
      <div className="message-group__avatar">
        <MessageAvatar
          role={group.role}
          name={group.role === 'user' ? '你' : agentName}
        />
      </div>

      {/* 消息内容区 */}
      <div className="message-group__content">
        {/* 名称在顶部（微信风格） */}
        <div className="message-group__header">
          <span className="message-group__name">{displayName}</span>
        </div>

        {/* 消息气泡区 */}
        <div className="message-group__bubbles">
          {/* 组内消息（流式输出时排除最后一条） */}
          {renderableMessages.map((message, idx) => (
            <MessageBubble
              key={idx}
              message={message}
              showTime={idx === renderableMessages.length - 1 ? showTime : null}
            />
          ))}

          {/* 流式输出（替代最后一条消息显示） */}
          {hasStreamingContent && (
            <MessageBubble
              message={{ content: streamingContent }}
              isStreaming={true}
            />
          )}

          {/* 🔥 过渡期加载状态（流式结束但历史还没加载完成） */}
          {isInTransition && group.messages.length > 0 && (
            <div className="message-bubble streaming">
              <div className="streaming-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MessageGroup
