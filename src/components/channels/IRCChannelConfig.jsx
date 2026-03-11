/**
 * IRCChannelConfig - IRC 通道配置组件
 * 支持通过 IRC 协议接收和发送消息
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
  Hash
} from 'lucide-react'

import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

// IRC 账户配置卡片组件
function IRCAccountCard({ account, onEdit, onDelete, onToggle }) {
  return (
    <Card className="mb-3">
      <CardHeader className="pb-2 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-orange-500" />
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
          {account.server ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              服务器: {account.server}:{account.port || 6667}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              未配置服务器
            </span>
          )}
          {account.nickname ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              昵称: {account.nickname}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              未配置昵称
            </span>
          )}
          {account.tls && (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              TLS 已启用
            </span>
          )}
        </div>
        {account.channels?.length > 0 && (
          <div className="mt-2">
            <span className="text-xs text-muted-foreground">频道: </span>
            {account.channels.map(c => (
              <Badge key={c} variant="outline" className="ml-1">{c}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// 账户编辑对话框
function IRCAccountDialog({ open, onOpenChange, account, onSave, title }) {
  const [formData, setFormData] = useState({
    id: '',
    server: '',
    port: 6667,
    nickname: '',
    username: '',
    realname: '',
    password: '',
    enabled: true,
    channels: [],
    tls: true,
    autoJoin: true,
    nickservPassword: ''
  })

  useEffect(() => {
    if (account) {
      setFormData({
        id: account.id || '',
        server: account.server || '',
        port: account.port || 6667,
        nickname: account.nickname || '',
        username: account.username || '',
        realname: account.realname || '',
        password: account.password || '',
        enabled: account.enabled ?? true,
        channels: account.channels || [],
        tls: account.tls ?? true,
        autoJoin: account.autoJoin ?? true,
        nickservPassword: account.nickservPassword || ''
      })
    } else {
      setFormData({
        id: '',
        server: '',
        port: 6667,
        nickname: '',
        username: '',
        realname: '',
        password: '',
        enabled: true,
        channels: [],
        tls: true,
        autoJoin: true,
        nickservPassword: ''
      })
    }
  }, [account, open])

  const handleSave = () => {
    if (!formData.id || !formData.server || !formData.nickname) {
      toast.error('保存失败', 'ID、服务器和昵称不能为空')
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
              placeholder="例如: libera"
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>服务器 *</Label>
              <Input
                placeholder="irc.libera.chat"
                value={formData.server}
                onChange={(e) => setFormData({ ...formData, server: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>端口</Label>
              <Input
                type="number"
                placeholder="6667"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 6667 })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>昵称 *</Label>
            <Input
              placeholder="YourBot"
              value={formData.nickname}
              onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>用户名</Label>
              <Input
                placeholder="bot"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>真实名称</Label>
              <Input
                placeholder="OpenClaw Bot"
                value={formData.realname}
                onChange={(e) => setFormData({ ...formData, realname: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>服务器密码</Label>
            <Input
              type="password"
              placeholder="可选"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>NickServ 密码</Label>
            <Input
              type="password"
              placeholder="用于昵称认证"
              value={formData.nickservPassword}
              onChange={(e) => setFormData({ ...formData, nickservPassword: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>频道列表 (逗号分隔)</Label>
            <Input
              placeholder="#openclaw, #help"
              value={formData.channels.join(', ')}
              onChange={(e) => setFormData({
                ...formData,
                channels: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>启用 TLS</Label>
            <Switch
              checked={formData.tls}
              onCheckedChange={(checked) => setFormData({ ...formData, tls: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>自动加入频道</Label>
            <Switch
              checked={formData.autoJoin}
              onCheckedChange={(checked) => setFormData({ ...formData, autoJoin: checked })}
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

export default function IRCChannelConfig() {
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
        const ircConfig = result.data?.channels?.irc || { enabled: false, accounts: [] }
        setConfig(ircConfig)
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
        fullConfig.channels.irc = newConfig
        const saveResult = await api.config.set(fullConfig)
        if (saveResult.success) {
          setConfig(newConfig)
          toast.success('保存成功', 'IRC 配置已更新')
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
          <h3 className="text-lg font-semibold">IRC 通道</h3>
          <p className="text-sm text-muted-foreground">配置 IRC 连接以接收和发送消息</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label>启用 IRC</Label>
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
          <CardDescription>管理 IRC 服务器连接</CardDescription>
        </CardHeader>
        <CardContent>
          {config.accounts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              暂无账户，点击"添加账户"创建第一个 IRC 连接
            </div>
          ) : (
            config.accounts.map(account => (
              <IRCAccountCard
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
          <p>1. 填写 IRC 服务器地址（如 irc.libera.chat）</p>
          <p>2. 配置机器人昵称和用户信息</p>
          <p>3. 如需昵称认证，填写 NickServ 密码</p>
          <p>4. 添加要加入的频道列表</p>
          <p>5. 建议启用 TLS 加密连接</p>
        </CardContent>
      </Card>

      {/* 编辑对话框 */}
      <IRCAccountDialog
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
