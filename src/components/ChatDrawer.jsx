import React, { useState, useRef, useEffect } from 'react'
import { X, ChevronDown, ChevronLeft, ChevronRight, Bot, Plus, Loader2, Pencil, Camera, Trash2, MessageSquare, FolderOpen, MessageCircle, PanelLeftClose, PanelLeft } from 'lucide-react'
import api from '@/lib/api'

// 响应式断点
const MOBILE_BREAKPOINT = 1024  // lg
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog'
import { cn } from '@/lib/utils'

// 预设头像颜色
const AVATAR_COLORS = [
  { id: 'blue', class: 'bg-blue-500', name: '蓝色' },
  { id: 'green', class: 'bg-green-500', name: '绿色' },
  { id: 'purple', class: 'bg-purple-500', name: '紫色' },
  { id: 'orange', class: 'bg-orange-500', name: '橙色' },
  { id: 'pink', class: 'bg-pink-500', name: '粉色' },
  { id: 'teal', class: 'bg-teal-500', name: '青色' },
  { id: 'indigo', class: 'bg-indigo-500', name: '靛蓝' },
  { id: 'red', class: 'bg-red-500', name: '红色' },
  { id: 'amber', class: 'bg-amber-500', name: '琥珀' },
  { id: 'cyan', class: 'bg-cyan-500', name: '天蓝' },
]

// 从session_key获取显示名称
function getSessionDisplayName(sessionKey) {
  if (!sessionKey) return '未选择'
  if (sessionKey === 'main' || sessionKey === 'agent:main:main') {
    return '默认助手'
  }
  // Gateway 格式: agent:{agentId}:main
  if (sessionKey.startsWith('agent:')) {
    const parts = sessionKey.replace('agent:', '').split(':')
    const agentId = parts[0]
    return agentId === 'main' ? '默认助手' : agentId
  }
  return sessionKey
}

// 获取头像首字母
function getAvatarLetter(name) {
  if (!name) return '?'
  // 中文取第一个字，英文取首字母
  const firstChar = name.charAt(0)
  if (/[\u4e00-\u9fa5]/.test(firstChar)) {
    return firstChar
  }
  return firstChar.toUpperCase()
}

// 生成头像颜色（基于名称）
function getDefaultAvatarColor(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length].class
}

// 获取头像颜色（优先使用自定义颜色）
function getAvatarColor(name, customColor) {
  if (customColor) {
    const colorObj = AVATAR_COLORS.find(c => c.id === customColor)
    if (colorObj) return colorObj.class
  }
  return getDefaultAvatarColor(name)
}

// 从 session_key 解析 agent_id
function parseAgentId(sessionKey) {
  if (sessionKey === 'main') return 'main'
  if (sessionKey.startsWith('agent:')) {
    const parts = sessionKey.split(':')
    return parts[1] || 'main'
  }
  return 'main'
}

// 编辑智能体弹窗组件
function EditAgentDialog({ isOpen, onClose, displayName, customColor, customAvatar, onSave }) {
  const [name, setName] = useState(displayName)
  const [color, setColor] = useState(customColor || null)
  const [avatar, setAvatar] = useState(customAvatar || null)
  const fileInputRef = useRef(null)

  // 重置状态
  React.useEffect(() => {
    if (isOpen) {
      setName(displayName)
      setColor(customColor || null)
      setAvatar(customAvatar || null)
    }
  }, [isOpen, displayName, customColor, customAvatar])

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件')
      return
    }

    // 检查文件大小（最大 500KB）
    if (file.size > 500 * 1024) {
      alert('图片大小不能超过 500KB')
      return
    }

    // 转换为 base64
    const reader = new FileReader()
    reader.onload = (event) => {
      setAvatar(event.target.result)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveAvatar = () => {
    setAvatar(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSave = () => {
    onSave(name.trim() || displayName, color, avatar)
    onClose()
  }

  const letter = getAvatarLetter(name || displayName)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>编辑智能体</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 头像预览和编辑 */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              {avatar ? (
                <img
                  src={avatar}
                  alt="头像"
                  className="w-20 h-20 rounded-full object-cover border-4 border-border"
                />
              ) : (
                <div className={cn(
                  "w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold border-4 border-border",
                  getAvatarColor(name || displayName, color)
                )}>
                  {letter}
                </div>
              )}
              {/* 上传按钮 */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center shadow-lg hover:bg-primary-dark transition-colors"
                title="上传头像"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>

            {/* 删除头像按钮 */}
            {avatar && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemoveAvatar}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                移除头像
              </Button>
            )}

            {/* 颜色选择（仅在没有自定义头像时显示） */}
            {!avatar && (
              <div className="w-full">
                <Label className="text-sm text-foreground-secondary mb-2 block text-center">
                  选择头像颜色
                </Label>
                <div className="flex flex-wrap justify-center gap-2">
                  {AVATAR_COLORS.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setColor(c.id)}
                      className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium transition-transform hover:scale-110",
                        c.class,
                        color === c.id && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                      )}
                      title={c.name}
                    >
                      {letter}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 名称编辑 */}
          <div className="space-y-2">
            <Label>智能体名称</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入智能体名称"
              className="text-base"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 🔥 新建会话弹窗组件
function NewSessionDialog({ isOpen, onClose, agentId, agentName, onCreate }) {
  const [sessionName, setSessionName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    setIsCreating(true)
    try {
      await onCreate(agentId, sessionName.trim() || `新会话`)
      setSessionName('')
      onClose()
    } catch (error) {
      console.error('创建会话失败:', error)
      alert('创建会话失败: ' + error)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新建会话</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="text-sm text-foreground-secondary">
            为智能体 <strong>"{agentName}"</strong> 创建新会话
          </div>
          <div className="space-y-2">
            <Label>会话名称（可选）</Label>
            <Input
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="例如：代码审查、文档翻译"
              className="text-base"
            />
            <p className="text-xs text-foreground-tertiary">
              不填写将自动生成名称
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                创建中...
              </>
            ) : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function ChatDrawer({
  gatewaySessions = [],  // Gateway 会话列表（智能体）
  currentSessionKey,     // 当前选中的 session_key
  onSelectSession,       // 选择会话回调
  onCreateSession,       // 创建会话回调
  onDeleteSession,       // 删除会话回调
  onUpdateMetadata,      // 更新元数据回调
  isLoading = false,     // 加载状态
  agentMetadata = {},    // 智能体元数据（名称、颜色等）
  agentNames = {},       // 🔥 智能体名称缓存（从 Workspace 加载的真实名称）
  unreadCounts = {}     // 🔥 未读消息计数
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024)

  // 响应式监听窗口大小
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      const prevWidth = windowWidth
      setWindowWidth(width)

      // 小屏幕自动折叠
      if (width < MOBILE_BREAKPOINT && !collapsed) {
        setCollapsed(true)
      }
      // 大屏幕恢复展开
      if (width >= MOBILE_BREAKPOINT && prevWidth < MOBILE_BREAKPOINT && collapsed) {
        setCollapsed(false)
      }
    }

    // 初始化时检查一次
    handleResize()

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [collapsed, windowWidth])

  // 🔥 新增：展开的智能体（用于显示会话列表）
  const [expandedAgents, setExpandedAgents] = useState({})
  // 🔥 新增：智能体的会话列表
  const [agentSessions, setAgentSessions] = useState({})
  // 🔥 新增：加载状态
  const [loadingSessions, setLoadingSessions] = useState({})
  // 🔥 新增：新建会话弹窗
  const [showNewSessionDialog, setShowNewSessionDialog] = useState(false)
  const [newSessionAgentId, setNewSessionAgentId] = useState('')
  const [newSessionAgentName, setNewSessionAgentName] = useState('')
  // 🔥 删除会话确认
  const [showDeleteSessionDialog, setShowDeleteSessionDialog] = useState(false)
  const [deleteSessionKey, setDeleteSessionKey] = useState('')
  const [deleteSessionTitle, setDeleteSessionTitle] = useState('')

  // 获取智能体显示名称
  const getAgentDisplayName = (sessionKey) => {
    // 🔥 优先使用从 Workspace 加载的真实名称
    if (agentNames && agentNames[sessionKey]) {
      return agentNames[sessionKey]
    }

    if (sessionKey === 'main') {
      // 先从用户设置获取助手名称
      try {
        const stored = localStorage.getItem('openclaw_user_settings')
        if (stored) {
          const settings = JSON.parse(stored)
          if (settings.agentName) {
            return settings.agentName
          }
        }
      } catch (e) {}
      // 回退到元数据
      if (agentMetadata['main']?.name) {
        return agentMetadata['main'].name
      }
      return '默认助手'
    }
    if (agentMetadata[sessionKey]?.name) {
      return agentMetadata[sessionKey].name
    }
    return getSessionDisplayName(sessionKey)
  }

  // 获取智能体头像颜色
  const getAgentColor = (sessionKey) => {
    return agentMetadata[sessionKey]?.color || null
  }

  // 获取智能体自定义头像
  const getAgentAvatar = (sessionKey) => {
    return agentMetadata[sessionKey]?.avatar || null
  }

  // 🔥 切换智能体展开状态
  const toggleAgentExpanded = async (sessionKey) => {
    const newExpanded = { ...expandedAgents }
    const agentId = parseAgentId(sessionKey)

    if (newExpanded[sessionKey]) {
      // 收起
      delete newExpanded[sessionKey]
    } else {
      // 展开，加载会话列表
      newExpanded[sessionKey] = true
      await loadAgentSessions(agentId)
    }

    setExpandedAgents(newExpanded)
  }

  // 🔥 加载智能体的会话列表
  const loadAgentSessions = async (agentId) => {
    setLoadingSessions(prev => ({ ...prev, [agentId]: true }))
    const result = await api.sessions.listAgentSessions(agentId)
    if (result.success) {
      setAgentSessions(prev => ({ ...prev, [agentId]: result.data || [] }))
    } else {
      console.error('加载会话列表失败:', result.error)
      setAgentSessions(prev => ({ ...prev, [agentId]: [] }))
    }
    setLoadingSessions(prev => ({ ...prev, [agentId]: false }))
  }

  // 🔥 打开新建会话弹窗
  const handleOpenNewSessionDialog = (sessionKey) => {
    const agentId = parseAgentId(sessionKey)
    const displayName = getAgentDisplayName(sessionKey)
    setNewSessionAgentId(agentId)
    setNewSessionAgentName(displayName)
    setShowNewSessionDialog(true)
  }

  // 🔥 创建新会话
  const handleCreateNewSession = async (agentId, sessionName) => {
    const result = await api.sessions.create(agentId, sessionName)
    if (result.success) {
      console.log('✅ 创建新会话:', result.data)
      // 刷新会话列表
      await loadAgentSessions(agentId)
      // 切换到新会话
      onSelectSession(result.data)
    } else {
      console.error('创建会话失败:', result.error)
    }
  }

  // 🔥 删除单个会话 - 打开确认对话框
  const openDeleteSessionDialog = (sessionKey, title) => {
    setDeleteSessionKey(sessionKey)
    setDeleteSessionTitle(title || '未命名')
    setShowDeleteSessionDialog(true)
  }

  // 🔥 确认删除会话
  const confirmDeleteSession = async () => {
    const result = await api.sessions.deleteSingle(deleteSessionKey)
    if (result.success) {
      console.log('✅ 删除会话:', deleteSessionKey)
      // 刷新会话列表
      const agentId = parseAgentId(deleteSessionKey)
      await loadAgentSessions(agentId)
      // 如果删除的是当前会话，切换到默认
      if (deleteSessionKey === currentSessionKey) {
        onSelectSession('main')
      }
    } else {
      console.error('删除会话失败:', result.error)
      alert('删除失败: ' + result.error)
    }
    setShowDeleteSessionDialog(false)
  }

  // 折叠模式：只显示头像列表
  if (collapsed) {
    return (
      <div className="w-14 md:w-16 bg-surface border-r border-border flex flex-col shrink-0">
        {/* 折叠模式头部 - 与 Sidebar 高度对齐 */}
        <div className="h-14 md:h-16 flex items-center justify-center border-b border-border">
          <button
            onClick={() => setCollapsed(false)}
            className="p-1.5 md:p-2 rounded-lg hover:bg-surface-elevated transition-colors"
            title="展开侧边栏"
          >
            <PanelLeft className="w-4 h-4 text-foreground-secondary" />
          </button>
        </div>

        {/* 头像列表 */}
        <ScrollArea className="flex-1">
          <div className="p-1.5 md:p-2 space-y-1.5 md:space-y-2">
            {gatewaySessions && gatewaySessions.length > 0 ? (
              gatewaySessions.map(session => {
                const displayName = getAgentDisplayName(session.session_key)
                const customColor = getAgentColor(session.session_key)
                const customAvatar = getAgentAvatar(session.session_key)
                const isActive = session.session_key === currentSessionKey ||
                  currentSessionKey?.startsWith(session.session_key.replace(':main', ':'))
                // 🔥 获取该会话的未读计数
                const unreadCount = unreadCounts[session.session_key] || 0

                return (
                  <button
                    key={session.session_key}
                    onClick={() => {
                      // 🔥 修复：不再盲目拼接 :main
                      let targetKey = 'main'
                      if (session.session_key !== 'main') {
                        const parts = session.session_key.split(':')
                        if (parts.length >= 3) {
                          // 已经是完整格式，直接使用
                          targetKey = session.session_key
                        } else if (parts.length === 2) {
                          // 2段格式，补全为3段
                          targetKey = `${session.session_key}:main`
                        } else {
                          targetKey = session.session_key
                        }
                      }
                      onSelectSession(targetKey)
                    }}
                    className={cn(
                      "w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center text-white font-medium text-xs md:text-sm transition-all overflow-hidden relative",
                      customAvatar ? '' : getAvatarColor(displayName, customColor),
                      isActive && "ring-2 ring-primary ring-offset-2 ring-offset-surface"
                    )}
                    title={displayName}
                  >
                    {customAvatar ? (
                      <img src={customAvatar} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      getAvatarLetter(displayName)
                    )}
                    {/* 🔥 未读红点 */}
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </button>
                )
              })
            ) : (
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-surface-elevated flex items-center justify-center">
                <Bot className="w-4 h-4 md:w-5 md:h-5 text-foreground-tertiary" />
              </div>
            )}
          </div>
        </ScrollArea>

        {/* 新建按钮 - 与 Sidebar 高度对齐 */}
        <div className="h-14 md:h-16 flex items-center justify-center border-t border-border">
          <button
            onClick={onCreateSession}
            className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary-dark transition-colors"
            title="新建智能体"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  // 展开模式
  return (
    <div className="w-60 lg:w-72 bg-surface border-r border-border flex flex-col shrink-0 transition-all duration-300">
      {/* 侧边栏头部 - 与 Sidebar 高度对齐 */}
      <div className="h-14 md:h-16 flex items-center justify-between px-3 md:px-4 border-b border-border">
        <div className="flex items-center">
          <Bot className="w-4 h-4 md:w-5 md:h-5 mr-1.5 md:mr-2 text-primary" />
          <h2 className="text-base md:text-lg font-semibold">智能体</h2>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 md:p-1.5 rounded-lg hover:bg-surface-elevated transition-colors"
          title="收起侧边栏"
        >
          <PanelLeftClose className="w-4 h-4 text-foreground-secondary" />
        </button>
      </div>

      {/* 侧边栏内容区 */}
      <ScrollArea className="flex-1">
        <div className="p-3 md:p-4 space-y-2 flex-1">
          {/* 智能体列表 */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-foreground-secondary text-sm">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              加载中...
            </div>
          ) : gatewaySessions && gatewaySessions.length > 0 ? (
            gatewaySessions.map(session => (
              <AgentItem
                key={session.session_key}
                session={session}
                displayName={getAgentDisplayName(session.session_key)}
                customColor={getAgentColor(session.session_key)}
                customAvatar={getAgentAvatar(session.session_key)}
                isActive={session.session_key === currentSessionKey ||
                  currentSessionKey?.startsWith(session.session_key.split(':')[1] ?
                    `agent:${session.session_key.split(':')[1]}:` : 'main')}
                currentSessionKey={currentSessionKey}
                isExpanded={expandedAgents[session.session_key]}
                onToggleExpand={() => toggleAgentExpanded(session.session_key)}
                onClick={() => {
                  // 点击智能体时，切换到其默认会话
                  let defaultSessionKey = 'main'

                  if (session.session_key !== 'main') {
                    // 🔥 修复：检查是否已经有会话列表
                    const sessions = agentSessions[parseAgentId(session.session_key)]
                    if (sessions && sessions.length > 0) {
                      // 有会话列表，使用第一个会话
                      defaultSessionKey = sessions[0].session_key
                    } else {
                      // 没有会话列表，使用智能体的默认会话
                      // 🔥 关键修复：不再盲目拼接 :main
                      // 如果 session.session_key 已经是完整格式（3段），直接使用
                      const parts = session.session_key.split(':')
                      if (parts.length >= 3) {
                        // 已经是完整格式（agent:xx:xx），直接使用
                        defaultSessionKey = session.session_key
                      } else if (parts.length === 2) {
                        // 2段格式（agent:xx），补全为3段
                        defaultSessionKey = `${session.session_key}:main`
                      } else {
                        // 其他格式，直接使用
                        defaultSessionKey = session.session_key
                      }
                    }
                  }

                  onSelectSession(defaultSessionKey)
                }}
                onDelete={() => onDeleteSession(session.session_key)}
                onUpdate={(name, color, avatar) => onUpdateMetadata(session.session_key, name, color, avatar)}
                onNewSession={() => handleOpenNewSessionDialog(session.session_key)}
                onSelectSession={onSelectSession}
                onDeleteSession={openDeleteSessionDialog}
                agentSessions={agentSessions[parseAgentId(session.session_key)] || []}
                loadingSessions={loadingSessions[parseAgentId(session.session_key)]}
                unreadCount={unreadCounts[session.session_key] || 0}
              />
            ))
          ) : (
            <div className="text-center py-8 text-foreground-secondary text-sm">
              <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>暂无智能体</p>
              <p className="text-xs mt-1">点击下方按钮创建</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* 底部新建按钮 - 与 Sidebar 高度对齐 */}
      <div className="h-14 md:h-16 flex items-center px-3 md:px-4 border-t border-border">
        <Button
          size="sm"
          variant="outline"
          onClick={onCreateSession}
          className="w-full h-8 md:h-9"
          disabled={isLoading}
        >
          <Plus className="w-3 h-3 mr-1" />
          <span className="text-xs md:text-sm">新建智能体</span>
        </Button>
      </div>

      {/* 🔥 新建会话弹窗 */}
      <NewSessionDialog
        isOpen={showNewSessionDialog}
        onClose={() => setShowNewSessionDialog(false)}
        agentId={newSessionAgentId}
        agentName={newSessionAgentName}
        onCreate={handleCreateNewSession}
      />

      {/* 🔥 删除会话确认对话框 */}
      <Dialog open={showDeleteSessionDialog} onOpenChange={setShowDeleteSessionDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>删除会话</DialogTitle>
            <DialogDescription>
              确定要删除会话「{deleteSessionTitle}」吗？
              <p className="mt-2 text-red-600 text-sm">此操作不可恢复！</p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowDeleteSessionDialog(false)}>取消</Button>
            <Button variant="destructive" size="sm" onClick={confirmDeleteSession}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// 智能体列表项组件
function AgentItem({
  session,
  displayName,
  customColor,
  customAvatar,
  isActive,
  currentSessionKey,
  isExpanded,
  onToggleExpand,
  onClick,
  onDelete,
  onUpdate,
  onNewSession,
  onSelectSession,
  onDeleteSession,
  agentSessions,
  loadingSessions,
  unreadCount = 0  // 🔥 未读消息计数
}) {
  const [showActions, setShowActions] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const isDefault = session.session_key === 'main' || session.isDefault

  // 头像
  const avatarLetter = getAvatarLetter(displayName)
  const avatarColorClass = getAvatarColor(displayName, customColor)

  const handleSave = (name, color, avatar) => {
    onUpdate(name, color, avatar)
  }

  return (
    <>
      <div
        className={cn(
          "group relative rounded-lg transition-colors overflow-hidden",
          isActive
            ? 'bg-primary/10 border border-primary/30'
            : 'bg-surface-elevated hover:bg-surface-elevated/80 border border-transparent'
        )}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        {/* 🔥 默认标签 - 角标样式 */}
        {isDefault && (
          <div className={cn(
            "absolute top-0 left-0 px-2 py-0.5 text-[10px] font-medium rounded-br-lg z-10",
            isActive
              ? 'bg-primary text-white'
              : 'bg-primary/80 text-white'
          )}>
            默认
          </div>
        )}

        {/* 智能体主行 */}
        <div className="flex items-center">
          {/* 展开/收起按钮 */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand()
            }}
            className="p-2 hover:bg-surface-elevated/50 rounded-l-lg"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-foreground-secondary" />
            ) : (
              <ChevronRight className="w-4 h-4 text-foreground-secondary" />
            )}
          </button>

          {/* 智能体信息 */}
          <button
            onClick={onClick}
            className={cn(
              "flex-1 text-left py-3 pr-2",
              isDefault && "pt-6" // 有默认标签时增加顶部间距
            )}
          >
            <div className="flex items-center gap-3">
              {/* 圆形头像 */}
              <div className="relative flex-shrink-0">
                {customAvatar ? (
                  <img
                    src={customAvatar}
                    alt={displayName}
                    className="w-9 h-9 rounded-full object-cover"
                  />
                ) : (
                  <div className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center text-white font-medium text-sm",
                    avatarColorClass
                  )}>
                    {avatarLetter}
                  </div>
                )}
                {/* 🔥 未读红点 */}
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className={cn(
                  "font-medium text-sm truncate",
                  isActive ? 'text-primary' : 'text-foreground'
                )}>{displayName}</div>
                <div className={cn(
                  "text-xs mt-0.5",
                  isActive ? 'text-primary/70' : 'text-foreground-secondary'
                )}>
                  {session.message_count || 0} 条消息
                </div>
              </div>
            </div>
          </button>

          {/* 🔥 操作按钮 - 右侧垂直排列 */}
          <div className={cn(
            "flex flex-col gap-0.5 pr-2 transition-opacity",
            showActions ? "opacity-100" : "opacity-0"
          )}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowEditDialog(true)
              }}
              className="p-1.5 rounded-md hover:bg-primary/20 text-foreground-secondary hover:text-primary transition-colors"
              title="编辑"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            {!isDefault && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
                className="p-1.5 rounded-md hover:bg-destructive/20 text-foreground-secondary hover:text-destructive transition-colors"
                title="删除"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 🔥 会话列表（展开时显示） */}
        {isExpanded && (
          <div className="border-t border-border mt-1">
            {/* 🔥 新建会话按钮 - 放在会话列表顶部 */}
            <div className="px-2 py-1.5 border-b border-border/50">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onNewSession()
                }}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs text-primary hover:bg-primary/10 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                新建会话
              </button>
            </div>

            {loadingSessions ? (
              <div className="flex items-center justify-center py-4 text-foreground-secondary text-xs">
                <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                加载会话...
              </div>
            ) : agentSessions && agentSessions.length > 0 ? (
              <div className="py-1">
                {agentSessions.map(sess => {
                  const isCurrentSession = sess.session_key === currentSessionKey
                  // 🔥 只有 session_key 包含 :main 结尾或者是 main 本身才是默认会话
                  const isMainSession = sess.session_key === 'main' ||
                    sess.session_key.endsWith(':main')
                  return (
                    <div
                      key={sess.session_key}
                      className={cn(
                        "group flex items-center px-3 py-2 mx-2 my-1 rounded-md cursor-pointer transition-colors",
                        isCurrentSession
                          ? 'bg-primary/20 text-primary'
                          : 'hover:bg-surface-elevated text-foreground-secondary'
                      )}
                      onClick={() => onSelectSession(sess.session_key)}
                    >
                      <MessageSquare className="w-3.5 h-3.5 mr-2 flex-shrink-0" />
                      <span className="flex-1 text-sm truncate">{sess.title || '未命名会话'}</span>
                      <span className="text-xs text-foreground-tertiary mr-2">{sess.message_count || 0}</span>

                      {/* 🔥 删除会话按钮 - 非默认会话显示 */}
                      {!isMainSession && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteSession(sess.session_key, sess.title)
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/20 text-destructive transition-all"
                          title="删除会话"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-4 text-center text-foreground-tertiary text-xs">
                点击上方「新建会话」开始
              </div>
            )}
          </div>
        )}
      </div>

      {/* 编辑弹窗 */}
      <EditAgentDialog
        isOpen={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        displayName={displayName}
        customColor={customColor}
        customAvatar={customAvatar}
        onSave={handleSave}
      />
    </>
  )
}
