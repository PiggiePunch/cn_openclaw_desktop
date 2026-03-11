/**
 * MattermostChannelConfig - Mattermost 通道配置组件
 * 支持通过 Mattermost API 接收和发送消息
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

// Mattermost 账户配置卡片组件
function MattermostAccountCard({ account, onEdit, onDelete, onToggle }) {
  return (
    <Card className="mb-3">
      <CardHeader className="pb-2 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-600" />
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
          {account.serverUrl ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              服务器: {account.serverUrl}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              未配置服务器
            </span>
          )}
          {account.accessToken ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              Access Token: ****{account.accessToken.slice(-8)}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              未配置 Access Token
            </span>
          )}
          {account.teamName && (
            <span className="flex items-center gap-1">
              团队: {account.teamName}
            </span>
          )}
        </div>
        {account.allowedChannels?.length > 0 && (
          <div className="mt-2">
            <span className="text-xs text-muted-foreground">允许的频道: </span>
            {account.allowedChannels.map(c => (
              <Badge key={c} variant="outline" className="ml-1">{c}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// 账户编辑对话框
function MattermostAccountDialog({ open, onOpenChange, account, onSave, title }) {
  const [formData, setFormData] = useState({
    id: '',
    serverUrl: '',
    accessToken: '',
    teamName: '',
    enabled: true,
    allowedChannels: [],
    botUsername: '',
    webhookUrl: '',
    skipTLSVerify: false
  })

  useEffect(() => {
    if (account) {
      setFormData({
        id: account.id || '',
        serverUrl: account.serverUrl || '',
        accessToken: account.accessToken || '',
        teamName: account.teamName || '',
        enabled: account.enabled ?? true,
        allowedChannels: account.allowedChannels || [],
        botUsername: account.botUsername || '',
        webhookUrl: account.webhookUrl || '',
        skipTLSVerify: account.skipTLSVerify ?? false
      })
    } else {
      setFormData({
        id: '',
        serverUrl: '',
        accessToken: '',
        teamName: '',
        enabled: true,
        allowedChannels: [],
        botUsername: '',
        webhookUrl: '',
        skipTLSVerify: false
      })
    }
  }, [account, open])

  const handleSave = () => {
    if (!formData.id || !formData.serverUrl || !formData.accessToken) {
      toast.error('保存失败', 'ID、服务器地址和 Access Token 不能为空')
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
              placeholder="例如: my_mattermost"
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>服务器地址 *</Label>
            <Input
              placeholder="https://mattermost.example.com"
              value={formData.serverUrl}
              onChange={(e) => setFormData({ ...formData, serverUrl: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Mattermost 服务器 URL
            </p>
          </div>
          <div className="space-y-2">
            <Label>Access Token *</Label>
            <Input
              type="password"
              placeholder="从 Mattermost 获取"
              value={formData.accessToken}
              onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Bot 或个人访问令牌
            </p>
          </div>
          <div className="space-y-2">
            <Label>团队名称</Label>
            <Input
              placeholder="my-team"
              value={formData.teamName}
              onChange={(e) => setFormData({ ...formData, teamName: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              默认操作的团队
            </p>
          </div>
          <div className="space-y-2">
            <Label>Bot 用户名</Label>
            <Input
              placeholder="@bot"
              value={formData.botUsername}
              onChange={(e) => setFormData({ ...formData, botUsername: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Bot 的 @ 用户名
            </p>
          </div>
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <Input
              placeholder="https://mattermost.example.com/hooks/..."
              value={formData.webhookUrl}
              onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              可选的 Incoming Webhook
            </p>
          </div>
          <div className="space-y-2">
            <Label>允许的频道 ID (逗号分隔)</Label>
            <Input
              placeholder="channel-id-1, channel-id-2"
              value={formData.allowedChannels.join(', ')}
              onChange={(e) => setFormData({
                ...formData,
                allowedChannels: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              })}
            />
            <p className="text-xs text-muted-foreground">
              留空表示允许所有频道
            </p>
          </div>
          <div className="flex items-center justify-between">
            <Label>跳过 TLS 验证</Label>
            <Switch
              checked={formData.skipTLSVerify}
              onCheckedChange={(checked) => setFormData({ ...formData, skipTLSVerify: checked })}
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

export default function MattermostChannelConfig() {
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
        const mattermostConfig = result.data?.channels?.mattermost || { enabled: false, accounts: [] }
        setConfig(mattermostConfig)
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
        fullConfig.channels.mattermost = newConfig
        const saveResult = await api.config.set(fullConfig)
        if (saveResult.success) {
          setConfig(newConfig)
          toast.success('保存成功', 'Mattermost 配置已更新')
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
          <h3 className="text-lg font-semibold">Mattermost 通道</h3>
          <p className="text-sm text-muted-foreground">配置 Mattermost Bot 以接收和发送消息</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label>启用 Mattermost</Label>
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
          <CardDescription>管理 Mattermost Bot 账户</CardDescription>
        </CardHeader>
        <CardContent>
          {config.accounts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              暂无账户，点击"添加账户"创建第一个 Mattermost Bot
            </div>
          ) : (
            config.accounts.map(account => (
              <MattermostAccountCard
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
          <p>1. 在 Mattermost 中创建 Bot 账户（集成管理）</p>
          <p>2. 获取 Bot 的 Access Token</p>
          <p>3. 配置服务器地址和团队名称</p>
          <p>4. 可选配置 Incoming Webhook</p>
          <p>5. 配置允许的频道 ID 以限制响应范围</p>
        </CardContent>
      </Card>

      {/* 编辑对话框 */}
      <MattermostAccountDialog
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
