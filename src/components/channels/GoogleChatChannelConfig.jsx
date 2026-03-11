/**
 * GoogleChatChannelConfig - Google Chat 通道配置组件
 * 支持通过 Google Chat API 接收和发送消息
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
  MessageCircle
} from 'lucide-react'

import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

// Google Chat 账户配置卡片组件
function GoogleChatAccountCard({ account, onEdit, onDelete, onToggle }) {
  return (
    <Card className="mb-3">
      <CardHeader className="pb-2 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-blue-500" />
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
          {account.webhookUrl ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              Webhook: {account.webhookUrl.slice(0, 30)}...
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              未配置 Webhook
            </span>
          )}
          {account.serviceAccountJson && (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              服务账号已配置
            </span>
          )}
        </div>
        {account.allowedSpaces?.length > 0 && (
          <div className="mt-2">
            <span className="text-xs text-muted-foreground">允许的空间: </span>
            {account.allowedSpaces.map(s => (
              <Badge key={s} variant="outline" className="ml-1">{s.slice(0, 15)}...</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// 账户编辑对话框
function GoogleChatAccountDialog({ open, onOpenChange, account, onSave, title }) {
  const [formData, setFormData] = useState({
    id: '',
    webhookUrl: '',
    serviceAccountJson: '',
    enabled: true,
    allowedSpaces: [],
    projectId: ''
  })

  useEffect(() => {
    if (account) {
      setFormData({
        id: account.id || '',
        webhookUrl: account.webhookUrl || '',
        serviceAccountJson: account.serviceAccountJson || '',
        enabled: account.enabled ?? true,
        allowedSpaces: account.allowedSpaces || [],
        projectId: account.projectId || ''
      })
    } else {
      setFormData({
        id: '',
        webhookUrl: '',
        serviceAccountJson: '',
        enabled: true,
        allowedSpaces: [],
        projectId: ''
      })
    }
  }, [account, open])

  const handleSave = () => {
    if (!formData.id || !formData.webhookUrl) {
      toast.error('保存失败', 'ID 和 Webhook URL 不能为空')
      return
    }
    onSave(formData)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>账户 ID *</Label>
            <Input
              placeholder="例如: my_googlechat"
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Webhook URL *</Label>
            <Input
              placeholder="https://chat.googleapis.com/v1/spaces/..."
              value={formData.webhookUrl}
              onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Google Chat 空间的 Incoming Webhook URL
            </p>
          </div>
          <div className="space-y-2">
            <Label>项目 ID</Label>
            <Input
              placeholder="my-gcp-project"
              value={formData.projectId}
              onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Google Cloud 项目 ID（用于 API 调用）
            </p>
          </div>
          <div className="space-y-2">
            <Label>服务账号 JSON</Label>
            <textarea
              className="w-full h-32 px-3 py-2 text-sm rounded-md border border-input bg-background resize-none"
              placeholder='{"type": "service_account", ...}'
              value={formData.serviceAccountJson}
              onChange={(e) => setFormData({ ...formData, serviceAccountJson: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              粘贴服务账号的 JSON 密钥（用于 API 认证）
            </p>
          </div>
          <div className="space-y-2">
            <Label>允许的空间 ID (逗号分隔)</Label>
            <Input
              placeholder="spaces/AAAAA, spaces/BBBBB"
              value={formData.allowedSpaces.join(', ')}
              onChange={(e) => setFormData({
                ...formData,
                allowedSpaces: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              })}
            />
            <p className="text-xs text-muted-foreground">
              留空表示允许所有空间
            </p>
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

export default function GoogleChatChannelConfig() {
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
        const googleChatConfig = result.data?.channels?.googlechat || { enabled: false, accounts: [] }
        setConfig(googleChatConfig)
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
        fullConfig.channels.googlechat = newConfig
        const saveResult = await api.config.set(fullConfig)
        if (saveResult.success) {
          setConfig(newConfig)
          toast.success('保存成功', 'Google Chat 配置已更新')
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
          <h3 className="text-lg font-semibold">Google Chat 通道</h3>
          <p className="text-sm text-muted-foreground">配置 Google Chat Webhook 以接收和发送消息</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label>启用 Google Chat</Label>
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
          <CardDescription>管理 Google Chat Webhook 配置</CardDescription>
        </CardHeader>
        <CardContent>
          {config.accounts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              暂无账户，点击"添加账户"创建第一个 Google Chat 配置
            </div>
          ) : (
            config.accounts.map(account => (
              <GoogleChatAccountCard
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
          <p>1. 在 Google Chat 空间中添加 Webhook</p>
          <p>2. 获取 Webhook URL</p>
          <p>3. 如需完整的 API 功能，创建 Google Cloud 服务账号</p>
          <p>4. 下载服务账号 JSON 密钥并粘贴到配置中</p>
          <p>5. 配置允许的空间 ID 以限制响应范围</p>
        </CardContent>
      </Card>

      {/* 编辑对话框 */}
      <GoogleChatAccountDialog
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
