import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Card, CardContent } from './ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Badge } from './ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Clock, ClipboardList, Play, Pause, Timer, Pin, Plus, RefreshCw, Trash2, Edit3, Loader2, Bot, MessageSquare, Zap, Calendar, Repeat, History } from 'lucide-react'

// 🆕 使用新的服务层
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

// 格式化时间戳为相对时间
const formatRelativeTime = (ms) => {
  if (!ms) return 'n/a'
  const now = Date.now()
  const diff = ms - now
  if (diff < 0) return '已过期'
  if (diff < 60000) return `${Math.floor(diff / 1000)}秒后`
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟后`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时后`
  return `${Math.floor(diff / 86400000)}天后`
}

// 格式化毫秒为可读时间
const formatMs = (ms) => {
  if (!ms) return 'n/a'
  return new Date(ms).toLocaleString('zh-CN')
}

export default function Schedule() {
  const [tasks, setTasks] = useState([])
  const [agents, setAgents] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showHistory, setShowHistory] = useState(null)
  const [history, setHistory] = useState([])
  const [deleteConfirm, setDeleteConfirm] = useState(null)  // 要删除的任务 ID

  // 统一处理 API 可能返回的数组/对象结构，避免直接 .filter/.map 崩溃
  const normalizeArray = (value, preferredKeys = []) => {
    if (Array.isArray(value)) return value
    if (!value || typeof value !== 'object') return []

    for (const key of preferredKeys) {
      if (Array.isArray(value[key])) return value[key]
    }

    return Object.values(value).filter(item => item && typeof item === 'object')
  }

  const normalizeTaskForUi = (task) => {
    const rawTask = task && typeof task === 'object' ? task : {}
    const schedule = rawTask.schedule && typeof rawTask.schedule === 'object' ? rawTask.schedule : {}
    const rawState = rawTask.state && typeof rawTask.state === 'object' ? rawTask.state : null

    const normalizedState = rawState
      ? {
          ...rawState,
          last_status: rawState.last_status ?? rawState.lastRunStatus ?? rawState.lastStatus ?? null,
          next_run_at_ms: rawState.next_run_at_ms ?? rawState.nextRunAtMs ?? null,
          run_count: rawState.run_count ?? rawState.runCount ?? 0,
        }
      : null

    return {
      ...rawTask,
      schedule_kind: rawTask.schedule_kind || schedule.kind || 'cron',
      cron_expression: rawTask.cron_expression || rawTask.cron || schedule.expr || '',
      cron: rawTask.cron || rawTask.cron_expression || schedule.expr || '',
      every_ms: rawTask.every_ms ?? schedule.everyMs ?? null,
      run_at: rawTask.run_at || schedule.at || schedule.runAt || null,
      agent_id: rawTask.agent_id || rawTask.agentId || rawTask.agent_config?.agent_id || '',
      action: rawTask.parameters?.action
        || rawTask.action
        || (rawTask.payload?.kind === 'systemEvent' ? 'reminder' : 'chat'),
      message: rawTask.parameters?.message || rawTask.message || rawTask.payload?.message || rawTask.payload?.text || '',
      target: rawTask.parameters?.target || rawTask.target || rawTask.payload?.model || '',
      delete_after_run: rawTask.delete_after_run ?? rawTask.deleteAfterRun ?? false,
      session_key: rawTask.session_key || rawTask.sessionKey || '',
      session_target: rawTask.session_target || rawTask.sessionTarget || 'main',
      wake_mode: rawTask.wake_mode || rawTask.wakeMode || 'now',
      state: normalizedState,
    }
  }

  const normalizeHistoryEntryForUi = (entry) => {
    const row = entry && typeof entry === 'object' ? entry : {}
    const taskId = row.task_id || row.taskId || row.jobId || ''
    const executedAt = row.executed_at || row.executedAt || (row.runAtMs ? new Date(row.runAtMs).toISOString() : null)

    return {
      ...row,
      task_id: String(taskId || ''),
      executed_at: executedAt,
      duration_ms: row.duration_ms ?? row.durationMs ?? 0,
      session_id: row.session_id || row.sessionId || null,
    }
  }

  const formatDateTimeLocalValue = (value) => {
    if (!value) return ''
    const ms = typeof value === 'number' ? value : Date.parse(value)
    if (!Number.isFinite(ms)) return ''
    const date = new Date(ms)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hour}:${minute}`
  }

  const buildGatewaySchedule = (rawForm) => {
    const scheduleKind = rawForm?.schedule_kind || 'cron'

    if (scheduleKind === 'every') {
      const amount = Math.max(1, Number.parseInt(String(rawForm?.every_amount || '1'), 10) || 1)
      const unit = rawForm?.every_unit || 'minutes'
      const multiplier = unit === 'days' ? 86400000 : (unit === 'hours' ? 3600000 : 60000)
      return { kind: 'every', everyMs: amount * multiplier }
    }

    if (scheduleKind === 'at') {
      const runAtInput = String(rawForm?.run_at || '').trim()
      const runAtMs = Date.parse(runAtInput)
      if (!Number.isFinite(runAtMs)) {
        throw new Error('指定时间格式无效')
      }
      return { kind: 'at', at: new Date(runAtMs).toISOString() }
    }

    const expr = String(rawForm?.cron || '').trim()
    if (!expr) {
      throw new Error('Cron 表达式不能为空')
    }
    return { kind: 'cron', expr }
  }

  const buildCronPayloadFromForm = (rawForm, options = {}) => {
    const existingTask = options.existingTask || null
    const name = String(rawForm?.name || '').trim()
    const description = String(rawForm?.description || '').trim()
    const rawMessage = String(rawForm?.message || '').trim()
    const message = rawMessage || description || name
    const model = String(rawForm?.target || '').trim()
    const agentId = String(rawForm?.agent_id || '').trim()
    const hasExistingAgent = Boolean(existingTask?.agentId || existingTask?.agent_id || existingTask?.agent_config?.agent_id)
    const warnings = []
    let sessionTarget = rawForm?.session_target === 'isolated' ? 'isolated' : 'main'
    const wakeMode = rawForm?.wake_mode === 'now' ? 'now' : 'next-heartbeat'

    if (!name) {
      throw new Error('任务名称不能为空')
    }

    if (sessionTarget === 'main' && agentId && agentId !== 'main') {
      // Gateway 约束：main 会话仅支持默认智能体；非 main 智能体必须 isolated。
      sessionTarget = 'isolated'
      warnings.push('非默认智能体不支持主会话，已自动切换为独立会话')
    }

    const payloadBody = sessionTarget === 'main'
      ? {
          kind: 'systemEvent',
          text: message,
        }
      : {
          kind: 'agentTurn',
          message,
          ...(model ? { model } : {}),
      }

    const requestedSessionKey = String(rawForm?.session_key || '').trim()
    const defaultAgentId = String((agentId || 'main')).trim() || 'main'
    const sessionKey = sessionTarget === 'main'
      ? (requestedSessionKey || 'main')
      : (requestedSessionKey || `agent:${defaultAgentId}:main`)

    const payload = {
      name,
      description: description || undefined,
      enabled: rawForm?.enabled !== false,
      deleteAfterRun: Boolean(rawForm?.delete_after_run),
      schedule: buildGatewaySchedule(rawForm),
      sessionKey,
      sessionTarget,
      wakeMode,
      payload: payloadBody,
    }

    // 为 isolated 任务显式设置 delivery，避免网关回落到“last route”造成随机串到 Telegram。
    if (sessionTarget === 'isolated') {
      const deliveryMode = String(rawForm?.delivery_mode || '').trim().toLowerCase()
      const telegramChatId = String(rawForm?.delivery_to || '').trim()

      if (deliveryMode === 'telegram') {
        if (!telegramChatId) {
          throw new Error('Telegram 推送需要填写 chatId')
        }
        payload.delivery = {
          mode: 'announce',
          channel: 'telegram',
          to: telegramChatId,
        }
      } else {
        payload.delivery = { mode: 'none' }
      }
    }

    if (sessionTarget === 'main') {
      if (agentId === 'main') {
        payload.agentId = 'main'
      } else if (existingTask && hasExistingAgent) {
        payload.agentId = null
      }
    } else if (agentId) {
      payload.agentId = agentId
    } else if (existingTask && hasExistingAgent) {
      // 编辑时从“绑定智能体”切到“无绑定”，需要显式传 null 以清除旧值
      payload.agentId = null
    }

    return { payload, warnings }
  }

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    schedule_kind: 'cron',
    cron: '0 0 * * *',
    every_amount: 1,
    every_unit: 'hours',
    run_at: '',
    enabled: true,
    delete_after_run: false,
    action: 'chat',
    target: '',
    message: '',
    agent_id: '',
    session_key: '',
    session_target: 'main',
    wake_mode: 'next-heartbeat',
    delivery_mode: 'none',
    delivery_to: '',
  })

  useEffect(() => {
    loadTasks()
    loadAgents()
  }, [])

  const loadAgents = async () => {
    // 🆕 使用统一 API 服务层
    const result = await api.agents.list()
    if (result.success) {
      // agent_list 返回 [[agent_id, identity_config], ...] 格式
      const rawAgents = normalizeArray(result.data, ['agents', 'items', 'list'])
      const formattedAgents = rawAgents
        .map((entry) => {
          if (Array.isArray(entry)) {
            const [id, identity] = entry
            return {
              id,
              name: identity?.name || id,
              emoji: identity?.emoji || '🤖'
            }
          }

          if (entry && typeof entry === 'object') {
            const id = entry.id || entry.agent_id
            if (!id) return null
            return {
              id,
              name: entry.name || entry.display_name || id,
              emoji: entry.emoji || '🤖'
            }
          }

          return null
        })
        .filter(Boolean)
      setAgents(formattedAgents)
    } else {
      console.error('加载 Agent 列表失败:', result.error)
      setAgents([])
    }
  }

  const loadTasks = async () => {
    setIsLoading(true)
    console.log('📋 正在加载定时任务...')
    // 🆕 使用统一 API 服务层
    const result = await api.cron.list()
    if (result.success) {
      console.log('📋 加载结果:', result.data)
      const rawTasks = normalizeArray(result.data, ['tasks', 'items', 'list', 'jobs'])
      const seenKeys = new Set()
      const normalizedTasks = rawTasks
        .filter(task => task && typeof task === 'object' && !Array.isArray(task))
        .map((task, index) => {
        const normalizedTask = normalizeTaskForUi(task)
        const baseId =
          normalizedTask?.id ??
          normalizedTask?.jobId ??
          normalizedTask?.job_id ??
          normalizedTask?.taskId ??
          normalizedTask?.task_id ??
          null

        const normalizedId = baseId != null ? String(baseId) : null
        const keySeed =
          normalizedId ||
          String(normalizedTask?.name || '').trim() ||
          `task-${index}`

        let uiKey = keySeed
        let suffix = 1
        while (seenKeys.has(uiKey)) {
          suffix += 1
          uiKey = `${keySeed}-${suffix}`
        }
        seenKeys.add(uiKey)

        return {
          ...normalizedTask,
          id: normalizedId,
          _uiKey: uiKey,
        }
      })
        .filter(task => task && task.id)
      setTasks(normalizedTasks)
    } else {
      console.error('加载定时任务失败:', result.error)
      toast.error('加载失败', result.error)
      setTasks([])
    }
    setIsLoading(false)
  }

  const loadHistory = async (taskId) => {
    // 🆕 使用统一 API 服务层
    const result = await api.cron.history()
    if (result.success) {
      const records = normalizeArray(result.data, ['history', 'items', 'records', 'entries'])
        .map(normalizeHistoryEntryForUi)
      const targetTaskId = String(taskId || '')
      const taskHistory = records.filter(r => r.task_id === targetTaskId)
      setHistory(taskHistory)
      setShowHistory(taskId)
    } else {
      console.error('加载历史失败:', result.error)
      setHistory([])
    }
  }

  const saveTask = async () => {
    setIsLoading(true)
    console.log('📋 保存任务:', { editingTask, formData })
    try {
      const { payload, warnings } = buildCronPayloadFromForm(formData, { existingTask: editingTask })
      if (warnings.length > 0) {
        toast.warning('已自动调整任务参数', warnings.join('；'))
      }
      let result
      if (editingTask) {
        console.log('📋 更新任务 ID:', editingTask.id)
        result = await api.cron.update(editingTask.id, payload)
      } else {
        console.log('📋 创建新任务')
        result = await api.cron.create(payload)
      }

      if (result.success) {
        await loadTasks()
        closeModal()
        toast.success(editingTask ? '更新成功' : '创建成功', '定时任务已保存')
      } else {
        console.error('❌ 保存失败:', result.error)
        toast.error('保存失败', result.error)
      }
    } catch (error) {
      const message = error?.message || '参数无效'
      console.error('❌ 保存失败:', error)
      toast.error('保存失败', message)
    }
    setIsLoading(false)
  }

  const deleteTask = async (taskId) => {
    console.log('📋 删除任务:', taskId)
    // 🆕 使用统一 API 服务层
    const result = await api.cron.delete(taskId)
    if (result.success) {
      setDeleteConfirm(null)
      await loadTasks()
      toast.success('删除成功', '定时任务已删除')
    } else {
      console.error('❌ 删除失败:', result.error)
      toast.error('删除失败', result.error)
    }
  }

  const confirmDelete = (taskId) => {
    console.log('📋 确认删除:', taskId)
    setDeleteConfirm(taskId)
  }

  const toggleTask = async (taskId) => {
    // 🆕 使用统一 API 服务层
    const result = await api.cron.toggle(taskId)
    if (result.success) {
      await loadTasks()
    } else {
      toast.error('操作失败', result.error)
    }
  }

  const runTaskNow = async (taskId) => {
    // 🆕 使用统一 API 服务层
    const result = await api.cron.runNow(taskId)
    if (result.success) {
      toast.success('任务已触发', '定时任务正在执行')
    } else {
      toast.error('触发失败', result.error)
    }
  }

  const openNewModal = () => {
    setFormData({
      name: '',
      description: '',
      schedule_kind: 'cron',
      cron: '0 0 * * *',
      every_amount: 1,
      every_unit: 'hours',
      run_at: '',
      enabled: true,
      delete_after_run: false,
      action: 'chat',
      target: '',
      message: '',
      agent_id: '',
      session_key: '',
      session_target: 'main',
      wake_mode: 'next-heartbeat',
      delivery_mode: 'none',
      delivery_to: '',
    })
    setEditingTask(null)
    setShowModal(true)
  }

  const openEditModal = (task) => {
    const everyMs = task.every_ms ?? task.schedule?.everyMs

    const delivery = task?.delivery && typeof task.delivery === 'object' ? task.delivery : {}
    const normalizedDeliveryMode = String(delivery.mode || '').trim().toLowerCase()
    const normalizedDeliveryChannel = String(delivery.channel || '').trim().toLowerCase()
    const telegramDeliveryEnabled = normalizedDeliveryMode === 'announce'
      && normalizedDeliveryChannel === 'telegram'
      && String(delivery.to || '').trim().length > 0

    setFormData({
      name: task.name,
      description: task.description,
      schedule_kind: task.schedule_kind || task.schedule?.kind || 'cron',
      cron: task.cron_expression || task.cron || task.schedule?.expr || '0 * * * *',
      every_amount: everyMs ? Math.max(1, Math.floor(everyMs / 60000)) : 1,
      every_unit: 'minutes',
      run_at: formatDateTimeLocalValue(task.run_at || task.schedule?.at || task.schedule?.runAt || ''),
      enabled: task.enabled !== false,
      delete_after_run: task.delete_after_run || false,
      action: task.parameters?.action || task.action || (task.payload?.kind === 'systemEvent' ? 'reminder' : 'chat'),
      target: task.parameters?.target || task.target || task.payload?.model || '',
      message: task.parameters?.message || task.message || task.payload?.message || task.payload?.text || '',
      agent_id: task.agent_config?.agent_id || task.agent_id || task.agentId || '',
      session_key: task.session_key || task.sessionKey || '',
      session_target: task.session_target || task.sessionTarget || 'main',
      wake_mode: task.wake_mode || task.wakeMode || 'next-heartbeat',
      delivery_mode: telegramDeliveryEnabled ? 'telegram' : 'none',
      delivery_to: telegramDeliveryEnabled ? String(delivery.to || '') : '',
    })
    setEditingTask(task)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingTask(null)
  }

  const cronPresets = [
    { label: '每分钟', value: '* * * * *' },
    { label: '每小时', value: '0 * * * *' },
    { label: '每天 0点', value: '0 0 * * *' },
    { label: '每天 9点', value: '0 9 * * *' },
    { label: '每天 12点', value: '0 12 * * *' },
    { label: '每天 18点', value: '0 18 * * *' },
    { label: '每周一 9点', value: '0 9 * * 1' },
    { label: '每月1号 0点', value: '0 0 1 * *' },
    { label: '每30分钟', value: '*/30 * * * *' },
  ]

  const safeTasks = Array.isArray(tasks) ? tasks : []
  const safeAgents = Array.isArray(agents) ? agents : []
  const runningCount = safeTasks.filter(t => t.enabled).length
  const pausedCount = safeTasks.filter(t => !t.enabled).length

  const filteredTasks = safeTasks.filter(task =>
    String(task?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(task?.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getAgentDisplayName = (agentId) => {
    if (!agentId) return '未知'
    const agent = safeAgents.find(a => a.id === agentId)
    return agent?.name || agent?.display_name || agentId
  }

  // 获取调度显示文本
  const getScheduleDisplay = (task) => {
    const scheduleKind = task.schedule_kind || task.schedule?.kind

    switch (scheduleKind) {
      case 'every':
        const ms = task.every_ms || task.schedule?.everyMs || 60000
        const mins = Math.floor(ms / 60000)
        if (mins < 60) return `每 ${mins} 分钟`
        if (mins < 1440) return `每 ${Math.floor(mins / 60)} 小时`
        return `每 ${Math.floor(mins / 1440)} 天`
      case 'at': {
        const runAt = task.run_at || task.schedule?.at || task.schedule?.runAt
        if (runAt) {
          const ts = typeof runAt === 'number' ? runAt : new Date(runAt).getTime()
          if (Number.isFinite(ts)) {
            return `于 ${new Date(ts).toLocaleString('zh-CN')}`
          }
        }
        if (Number.isFinite(task.schedule?.runAtMs)) {
          return `于 ${new Date(task.schedule.runAtMs).toLocaleString('zh-CN')}`
        }
        return '指定时间'
      }
      default:
        return task.cron_expression || task.cron || task.schedule?.expr || '未设置'
    }
  }

  // 获取状态颜色
  const getStatusColor = (status) => {
    switch (status) {
      case 'ok': return 'text-green-600 bg-green-50'
      case 'error': return 'text-red-600 bg-red-50'
      case 'skipped': return 'text-yellow-600 bg-yellow-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  return (
    <div className="space-y-4">
      {/* 顶部栏 */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Input
            placeholder="搜索任务..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10 h-9"
          />
          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-tertiary" />
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <ClipboardList className="w-3 h-3" />
            {safeTasks.length} 任务
          </Badge>
          <Badge variant="secondary" className="gap-1 text-green-600">
            <Play className="w-3 h-3" />
            {runningCount} 运行
          </Badge>
          <Badge variant="secondary" className="gap-1 text-foreground-tertiary">
            <Pause className="w-3 h-3" />
            {pausedCount} 暂停
          </Badge>
        </div>

        <Button size="sm" variant="outline" onClick={loadTasks} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
        <Button size="sm" onClick={openNewModal}>
          <Plus className="w-4 h-4 mr-1" />
          新建
        </Button>
      </div>

      {/* 任务列表 */}
      {isLoading ? (
        <div className="text-center py-12 text-foreground-secondary">
          <Loader2 className="w-8 h-8 mx-auto animate-spin mb-2" />
          <div>加载中...</div>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-12 text-foreground-secondary">
          <ClipboardList className="w-16 h-16 mx-auto mb-4 text-foreground-tertiary" />
          <div className="text-lg font-medium text-foreground mb-1">暂无定时任务</div>
          <div className="text-sm">点击「新建」创建第一个定时任务</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredTasks.map((task, index) => (
            <Card
              key={task._uiKey || task.id || `task-${index}`}
              className={`group hover:shadow-md transition-all duration-200 ${
                task.enabled ? 'hover:border-primary/30' : 'opacity-70'
              }`}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-2.5">
                  <Button
                    onClick={() => toggleTask(task.id)}
                    variant="ghost"
                    size="sm"
                    className={`w-9 h-9 p-0 rounded-lg flex-shrink-0 ${
                      task.enabled ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-surface-elevated text-foreground-tertiary'
                    }`}
                  >
                    {task.enabled ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  </Button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`font-medium text-sm truncate ${task.enabled ? '' : 'text-foreground-secondary'}`}>
                        {task.name}
                      </span>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${
                        task.enabled ? 'text-green-600' : 'text-foreground-tertiary'
                      }`}>
                        {task.enabled ? '运行中' : '已暂停'}
                      </Badge>
                      {/* 一次性任务标记 */}
                      {task.delete_after_run && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-orange-600">
                          一次性
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-foreground-secondary line-clamp-1 mt-0.5">
                      {task.description || '无描述'}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-foreground-tertiary flex-wrap">
                      {/* 调度类型图标 */}
                      <span className="flex items-center gap-1 bg-surface-elevated px-1.5 py-0.5 rounded">
                        {(task.schedule_kind || task.schedule?.kind) === 'every' ? <Repeat className="w-2.5 h-2.5" /> :
                         (task.schedule_kind || task.schedule?.kind) === 'at' ? <Calendar className="w-2.5 h-2.5" /> :
                         <Timer className="w-2.5 h-2.5" />}
                        <span className="font-mono">{getScheduleDisplay(task)}</span>
                      </span>
                      <span className="flex items-center gap-1 bg-surface-elevated px-1.5 py-0.5 rounded">
                        <Pin className="w-2.5 h-2.5" />
                        {task.parameters?.action || task.action || 'chat'}
                      </span>
                      {/* Agent */}
                      {(task.agent_config?.agent_id || task.agent_id) && (
                        <span className="flex items-center gap-1 bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                          <Bot className="w-2.5 h-2.5" />
                          {getAgentDisplayName(task.agent_config?.agent_id || task.agent_id)}
                        </span>
                      )}
                    </div>
                    {/* 消息预览 */}
                    {(task.parameters?.message || task.message) && (
                      <div className="flex items-start gap-1 mt-1.5 text-[10px] text-foreground-secondary bg-surface-elevated px-1.5 py-1 rounded">
                        <MessageSquare className="w-2.5 h-2.5 flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{task.parameters?.message || task.message}</span>
                      </div>
                    )}
                    {/* 运行状态 */}
                    {task.state && (
                      <div className="flex items-center gap-2 mt-1.5 text-[10px]">
                        {task.state.last_status && (
                          <span className={`px-1.5 py-0.5 rounded ${getStatusColor(task.state.last_status)}`}>
                            {task.state.last_status === 'ok' ? '✓ 成功' :
                             task.state.last_status === 'error' ? '✗ 失败' : '○ 跳过'}
                          </span>
                        )}
                        {task.state.next_run_at_ms && (
                          <span className="text-foreground-tertiary">
                            下次: {formatRelativeTime(task.state.next_run_at_ms)}
                          </span>
                        )}
                        {task.state.run_count > 0 && (
                          <span className="text-foreground-tertiary">
                            已运行 {task.state.run_count} 次
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-border-subtle">
                  <Button
                    onClick={() => runTaskNow(task.id)}
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    title="立即运行"
                  >
                    <Zap className="w-3 h-3" />
                  </Button>
                  <Button
                    onClick={() => loadHistory(task.id)}
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    title="运行历史"
                  >
                    <History className="w-3 h-3" />
                  </Button>
                  <Button onClick={() => openEditModal(task)} variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <Edit3 className="w-3 h-3" />
                  </Button>
                  <Button onClick={() => confirmDelete(task.id)} variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 运行历史弹窗 */}
      <Dialog open={!!showHistory} onOpenChange={() => setShowHistory(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>运行历史</DialogTitle>
          </DialogHeader>
          {history.length === 0 ? (
            <div className="text-center py-8 text-foreground-secondary">
              暂无运行记录
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {history.map((entry, idx) => (
                <div key={idx} className="p-2 bg-surface-elevated rounded text-sm">
                  <div className="flex items-center justify-between">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${getStatusColor(entry.status)}`}>
                      {entry.status === 'ok' ? '成功' :
                       entry.status === 'error' ? '失败' : '跳过'}
                    </span>
                    <span className="text-xs text-foreground-tertiary">
                      {entry.executed_at ? formatMs(new Date(entry.executed_at).getTime()) : 'n/a'}
                    </span>
                  </div>
                  {entry.summary && (
                    <p className="mt-1 text-xs text-foreground-secondary">{entry.summary}</p>
                  )}
                  {entry.error && (
                    <p className="mt-1 text-xs text-red-500">{entry.error}</p>
                  )}
                  <div className="mt-1 text-xs text-foreground-tertiary">
                    耗时: {entry.duration_ms}ms
                    {entry.session_id && <span className="ml-2">会话: {entry.session_id}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-foreground-secondary">
            确定要删除这个任务吗？此操作无法撤销。
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>取消</Button>
            <Button variant="destructive" size="sm" onClick={() => deleteTask(deleteConfirm)}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新建/编辑弹窗 */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTask ? '编辑任务' : '新建任务'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label className="text-xs text-foreground-tertiary">任务名称</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="每日摘要" className="mt-1 h-9" />
            </div>

            <div>
              <Label className="text-xs text-foreground-tertiary">描述</Label>
              <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="任务描述..." className="mt-1 h-9" />
            </div>

            {/* 调度类型选择 */}
            <div>
              <Label className="text-xs text-foreground-tertiary">调度类型</Label>
              <Select value={formData.schedule_kind} onValueChange={(value) => setFormData({ ...formData, schedule_kind: value })}>
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cron">Cron 表达式</SelectItem>
                  <SelectItem value="every">间隔执行</SelectItem>
                  <SelectItem value="at">指定时间</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Cron 表达式 */}
            {formData.schedule_kind === 'cron' && (
              <div>
                <Label className="text-xs text-foreground-tertiary">Cron 表达式</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={formData.cron} onChange={(e) => setFormData({ ...formData, cron: e.target.value })} className="flex-1 font-mono h-9" placeholder="0 * * * *" />
                  <Select value={formData.cron} onValueChange={(value) => setFormData({ ...formData, cron: value })}>
                    <SelectTrigger className="w-28 h-9">
                      <SelectValue placeholder="预设" />
                    </SelectTrigger>
                    <SelectContent>
                      {cronPresets.map(preset => (
                        <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[10px] text-foreground-tertiary mt-1">格式：秒 分 时 日 月 周（6字段）</p>
              </div>
            )}

            {/* 间隔执行 */}
            {formData.schedule_kind === 'every' && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="text-xs text-foreground-tertiary">间隔数量</Label>
                  <Input
                    type="number"
                    value={formData.every_amount}
                    onChange={(e) => setFormData({ ...formData, every_amount: parseInt(e.target.value) || 1 })}
                    className="mt-1 h-9"
                    min={1}
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-foreground-tertiary">单位</Label>
                  <Select value={formData.every_unit} onValueChange={(value) => setFormData({ ...formData, every_unit: value })}>
                    <SelectTrigger className="mt-1 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutes">分钟</SelectItem>
                      <SelectItem value="hours">小时</SelectItem>
                      <SelectItem value="days">天</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* 指定时间 */}
            {formData.schedule_kind === 'at' && (
              <div>
                <Label className="text-xs text-foreground-tertiary">运行时间</Label>
                <Input
                  type="datetime-local"
                  value={formData.run_at}
                  onChange={(e) => setFormData({ ...formData, run_at: e.target.value })}
                  className="mt-1 h-9"
                />
              </div>
            )}

            <div>
              <Label className="text-xs text-foreground-tertiary">执行动作</Label>
              <Select value={formData.action} onValueChange={(value) => setFormData({ ...formData, action: value })}>
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chat">发送消息</SelectItem>
                  <SelectItem value="skill">执行技能</SelectItem>
                  <SelectItem value="command">运行命令</SelectItem>
                  <SelectItem value="reminder">设置提醒</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Agent 选择器 */}
            <div>
              <Label className="text-xs text-foreground-tertiary">绑定 Agent（可选）</Label>
              <Select
                value={formData.agent_id || 'none'}
                onValueChange={(value) => setFormData({ ...formData, agent_id: value === 'none' ? '' : value })}
              >
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue placeholder="选择要绑定的 Agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不绑定 Agent</SelectItem>
                  {safeAgents.map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>
                      <div className="flex items-center gap-2">
                        <Bot className="w-3 h-3" />
                        {agent.name || agent.display_name || agent.id}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 高级选项 */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-foreground-tertiary">会话目标</Label>
                <Select value={formData.session_target} onValueChange={(value) => setFormData({ ...formData, session_target: value })}>
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="main">主会话</SelectItem>
                    <SelectItem value="isolated">独立会话</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-foreground-tertiary">唤醒模式</Label>
                <Select value={formData.wake_mode} onValueChange={(value) => setFormData({ ...formData, wake_mode: value })}>
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="now">立即执行</SelectItem>
                    <SelectItem value="next-heartbeat">下次心跳</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.session_target === 'isolated' && (
              <div className="space-y-2 rounded-md border border-border-subtle bg-surface-elevated/40 p-2">
                <div>
                  <Label className="text-xs text-foreground-tertiary">执行结果推送</Label>
                  <Select value={formData.delivery_mode} onValueChange={(value) => setFormData({ ...formData, delivery_mode: value })}>
                    <SelectTrigger className="mt-1 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">仅内部执行（推荐）</SelectItem>
                      <SelectItem value="telegram">推送到 Telegram</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.delivery_mode === 'telegram' && (
                  <div>
                    <Label className="text-xs text-foreground-tertiary">Telegram chatId</Label>
                    <Input
                      value={formData.delivery_to}
                      onChange={(e) => setFormData({ ...formData, delivery_to: e.target.value })}
                      placeholder="例如: 8082835829 或 -1001234567890"
                      className="mt-1 h-9"
                    />
                  </div>
                )}
              </div>
            )}

            {formData.action === 'chat' && (
              <>
                <div>
                  <Label className="text-xs text-foreground-tertiary">目标</Label>
                  <Input value={formData.target} onChange={(e) => setFormData({ ...formData, target: e.target.value })} placeholder="AI 提供商 (如: qwen)" className="mt-1 h-9" />
                </div>
                <div>
                  <Label className="text-xs text-foreground-tertiary">消息内容</Label>
                  <Textarea value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} rows={2} placeholder="要发送的消息..." className="mt-1 text-sm" />
                </div>
              </>
            )}

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <span className="text-xs">启用任务</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.delete_after_run}
                  onChange={(e) => setFormData({ ...formData, delete_after_run: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <span className="text-xs">一次性任务</span>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={closeModal}>取消</Button>
            <Button size="sm" onClick={saveTask} disabled={!formData.name || isLoading}>
              {isLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
