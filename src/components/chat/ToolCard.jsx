/**
 * ToolCard - 工具调用卡片组件
 * 展示 AI 的工具调用过程和结果
 * 🔥 默认折叠显示，用户点击展开查看详情
 */
import React, { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Check,
  FileText,
  Globe,
  Terminal,
  Database,
  Search,
  Image,
  Code,
  FolderOpen,
  Clock,
  Cpu,
  Wrench
} from 'lucide-react'

// 工具图标映射
const toolIcons = {
  browser_navigate: Globe,
  browser_click: Globe,
  browser_type: Globe,
  browser_snapshot: Image,
  browser_screenshot: Image,
  fs_read: FileText,
  fs_write: FileText,
  fs_list: FolderOpen,
  web_search: Search,
  web_fetch: Globe,
  memory_search: Database,
  memory_get: Database,
  memory_store: Database,
  node_call: Cpu,
  node_list: Cpu,
  canvas_push: Image,
  cron_create: Clock,
  cron_list: Clock,
  default: Wrench
}

// 工具名称映射
const toolLabels = {
  browser_navigate: '导航到网页',
  browser_click: '点击元素',
  browser_type: '输入文本',
  browser_snapshot: '获取页面快照',
  browser_screenshot: '截图',
  fs_read: '读取文件',
  fs_write: '写入文件',
  fs_list: '列出目录',
  web_search: '网络搜索',
  web_fetch: '获取网页',
  memory_search: '搜索记忆',
  memory_get: '获取记忆',
  memory_store: '存储记忆',
  node_call: '调用节点',
  node_list: '列出节点',
  canvas_push: '推送画布',
  cron_create: '创建定时任务',
  cron_list: '列出定时任务'
}

/**
 * 获取工具显示信息
 */
function getToolDisplay(toolName) {
  const icon = toolIcons[toolName] || toolIcons.default
  const label = toolLabels[toolName] || toolName
  return { icon, label }
}

/**
 * 截断预览文本
 */
function truncatePreview(text, maxLength = 80) {
  if (!text) return ''
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= maxLength) return cleaned
  return cleaned.slice(0, maxLength) + '...'
}

/**
 * 工具卡片组件
 * 🔥 默认折叠，点击展开查看详情
 */
export function ToolCard({ name, args, result, status = 'completed', onClick }) {
  const [expanded, setExpanded] = useState(false) // 🔥 默认折叠
  const { icon: Icon, label } = getToolDisplay(name)

  const hasResult = result && result.trim()
  const hasArgs = args && (typeof args === 'object' ? Object.keys(args).length > 0 : args.length > 0)

  // 解析参数用于显示
  let argsPreview = ''
  let argsDetail = ''
  if (args) {
    try {
      const parsed = typeof args === 'string' ? JSON.parse(args) : args
      // 提取关键参数用于预览
      if (parsed.path) argsPreview = parsed.path
      else if (parsed.url) argsPreview = parsed.url
      else if (parsed.query) argsPreview = parsed.query
      else if (parsed.message) argsPreview = truncatePreview(parsed.message, 50)
      else if (typeof parsed === 'object') {
        const keys = Object.keys(parsed).slice(0, 2)
        argsPreview = keys.map(k => `${k}=${String(parsed[k]).slice(0, 20)}`).join(', ')
      }
      // 完整参数用于详情
      argsDetail = typeof args === 'string' ? args : JSON.stringify(parsed, null, 2)
    } catch {
      argsPreview = String(args).slice(0, 50)
      argsDetail = String(args)
    }
  }

  return (
    <div className="tool-card">
      {/* 卡片头部 - 可点击展开 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="tool-card__header w-full text-left"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          <Icon className="w-4 h-4 tool-card__icon" />
          <span className="font-medium">{label}</span>
          {argsPreview && (
            <code className="text-xs text-muted-foreground ml-1 truncate max-w-[200px]">
              {argsPreview}
            </code>
          )}
        </div>
        {/* 状态指示 */}
        <div className="flex items-center gap-2">
          {hasResult && (
            <span className="text-xs text-muted-foreground">
              {result.length > 1000 ? `${Math.round(result.length / 1024)}KB` : `${result.length}字符`}
            </span>
          )}
          <Check className="w-4 h-4 text-green-500" />
        </div>
      </button>

      {/* 展开内容 */}
      {expanded && (
        <div className="tool-card__detail mt-2 space-y-2">
          {/* 参数 */}
          {hasArgs && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">参数</div>
              <pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto max-h-[200px]">
                <code>{argsDetail}</code>
              </pre>
            </div>
          )}

          {/* 结果 */}
          {hasResult && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">返回结果</div>
              <pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto max-h-[400px]">
                <code>{result}</code>
              </pre>
            </div>
          )}

          {/* 无结果 */}
          {!hasResult && !hasArgs && (
            <div className="text-xs text-muted-foreground">
              执行完成，无返回内容
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * 从消息中提取工具调用
 */
export function extractToolCalls(message) {
  if (!message) return []

  const calls = []

  // 处理 content 数组格式
  if (Array.isArray(message.content)) {
    for (const item of message.content) {
      const type = (item.type || '').toLowerCase()

      // 工具调用
      if (['toolcall', 'tool_call', 'tooluse', 'tool_use'].includes(type) ||
          (item.name && item.arguments)) {
        calls.push({
          type: 'call',
          name: item.name || 'tool',
          args: item.arguments || item.args
        })
      }

      // 工具结果
      if (['toolresult', 'tool_result'].includes(type)) {
        calls.push({
          type: 'result',
          name: item.name || 'tool',
          result: item.text || item.content
        })
      }
    }
  }

  // 处理 tool_calls 字段
  if (message.tool_calls) {
    for (const tc of message.tool_calls) {
      calls.push({
        type: 'call',
        name: tc.function?.name || tc.name || 'tool',
        args: tc.function?.arguments || tc.arguments
      })
    }
  }

  // 处理 tool_call_id（工具结果）
  if (message.tool_call_id && message.content) {
    calls.push({
      type: 'result',
      name: message.name || 'tool',
      result: typeof message.content === 'string'
        ? message.content
        : JSON.stringify(message.content)
    })
  }

  return calls
}

export default ToolCard
