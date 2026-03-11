/**
 * MatrixChannelConfig - Matrix 通道配置组件
 * 支持通过 Matrix 协议接收和发送消息
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
  Grid3X3
} from 'lucide-react'

import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

// Matrix 账户配置卡片组件
function MatrixAccountCard({ account, onEdit, onDelete, onToggle }) {
  return (
    <Card className="mb-3">
      <CardHeader className="pb-2 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Grid3X3 className="h-4 w-4 text-purple-500" />
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
          {account.homeserver ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              服务器: {account.homeserver}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              未配置服务器
            </span>
          )}
          {account.userId ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              用户: {account.userId}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              未配置用户 ID
            </span>
          )}
          {account.accessToken && (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              访问令牌: ****{account.accessToken.slice(-8)}
            </span>
          )}
        </div>
        {account.rooms?.length > 0 && (
          <div className="mt-2">
            <span className="text-xs text-muted-foreground">房间: </span>
            {account.rooms.slice(0, 3).map(r => (
              <Badge key={r} variant="outline" className="ml-1">{r.slice(0, 20)}...</Badge>
            ))}
            {account.rooms.length > 3 && (
              <Badge variant="outline" className="ml-1">+{account.rooms.length - 3}</Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// 账户编辑对话框
function MatrixAccountDialog({ open, onOpenChange, account, onSave, title }) {
  const [formData, setFormData] = useState({
    id: '',
    homeserver: '',
    userId: '',
    accessToken: '',
    password: '',
    deviceId: '',
    enabled: true,
    rooms: [],
    autoJoin: true,
    encryption: true
  })

  useEffect(() => {
    if (account) {
      setFormData({
        id: account.id || '',
        homeserver: account.homeserver || '',
        userId: account.userId || '',
        accessToken: account.accessToken || '',
        password: account.password || '',
        deviceId: account.deviceId || '',
        enabled: account.enabled ?? true,
        rooms: account.rooms || [],
        autoJoin: account.autoJoin ?? true,
        encryption: account.encryption ?? true
      })
    } else {
      setFormData({
        id: '',
        homeserver: '',
        userId: '',
        accessToken: '',
        password: '',
        deviceId: '',
        enabled: true,
        rooms: [],
        autoJoin: true,
        encryption: true
      })
    }
  }, [account, open])

  const handleSave = () => {
    if (!formData.id || !formData.homeserver || !formData.userId) {
      toast.error('保存失败', 'ID、服务器和用户 ID 不能为空')
      return
    }
    if (!formData.accessToken && !formData.password) {
      toast.error('保存失败', '访问令牌或密码必须填写一项')
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
              placeholder="例如: matrix_org"
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>服务器地址 *</Label>
            <Input
              placeholder="https://matrix.org"
              value={formData.homeserver}
              onChange={(e) => setFormData({ ...formData, homeserver: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Matrix 主服务器 URL
            </p>
          </div>
          <div className="space-y-2">
            <Label>用户 ID *</Label>
            <Input
              placeholder="@bot:matrix.org"
              value={formData.userId}
              onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              完整的 Matrix 用户 ID
            </p>
          </div>
          <div className="space-y-2">
            <Label>访问令牌</Label>
            <Input
              type="password"
              placeholder="syt_..."
              value={formData.accessToken}
              onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              优先使用访问令牌进行认证
            </p>
          </div>
          <div className="space-y-2">
            <Label>密码</Label>
            <Input
              type="password"
              placeholder="如果没有访问令牌"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              如果未提供访问令牌，将使用密码登录
            </p>
          </div>
          <div className="space-y-2">
            <Label>设备 ID</Label>
            <Input
              placeholder="OPENCLAW_BOT"
              value={formData.deviceId}
              onChange={(e) => setFormData({ ...formData, deviceId: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              设备标识符，可选
            </p>
          </div>
          <div className="space-y-2">
            <Label>房间 ID 列表 (逗号分隔)</Label>
            <Input
              placeholder="!abc123:matrix.org"
              value={formData.rooms.join(', ')}
              onChange={(e) => setFormData({
                ...formData,
                rooms: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              })}
            />
            <p className="text-xs text-muted-foreground">
              留空表示响应所有房间
            </p>
          </div>
          <div className="flex items-center justify-between">
            <Label>自动加入邀请</Label>
            <Switch
              checked={formData.autoJoin}
              onCheckedChange={(checked) => setFormData({ ...formData, autoJoin: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>启用端到端加密</Label>
            <Switch
              checked={formData.encryption}
              onCheckedChange={(checked) => setFormData({ ...formData, encryption: checked })}
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

export default function MatrixChannelConfig() {
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
        const matrixConfig = result.data?.channels?.matrix || { enabled: false, accounts: [] }
        setConfig(matrixConfig)
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
        fullConfig.channels.matrix = newConfig
        const saveResult = await api.config.set(fullConfig)
        if (saveResult.success) {
          setConfig(newConfig)
          toast.success('保存成功', 'Matrix 配置已更新')
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
          <h3 className="text-lg font-semibold">Matrix 通道</h3>
          <p className="text-sm text-muted-foreground">配置 Matrix 客户端以接收和发送消息</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label>启用 Matrix</Label>
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
          <CardDescription>管理 Matrix 服务器连接</CardDescription>
        </CardHeader>
        <CardContent>
          {config.accounts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              暂无账户，点击"添加账户"创建第一个 Matrix 连接
            </div>
          ) : (
            config.accounts.map(account => (
              <MatrixAccountCard
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
          <p>1. 填写 Matrix 服务器地址（如 matrix.org）</p>
          <p>2. 配置用户 ID（格式: @username:server.com）</p>
          <p>3. 提供访问令牌或密码进行认证</p>
          <p>4. 可选配置房间 ID 以限制响应范围</p>
          <p>5. 端到端加密需要额外配置设备密钥</p>
        </CardContent>
      </Card>

      {/* 编辑对话框 */}
      <MatrixAccountDialog
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
