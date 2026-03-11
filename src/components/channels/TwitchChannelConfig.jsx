/**
 * TwitchChannelConfig - Twitch 通道配置组件
 * 支持通过 Twitch IRC/EventSub 接收和发送消息
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
  Tv
} from 'lucide-react'

import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

// Twitch 账户配置卡片组件
function TwitchAccountCard({ account, onEdit, onDelete, onToggle }) {
  return (
    <Card className="mb-3">
      <CardHeader className="pb-2 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tv className="h-4 w-4 text-purple-500" />
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
          {account.clientId ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              Client ID: {account.clientId.slice(0, 8)}...
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              未配置 Client ID
            </span>
          )}
          {account.botUsername && (
            <span className="flex items-center gap-1">
              Bot: {account.botUsername}
            </span>
          )}
        </div>
        {account.channels?.length > 0 && (
          <div className="mt-2">
            <span className="text-xs text-muted-foreground">频道: </span>
            {account.channels.map(c => (
              <Badge key={c} variant="outline" className="ml-1">#{c}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// 账户编辑对话框
function TwitchAccountDialog({ open, onOpenChange, account, onSave, title }) {
  const [formData, setFormData] = useState({
    id: '',
    clientId: '',
    clientSecret: '',
    accessToken: '',
    refreshToken: '',
    botUsername: '',
    enabled: true,
    channels: [],
    commandPrefix: '!',
    moderatorOnly: false
  })

  useEffect(() => {
    if (account) {
      setFormData({
        id: account.id || '',
        clientId: account.clientId || '',
        clientSecret: account.clientSecret || '',
        accessToken: account.accessToken || '',
        refreshToken: account.refreshToken || '',
        botUsername: account.botUsername || '',
        enabled: account.enabled ?? true,
        channels: account.channels || [],
        commandPrefix: account.commandPrefix || '!',
        moderatorOnly: account.moderatorOnly ?? false
      })
    } else {
      setFormData({
        id: '',
        clientId: '',
        clientSecret: '',
        accessToken: '',
        refreshToken: '',
        botUsername: '',
        enabled: true,
        channels: [],
        commandPrefix: '!',
        moderatorOnly: false
      })
    }
  }, [account, open])

  const handleSave = () => {
    if (!formData.id || !formData.clientId || !formData.clientSecret) {
      toast.error('保存失败', 'ID、Client ID 和 Client Secret 不能为空')
      return
    }
    if (formData.channels.length === 0) {
      toast.error('保存失败', '至少需要配置一个频道')
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
              placeholder="例如: my_twitch_bot"
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Client ID *</Label>
            <Input
              placeholder="从 Twitch Developer Console 获取"
              value={formData.clientId}
              onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Twitch 应用的客户端 ID
            </p>
          </div>
          <div className="space-y-2">
            <Label>Client Secret *</Label>
            <Input
              type="password"
              placeholder="从 Twitch Developer Console 获取"
              value={formData.clientSecret}
              onChange={(e) => setFormData({ ...formData, clientSecret: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Access Token</Label>
            <Input
              type="password"
              placeholder="OAuth 访问令牌"
              value={formData.accessToken}
              onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Bot 的 OAuth 访问令牌
            </p>
          </div>
          <div className="space-y-2">
            <Label>Refresh Token</Label>
            <Input
              type="password"
              placeholder="OAuth 刷新令牌"
              value={formData.refreshToken}
              onChange={(e) => setFormData({ ...formData, refreshToken: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Bot 用户名</Label>
            <Input
              placeholder="YourBotName"
              value={formData.botUsername}
              onChange={(e) => setFormData({ ...formData, botUsername: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Bot 的 Twitch 用户名
            </p>
          </div>
          <div className="space-y-2">
            <Label>频道列表 (逗号分隔) *</Label>
            <Input
              placeholder="channel1, channel2"
              value={formData.channels.join(', ')}
              onChange={(e) => setFormData({
                ...formData,
                channels: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              })}
            />
            <p className="text-xs text-muted-foreground">
              Bot 要加入的频道名称（不含 #）
            </p>
          </div>
          <div className="space-y-2">
            <Label>命令前缀</Label>
            <Input
              placeholder="!"
              value={formData.commandPrefix}
              onChange={(e) => setFormData({ ...formData, commandPrefix: e.target.value })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>仅管理员可使用命令</Label>
            <Switch
              checked={formData.moderatorOnly}
              onCheckedChange={(checked) => setFormData({ ...formData, moderatorOnly: checked })}
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

export default function TwitchChannelConfig() {
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
        const twitchConfig = result.data?.channels?.twitch || { enabled: false, accounts: [] }
        setConfig(twitchConfig)
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
        fullConfig.channels.twitch = newConfig
        const saveResult = await api.config.set(fullConfig)
        if (saveResult.success) {
          setConfig(newConfig)
          toast.success('保存成功', 'Twitch 配置已更新')
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
          <h3 className="text-lg font-semibold">Twitch 通道</h3>
          <p className="text-sm text-muted-foreground">配置 Twitch Bot 以在直播间接收和发送消息</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label>启用 Twitch</Label>
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
          <CardDescription>管理 Twitch Bot 账户</CardDescription>
        </CardHeader>
        <CardContent>
          {config.accounts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              暂无账户，点击"添加账户"创建第一个 Twitch Bot
            </div>
          ) : (
            config.accounts.map(account => (
              <TwitchAccountCard
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
          <p>1. 在 Twitch Developer Console (dev.twitch.tv) 创建应用</p>
          <p>2. 获取 Client ID 和 Client Secret</p>
          <p>3. 获取 Bot 账号的 OAuth Access Token（需要 chat:read, chat:edit 权限）</p>
          <p>4. 配置要加入的频道列表</p>
          <p>5. 可选配置命令前缀和权限限制</p>
        </CardContent>
      </Card>

      {/* 编辑对话框 */}
      <TwitchAccountDialog
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
