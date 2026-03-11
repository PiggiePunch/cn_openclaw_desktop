/**
 * MessageAvatar - 消息头像组件
 * 支持 Emoji、图片、首字母等多种显示方式
 */
import React from 'react'
import { Bot, User } from 'lucide-react'

/**
 * 获取头像显示内容
 * @param {object} props
 * @param {string} props.role - 角色类型 (user/assistant/tool)
 * @param {string} props.name - 显示名称
 * @param {string} props.emoji - 自定义 Emoji
 * @param {string} props.image - 图片 URL
 */
export function MessageAvatar({ role, name, emoji, image }) {
  // 如果有图片
  if (image) {
    return (
      <img
        src={image}
        alt={name || role}
        className="chat-avatar"
        loading="lazy"
      />
    )
  }

  // 如果有 Emoji
  if (emoji) {
    return (
      <div className={`chat-avatar ${role}`}>
        <span className="text-lg">{emoji}</span>
      </div>
    )
  }

  // AI 助手默认图标
  if (role === 'assistant') {
    return (
      <div className="chat-avatar assistant">
        <Bot className="w-5 h-5" />
      </div>
    )
  }

  // 工具调用
  if (role === 'tool') {
    return (
      <div className="chat-avatar tool">
        <span className="text-sm">⚙️</span>
      </div>
    )
  }

  // 用户：显示首字母
  const initial = name?.charAt(0)?.toUpperCase() || 'U'
  return (
    <div className="chat-avatar user">
      <span>{initial}</span>
    </div>
  )
}

export default MessageAvatar
