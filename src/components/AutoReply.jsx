import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Badge } from './ui/badge'
import { Switch } from './ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import {
  MessageSquare,
  Plus,
  RefreshCw,
  Trash2,
  Edit3,
  Loader2,
  Zap,
  Clock,
  Hash,
  Code,
  Webhook,
  Bot,
  Terminal,
  Play,
  Pause
} from 'lucide-react'

// 🆕 使用新的服务层
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

// 触发器类型配置组件
function TriggerConfig({ trigger, onChange }) {
  if (!trigger) return null

  switch (trigger.type) {
    case 'keyword':
      return (
        <div className="space-y-2">
          <Label>关键词 (逗号分隔)</Label>
          <Input
            placeholder="hello, hi, 你好"
            value={trigger.keywords?.join(', ') || ''}
            onChange={(e) => onChange({
              ...trigger,
              keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean)
            })}
          />
        </div>
      )
    case 'pattern':
      return (
        <div className="space-y-2">
          <Label>正则表达式</Label>
          <Input
            placeholder="\d{4}"
            value={trigger.regex || ''}
            onChange={(e) => onChange({ ...trigger, regex: e.target.value })}
          />
        </div>
      )
    case 'ai':
      return (
        <div className="space-y-2">
          <Label>AI 判断提示词</Label>
          <Textarea
            placeholder="判断这条消息是否需要自动回复..."
            value={trigger.prompt || ''}
            onChange={(e) => onChange({ ...trigger, prompt: e.target.value })}
            rows={3}
          />
        </div>
      )
    case 'schedule':
      return (
        <div className="space-y-2">
          <Label>Cron 表达式</Label>
          <Input
            placeholder="0 0 * * * *"
            value={trigger.cron || ''}
            onChange={(e) => onChange({ ...trigger, cron: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">秒 分 时 日 月 周</p>
        </div>
      )
    default:
      return null
  }
}

// 动作类型配置组件
function ActionConfig({ action, onChange }) {
  if (!action) return null

  switch (action.type) {
    case 'text':
      return (
        <div className="space-y-2">
          <Label>回复模板</Label>
          <Textarea
            placeholder="支持 {message}, {channel}, {user_id} 变量"
            value={action.template || ''}
            onChange={(e) => onChange({ ...action, template: e.target.value })}
            rows={3}
          />
        </div>
      )
    case 'agent':
      return (
        <div className="space-y-2">
          <Label>模型</Label>
          <Input
            placeholder="留空使用默认模型"
            value={action.model || ''}
            onChange={(e) => onChange({ ...action, model: e.target.value || null })}
          />
          <Label className="mt-2">系统提示词</Label>
          <Textarea
            placeholder="可选的系统提示词"
            value={action.system_prompt || ''}
            onChange={(e) => onChange({ ...action, system_prompt: e.target.value || null })}
            rows={3}
          />
        </div>
      )
    case 'command':
      return (
        <div className="space-y-2">
          <Label>命令</Label>
          <Input
            placeholder="/bin/echo"
            value={action.command || ''}
            onChange={(e) => onChange({ ...action, command: e.target.value })}
          />
          <Label className="mt-2">参数 (逗号分隔)</Label>
          <Input
            placeholder="arg1, arg2"
            value={action.args?.join(', ') || ''}
            onChange={(e) => onChange({
              ...action,
              args: e.target.value.split(',').map(a => a.trim()).filter(Boolean)
            })}
          />
        </div>
      )
    case 'webhook':
      return (
        <div className="space-y-2">
          <Label>URL</Label>
          <Input
            placeholder="https://api.example.com/webhook"
            value={action.url || ''}
            onChange={(e) => onChange({ ...action, url: e.target.value })}
          />
          <Label className="mt-2">HTTP 方法</Label>
          <Select
            value={action.method || 'POST'}
            onValueChange={(v) => onChange({ ...action, method: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GET">GET</SelectItem>
              <SelectItem value="POST">POST</SelectItem>
              <SelectItem value="PUT">PUT</SelectItem>
              <SelectItem value="DELETE">DELETE</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )
    default:
      return null
  }
}

// 触发器类型图标
const TriggerIcon = ({ type }) => {
  switch (type) {
    case 'keyword': return <Hash className="h-4 w-4" />
    case 'pattern': return <Code className="h-4 w-4" />
    case 'ai': return <Bot className="h-4 w-4" />
    case 'schedule': return <Clock className="h-4 w-4" />
    case 'webhook': return <Webhook className="h-4 w-4" />
    default: return <Zap className="h-4 w-4" />
  }
}

// 动作类型图标
const ActionIcon = ({ type }) => {
  switch (type) {
    case 'text': return <MessageSquare className="h-4 w-4" />
    case 'agent': return <Bot className="h-4 w-4" />
    case 'command': return <Terminal className="h-4 w-4" />
    case 'webhook': return <Webhook className="h-4 w-4" />
    default: return <Zap className="h-4 w-4" />
  }
}

export default function AutoReply() {
  const [rules, setRules] = useState([])
  const [status, setStatus] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingRule, setEditingRule] = useState(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trigger: { type: 'keyword', keywords: [] },
    action: { type: 'text', template: '' },
    channels: [],
    enabled: true,
    priority: 0,
    cooldown_seconds: null
  })

  useEffect(() => {
    loadRules()
    loadStatus()
  }, [])

  const loadRules = async () => {
    setIsLoading(true)
    // 🆕 使用统一 API 服务层
    const result = await api.autoReply.list()
    if (result.success) {
      setRules(result.data?.rules || [])
    } else {
      console.error('加载规则失败:', result.error)
    }
    setIsLoading(false)
  }

  const loadStatus = async () => {
    // 🆕 使用统一 API 服务层
    const result = await api.autoReply.status()
    if (result.success) {
      setStatus(result.data)
    } else {
      console.error('加载状态失败:', result.error)
    }
  }

  const handleSave = async () => {
    let result
    if (editingRule) {
      result = await api.autoReply.update(editingRule.id, { ...formData, id: editingRule.id })
    } else {
      result = await api.autoReply.create(formData)
    }

    if (result.success) {
      setShowModal(false)
      setEditingRule(null)
      setFormData({
        name: '',
        description: '',
        trigger: { type: 'keyword', keywords: [] },
        action: { type: 'text', template: '' },
        channels: [],
        enabled: true,
        priority: 0,
        cooldown_seconds: null
      })
      loadRules()
      toast.success('保存成功', editingRule ? '规则已更新' : '规则已创建')
    } else {
      console.error('保存规则失败:', result.error)
      toast.error('保存失败', result.error)
    }
  }

  const handleEdit = (rule) => {
    setEditingRule(rule)
    setFormData({
      name: rule.name,
      description: rule.description || '',
      trigger: rule.trigger,
      action: rule.action,
      channels: rule.channels || [],
      enabled: rule.enabled,
      priority: rule.priority || 0,
      cooldown_seconds: rule.cooldown_seconds
    })
    setShowModal(true)
  }

  const handleDelete = async (ruleId) => {
    if (!confirm('确定要删除这条规则吗？')) return

    // 🆕 使用统一 API 服务层
    const result = await api.autoReply.delete(ruleId)
    if (result.success) {
      loadRules()
      toast.success('删除成功', '规则已删除')
    } else {
      console.error('删除规则失败:', result.error)
      toast.error('删除失败', result.error)
    }
  }

  const handleToggle = async (ruleId, enabled) => {
    // 🆕 使用统一 API 服务层
    const result = enabled
      ? await api.autoReply.enable(ruleId)
      : await api.autoReply.disable(ruleId)
    if (result.success) {
      loadRules()
    } else {
      console.error('切换状态失败:', result.error)
      toast.error('操作失败', result.error)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">自动回复</h2>
          <p className="text-muted-foreground">配置智能自动回复规则</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadRules} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button size="sm" onClick={() => {
            setEditingRule(null)
            setFormData({
              name: '',
              description: '',
              trigger: { type: 'keyword', keywords: [] },
              action: { type: 'text', template: '' },
              channels: [],
              enabled: true,
              priority: 0,
              cooldown_seconds: null
            })
            setShowModal(true)
          }}>
            <Plus className="h-4 w-4 mr-2" />
            新建规则
          </Button>
        </div>
      </div>

      {/* 状态卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            系统状态
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">总规则数:</span>
              <Badge variant="outline">{status?.total_rules || 0}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">已启用:</span>
              <Badge>{status?.enabled_rules || 0}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 规则列表 */}
      <div className="space-y-4">
        {rules.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              暂无规则，点击"新建规则"创建第一条自动回复规则
            </CardContent>
          </Card>
        ) : (
          rules.map((rule) => (
            <Card key={rule.id} className={!rule.enabled ? 'opacity-60' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{rule.name}</CardTitle>
                    <Badge variant={rule.enabled ? 'default' : 'secondary'}>
                      {rule.enabled ? '已启用' : '已禁用'}
                    </Badge>
                    {rule.priority > 0 && (
                      <Badge variant="outline">优先级: {rule.priority}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggle(rule.id, !rule.enabled)}
                    >
                      {rule.enabled ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(rule)}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(rule.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                {rule.description && (
                  <CardDescription>{rule.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <TriggerIcon type={rule.trigger?.type} />
                    <span className="text-muted-foreground">触发:</span>
                    <Badge variant="outline">{rule.trigger?.type}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <ActionIcon type={rule.action?.type} />
                    <span className="text-muted-foreground">动作:</span>
                    <Badge variant="outline">{rule.action?.type}</Badge>
                  </div>
                  {rule.channels?.length > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">渠道:</span>
                      {rule.channels.map(c => (
                        <Badge key={c} variant="secondary">{c}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* 编辑/新建模态框 */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? '编辑规则' : '新建规则'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* 基本信息 */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>规则名称 *</Label>
                <Input
                  placeholder="例如: 问候回复"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>描述</Label>
                <Input
                  placeholder="可选的规则描述"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>

            {/* 触发器配置 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">触发条件</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>触发类型</Label>
                  <Select
                    value={formData.trigger?.type || 'keyword'}
                    onValueChange={(v) => setFormData({
                      ...formData,
                      trigger: { type: v, ...(v === 'keyword' ? { keywords: [] } : {}) }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keyword">
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4" />
                          关键词匹配
                        </div>
                      </SelectItem>
                      <SelectItem value="pattern">
                        <div className="flex items-center gap-2">
                          <Code className="h-4 w-4" />
                          正则表达式
                        </div>
                      </SelectItem>
                      <SelectItem value="ai">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4" />
                          AI 判断
                        </div>
                      </SelectItem>
                      <SelectItem value="schedule">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          定时触发
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <TriggerConfig
                  trigger={formData.trigger}
                  onChange={(trigger) => setFormData({ ...formData, trigger })}
                />
              </CardContent>
            </Card>

            {/* 动作配置 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">回复动作</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>动作类型</Label>
                  <Select
                    value={formData.action?.type || 'text'}
                    onValueChange={(v) => setFormData({
                      ...formData,
                      action: { type: v, ...(v === 'text' ? { template: '' } : {}) }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          文本回复
                        </div>
                      </SelectItem>
                      <SelectItem value="agent">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4" />
                          AI 回复
                        </div>
                      </SelectItem>
                      <SelectItem value="command">
                        <div className="flex items-center gap-2">
                          <Terminal className="h-4 w-4" />
                          执行命令
                        </div>
                      </SelectItem>
                      <SelectItem value="webhook">
                        <div className="flex items-center gap-2">
                          <Webhook className="h-4 w-4" />
                          Webhook
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <ActionConfig
                  action={formData.action}
                  onChange={(action) => setFormData({ ...formData, action })}
                />
              </CardContent>
            </Card>

            {/* 高级选项 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">高级选项</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>启用规则</Label>
                  <Switch
                    checked={formData.enabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>优先级 (数字越大优先级越高)</Label>
                  <Input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>冷却时间 (秒)</Label>
                  <Input
                    type="number"
                    placeholder="留空表示不限制"
                    value={formData.cooldown_seconds || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      cooldown_seconds: e.target.value ? parseInt(e.target.value) : null
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>适用渠道 (留空表示全部)</Label>
                  <Input
                    placeholder="telegram, discord"
                    value={formData.channels?.join(', ') || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      channels: e.target.value.split(',').map(c => c.trim()).filter(Boolean)
                    })}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={!formData.name}>
              {editingRule ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
