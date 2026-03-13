/**
 * WebChatChannelConfig - WebChat 通道配置组件
 * 支持嵌入式 Web 聊天窗口配置
 */
import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Badge } from './ui/badge'
import { Switch } from './ui/switch'
import { Textarea } from './ui/textarea'
import {
  Plus,
  Trash2,
  Edit3,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Globe
} from 'lucide-react'

import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

// WebChat 实例配置卡片
function WebChatInstanceCard({ instance, onEdit, onDelete, onToggle }) {
  return (
    <Card className="mb-3">
      <CardHeader className="pb-2 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">{instance.id}</CardTitle>
            {instance.enabled ? (
              <Badge variant="default" className="bg-green-500">已启用</Badge>
            ) : (
              <Badge variant="secondary">已禁用</Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Switch
              checked={instance.enabled}
              onCheckedChange={(checked) => onToggle(instance.id, checked)}
            />
            <Button variant="ghost" size="sm" onClick={() => onEdit(instance)}>
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(instance.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="py-2">
        <div className="text-sm text-muted-foreground space-y-1">
          {instance.port ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              端口: {instance.port}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              未配置端口
            </span>
          )}
          {instance.host && (
            <div className="flex items-center gap-1">
              <span className="text-xs">Host: {instance.host}</span>
            </div>
          )}
          {instance.welcome_message && (
            <div className="mt-2 p-2 bg-muted rounded text-xs">
              欢迎消息: {instance.welcome_message.substring(0, 50)}...
            </div>
          )}
        </div>
        {instance.allowed_origins?.length > 0 && (
          <div className="mt-2">
            <span className="text-xs text-muted-foreground">允许的来源: </span>
            {instance.allowed_origins.map(o => (
              <Badge key={o} variant="outline" className="ml-1">{o}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// 添加/编辑 WebChat 实例对话框
function WebChatInstanceDialog({ open, onClose, instance, onSave }) {
  const [formData, setFormData] = useState({
    id: '',
    port: 3000,
    host: '0.0.0.0',
    enabled: true,
    welcome_message: '你好！我是 AI 助手，有什么可以帮助你的？',
    allowed_origins: [],
    theme: 'light',
    ...instance
  })
  const [saving, setSaving] = useState(false)
  const [allowedOriginsText, setAllowedOriginsText] = useState('')

  useEffect(() => {
    if (instance) {
      setFormData({ ...formData, ...instance })
      setAllowedOriginsText(instance.allowed_origins?.join(', ') || '')
    } else {
      setFormData({
        id: '',
        port: 3000,
        host: '0.0.0.0',
        enabled: true,
        welcome_message: '你好！我是 AI 助手，有什么可以帮助你的？',
        allowed_origins: [],
        theme: 'light'
      })
      setAllowedOriginsText('')
    }
  }, [instance, open])

  const handleSave = async () => {
    if (!formData.id) {
      toast.error('错误', '请输入实例 ID')
      return
    }
    if (!formData.port) {
      toast.error('错误', '请输入端口号')
      return
    }

    setSaving(true)
    try {
      const origins = allowedOriginsText
        .split(',')
        .map(o => o.trim())
        .filter(o => o)

      await onSave({
        ...formData,
        port: parseInt(formData.port, 10),
        allowed_origins: origins
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{instance ? '编辑 WebChat 实例' : '添加 WebChat 实例'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>实例 ID</Label>
            <Input
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
              placeholder="例如: webchat-main"
              disabled={!!instance}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>端口</Label>
              <Input
                type="number"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                placeholder="3000"
              />
            </div>
            <div className="space-y-2">
              <Label>Host</Label>
              <Input
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                placeholder="0.0.0.0"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>欢迎消息</Label>
            <Textarea
              value={formData.welcome_message}
              onChange={(e) => setFormData({ ...formData, welcome_message: e.target.value })}
              placeholder="输入用户首次进入时显示的欢迎消息"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>允许的来源 (CORS, 逗号分隔)</Label>
            <Input
              value={allowedOriginsText}
              onChange={(e) => setAllowedOriginsText(e.target.value)}
              placeholder="例如: https://example.com, http://localhost:3000"
            />
          </div>
          <div className="space-y-2">
            <Label>主题</Label>
            <select
              className="w-full border rounded px-3 py-2"
              value={formData.theme}
              onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
            >
              <option value="light">浅色</option>
              <option value="dark">深色</option>
              <option value="auto">自动</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={formData.enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
            />
            <Label>启用</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 主组件
export default function WebChatChannelConfig({ channelId, config, onUpdate }) {
  const [instances, setInstances] = useState([])
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingInstance, setEditingInstance] = useState(null)

  useEffect(() => {
    if (config?.instances) {
      setInstances(config.instances)
    }
  }, [config])

  const handleSave = async (instanceData) => {
    let newInstances
    if (editingInstance) {
      newInstances = instances.map(i => i.id === instanceData.id ? instanceData : i)
    } else {
      newInstances = [...instances, instanceData]
    }
    setInstances(newInstances)
    await onUpdate({ instances: newInstances })
  }

  const handleToggle = async (instanceId, enabled) => {
    const newInstances = instances.map(i =>
      i.id === instanceId ? { ...i, enabled } : i
    )
    setInstances(newInstances)
    await onUpdate({ instances: newInstances })
  }

  const handleDelete = async (instanceId) => {
    if (!confirm('确定要删除此实例吗？')) return
    const newInstances = instances.filter(i => i.id !== instanceId)
    setInstances(newInstances)
    await onUpdate({ instances: newInstances })
  }

  const handleEdit = (instance) => {
    setEditingInstance(instance)
    setDialogOpen(true)
  }

  const handleAdd = () => {
    setEditingInstance(null)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">WebChat 配置</h3>
          <p className="text-sm text-muted-foreground">
            配置嵌入式 Web 聊天窗口
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          添加实例
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : instances.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            暂无 WebChat 实例配置，点击"添加实例"开始配置
          </CardContent>
        </Card>
      ) : (
        instances.map(instance => (
          <WebChatInstanceCard
            key={instance.id}
            instance={instance}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggle={handleToggle}
          />
        ))
      )}

      <WebChatInstanceDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        instance={editingInstance}
        onSave={handleSave}
      />
    </div>
  )
}
