/**
 * BlueBubblesChannelConfig - BlueBubbles 通道配置组件
 * 支持通过 BlueBubbles 服务器接收和发送 iMessage
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
  Cloud
} from 'lucide-react'

import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

// BlueBubbles 账户配置卡片组件
function BlueBubblesAccountCard({ account, onEdit, onDelete, onToggle }) {
  return (
    <Card className="mb-3">
      <CardHeader className="pb-2 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cloud className="h-4 w-4 text-blue-400" />
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
              未配置服务器地址
            </span>
          )}
          {account.password ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              密码: ****
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              未配置密码
            </span>
          )}
        </div>
        {account.allowedChats?.length > 0 && (
          <div className="mt-2">
            <span className="text-xs text-muted-foreground">允许的聊天: </span>
            {account.allowedChats.map(c => (
              <Badge key={c} variant="outline" className="ml-1">{c}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// 账户编辑对话框
function BlueBubblesAccountDialog({ open, onOpenChange, account, onSave, title }) {
  const [formData, setFormData] = useState({
    id: '',
    serverUrl: '',
    password: '',
    enabled: true,
    allowedChats: [],
    pollingInterval: 5000,
    autoReconnect: true,
    showTypingIndicator: true
  })

  useEffect(() => {
    if (account) {
      setFormData({
        id: account.id || '',
        serverUrl: account.serverUrl || '',
        password: account.password || '',
        enabled: account.enabled ?? true,
        allowedChats: account.allowedChats || [],
        pollingInterval: account.pollingInterval || 5000,
        autoReconnect: account.autoReconnect ?? true,
        showTypingIndicator: account.showTypingIndicator ?? true
      })
    } else {
      setFormData({
        id: '',
        serverUrl: '',
        password: '',
        enabled: true,
        allowedChats: [],
        pollingInterval: 5000,
        autoReconnect: true,
        showTypingIndicator: true
      })
    }
  }, [account, open])

  const handleSave = () => {
    if (!formData.id || !formData.serverUrl || !formData.password) {
      toast.error('保存失败', 'ID、服务器地址和密码不能为空')
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
              placeholder="例如: my_bluebubbles"
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>服务器地址 *</Label>
            <Input
              placeholder="https://your-bluebubbles-server.com"
              value={formData.serverUrl}
              onChange={(e) => setFormData({ ...formData, serverUrl: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              BlueBubbles 服务器的完整地址
            </p>
          </div>
          <div className="space-y-2">
            <Label>密码 *</Label>
            <Input
              type="password"
              placeholder="BlueBubbles 服务器密码"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              在 BlueBubbles 服务器设置中配置的密码
            </p>
          </div>
          <div className="space-y-2">
            <Label>轮询间隔 (毫秒)</Label>
            <Input
              type="number"
              placeholder="5000"
              value={formData.pollingInterval}
              onChange={(e) => setFormData({ ...formData, pollingInterval: parseInt(e.target.value) || 5000 })}
            />
            <p className="text-xs text-muted-foreground">
              检查新消息的间隔时间，默认 5000ms
            </p>
          </div>
          <div className="space-y-2">
            <Label>允许的聊天 (逗号分隔)</Label>
            <Input
              placeholder="+8613800138000, user@email.com"
              value={formData.allowedChats.join(', ')}
              onChange={(e) => setFormData({
                ...formData,
                allowedChats: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              })}
            />
            <p className="text-xs text-muted-foreground">
              留空表示允许所有聊天
            </p>
          </div>
          <div className="flex items-center justify-between">
            <Label>自动重连</Label>
            <Switch
              checked={formData.autoReconnect}
              onCheckedChange={(checked) => setFormData({ ...formData, autoReconnect: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>显示输入指示器</Label>
            <Switch
              checked={formData.showTypingIndicator}
              onCheckedChange={(checked) => setFormData({ ...formData, showTypingIndicator: checked })}
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

export default function BlueBubblesChannelConfig() {
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
        const bluebubblesConfig = result.data?.channels?.bluebubbles || { enabled: false, accounts: [] }
        setConfig(bluebubblesConfig)
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
        fullConfig.channels.bluebubbles = newConfig
        const saveResult = await api.config.set(fullConfig)
        if (saveResult.success) {
          setConfig(newConfig)
          toast.success('保存成功', 'BlueBubbles 配置已更新')
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
          <h3 className="text-lg font-semibold">BlueBubbles 通道</h3>
          <p className="text-sm text-muted-foreground">配置 BlueBubbles 服务器以远程访问 iMessage</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label>启用 BlueBubbles</Label>
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
          <CardDescription>管理 BlueBubbles 服务器连接</CardDescription>
        </CardHeader>
        <CardContent>
          {config.accounts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              暂无账户，点击"添加账户"创建第一个 BlueBubbles 连接
            </div>
          ) : (
            config.accounts.map(account => (
              <BlueBubblesAccountCard
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
          <p>1. 在 macOS 上安装并运行 BlueBubbles 服务器</p>
          <p>2. 配置服务器的密码和网络访问</p>
          <p>3. 确保服务器可以被当前设备访问（局域网或公网）</p>
          <p>4. 在此配置服务器地址和密码</p>
          <p>5. 配置允许的聊天以限制响应范围</p>
        </CardContent>
      </Card>

      {/* 编辑对话框 */}
      <BlueBubblesAccountDialog
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
