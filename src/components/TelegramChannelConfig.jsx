/**
 * TelegramChannelConfig - Telegram 通道配置组件
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
  Send,
  CheckCircle2,
  XCircle
} from 'lucide-react'

import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

// Telegram 账户配置组件
function TelegramAccountCard({ account, displayName, onEdit, onDelete, onToggle }) {
  return (
    <Card className="mb-3">
      <CardHeader className="pb-2 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="min-w-0">
              <CardTitle className="text-base truncate">{displayName || account.id}</CardTitle>
              {displayName && displayName !== account.id && (
                <p className="text-xs text-muted-foreground truncate">ID: {account.id}</p>
              )}
            </div>
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
        {account.allowed_groups?.length > 0 && (
          <div className="mt-2">
            <span className="text-xs text-muted-foreground">允许的群组: </span>
            {account.allowed_groups.map(g => (
              <Badge key={g} variant="outline" className="ml-1">{g}</Badge>
            ))}
          </div>
        )}
        {account.allowed_users?.length > 0 && (
          <div className="mt-2">
            <span className="text-xs text-muted-foreground">允许的用户: </span>
            {account.allowed_users.map(u => (
              <Badge key={u} variant="outline" className="ml-1">{u}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// 账户编辑对话框
function AccountDialog({ open, onOpenChange, account, onSave, title, agentOptions = [] }) {
  const [formData, setFormData] = useState({
    id: '',
    bot_token: '',
    enabled: true,
    allowed_groups: [],
    allowed_users: [],
    proxy_url: ''
  })

  useEffect(() => {
    if (account) {
      setFormData({
        id: account.id || '',
        bot_token: account.bot_token || '',
        enabled: account.enabled ?? true,
        allowed_groups: account.allowed_groups || [],
        allowed_users: account.allowed_users || [],
        proxy_url: account.proxy_url || ''
      })
    } else {
      setFormData({
        id: '',
        bot_token: '',
        enabled: true,
        allowed_groups: [],
        allowed_users: [],
        proxy_url: ''
      })
    }
  }, [account, open])

  const matchedAgent = agentOptions.find((agent) => agent.id === formData.id)

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
            <Label>账户 ID（建议和智能体 ID 一致）*</Label>
            <Input
              placeholder="例如: chief / coder / main"
              list="telegram-agent-id-options"
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
            />
            <datalist id="telegram-agent-id-options">
              {agentOptions.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </datalist>
            {matchedAgent && (
              <p className="text-xs text-muted-foreground">
                当前将绑定到聊天里的智能体名称: {matchedAgent.name}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Bot Token *</Label>
            <Input
              type="password"
              placeholder="从 @BotFather 获取"
              value={formData.bot_token}
              onChange={(e) => setFormData({ ...formData, bot_token: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              通过 Telegram @BotFather 创建机器人获取
            </p>
          </div>
          <div className="space-y-2">
            <Label>允许的群组 ID (逗号分隔)</Label>
            <Input
              placeholder="123456789"
              value={formData.allowed_groups.join(', ')}
              onChange={(e) => setFormData({
                ...formData,
                allowed_groups: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              })}
            />
          </div>
          <div className="space-y-2">
            <Label>允许的用户 ID (逗号分隔)</Label>
            <Input
              placeholder="123456789"
              value={formData.allowed_users.join(', ')}
              onChange={(e) => setFormData({
                ...formData,
                allowed_users: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              })}
            />
          </div>
          <div className="space-y-2">
            <Label>代理 URL (可选)</Label>
            <Input
              placeholder="socks5://127.0.0.1:1080"
              value={formData.proxy_url}
              onChange={(e) => setFormData({ ...formData, proxy_url: e.target.value })}
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

export default function TelegramChannelConfig() {
  const [config, setConfig] = useState({ enabled: false, accounts: [] })
  const [agentOptions, setAgentOptions] = useState([])
  const [agentNameMap, setAgentNameMap] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [editingAccount, setEditingAccount] = useState(null)

  useEffect(() => {
    loadConfig()
    loadAgents()
  }, [])

  const loadAgents = async () => {
    try {
      const result = await api.agents.list()
      if (!result.success || !Array.isArray(result.data)) return

      const map = {}
      const options = result.data
        .map((agent) => {
          const id = String(agent?.id || '').trim()
          if (!id) return null
          const name = String(
            agent?.identity?.name ||
            agent?.name ||
            agent?.display_name ||
            id
          ).trim() || id
          map[id] = name
          return { id, name }
        })
        .filter(Boolean)

      // Telegram 历史里常见 default 账户，默认映射为 main 的显示名
      if (!map.default && map.main) {
        map.default = map.main
        options.unshift({ id: 'default', name: map.main })
      }

      setAgentNameMap(map)
      setAgentOptions(options)
    } catch (error) {
      console.error('加载智能体列表失败:', error)
    }
  }

  const loadConfig = async () => {
    setIsLoading(true)
    try {
      const result = await api.config.get()
      if (result.success) {
        const telegramConfig = result.data?.channels?.telegram || { enabled: false, accounts: [] }
        setConfig(telegramConfig)
      }
    } catch (e) {
      console.error('加载配置失败:', e)
    }
    setIsLoading(false)
  }

  const saveConfig = async (newConfig) => {
    setIsSaving(true)
    try {
      const result = await api.config.get()
      if (result.success) {
        const fullConfig = result.data
        fullConfig.channels = fullConfig.channels || {}
        fullConfig.channels.telegram = newConfig
        const saveResult = await api.config.set(fullConfig)
        if (saveResult.success) {
          setConfig(newConfig)
          toast.success('保存成功', 'Telegram 配置已更新')
        } else {
          toast.error('保存失败', saveResult.error)
        }
      }
    } catch (e) {
      console.error('保存配置失败:', e)
      toast.error('保存失败', e.message)
    }
    setIsSaving(false)
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

  const getAccountDisplayName = (accountId) => {
    const id = String(accountId || '').trim()
    if (!id) return ''
    return agentNameMap[id] || id
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
          <h3 className="text-lg font-semibold">Telegram 通道</h3>
          <p className="text-sm text-muted-foreground">配置 Telegram 机器人以接收和发送消息</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label>启用 Telegram</Label>
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
          <CardDescription>管理多个 Telegram 机器人账户</CardDescription>
        </CardHeader>
        <CardContent>
          {config.accounts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              暂无账户，点击"添加账户"创建第一个 Telegram 机器人
            </div>
          ) : (
            config.accounts.map(account => (
              <TelegramAccountCard
                key={account.id}
                account={account}
                displayName={getAccountDisplayName(account.id)}
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
          <p>1. 在 Telegram 中搜索 @BotFather 创建新机器人</p>
          <p>2. 获取 Bot Token 并在 above 添加账户</p>
          <p>3. 配置允许的群组或用户 ID 以限制机器人响应范围</p>
          <p>4. 如需代理，在代理 URL 中填写 SOCKS5/HTTP 代理地址</p>
        </CardContent>
      </Card>

      {/* 编辑对话框 */}
      <AccountDialog
        open={showDialog}
        onOpenChange={(open) => {
          setShowDialog(open)
          if (!open) setEditingAccount(null)
        }}
        account={editingAccount}
        onSave={handleSave}
        agentOptions={agentOptions}
        title={editingAccount ? '编辑账户' : '添加账户'}
      />
    </div>
  )
}
