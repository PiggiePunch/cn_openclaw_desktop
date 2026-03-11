/**
 * messageGrouping - 消息分组工具
 * 实现 Slack 风格的连续消息合并
 */

/**
 * 将消息列表分组（同一角色连续消息合并）
 * @param {Array} messages - 原始消息列表
 * @param {object} options - 配置选项
 * @returns {Array} 分组后的消息组列表
 */
export function groupMessages(messages, options = {}) {
  if (!messages || messages.length === 0) return []

  const {
    maxGroupSize = 10,        // 每组最大消息数
    timeThreshold = 5 * 60 * 1000  // 时间阈值（5分钟）
  } = options

  const groups = []
  let currentGroup = null

  for (const message of messages) {
    const msgTime = message.timestamp ? new Date(message.timestamp).getTime() : Date.now()

    // 检查是否应该开始新组
    const shouldStartNewGroup =
      !currentGroup ||
      currentGroup.role !== message.role ||
      currentGroup.messages.length >= maxGroupSize ||
      (msgTime - currentGroup.lastTime) > timeThreshold

    if (shouldStartNewGroup) {
      // 保存当前组
      if (currentGroup) {
        groups.push(currentGroup)
      }
      // 开始新组
      currentGroup = {
        id: `group-${groups.length}`,
        role: message.role,
        messages: [message],
        firstTime: msgTime,
        lastTime: msgTime
      }
    } else {
      // 添加到当前组
      currentGroup.messages.push(message)
      currentGroup.lastTime = msgTime
    }
  }

  // 保存最后一组
  if (currentGroup) {
    groups.push(currentGroup)
  }

  return groups
}

/**
 * 获取消息组的显示名称
 */
export function getGroupDisplayName(group, agentName = 'AI 助手') {
  if (group.role === 'user') {
    return '你'
  }
  if (group.role === 'assistant') {
    return agentName
  }
  if (group.role === 'tool') {
    return '工具'
  }
  return '系统'
}

/**
 * 格式化时间戳（智能显示）
 */
export function formatGroupTime(timestamp) {
  if (!timestamp) return ''

  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  // 刚刚
  if (diffMins < 1) return '刚刚'
  // 几分钟前
  if (diffMins < 60) return `${diffMins} 分钟前`
  // 几小时前
  if (diffHours < 24) return `${diffHours} 小时前`
  // 今天（显示时间）
  if (diffDays === 0) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  // 昨天
  if (diffDays === 1) {
    return `昨天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  }
  // 一周内
  if (diffDays < 7) {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return `${weekdays[date.getDay()]} ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  }
  // 更早
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export default { groupMessages, getGroupDisplayName, formatGroupTime }
