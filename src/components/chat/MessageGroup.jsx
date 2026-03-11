/**
 * MessageGroup - 消息分组组件
 * 实现微信风格的消息组显示
 */
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

/**
 * 单条消息气泡
 */
function MessageBubble({ message, isStreaming, showTime }) {
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

  return (
    <div className={`message-bubble ${isStreaming ? 'streaming' : ''} ${isProactive ? 'proactive' : ''}`}>
      {/* 思考过程 - 不显示，直接隐藏 */}
      {/* {thinking && <ThinkingBlock content={thinking} />} */}

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
  const displayName = getGroupDisplayName(group, agentName)
  const showTime = formatGroupTime(group.lastTime)

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
          {messagesToShow.map((message, idx) => (
            <MessageBubble
              key={idx}
              message={message}
              showTime={idx === messagesToShow.length - 1 ? showTime : null}
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
