import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  MessageSquare,
  Bot,
  Settings,
  ChevronLeft,
  ChevronRight,
  Clock,
  Wrench,
  Globe,
  Brain,
  DollarSign,
  BookOpen,
  Smartphone,
  MonitorSmartphone,
  Link2,
  Layout,
  Volume2,
  Reply,
  Users,
  Radio,
  Activity,
  FileText,
  Radar,
  Send,
  Key,
  RefreshCcw,
} from 'lucide-react'

/**
 * OpenClaw 导航结构（优化版）
 *
 * 设计原则：
 * 1. 核心功能前置（对话、智能体、记忆）
 * 2. 相关功能聚合（智能体相关功能放在一起）
 * 3. 系统功能后置（设置、监控）
 */
const navigationGroups = [
  {
    title: '对话',
    items: [
      { id: 'chat', label: 'AI 对话', icon: MessageSquare },
    ]
  },
  {
    title: '智能体',
    items: [
      { id: 'agents', label: '智能体管理', icon: Bot },
      { id: 'subagents', label: '子智能体', icon: Users },
      { id: 'canvas', label: 'Canvas 画布', icon: Layout },
      { id: 'a2a', label: 'A2A 通信', icon: Radio },
      { id: 'patterns', label: '模式库', icon: BookOpen },
    ]
  },
  {
    title: '记忆',
    items: [
      { id: 'memory', label: '记忆中心', icon: Brain },
    ]
  },
  {
    title: '能力',
    items: [
      { id: 'skills', label: 'Skills', icon: Wrench },
      { id: 'toolManager', label: '工具管理', icon: Settings },
      { id: 'browser', label: '浏览器', icon: Globe },
      { id: 'schedule', label: '定时任务', icon: Clock },
      { id: 'tts', label: 'TTS 语音', icon: Volume2 },
      { id: 'autoreply', label: '自动回复', icon: Reply },
      { id: 'proactive', label: '主动消息', icon: Send },
    ]
  },
  {
    title: '设备',
    items: [
      { id: 'nodes', label: '节点设备', icon: MonitorSmartphone },
      { id: 'pairing', label: '设备配对', icon: Link2 },
      { id: 'discovery', label: '节点发现', icon: Radar },
    ]
  },
  {
    title: '通道',
    items: [
      { id: 'channels', label: '通道管理', icon: Smartphone },
    ]
  },
  {
    title: '监控',
    items: [
      { id: 'cost', label: '成本追踪', icon: DollarSign },
      { id: 'heartbeat', label: '心跳监控', icon: Activity },
      { id: 'audit', label: '审计日志', icon: FileText },
      { id: 'failover', label: '故障转移', icon: RefreshCcw },
    ]
  },
  {
    title: '系统',
    items: [
      { id: 'secrets', label: '密钥管理', icon: Key },
      { id: 'settings', label: '设置', icon: Settings },
    ]
  },
]

const IconComponent = ({ icon: Icon, size }) => {
  return <Icon size={size} />
}

// 响应式断点
const MOBILE_BREAKPOINT = 768  // md

export default function Sidebar({ currentPage, onPageChange }) {
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
      // 大屏幕恢复展开（仅当之前是因为屏幕变小而自动折叠的）
      if (width >= MOBILE_BREAKPOINT && prevWidth < MOBILE_BREAKPOINT && collapsed) {
        setCollapsed(false)
      }
    }

    // 初始化时检查一次
    handleResize()

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [collapsed, windowWidth])

  // 切换折叠状态
  const toggleCollapsed = () => {
    setCollapsed(!collapsed)
  }

  return (
    <div
      className={cn(
        "h-full flex flex-col glass glass-border transition-all duration-300 ease-apple flex-shrink-0",
        collapsed ? "w-16" : "w-56 xl:w-64"
      )}
    >
      {/* Logo 区域 */}
      <div className="h-14 md:h-16 flex items-center px-3 md:px-4 border-b border-subtle">
        <Bot className="w-7 h-7 md:w-8 md:h-8 flex-shrink-0 text-primary" />
        {!collapsed && (
          <div className="ml-2 md:ml-3 overflow-hidden">
            <h1 className="font-bold text-base md:text-lg leading-tight">OpenClaw</h1>
            <p className="text-xs text-foreground-tertiary hidden sm:block">AI 助手</p>
          </div>
        )}
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 px-2 md:px-3 py-3 md:py-4 space-y-4 md:space-y-6 overflow-y-auto overflow-x-hidden">
        {navigationGroups.map((group) => (
          <div key={group.title}>
            {!collapsed && (
              <div className="px-2 md:px-3 mb-1.5 md:mb-2 text-xs font-medium text-foreground-tertiary uppercase tracking-wider">
                {group.title}
              </div>
            )}
            <div className="space-y-0.5 md:space-y-1">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onPageChange(item.id)}
                  className={cn(
                    "nav-item",
                    currentPage === item.id && "nav-item-active"
                  )}
                  title={collapsed ? item.label : ''}
                >
                  <IconComponent icon={item.icon} size={18} />
                  {!collapsed && (
                    <span className="font-medium text-sm">{item.label}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* 底部信息 - 固定高度对齐 */}
      <div className="h-14 md:h-16 flex items-center px-2 md:px-3 border-t border-subtle">
        <button
          onClick={toggleCollapsed}
          className="w-full flex items-center justify-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 text-foreground-secondary hover:text-foreground hover:bg-surface-elevated rounded-lg md:rounded-xl transition-all duration-normal"
          title={collapsed ? "展开侧边栏" : "收起侧边栏"}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span className="text-xs md:text-sm hidden sm:inline">收起</span>
              <span className="text-xs hidden lg:inline">（v1.0.0）</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
