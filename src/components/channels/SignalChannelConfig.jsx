/**
 * SignalChannelConfig - Signal 通道配置组件
 * 支持通过 Signal CLI 接收和发送消息
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
  Shield
} from 'lucide-react'

import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

// Signal 账户配置卡片组件
function SignalAccountCard({ account, onEdit, onDelete, onToggle }) {
  return (
    <Card className="mb-3">
      <CardHeader className="pb-2 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-500" />
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
          {account.phoneNumber ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              电话号码: {account.phoneNumber}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              未配置电话号码
            </span>
          )}
          {account.signalCliPath ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              Signal CLI: {account.signalCliPath}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              未配置 Signal CLI 路径
            </span>
          )}
        </div>
        {account.allowedRecipients?.length > 0 && (
          <div className="mt-2">
            <span className="text-xs text-muted-foreground">允许的接收者: </span>
            {account.allowedRecipients.map(r => (
              <Badge key={r} variant="outline" className="ml-1">{r}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// 账户编辑对话框
function SignalAccountDialog({ open, onOpenChange, account, onSave, title }) {
  const [formData, setFormData] = useState({
    id: '',
    phoneNumber: '',
    signalCliPath: '',
    enabled: true,
    allowedRecipients: [],
    dataDir: '',
    socketPath: '',
    autoReceive: true
  })

  useEffect(() => {
    if (account) {
      setFormData({
        id: account.id || '',
        phoneNumber: account.phoneNumber || '',
        signalCliPath: account.signalCliPath || '',
        enabled: account.enabled ?? true,
        allowedRecipients: account.allowedRecipients || [],
        dataDir: account.dataDir || '',
        socketPath: account.socketPath || '',
        autoReceive: account.autoReceive ?? true
      })
    } else {
      setFormData({
        id: '',
        phoneNumber: '',
        signalCliPath: '',
        enabled: true,
        allowedRecipients: [],
        dataDir: '',
        socketPath: '',
        autoReceive: true
      })
    }
  }, [account, open])

  const handleSave = () => {
    if (!formData.id || !formData.phoneNumber) {
      toast.error('保存失败', 'ID 和电话号码不能为空')
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
              placeholder="例如: my_signal"
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>电话号码 *</Label>
            <Input
              placeholder="+8613800138000"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Signal 注册的电话号码，包含国家代码
            </p>
          </div>
          <div className="space-y-2">
            <Label>Signal CLI 路径</Label>
            <Input
              placeholder="/usr/local/bin/signal-cli"
              value={formData.signalCliPath}
              onChange={(e) => setFormData({ ...formData, signalCliPath: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Signal CLI 可执行文件的路径
            </p>
          </div>
          <div className="space-y-2">
            <Label>数据目录</Label>
            <Input
              placeholder="~/.local/share/signal-cli"
              value={formData.dataDir}
              onChange={(e) => setFormData({ ...formData, dataDir: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Signal CLI 数据存储目录
            </p>
          </div>
          <div className="space-y-2">
            <Label>Socket 路径</Label>
            <Input
              placeholder="/var/run/signal-cli/socket"
              value={formData.socketPath}
              onChange={(e) => setFormData({ ...formData, socketPath: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Signal CLI daemon 的 Unix socket 路径
            </p>
          </div>
          <div className="space-y-2">
            <Label>允许的接收者 (逗号分隔)</Label>
            <Input
              placeholder="+8613800138000"
              value={formData.allowedRecipients.join(', ')}
              onChange={(e) => setFormData({
                ...formData,
                allowedRecipients: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              })}
            />
            <p className="text-xs text-muted-foreground">
              留空表示允许所有接收者
            </p>
          </div>
          <div className="flex items-center justify-between">
            <Label>自动接收消息</Label>
            <Switch
              checked={formData.autoReceive}
              onCheckedChange={(checked) => setFormData({ ...formData, autoReceive: checked })}
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

export default function SignalChannelConfig() {
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
        const signalConfig = result.data?.channels?.signal || { enabled: false, accounts: [] }
        setConfig(signalConfig)
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
        fullConfig.channels.signal = newConfig
        const saveResult = await api.config.set(fullConfig)
        if (saveResult.success) {
          setConfig(newConfig)
          toast.success('保存成功', 'Signal 配置已更新')
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
          <h3 className="text-lg font-semibold">Signal 通道</h3>
          <p className="text-sm text-muted-foreground">配置 Signal CLI 以接收和发送消息</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label>启用 Signal</Label>
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
          <CardDescription>管理多个 Signal 账户</CardDescription>
        </CardHeader>
        <CardContent>
          {config.accounts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              暂无账户，点击"添加账户"创建第一个 Signal 机器人
            </div>
          ) : (
            config.accounts.map(account => (
              <SignalAccountCard
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
          <p>1. 安装 Signal CLI (github.com/AsamK/signal-cli)</p>
          <p>2. 使用 signal-cli link 或 register 命令注册/关联设备</p>
          <p>3. 启动 signal-cli daemon 模式以接收消息</p>
          <p>4. 配置允许的接收者以限制消息响应范围</p>
          <p>5. 确保 Signal CLI 有正确的权限访问数据目录</p>
        </CardContent>
      </Card>

      {/* 编辑对话框 */}
      <SignalAccountDialog
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
