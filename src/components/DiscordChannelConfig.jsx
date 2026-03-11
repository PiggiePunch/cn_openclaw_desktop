/**
 * DiscordChannelConfig - Discord 通道配置组件
 */
import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Badge } from './ui/badge'
import { Switch } from './ui/switch'
import {
  Plus,
  Trash2,
  Edit3,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle
} from 'lucide-react'

import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

// Discord 账户配置组件
function DiscordAccountCard({ account, onEdit, onDelete, onToggle }) {
  return (
    <Card className="mb-3">
      <CardHeader className="pb-2 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
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
        <div className="text-sm text-muted-foreground">
          {account.bot_token ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              Token: ****{account.bot_token.slice(-8)}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              未配置 Token
            </span>
          )}
        </div>
        {account.allowed_guilds?.length > 0 && (
          <div className="mt-2">
            <span className="text-xs text-muted-foreground">允许的服务器: </span>
            {account.allowed_guilds.map(g => (
              <Badge key={g} variant="outline" className="ml-1">{g}</Badge>
            ))}
          </div>
        )}
        {account.allowed_channels?.length > 0 && (
          <div className="mt-2">
            <span className="text-xs text-muted-foreground">允许的频道: </span>
            {account.allowed_channels.map(c => (
              <Badge key={c} variant="outline" className="ml-1">{c}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// 账户编辑对话框
function DiscordAccountDialog({ open, onOpenChange, account, onSave, title }) {
  const [formData, setFormData] = useState({
    id: '',
    bot_token: '',
    enabled: true,
    allowed_guilds: [],
    allowed_channels: [],
    application_id: ''
  })

  useEffect(() => {
    if (account) {
      setFormData({
        id: account.id || '',
        bot_token: account.bot_token || '',
        enabled: account.enabled ?? true,
        allowed_guilds: account.allowed_guilds || [],
        allowed_channels: account.allowed_channels || [],
        application_id: account.application_id || ''
      })
    } else {
      setFormData({
        id: '',
        bot_token: '',
        enabled: true,
        allowed_guilds: [],
        allowed_channels: [],
        application_id: ''
      })
    }
  }, [account, open])

  const handleSave = () => {
    if (!formData.id || !formData.bot_token) {
      toast.error('保存失败', 'ID 和 Bot Token 不能为空')
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
              placeholder="例如: my_discord_bot"
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Bot Token *</Label>
            <Input
              type="password"
              placeholder="从 Discord Developer Portal 获取"
              value={formData.bot_token}
              onChange={(e) => setFormData({ ...formData, bot_token: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              在 Discord Developer Portal 创建应用并获取 Bot Token
            </p>
          </div>
          <div className="space-y-2">
            <Label>Application ID (可选)</Label>
            <Input
              placeholder="从 Developer Portal 获取"
              value={formData.application_id}
              onChange={(e) => setFormData({ ...formData, application_id: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>允许的服务器 ID (逗号分隔)</Label>
            <Input
              placeholder="123456789012345678"
              value={formData.allowed_guilds.join(', ')}
              onChange={(e) => setFormData({
                ...formData,
                allowed_guilds: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              })}
            />
          </div>
          <div className="space-y-2">
            <Label>允许的频道 ID (逗号分隔)</Label>
            <Input
              placeholder="123456789012345678"
              value={formData.allowed_channels.join(', ')}
              onChange={(e) => setFormData({
                ...formData,
                allowed_channels: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              })}
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

export default function DiscordChannelConfig() {
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
        const discordConfig = result.data?.channels?.discord || { enabled: false, accounts: [] }
        setConfig(discordConfig)
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
        fullConfig.channels.discord = newConfig
        const saveResult = await api.config.set(fullConfig)
        if (saveResult.success) {
          setConfig(newConfig)
          toast.success('保存成功', 'Discord 配置已更新')
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
          <h3 className="text-lg font-semibold">Discord 通道</h3>
          <p className="text-sm text-muted-foreground">配置 Discord 机器人以接收和发送消息</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label>启用 Discord</Label>
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
          <CardDescription>管理多个 Discord 机器人账户</CardDescription>
        </CardHeader>
        <CardContent>
          {config.accounts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              暂无账户，点击"添加账户"创建第一个 Discord 机器人
            </div>
          ) : (
            config.accounts.map(account => (
              <DiscordAccountCard
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
          <p>1. 在 Discord Developer Portal (discord.com/developers/applications) 创建新应用</p>
          <p>2. 在"Bot"页面创建机器人并获取 Token</p>
          <p>3. 在"OAuth2"页面生成邀请链接来邀请机器人到服务器</p>
          <p>4. 配置允许的服务器和频道 ID 以限制机器人响应范围</p>
        </CardContent>
      </Card>

      {/* 编辑对话框 */}
      <DiscordAccountDialog
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
