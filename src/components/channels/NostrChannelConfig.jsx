/**
 * NostrChannelConfig - Nostr 通道配置组件
 * 支持通过 Nostr 协议接收和发送消息
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
  Bird
} from 'lucide-react'

import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

// Nostr 账户配置卡片组件
function NostrAccountCard({ account, onEdit, onDelete, onToggle }) {
  return (
    <Card className="mb-3">
      <CardHeader className="pb-2 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bird className="h-4 w-4 text-purple-500" />
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
          {account.privateKey ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              私钥: ****{account.privateKey.slice(-8)}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              未配置私钥
            </span>
          )}
          {account.publicKey && (
            <span className="flex items-center gap-1">
              公钥: {account.publicKey.slice(0, 16)}...
            </span>
          )}
        </div>
        {account.relays?.length > 0 && (
          <div className="mt-2">
            <span className="text-xs text-muted-foreground">中继: </span>
            {account.relays.slice(0, 2).map(r => (
              <Badge key={r} variant="outline" className="ml-1">{r.replace('wss://', '').slice(0, 15)}...</Badge>
            ))}
            {account.relays.length > 2 && (
              <Badge variant="outline" className="ml-1">+{account.relays.length - 2}</Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// 账户编辑对话框
function NostrAccountDialog({ open, onOpenChange, account, onSave, title }) {
  const [formData, setFormData] = useState({
    id: '',
    privateKey: '',
    publicKey: '',
    enabled: true,
    relays: [],
    autoConnect: true,
    subscribeTo: [],
    nsec: ''
  })

  useEffect(() => {
    if (account) {
      setFormData({
        id: account.id || '',
        privateKey: account.privateKey || '',
        publicKey: account.publicKey || '',
        enabled: account.enabled ?? true,
        relays: account.relays || [],
        autoConnect: account.autoConnect ?? true,
        subscribeTo: account.subscribeTo || [],
        nsec: account.nsec || ''
      })
    } else {
      setFormData({
        id: '',
        privateKey: '',
        publicKey: '',
        enabled: true,
        relays: ['wss://relay.damus.io', 'wss://nos.lol'],
        autoConnect: true,
        subscribeTo: [],
        nsec: ''
      })
    }
  }, [account, open])

  const handleSave = () => {
    if (!formData.id) {
      toast.error('保存失败', '账户 ID 不能为空')
      return
    }
    if (!formData.privateKey && !formData.nsec) {
      toast.error('保存失败', '请提供私钥或 nsec')
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
              placeholder="例如: my_nostr"
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>nsec (私钥)</Label>
            <Input
              type="password"
              placeholder="nsec1..."
              value={formData.nsec}
              onChange={(e) => setFormData({ ...formData, nsec: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Nostr 私钥（nsec 格式）
            </p>
          </div>
          <div className="space-y-2">
            <Label>或 Hex 私钥</Label>
            <Input
              type="password"
              placeholder="64字符十六进制"
              value={formData.privateKey}
              onChange={(e) => setFormData({ ...formData, privateKey: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>公钥 (可选)</Label>
            <Input
              placeholder="npub1... 或 hex"
              value={formData.publicKey}
              onChange={(e) => setFormData({ ...formData, publicKey: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              留空将自动从私钥推导
            </p>
          </div>
          <div className="space-y-2">
            <Label>中继服务器列表 (逗号分隔)</Label>
            <Input
              placeholder="wss://relay.damus.io, wss://nos.lol"
              value={formData.relays.join(', ')}
              onChange={(e) => setFormData({
                ...formData,
                relays: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              })}
            />
            <p className="text-xs text-muted-foreground">
              用于连接的 Nostr 中继服务器
            </p>
          </div>
          <div className="space-y-2">
            <Label>订阅的公钥 (逗号分隔)</Label>
            <Input
              placeholder="npub1..., npub1..."
              value={formData.subscribeTo.join(', ')}
              onChange={(e) => setFormData({
                ...formData,
                subscribeTo: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              })}
            />
            <p className="text-xs text-muted-foreground">
              留空表示接收所有消息
            </p>
          </div>
          <div className="flex items-center justify-between">
            <Label>自动连接中继</Label>
            <Switch
              checked={formData.autoConnect}
              onCheckedChange={(checked) => setFormData({ ...formData, autoConnect: checked })}
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

export default function NostrChannelConfig() {
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
        const nostrConfig = result.data?.channels?.nostr || { enabled: false, accounts: [] }
        setConfig(nostrConfig)
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
        fullConfig.channels.nostr = newConfig
        const saveResult = await api.config.set(fullConfig)
        if (saveResult.success) {
          setConfig(newConfig)
          toast.success('保存成功', 'Nostr 配置已更新')
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
          <h3 className="text-lg font-semibold">Nostr 通道</h3>
          <p className="text-sm text-muted-foreground">配置 Nostr 客户端以接收和发送消息</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label>启用 Nostr</Label>
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
          <CardDescription>管理 Nostr 账户配置</CardDescription>
        </CardHeader>
        <CardContent>
          {config.accounts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              暂无账户，点击"添加账户"创建第一个 Nostr 账户
            </div>
          ) : (
            config.accounts.map(account => (
              <NostrAccountCard
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
          <p>1. 生成或导入 Nostr 私钥（nsec 格式或 hex）</p>
          <p>2. 配置要连接的中继服务器</p>
          <p>3. 可选配置要订阅的公钥列表</p>
          <p>4. 启用自动连接以保持在线状态</p>
          <p>5. 私钥将安全存储，请妥善保管</p>
        </CardContent>
      </Card>

      {/* 编辑对话框 */}
      <NostrAccountDialog
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
