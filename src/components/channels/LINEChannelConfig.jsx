/**
 * LINEChannelConfig - LINE 通道配置组件
 * 支持通过 LINE Messaging API 接收和发送消息
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

// LINE 账户配置卡片组件
function LINEAccountCard({ account, onEdit, onDelete, onToggle }) {
  return (
    <Card className="mb-3">
      <CardHeader className="pb-2 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-green-500" />
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
          {account.channelId ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              Channel ID: {account.channelId}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              未配置 Channel ID
            </span>
          )}
          {account.channelAccessToken ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              Access Token: ****{account.channelAccessToken.slice(-8)}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              未配置 Access Token
            </span>
          )}
        </div>
        {account.allowedUsers?.length > 0 && (
          <div className="mt-2">
            <span className="text-xs text-muted-foreground">允许的用户: </span>
            {account.allowedUsers.map(u => (
              <Badge key={u} variant="outline" className="ml-1">{u}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// 账户编辑对话框
function LINEAccountDialog({ open, onOpenChange, account, onSave, title }) {
  const [formData, setFormData] = useState({
    id: '',
    channelId: '',
    channelAccessToken: '',
    channelSecret: '',
    enabled: true,
    allowedUsers: [],
    webhookUrl: '',
    richMenuId: ''
  })

  useEffect(() => {
    if (account) {
      setFormData({
        id: account.id || '',
        channelId: account.channelId || '',
        channelAccessToken: account.channelAccessToken || '',
        channelSecret: account.channelSecret || '',
        enabled: account.enabled ?? true,
        allowedUsers: account.allowedUsers || [],
        webhookUrl: account.webhookUrl || '',
        richMenuId: account.richMenuId || ''
      })
    } else {
      setFormData({
        id: '',
        channelId: '',
        channelAccessToken: '',
        channelSecret: '',
        enabled: true,
        allowedUsers: [],
        webhookUrl: '',
        richMenuId: ''
      })
    }
  }, [account, open])

  const handleSave = () => {
    if (!formData.id || !formData.channelId || !formData.channelAccessToken) {
      toast.error('保存失败', 'ID、Channel ID 和 Access Token 不能为空')
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
              placeholder="例如: my_line_bot"
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Channel ID *</Label>
            <Input
              placeholder="1656000000"
              value={formData.channelId}
              onChange={(e) => setFormData({ ...formData, channelId: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              在 LINE Developers Console 中获取
            </p>
          </div>
          <div className="space-y-2">
            <Label>Channel Access Token *</Label>
            <Input
              type="password"
              placeholder="从 Messaging API 获取"
              value={formData.channelAccessToken}
              onChange={(e) => setFormData({ ...formData, channelAccessToken: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              长期有效的 Channel Access Token
            </p>
          </div>
          <div className="space-y-2">
            <Label>Channel Secret</Label>
            <Input
              type="password"
              placeholder="用于签名验证"
              value={formData.channelSecret}
              onChange={(e) => setFormData({ ...formData, channelSecret: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              用于验证 Webhook 请求的签名
            </p>
          </div>
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <Input
              placeholder="https://your-domain.com/webhook/line"
              value={formData.webhookUrl}
              onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              LINE 消息回调地址
            </p>
          </div>
          <div className="space-y-2">
            <Label>Rich Menu ID</Label>
            <Input
              placeholder="richmenu-..."
              value={formData.richMenuId}
              onChange={(e) => setFormData({ ...formData, richMenuId: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              可选的富菜单 ID
            </p>
          </div>
          <div className="space-y-2">
            <Label>允许的用户 ID (逗号分隔)</Label>
            <Input
              placeholder="U1234567890abcdef"
              value={formData.allowedUsers.join(', ')}
              onChange={(e) => setFormData({
                ...formData,
                allowedUsers: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              })}
            />
            <p className="text-xs text-muted-foreground">
              留空表示允许所有用户
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

export default function LINEChannelConfig() {
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
        const lineConfig = result.data?.channels?.line || { enabled: false, accounts: [] }
        setConfig(lineConfig)
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
        fullConfig.channels.line = newConfig
        const saveResult = await api.config.set(fullConfig)
        if (saveResult.success) {
          setConfig(newConfig)
          toast.success('保存成功', 'LINE 配置已更新')
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
          <h3 className="text-lg font-semibold">LINE 通道</h3>
          <p className="text-sm text-muted-foreground">配置 LINE Messaging API 以接收和发送消息</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label>启用 LINE</Label>
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
          <CardDescription>管理 LINE Bot 账户</CardDescription>
        </CardHeader>
        <CardContent>
          {config.accounts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              暂无账户，点击"添加账户"创建第一个 LINE Bot
            </div>
          ) : (
            config.accounts.map(account => (
              <LINEAccountCard
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
          <p>1. 在 LINE Developers Console (developers.line.biz) 创建 Provider</p>
          <p>2. 创建 Messaging API Channel</p>
          <p>3. 获取 Channel ID 和 Channel Access Token</p>
          <p>4. 配置 Webhook URL 以接收消息</p>
          <p>5. Channel Secret 用于验证请求签名</p>
        </CardContent>
      </Card>

      {/* 编辑对话框 */}
      <LINEAccountDialog
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
