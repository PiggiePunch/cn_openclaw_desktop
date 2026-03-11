/**
 * FeishuChannelConfig - 飞书通道配置组件
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
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

// 飞书账户配置组件
function FeishuAccountCard({ account, onEdit, onDelete, onToggle }) {
  return (
    <Card className="mb-3">
      <CardHeader className="pb-2 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{account.name || account.id}</CardTitle>
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
          {account.appId ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              App ID: {account.appId}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              未配置 App ID
            </span>
          )}
          <span className="flex items-center gap-1">
            域名: {account.domain || 'feishu'}
          </span>
          <span className="flex items-center gap-1">
            连接方式: {account.connectionMode || 'websocket'}
          </span>
        </div>
        {account.allowFrom?.length > 0 && (
          <div className="mt-2">
            <span className="text-xs text-muted-foreground">允许的来源: </span>
            {account.allowFrom.map(a => (
              <Badge key={String(a)} variant="outline" className="ml-1">{String(a)}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// 账户编辑对话框
function FeishuAccountDialog({ open, onOpenChange, account, onSave, title }) {
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    appId: '',
    appSecret: '',
    encryptKey: '',
    verificationToken: '',
    domain: 'feishu',
    connectionMode: 'websocket',
    enabled: true,
    allowFrom: [],
    requireMention: true,
    dmPolicy: 'pairing',
    groupPolicy: 'allowlist'
  })

  useEffect(() => {
    if (account) {
      setFormData({
        id: account.id || '',
        name: account.name || '',
        appId: account.appId || '',
        appSecret: account.appSecret || '',
        encryptKey: account.encryptKey || '',
        verificationToken: account.verificationToken || '',
        domain: account.domain || 'feishu',
        connectionMode: account.connectionMode || 'websocket',
        enabled: account.enabled ?? true,
        allowFrom: account.allowFrom || [],
        requireMention: account.requireMention ?? true,
        dmPolicy: account.dmPolicy || 'pairing',
        groupPolicy: account.groupPolicy || 'allowlist'
      })
    } else {
      setFormData({
        id: '',
        name: '',
        appId: '',
        appSecret: '',
        encryptKey: '',
        verificationToken: '',
        domain: 'feishu',
        connectionMode: 'websocket',
        enabled: true,
        allowFrom: [],
        requireMention: true,
        dmPolicy: 'pairing',
        groupPolicy: 'allowlist'
      })
    }
  }, [account, open])

  const handleSave = () => {
    if (!formData.id || !formData.appId || !formData.appSecret) {
      toast.error('保存失败', 'ID、App ID 和 App Secret 不能为空')
      return
    }
    onSave(formData)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>账户 ID *</Label>
              <Input
                placeholder="例如: my_feishu"
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>显示名称</Label>
              <Input
                placeholder="例如: 飞书助手"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>App ID *</Label>
            <Input
              placeholder="cli_xxxxx"
              value={formData.appId}
              onChange={(e) => setFormData({ ...formData, appId: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>App Secret *</Label>
            <Input
              type="password"
              placeholder="从飞书开放平台获取"
              value={formData.appSecret}
              onChange={(e) => setFormData({ ...formData, appSecret: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Encrypt Key (可选)</Label>
              <Input
                placeholder="用于加密模式"
                value={formData.encryptKey}
                onChange={(e) => setFormData({ ...formData, encryptKey: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Verification Token</Label>
              <Input
                placeholder="用于 Webhook 模式"
                value={formData.verificationToken}
                onChange={(e) => setFormData({ ...formData, verificationToken: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>域名</Label>
              <Select
                value={formData.domain}
                onValueChange={(v) => setFormData({ ...formData, domain: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="feishu">飞书 (feishu.cn)</SelectItem>
                  <SelectItem value="lark">飞书 (lark.com)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>连接方式</Label>
              <Select
                value={formData.connectionMode}
                onValueChange={(v) => setFormData({ ...formData, connectionMode: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="websocket">WebSocket (推荐)</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>允许的来源 ID (逗号分隔)</Label>
            <Input
              placeholder="留空表示允许所有"
              value={formData.allowFrom.join(', ')}
              onChange={(e) => setFormData({
                ...formData,
                allowFrom: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>私信策略</Label>
              <Select
                value={formData.dmPolicy}
                onValueChange={(v) => setFormData({ ...formData, dmPolicy: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">开放</SelectItem>
                  <SelectItem value="pairing">配对模式</SelectItem>
                  <SelectItem value="allowlist">白名单</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>群聊策略</Label>
              <Select
                value={formData.groupPolicy}
                onValueChange={(v) => setFormData({ ...formData, groupPolicy: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">开放</SelectItem>
                  <SelectItem value="allowlist">白名单</SelectItem>
                  <SelectItem value="disabled">禁用</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label>需要 @ 提及才能回复</Label>
            <Switch
              checked={formData.requireMention}
              onCheckedChange={(checked) => setFormData({ ...formData, requireMention: checked })}
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

export default function FeishuChannelConfig() {
  const [config, setConfig] = useState({ enabled: false, accounts: {} })
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
        const feishuConfig = result.data?.channels?.feishu || { enabled: false, accounts: {} }
        setConfig(feishuConfig)
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
        fullConfig.channels.feishu = newConfig
        const saveResult = await api.config.set(fullConfig)
        if (saveResult.success) {
          setConfig(newConfig)
          toast.success('保存成功', '飞书配置已更新')
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
    const accounts = { ...config.accounts, [account.id]: account }
    saveConfig({ ...config, accounts })
  }

  const handleUpdateAccount = (account) => {
    const accounts = { ...config.accounts, [account.id]: account }
    saveConfig({ ...config, accounts })
  }

  const handleDeleteAccount = (accountId) => {
    if (!confirm('确定要删除这个账户吗？')) return
    const accounts = { ...config.accounts }
    delete accounts[accountId]
    saveConfig({ ...config, accounts })
  }

  const handleToggleAccount = (accountId, enabled) => {
    const accounts = {
      ...config.accounts,
      [accountId]: { ...config.accounts[accountId], enabled }
    }
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

  const accountList = Object.entries(config.accounts || {}).map(([id, account]) => ({
    id,
    ...account
  }))

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
          <h3 className="text-lg font-semibold">飞书通道</h3>
          <p className="text-sm text-muted-foreground">配置飞书机器人以接收和发送消息</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label>启用飞书</Label>
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
          <CardDescription>管理多个飞书机器人账户</CardDescription>
        </CardHeader>
        <CardContent>
          {accountList.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              暂无账户，点击"添加账户"创建第一个飞书机器人
            </div>
          ) : (
            accountList.map(account => (
              <FeishuAccountCard
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
          <p>1. 在飞书开放平台 (open.feishu.cn) 创建企业自建应用</p>
          <p>2. 获取 App ID 和 App Secret</p>
          <p>3. 配置应用权限: im:message, im:chat 等</p>
          <p>4. 创建事件订阅 (用于 WebSocket 模式) 或配置回调地址 (用于 Webhook 模式)</p>
          <p>5. 如需加密模式，配置 Encrypt Key</p>
        </CardContent>
      </Card>

      {/* 编辑对话框 */}
      <FeishuAccountDialog
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
