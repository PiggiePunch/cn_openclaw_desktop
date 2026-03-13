/**
 * ExecApprovalPanel - 执行审批面板
 *
 * 管理工具执行审批规则
 * 原版 Gateway 支持：exec.approvals.get/set, exec.approvals.node.get/set
 */
import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Badge } from './ui/badge'
import { Switch } from './ui/switch'
import { Input } from './ui/input'
import { Label } from './ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import {
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  AlertTriangle,
  Settings,
  User,
  Terminal,
} from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

export default function ExecApprovalPanel() {
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState(null)
  const [nodeConfig, setNodeConfig] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    setLoading(true)
    try {
      // 只加载主审批配置
      // 节点审批配置需要传入 nodeId，这里使用默认配置
      const mainResult = await api.execApprovals.get()

      if (mainResult.success) {
        setConfig(mainResult.data)
      }
      // 节点审批使用默认配置（需要特定 nodeId 才能获取/设置）
      setNodeConfig({ enabled: false, mode: 'ask' })
    } catch (error) {
      console.error('加载审批配置失败:', error)
    }
    setLoading(false)
  }

  const handleSaveMain = async () => {
    setSaving(true)
    const result = await api.execApprovals.set(config)
    if (result.success) {
      toast.success('保存成功', '审批配置已更新')
    } else {
      toast.error('保存失败', result.error)
    }
    setSaving(false)
  }

  const handleSaveNode = async () => {
    setSaving(true)
    const result = await api.execApprovals.nodeSet(nodeConfig)
    if (result.success) {
      toast.success('保存成功', '节点审批配置已更新')
    } else {
      toast.error('保存失败', result.error)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">加载中...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">执行审批</h2>
          <p className="text-muted-foreground">管理工具执行的安全审批规则</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadConfig}>
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </div>

      {/* 主审批配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            主审批配置
          </CardTitle>
          <CardDescription>
            控制哪些工具执行需要用户审批
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>启用审批系统</Label>
              <p className="text-sm text-muted-foreground">
                开启后，敏感操作需要用户确认
              </p>
            </div>
            <Switch
              checked={config?.enabled ?? false}
              onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label>审批模式</Label>
            <Select
              value={config?.mode || 'ask'}
              onValueChange={(value) => setConfig({ ...config, mode: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ask">询问用户</SelectItem>
                <SelectItem value="auto-approve">自动批准</SelectItem>
                <SelectItem value="auto-deny">自动拒绝</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>超时时间（秒）</Label>
            <Input
              type="number"
              value={config?.timeout_seconds || 60}
              onChange={(e) => setConfig({ ...config, timeout_seconds: parseInt(e.target.value) || 60 })}
              placeholder="60"
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveMain} disabled={saving}>
              {saving ? '保存中...' : '保存配置'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 节点审批配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            节点审批配置
          </CardTitle>
          <CardDescription>
            控制远程节点的执行审批行为
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>启用节点审批</Label>
              <p className="text-sm text-muted-foreground">
                远程节点的敏感操作也需要审批
              </p>
            </div>
            <Switch
              checked={nodeConfig?.enabled ?? false}
              onCheckedChange={(checked) => setNodeConfig({ ...nodeConfig, enabled: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label>节点审批模式</Label>
            <Select
              value={nodeConfig?.mode || 'ask'}
              onValueChange={(value) => setNodeConfig({ ...nodeConfig, mode: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ask">询问用户</SelectItem>
                <SelectItem value="auto-approve">自动批准</SelectItem>
                <SelectItem value="auto-deny">自动拒绝</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveNode} disabled={saving}>
              {saving ? '保存中...' : '保存配置'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            安全说明
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
              <span><strong>询问用户</strong>: 敏感操作会等待用户确认</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
              <span><strong>自动批准</strong>: 所有操作自动通过（不推荐）</span>
            </li>
            <li className="flex items-start gap-2">
              <XCircle className="w-4 h-4 text-red-500 mt-0.5" />
              <span><strong>自动拒绝</strong>: 所有敏感操作自动拒绝</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
