/**
 * ZaloChannelConfig - Zalo 通道配置组件
 * 支持官方 Zalo OA (Official Account) API
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

// Zalo 账户配置卡片
function ZaloAccountCard({ account, onEdit, onDelete, onToggle }) {
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
        <div className="text-sm text-muted-foreground">
          {account.oa_id ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              OA ID: {account.oa_id}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              未配置 OA ID
            </span>
          )}
        </div>
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

// 添加/编辑 Zalo 账户对话框
function ZaloAccountDialog({ open, onClose, account, onSave }) {
  const [formData, setFormData] = useState({
    id: '',
    oa_id: '',
    secret_key: '',
    enabled: true,
    allowed_users: [],
    ...account
  })
  const [saving, setSaving] = useState(false)
  const [allowedUsersText, setAllowedUsersText] = useState('')

  useEffect(() => {
    if (account) {
      setFormData({ ...formData, ...account })
      setAllowedUsersText(account.allowed_users?.join(', ') || '')
    } else {
      setFormData({
        id: '',
        oa_id: '',
        secret_key: '',
        enabled: true,
        allowed_users: []
      })
      setAllowedUsersText('')
    }
  }, [account, open])

  const handleSave = async () => {
    if (!formData.id) {
      toast.error('错误', '请输入账户 ID')
      return
    }
    if (!formData.oa_id) {
      toast.error('错误', '请输入 OA ID')
      return
    }

    setSaving(true)
    try {
      const users = allowedUsersText
        .split(',')
        .map(u => u.trim())
        .filter(u => u)

      await onSave({
        ...formData,
        allowed_users: users
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? '编辑 Zalo 账户' : '添加 Zalo 账户'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>账户 ID</Label>
            <Input
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
              placeholder="例如: zalo-main"
              disabled={!!account}
            />
          </div>
          <div className="space-y-2">
            <Label>OA ID (Official Account ID)</Label>
            <Input
              value={formData.oa_id}
              onChange={(e) => setFormData({ ...formData, oa_id: e.target.value })}
              placeholder="输入 Zalo OA ID"
            />
          </div>
          <div className="space-y-2">
            <Label>Secret Key</Label>
            <Input
              type="password"
              value={formData.secret_key}
              onChange={(e) => setFormData({ ...formData, secret_key: e.target.value })}
              placeholder="输入 Secret Key"
            />
          </div>
          <div className="space-y-2">
            <Label>允许的用户 ID (逗号分隔)</Label>
            <Input
              value={allowedUsersText}
              onChange={(e) => setAllowedUsersText(e.target.value)}
              placeholder="例如: user1, user2"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={formData.enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
            />
            <Label>启用</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 主组件
export default function ZaloChannelConfig({ channelId, config, onUpdate }) {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState(null)

  useEffect(() => {
    if (config?.accounts) {
      setAccounts(config.accounts)
    }
  }, [config])

  const handleSave = async (accountData) => {
    let newAccounts
    if (editingAccount) {
      newAccounts = accounts.map(a => a.id === accountData.id ? accountData : a)
    } else {
      newAccounts = [...accounts, accountData]
    }
    setAccounts(newAccounts)
    await onUpdate({ accounts: newAccounts })
  }

  const handleToggle = async (accountId, enabled) => {
    const newAccounts = accounts.map(a =>
      a.id === accountId ? { ...a, enabled } : a
    )
    setAccounts(newAccounts)
    await onUpdate({ accounts: newAccounts })
  }

  const handleDelete = async (accountId) => {
    if (!confirm('确定要删除此账户吗？')) return
    const newAccounts = accounts.filter(a => a.id !== accountId)
    setAccounts(newAccounts)
    await onUpdate({ accounts: newAccounts })
  }

  const handleEdit = (account) => {
    setEditingAccount(account)
    setDialogOpen(true)
  }

  const handleAdd = () => {
    setEditingAccount(null)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Zalo 配置</h3>
          <p className="text-sm text-muted-foreground">
            配置 Zalo Official Account (OA) 通道
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          添加账户
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            暂无 Zalo 账户配置，点击"添加账户"开始配置
          </CardContent>
        </Card>
      ) : (
        accounts.map(account => (
          <ZaloAccountCard
            key={account.id}
            account={account}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggle={handleToggle}
          />
        ))
      )}

      <ZaloAccountDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        account={editingAccount}
        onSave={handleSave}
      />
    </div>
  )
}
