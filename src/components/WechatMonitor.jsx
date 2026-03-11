import React, { useState, useEffect } from 'react'
import api from '@/lib/api'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Badge } from './ui/badge'
import { Switch } from './ui/switch'
import { Textarea } from './ui/textarea'
import {
  MessageSquare,
  Send,
  Play,
  Square,
  Trash2,
  RefreshCw,
  Users,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Smartphone,
  Settings,
} from 'lucide-react'

// 消息类型样式
const MESSAGE_TYPE_STYLES = {
  Text: 'bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
  Image: 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200',
  File: 'bg-purple-50 text-purple-800 dark:bg-purple-950 dark:text-purple-200',
  Video: 'bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-200',
  Audio: 'bg-pink-50 text-pink-800 dark:bg-pink-950 dark:text-pink-200',
  Link: 'bg-cyan-50 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200',
  Emoji: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200',
}

// 消息类型图标
const MESSAGE_TYPE_ICONS = {
  Text: '📝',
  Image: '🖼️',
  File: '📎',
  Video: '🎬',
  Audio: '🎵',
  Link: '🔗',
  Emoji: '😀',
}

// 格式化时间
function formatTime(timestamp) {
  if (!timestamp) return '-'
  const date = new Date(timestamp * 1000) // 假设是 Unix 时间戳
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// 格式化运行时长
function formatUptime(seconds) {
  if (!seconds) return '0秒'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  const parts = []
  if (hours > 0) parts.push(`${hours}小时`)
  if (minutes > 0) parts.push(`${minutes}分钟`)
  if (secs > 0 || parts.length === 0) parts.push(`${secs}秒`)

  return parts.join('')
}

export default function WechatMonitor() {
  const [status, setStatus] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false)
  const [permissionStatus, setPermissionStatus] = useState(null)

  // 发送消息表单
  const [sendForm, setSendForm] = useState({ chatName: '', content: '' })
  const [sending, setSending] = useState(false)

  // 操作状态
  const [starting, setStarting] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [clearing, setClearing] = useState(false)

  // 加载状态和消息
  useEffect(() => {
    loadStatus()
    loadMessages()
    checkPermission()

    // 定时刷新消息（每 3 秒）
    const interval = setInterval(() => {
      loadMessages()
      loadStatus()
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const checkPermission = async () => {
    const result = await api.wechat.checkPermission()
    if (result.success) {
      setPermissionStatus(result.data)
    } else {
      console.error('检查权限失败:', result.error)
      setPermissionStatus({ has_permission: false, error: result.error })
    }
  }

  const loadStatus = async () => {
    const result = await api.wechat.getStatus()
    if (result.success) {
      setStatus(result.data)
      setAutoReplyEnabled(result.data?.auto_reply_enabled || false)
    } else {
      console.error('加载状态失败:', result.error)
    }
  }

  const loadMessages = async () => {
    const result = await api.wechat.getMessages()
    if (result.success) {
      setMessages(result.data || [])
    } else {
      console.error('加载消息失败:', result.error)
    }
    setLoading(false)
  }

  const startMonitoring = async () => {
    setStarting(true)
    const result = await api.wechat.startMonitoring()
    if (result.success) {
      setStatus(result.data)
      // 检查返回状态中的错误
      if (result.data.error) {
        alert('启动失败: ' + result.data.error)
      } else if (!result.data.running) {
        alert('启动失败: 未知原因')
      }
    } else {
      console.error('启动监控失败:', result.error)
      alert('启动监控失败: ' + result.error)
    }
    setStarting(false)
  }

  const stopMonitoring = async () => {
    setStopping(true)
    const result = await api.wechat.stopMonitoring()
    if (result.success) {
      await loadStatus()
    } else {
      console.error('停止监控失败:', result.error)
      alert('停止监控失败: ' + result.error)
    }
    setStopping(false)
  }

  const clearMessages = async () => {
    if (!confirm('确定要清空所有消息吗？')) return

    setClearing(true)
    const result = await api.wechat.clearMessages()
    if (result.success) {
      setMessages([])
    } else {
      console.error('清空消息失败:', result.error)
      alert('清空消息失败: ' + result.error)
    }
    setClearing(false)
  }

  const sendMessage = async () => {
    if (!sendForm.chatName.trim() || !sendForm.content.trim()) {
      alert('请填写聊天名称和消息内容')
      return
    }

    setSending(true)
    const result = await api.wechat.sendMessage(sendForm.chatName, sendForm.content)
    if (result.success) {
      setSendForm({ chatName: '', content: '' })
      alert('消息发送成功')
    } else {
      console.error('发送消息失败:', result.error)
      alert('发送消息失败: ' + result.error)
    }
    setSending(false)
  }

  const toggleAutoReply = async (enabled) => {
    const result = await api.wechat.setAutoReply(enabled, null)
    if (result.success) {
      setAutoReplyEnabled(enabled)
    } else {
      console.error('设置自动回复失败:', result.error)
      alert('设置自动回复失败: ' + result.error)
    }
  }

  const isMonitoring = status?.is_monitoring || false

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">微信监控</h2>
          <p className="text-muted-foreground">监控微信消息并自动回复</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { loadStatus(); loadMessages(); }} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </div>

      {/* 权限警告 */}
      {permissionStatus && !permissionStatus.has_permission && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-orange-800 dark:text-orange-200">需要辅助功能权限</p>
                <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                  微信监控需要 macOS 辅助功能权限才能正常运行。请在"系统偏好设置 → 隐私与安全性 → 辅助功能"中添加此应用。
                </p>
                {permissionStatus.error && (
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                    错误: {permissionStatus.error}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 状态卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            监控状态
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* 监控状态 */}
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isMonitoring
                  ? 'bg-green-100 dark:bg-green-900'
                  : 'bg-gray-100 dark:bg-gray-800'
              }`}>
                {isMonitoring ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                ) : (
                  <XCircle className="h-5 w-5 text-gray-400" />
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">监控状态</p>
                <Badge variant={isMonitoring ? 'default' : 'secondary'}>
                  {isMonitoring ? '运行中' : '已停止'}
                </Badge>
              </div>
            </div>

            {/* 消息数 */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">消息数</p>
                <p className="font-semibold">{status?.message_count || messages.length || 0}</p>
              </div>
            </div>

            {/* 错误数 */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">错误数</p>
                <p className="font-semibold">{status?.error_count || 0}</p>
              </div>
            </div>

            {/* 运行时长 */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">运行时长</p>
                <p className="font-semibold text-sm">{formatUptime(status?.uptime_seconds)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 控制面板 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            控制面板
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            {/* 启动/停止按钮 */}
            {isMonitoring ? (
              <Button
                variant="destructive"
                onClick={stopMonitoring}
                disabled={stopping}
              >
                {stopping ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Square className="h-4 w-4 mr-2" />
                )}
                {stopping ? '停止中...' : '停止监控'}
              </Button>
            ) : (
              <Button
                onClick={startMonitoring}
                disabled={starting}
              >
                {starting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                {starting ? '启动中...' : '启动监控'}
              </Button>
            )}

            {/* 清空消息 */}
            <Button
              variant="outline"
              onClick={clearMessages}
              disabled={clearing || messages.length === 0}
            >
              {clearing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              {clearing ? '清空中...' : '清空消息'}
            </Button>

            {/* 自动回复开关 */}
            <div className="flex items-center gap-2 ml-auto">
              <Label htmlFor="auto-reply" className="text-sm">自动回复</Label>
              <Switch
                id="auto-reply"
                checked={autoReplyEnabled}
                onCheckedChange={toggleAutoReply}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 消息列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            消息列表
            {messages.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {messages.length} 条
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            最近收到的微信消息（每 3 秒自动刷新）
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>暂无消息</p>
              <p className="text-sm mt-1">启动监控后将自动接收消息</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {messages.map((msg, index) => (
                <div
                  key={msg.id || index}
                  className="p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* 消息头部 */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm truncate">
                          {msg.sender || '未知发送者'}
                        </span>
                        {/* 消息类型 */}
                        <Badge
                          variant="outline"
                          className={MESSAGE_TYPE_STYLES[msg.msg_type] || MESSAGE_TYPE_STYLES.Text}
                        >
                          {MESSAGE_TYPE_ICONS[msg.msg_type] || '📝'} {msg.msg_type || 'Text'}
                        </Badge>
                        {/* 群聊标识 */}
                        {msg.is_group && (
                          <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                            <Users className="h-3 w-3 mr-1" />
                            群聊
                          </Badge>
                        )}
                      </div>

                      {/* 消息内容 */}
                      <p className="text-sm text-foreground break-all line-clamp-3">
                        {msg.content || '[无内容]'}
                      </p>

                      {/* 群名（如果是群聊） */}
                      {msg.is_group && msg.chat_name && (
                        <p className="text-xs text-muted-foreground mt-1">
                          群: {msg.chat_name}
                        </p>
                      )}
                    </div>

                    {/* 时间戳 */}
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 发送消息 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            发送消息
          </CardTitle>
          <CardDescription>
            向指定聊天发送消息（需要先在微信中打开对应聊天窗口）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="chat-name">聊天名称</Label>
            <Input
              id="chat-name"
              placeholder="输入聊天窗口标题（如：张三、产品群）"
              value={sendForm.chatName}
              onChange={(e) => setSendForm({ ...sendForm, chatName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="content">消息内容</Label>
            <Textarea
              id="content"
              placeholder="输入要发送的消息..."
              value={sendForm.content}
              onChange={(e) => setSendForm({ ...sendForm, content: e.target.value })}
              rows={3}
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={sendMessage}
              disabled={sending || !sendForm.chatName.trim() || !sendForm.content.trim()}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {sending ? '发送中...' : '发送消息'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 使用说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">使用说明</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>1. 首先在"系统偏好设置 → 隐私与安全性 → 辅助功能"中授权此应用</p>
            <p>2. 打开微信 Mac 客户端并登录</p>
            <p>3. 点击"启动监控"开始监听微信消息</p>
            <p>4. 收到的消息将自动显示在消息列表中</p>
            <p>5. 开启"自动回复"后，可配置自动回复规则</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
