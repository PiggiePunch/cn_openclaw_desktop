/**
 * 通道配置组件索引
 * 统一导出所有通道配置组件
 */

// 高优先级通道
export { default as WhatsAppChannelConfig } from './WhatsAppChannelConfig'
export { default as SignalChannelConfig } from './SignalChannelConfig'
export { default as IMessageChannelConfig } from './IMessageChannelConfig'
export { default as BlueBubblesChannelConfig } from './BlueBubblesChannelConfig'

// 中优先级通道
export { default as IRCChannelConfig } from './IRCChannelConfig'
export { default as MatrixChannelConfig } from './MatrixChannelConfig'
export { default as LINEChannelConfig } from './LINEChannelConfig'
export { default as MattermostChannelConfig } from './MattermostChannelConfig'

// 低优先级通道
export { default as MSTeamsChannelConfig } from './MSTeamsChannelConfig'
export { default as GoogleChatChannelConfig } from './GoogleChatChannelConfig'
export { default as NostrChannelConfig } from './NostrChannelConfig'
export { default as TwitchChannelConfig } from './TwitchChannelConfig'

// 通道配置映射表
export const channelConfigMap = {
  whatsapp: 'WhatsAppChannelConfig',
  signal: 'SignalChannelConfig',
  imessage: 'IMessageChannelConfig',
  bluebubbles: 'BlueBubblesChannelConfig',
  irc: 'IRCChannelConfig',
  matrix: 'MatrixChannelConfig',
  line: 'LINEChannelConfig',
  mattermost: 'MattermostChannelConfig',
  msteams: 'MSTeamsChannelConfig',
  googlechat: 'GoogleChatChannelConfig',
  nostr: 'NostrChannelConfig',
  twitch: 'TwitchChannelConfig'
}
