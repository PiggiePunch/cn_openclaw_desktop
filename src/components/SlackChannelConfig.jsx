/**
 * SlackChannelConfig - Slack 通道配置组件
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

// Slack 账户配置组件
function SlackAccountCard({ account, onEdit, onDelete, onToggle }) {
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
        <div className="text-sm text-muted-foreground space-y-1">
          {account.bot_token ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              Bot Token: ****{account.bot_token.slice(-8)}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              未配置 Bot Token
            </span>
          )}
          {account.app_token && (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              App Token: ****{account.app_token.slice(-8)}
            </span>
          )}
        </div>
        {account.allowed_channels?.length > 0 && (
          <div className="mt-2">
            <span className="text-xs text-muted-foreground">允许的频道: </span>
            {account.allowed_channels.map(c => (
              <Badge key={c} variant="outline" className="ml-1">{c}</Badge>
            ))}
          </div>
        )}
        {account.allowed_teams?.length > 0 && (
          <div className="mt-2">
            <span className="text-xs text-muted-foreground">允许的团队: </span>
            {account.allowed_teams.map(t => (
              <Badge key={t} variant="outline" className="ml-1">{t}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// 账户编辑对话框
function SlackAccountDialog({ open, onOpenChange, account, onSave, title }) {
  const [formData, setFormData] = useState({
    id: '',
    bot_token: '',
    app_token: '',
    enabled: true,
    allowed_channels: [],
    allowed_teams: []
  })

  useEffect(() => {
    if (account) {
      setFormData({
        id: account.id || '',
        bot_token: account.bot_token || '',
        app_token: account.app_token || '',
        enabled: account.enabled ?? true,
        allowed_channels: account.allowed_channels || [],
        allowed_teams: account.allowed_teams || []
      })
    } else {
      setFormData({
        id: '',
        bot_token: '',
        app_token: '',
        enabled: true,
        allowed_channels: [],
        allowed_teams: []
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
              placeholder="例如: my_slack_bot"
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Bot Token (xoxb-...) *</Label>
            <Input
              type="password"
              placeholder="xoxb-..."
              value={formData.bot_token}
              onChange={(e) => setFormData({ ...formData, bot_token: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              在 Slack App 设置中获取 Bot User OAuth Token
            </p>
          </div>
          <div className="space-y-2">
            <Label>App Token (xapp-..., 可选)</Label>
            <Input
              type="password"
              placeholder="xapp-..."
              value={formData.app_token}
              onChange={(e) => setFormData({ ...formData, app_token: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              用于 Socket Mode，参考 Slack App 设置中的 "App Level Tokens"
            </p>
          </div>
          <div className="space-y-2">
            <Label>允许的频道 ID (逗号分隔)</Label>
            <Input
              placeholder="C0123456789"
              value={formData.allowed_channels.join(', ')}
              onChange={(e) => setFormData({
                ...formData,
                allowed_channels: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              })}
            />
          </div>
          <div className="space-y-2">
            <Label>允许的团队 ID (逗号分隔)</Label>
            <Input
              placeholder="T0123456789"
              value={formData.allowed_teams.join(', ')}
              onChange={(e) => setFormData({
                ...formData,
                allowed_teams: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
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

export default function SlackChannelConfig() {
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
        const slackConfig = result.data?.channels?.slack || { enabled: false, accounts: [] }
        setConfig(slackConfig)
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
        fullConfig.channels.slack = newConfig
        const saveResult = await api.config.set(fullConfig)
        if (saveResult.success) {
          setConfig(newConfig)
          toast.success('保存成功', 'Slack 配置已更新')
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
          <h3 className="text-lg font-semibold">Slack 通道</h3>
          <p className="text-sm text-muted-foreground">配置 Slack 机器人以接收和发送消息</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label>启用 Slack</Label>
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
          <CardDescription>管理多个 Slack 机器人账户</CardDescription>
        </CardHeader>
        <CardContent>
          {config.accounts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              暂无账户，点击"添加账户"创建第一个 Slack 机器人
            </div>
          ) : (
            config.accounts.map(account => (
              <SlackAccountCard
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
          <p>1. 在 Slack API (api.slack.com/apps) 创建新应用</p>
          <p>2. 添加 Bot Token Scopes (chat:write, channels:read 等)</p>
          <p>3. 安装应用到工作区并获取 Bot Token (xoxb-...)</p>
          <p>4. 如需 Socket Mode，还需生成 App Token (xapp-...)</p>
          <p>5. 配置允许的频道和团队 ID 以限制机器人响应范围</p>
        </CardContent>
      </Card>

      {/* 编辑对话框 */}
      <SlackAccountDialog
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
