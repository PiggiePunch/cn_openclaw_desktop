/**
 * MSTeamsChannelConfig - Microsoft Teams 通道配置组件
 * 支持通过 MS Teams Bot Framework 接收和发送消息
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
  Users
} from 'lucide-react'

import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

// MS Teams 账户配置卡片组件
function MSTeamsAccountCard({ account, onEdit, onDelete, onToggle }) {
  return (
    <Card className="mb-3">
      <CardHeader className="pb-2 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-purple-600" />
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
          {account.tenantId ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              租户 ID: {account.tenantId.slice(0, 8)}...
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              未配置租户 ID
            </span>
          )}
          {account.appId ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              App ID: {account.appId.slice(0, 8)}...
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              未配置 App ID
            </span>
          )}
        </div>
        {account.allowedTeams?.length > 0 && (
          <div className="mt-2">
            <span className="text-xs text-muted-foreground">允许的团队: </span>
            {account.allowedTeams.map(t => (
              <Badge key={t} variant="outline" className="ml-1">{t}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// 账户编辑对话框
function MSTeamsAccountDialog({ open, onOpenChange, account, onSave, title }) {
  const [formData, setFormData] = useState({
    id: '',
    tenantId: '',
    appId: '',
    appSecret: '',
    enabled: true,
    allowedTeams: [],
    allowedChannels: [],
    webhookUrl: ''
  })

  useEffect(() => {
    if (account) {
      setFormData({
        id: account.id || '',
        tenantId: account.tenantId || '',
        appId: account.appId || '',
        appSecret: account.appSecret || '',
        enabled: account.enabled ?? true,
        allowedTeams: account.allowedTeams || [],
        allowedChannels: account.allowedChannels || [],
        webhookUrl: account.webhookUrl || ''
      })
    } else {
      setFormData({
        id: '',
        tenantId: '',
        appId: '',
        appSecret: '',
        enabled: true,
        allowedTeams: [],
        allowedChannels: [],
        webhookUrl: ''
      })
    }
  }, [account, open])

  const handleSave = () => {
    if (!formData.id || !formData.tenantId || !formData.appId || !formData.appSecret) {
      toast.error('保存失败', 'ID、租户 ID、App ID 和 App Secret 不能为空')
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
              placeholder="例如: my_msteams"
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>租户 ID (Tenant ID) *</Label>
            <Input
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={formData.tenantId}
              onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Azure AD 租户 ID
            </p>
          </div>
          <div className="space-y-2">
            <Label>应用 ID (App ID) *</Label>
            <Input
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={formData.appId}
              onChange={(e) => setFormData({ ...formData, appId: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Azure Bot 应用的客户端 ID
            </p>
          </div>
          <div className="space-y-2">
            <Label>应用密钥 (App Secret) *</Label>
            <Input
              type="password"
              placeholder="客户端密钥值"
              value={formData.appSecret}
              onChange={(e) => setFormData({ ...formData, appSecret: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Azure Bot 应用的客户端密钥
            </p>
          </div>
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <Input
              placeholder="https://your-domain.com/api/messages"
              value={formData.webhookUrl}
              onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Bot 消息端点 URL
            </p>
          </div>
          <div className="space-y-2">
            <Label>允许的团队 ID (逗号分隔)</Label>
            <Input
              placeholder="team-id-1, team-id-2"
              value={formData.allowedTeams.join(', ')}
              onChange={(e) => setFormData({
                ...formData,
                allowedTeams: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              })}
            />
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

export default function MSTeamsChannelConfig() {
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
        const msteamsConfig = result.data?.channels?.msteams || { enabled: false, accounts: [] }
        setConfig(msteamsConfig)
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
        fullConfig.channels.msteams = newConfig
        const saveResult = await api.config.set(fullConfig)
        if (saveResult.success) {
          setConfig(newConfig)
          toast.success('保存成功', 'MS Teams 配置已更新')
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
          <h3 className="text-lg font-semibold">MS Teams 通道</h3>
          <p className="text-sm text-muted-foreground">配置 Microsoft Teams Bot 以接收和发送消息</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label>启用 MS Teams</Label>
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
          <CardDescription>管理 MS Teams Bot 账户</CardDescription>
        </CardHeader>
        <CardContent>
          {config.accounts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              暂无账户，点击"添加账户"创建第一个 MS Teams Bot
            </div>
          ) : (
            config.accounts.map(account => (
              <MSTeamsAccountCard
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
          <p>1. 在 Azure Portal 创建 Bot Framework 注册</p>
          <p>2. 获取租户 ID、应用 ID 和客户端密钥</p>
          <p>3. 配置 Bot 消息端点 (Webhook URL)</p>
          <p>4. 在 Teams 管理中心允许自定义 Bot</p>
          <p>5. 配置允许的团队和频道以限制响应范围</p>
        </CardContent>
      </Card>

      {/* 编辑对话框 */}
      <MSTeamsAccountDialog
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
