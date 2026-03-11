/**
 * IMessageChannelConfig - iMessage 通道配置组件
 * 支持通过 macOS Messages.app 接收和发送消息
 */
import React, { useState, useEffect } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { Badge } from '../ui/badge'
import { Switch } from '../ui/switch'
import {
  Plus,
  Trash2,
  Edit3,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  MessageSquare
} from 'lucide-react'

import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

// iMessage 账户配置卡片组件
function IMessageAccountCard({ account, onEdit, onDelete, onToggle }) {
  return (
    <Card className="mb-3">
      <CardHeader className="pb-2 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-500" />
            <CardTitle className="text-base">{account.id}</CardTitle>
            {account.enabled ? (
              <Badge variant="default" className="bg-green-500">已启用</Badge>
            ) : (
              <Badge variant="secondary">已禁用</Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Switch
              checked={account.enabled}
              onCheckedChange={(checked) => onToggle(account.id, checked)}
            />
            <Button variant="ghost" size="sm" onClick={() => onEdit(account)}>
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(account.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="py-2">
        <div className="text-sm text-muted-foreground space-y-1">
          {account.appleId ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              Apple ID: {account.appleId}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              未配置 Apple ID
            </span>
          )}
          {account.selectedDevice ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              设备: {account.selectedDevice}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              使用默认设备
            </span>
          )}
        </div>
        {account.allowedHandles?.length > 0 && (
          <div className="mt-2">
            <span className="text-xs text-muted-foreground">允许的联系人: </span>
            {account.allowedHandles.map(h => (
              <Badge key={h} variant="outline" className="ml-1">{h}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// 账户编辑对话框
function IMessageAccountDialog({ open, onOpenChange, account, onSave, title }) {
  const [formData, setFormData] = useState({
    id: '',
    appleId: '',
    selectedDevice: '',
    enabled: true,
    allowedHandles: [],
    autoReply: false,
    syncMode: 'realtime'
  })

  useEffect(() => {
    if (account) {
      setFormData({
        id: account.id || '',
        appleId: account.appleId || '',
        selectedDevice: account.selectedDevice || '',
        enabled: account.enabled ?? true,
        allowedHandles: account.allowedHandles || [],
        autoReply: account.autoReply ?? false,
        syncMode: account.syncMode || 'realtime'
      })
    } else {
      setFormData({
        id: '',
        appleId: '',
        selectedDevice: '',
        enabled: true,
        allowedHandles: [],
        autoReply: false,
        syncMode: 'realtime'
      })
    }
  }, [account, open])

  const handleSave = () => {
    if (!formData.id || !formData.appleId) {
      toast.error('保存失败', 'ID 和 Apple ID 不能为空')
      return
    }
    onSave(formData)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>账户 ID *</Label>
            <Input
              placeholder="例如: my_imessage"
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Apple ID *</Label>
            <Input
              placeholder="your@email.com"
              value={formData.appleId}
              onChange={(e) => setFormData({ ...formData, appleId: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              用于 iMessage 的 Apple ID（邮箱地址）
            </p>
          </div>
          <div className="space-y-2">
            <Label>选择设备</Label>
            <Input
              placeholder="MacBook Pro"
              value={formData.selectedDevice}
              onChange={(e) => setFormData({ ...formData, selectedDevice: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              留空使用当前设备，或指定特定设备名称
            </p>
          </div>
          <div className="space-y-2">
            <Label>允许的联系人 (逗号分隔)</Label>
            <Input
              placeholder="+8613800138000, user@email.com"
              value={formData.allowedHandles.join(', ')}
              onChange={(e) => setFormData({
                ...formData,
                allowedHandles: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              })}
            />
            <p className="text-xs text-muted-foreground">
              留空表示允许所有联系人，支持电话号码或邮箱
            </p>
          </div>
          <div className="space-y-2">
            <Label>同步模式</Label>
            <select
              className="w-full h-10 px-3 rounded-md border border-input bg-background"
              value={formData.syncMode}
              onChange={(e) => setFormData({ ...formData, syncMode: e.target.value })}
            >
              <option value="realtime">实时同步</option>
              <option value="polling">轮询同步</option>
              <option value="manual">手动同步</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <Label>自动回复</Label>
            <Switch
              checked={formData.autoReply}
              onCheckedChange={(checked) => setFormData({ ...formData, autoReply: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>启用账户</Label>
            <Switch
              checked={formData.enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function IMessageChannelConfig() {
  const [config, setConfig] = useState({ enabled: false, accounts: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingAccount, setEditingAccount] = useState(null)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    setIsLoading(true)
    try {
      const result = await api.config.get()
      if (result.success) {
        const imessageConfig = result.data?.channels?.imessage || { enabled: false, accounts: [] }
        setConfig(imessageConfig)
      }
    } catch (e) {
      console.error('加载配置失败:', e)
    }
    setIsLoading(false)
  }

  const saveConfig = async (newConfig) => {
    try {
      const result = await api.config.get()
      if (result.success) {
        const fullConfig = result.data
        fullConfig.channels = fullConfig.channels || {}
        fullConfig.channels.imessage = newConfig
        const saveResult = await api.config.set(fullConfig)
        if (saveResult.success) {
          setConfig(newConfig)
          toast.success('保存成功', 'iMessage 配置已更新')
        } else {
          toast.error('保存失败', saveResult.error)
        }
      }
    } catch (e) {
      console.error('保存配置失败:', e)
      toast.error('保存失败', e.message)
    }
  }

  const handleToggleEnabled = (enabled) => {
    saveConfig({ ...config, enabled })
  }

  const handleAddAccount = (account) => {
    const accounts = [...config.accounts, account]
    saveConfig({ ...config, accounts })
  }

  const handleUpdateAccount = (account) => {
    const accounts = config.accounts.map(a => a.id === account.id ? account : a)
    saveConfig({ ...config, accounts })
  }

  const handleDeleteAccount = (accountId) => {
    if (!confirm('确定要删除这个账户吗？')) return
    const accounts = config.accounts.filter(a => a.id !== accountId)
    saveConfig({ ...config, accounts })
  }

  const handleToggleAccount = (accountId, enabled) => {
    const accounts = config.accounts.map(a =>
      a.id === accountId ? { ...a, enabled } : a
    )
    saveConfig({ ...config, accounts })
  }

  const handleEdit = (account) => {
    setEditingAccount(account)
    setShowDialog(true)
  }

  const handleSave = (accountData) => {
    if (editingAccount) {
      handleUpdateAccount(accountData)
    } else {
      handleAddAccount(accountData)
    }
    setEditingAccount(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 头部控制 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">iMessage 通道</h3>
          <p className="text-sm text-muted-foreground">配置 iMessage 以在 macOS 上接收和发送消息</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label>启用 iMessage</Label>
            <Switch
              checked={config.enabled}
              onCheckedChange={handleToggleEnabled}
            />
          </div>
          <Button variant="outline" size="sm" onClick={loadConfig}>
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
        </div>
      </div>

      {/* 系统要求提示 */}
      <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
        <CardContent className="py-3">
          <div className="flex items-start gap-2">
            <MessageSquare className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              <p className="font-medium">macOS 专属功能</p>
              <p>iMessage 通道仅支持 macOS 系统，需要授予 Messages.app 的自动化权限。</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 账户列表 */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">账户列表</CardTitle>
            <Button size="sm" onClick={() => {
              setEditingAccount(null)
              setShowDialog(true)
            }}>
              <Plus className="h-4 w-4 mr-2" />
              添加账户
            </Button>
          </div>
          <CardDescription>管理 iMessage 账户配置</CardDescription>
        </CardHeader>
        <CardContent>
          {config.accounts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              暂无账户，点击"添加账户"创建第一个 iMessage 配置
            </div>
          ) : (
            config.accounts.map(account => (
              <IMessageAccountCard
                key={account.id}
                account={account}
                onEdit={handleEdit}
                onDelete={handleDeleteAccount}
                onToggle={handleToggleAccount}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* 使用说明 */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">使用说明</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. 确保已登录 iCloud 并启用 iMessage</p>
          <p>2. 首次使用时需要授予 Messages.app 的自动化权限</p>
          <p>3. 配置允许的联系人以限制消息响应范围</p>
          <p>4. 可以配置同步模式：实时同步、轮询同步或手动同步</p>
          <p>5. 启用自动回复后，收到消息将自动处理</p>
        </CardContent>
      </Card>

      {/* 编辑对话框 */}
      <IMessageAccountDialog
        open={showDialog}
        onOpenChange={(open) => {
          setShowDialog(open)
          if (!open) setEditingAccount(null)
        }}
        account={editingAccount}
        onSave={handleSave}
        title={editingAccount ? '编辑账户' : '添加账户'}
      />
    </div>
  )
}
