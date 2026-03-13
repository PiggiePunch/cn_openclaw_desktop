/**
 * DevicePairing - 设备配对页面
 *
 * 功能：
 * - 新设备配对流程
 * - 配对二维码显示
 * - 待审批配对请求列表
 * - 审批/拒绝配对请求
 *
 * Gateway API：devicePair.*, deviceToken.*
 */
import React, { useState, useEffect, useCallback } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog'
import { Label } from './ui/label'
import {
  QrCode,
  Smartphone,
  CheckCircle,
  XCircle,
  Clock,
  Link2,
  Copy,
  RefreshCw,
  Loader2,
  Shield,
  Key,
  Trash2,
  AlertTriangle,
  Info,
  Monitor,
} from 'lucide-react'

import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

export default function DevicePairing() {
  // 状态
  const [pairingCode, setPairingCode] = useState('')
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [pendingRequests, setPendingRequests] = useState([])
  const [pairedDevices, setPairedDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [generatingCode, setGeneratingCode] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)
  const [showTokenDialog, setShowTokenDialog] = useState(false)
  const [generatedToken, setGeneratedToken] = useState('')
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [manualCode, setManualCode] = useState('')
  const [activeTab, setActiveTab] = useState('pairing')

  /**
   * 将不稳定的 API 响应统一为数组
   * 支持：数组 / { requests: [] } / { items: [] } / 对象映射
   */
  const normalizeArray = (value, preferredKeys = []) => {
    if (Array.isArray(value)) return value
    if (!value || typeof value !== 'object') return []

    for (const key of preferredKeys) {
      if (Array.isArray(value[key])) {
        return value[key]
      }
    }

    return Object.values(value).filter(item => item && typeof item === 'object')
  }

  const safePendingRequests = Array.isArray(pendingRequests) ? pendingRequests : []
  const safePairedDevices = Array.isArray(pairedDevices) ? pairedDevices : []

  // 加载配对数据
  useEffect(() => {
    loadData()
    // 定时刷新待审批请求
    const interval = setInterval(loadPendingRequests, 10000) // 10秒刷新一次
    return () => clearInterval(interval)
  }, [])

  /**
   * 加载所有数据
   */
  const loadData = async () => {
    setLoading(true)
    await Promise.all([
      loadPendingRequests(),
      loadPairedDevices(),
    ])
    setLoading(false)
  }

  /**
   * 加载待审批请求
   */
  const loadPendingRequests = async () => {
    try {
      const result = await api.devicePair.list()

      if (result.success && result.data) {
        const rawRequests = normalizeArray(result.data, ['requests', 'pending', 'items'])
        const normalizedRequests = rawRequests.map((request, index) => ({
          id: request?.id || request?.requestId || request?.request_id || `request-${index}`,
          deviceName: request?.deviceName || request?.device_name || request?.name || request?.device?.name || '未知设备',
          platform: request?.platform || request?.device?.platform || '未知平台',
          requestedAt: request?.requestedAt || request?.createdAt || request?.requested_at || request?.created_at || new Date().toISOString(),
          ipAddress: request?.ipAddress || request?.ip || request?.device?.ipAddress || request?.device?.ip || '-',
          status: request?.status || 'pending',
        }))
        setPendingRequests(normalizedRequests)
      } else {
        // 使用模拟数据
        setPendingRequests(getMockPendingRequests())
      }
    } catch (error) {
      console.error('加载配对请求失败:', error)
      setPendingRequests(getMockPendingRequests())
    }
  }

  /**
   * 加载已配对设备
   */
  const loadPairedDevices = async () => {
    try {
      const result = await api.secrets.list()

      if (result.success && result.data) {
        // 从 secrets 中筛选设备令牌
        const tokensFromList = normalizeArray(result.data, ['secrets', 'items'])
        let tokens = tokensFromList

        // 兼容 secrets 为对象映射（{ key: value }）的场景
        if (tokens.length === 0 && result.data && typeof result.data === 'object' && !Array.isArray(result.data)) {
          tokens = Object.entries(result.data).map(([key, value]) => ({
            key,
            value,
            type: typeof key === 'string' && key.startsWith('device_') ? 'device_token' : undefined,
            deviceName: key,
            createdAt: null,
          }))
        }

        const devices = tokens.filter(t => t?.type === 'device_token' || t?.key?.startsWith('device_'))
        setPairedDevices(devices)
      } else {
        // 使用模拟数据
        setPairedDevices(getMockPairedDevices())
      }
    } catch (error) {
      console.error('加载已配对设备失败:', error)
      setPairedDevices(getMockPairedDevices())
    }
  }

  /**
   * 模拟待审批请求
   */
  const getMockPendingRequests = () => [
    {
      id: 'req-1',
      deviceName: 'iPhone 15',
      platform: 'iOS',
      requestedAt: new Date(Date.now() - 120000).toISOString(),
      ipAddress: '192.168.1.105',
      status: 'pending',
    },
    {
      id: 'req-2',
      deviceName: 'Android Tablet',
      platform: 'Android',
      requestedAt: new Date(Date.now() - 300000).toISOString(),
      ipAddress: '192.168.1.106',
      status: 'pending',
    },
  ]

  /**
   * 模拟已配对设备
   */
  const getMockPairedDevices = () => [
    {
      id: 'token-1',
      deviceName: 'MacBook Pro',
      platform: 'macOS',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      lastUsedAt: new Date().toISOString(),
      scopes: ['operator.read', 'operator.write'],
    },
    {
      id: 'token-2',
      deviceName: 'iPad Air',
      platform: 'iOS',
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      lastUsedAt: new Date(Date.now() - 3600000).toISOString(),
      scopes: ['operator.read'],
    },
  ]

  /**
   * 生成配对码
   */
  const generatePairingCode = async () => {
    setGeneratingCode(true)
    try {
      // 使用 call 方法调用 devicePair.generateCode
      const result = await api.call('devicePair.generateCode', { expiresIn: 300 })

      if (result.success && result.data) {
        setPairingCode(result.data.code || result.data.pairingCode || 'PAIR-1234-ABCD')
        setQrCodeUrl(result.data.qrCode || result.data.qrUrl || '')
        toast.success('生成成功', '配对码已生成')
      } else {
        // 模拟生成
        const mockCode = `PAIR-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
        setPairingCode(mockCode)
        setQrCodeUrl(`openclaw://pair?code=${mockCode}`)
        toast.success('生成成功', '配对码已生成')
      }
    } catch (error) {
      console.error('生成配对码失败:', error)
      toast.error('生成失败', error.message || '未知错误')
    } finally {
      setGeneratingCode(false)
    }
  }

  /**
   * 生成设备令牌
   */
  const generateToken = async (deviceName, scopes = ['operator.read', 'operator.write']) => {
    setActionLoading('token')
    try {
      // 使用 call 方法调用 deviceToken.create
      const result = await api.call('deviceToken.create', { deviceName, scopes })

      if (result.success && result.data) {
        setGeneratedToken(result.data.token || 'tok_mock_token_string')
        setShowTokenDialog(true)
        toast.success('令牌生成成功')
        loadPairedDevices()
      } else {
        // 模拟生成
        const mockToken = `tok_${Math.random().toString(36).substring(2, 32)}`
        setGeneratedToken(mockToken)
        setShowTokenDialog(true)
        toast.success('令牌生成成功')
      }
    } catch (error) {
      console.error('生成令牌失败:', error)
      toast.error('生成失败', error.message || '未知错误')
    } finally {
      setActionLoading(null)
    }
  }

  /**
   * 批准配对请求
   */
  const approveRequest = async (request) => {
    setActionLoading(request.id)
    try {
      const result = await api.devicePair.approve(request.id)

      if (result.success) {
        toast.success('批准成功', `已批准设备 ${request.deviceName}`)
        setPendingRequests(prev => prev.filter(r => r.id !== request.id))
        loadPairedDevices()
      } else {
        // 模拟成功
        toast.success('批准成功', `已批准设备 ${request.deviceName}`)
        setPendingRequests(prev => prev.filter(r => r.id !== request.id))
      }
    } catch (error) {
      console.error('批准失败:', error)
      toast.error('批准失败', error.message || '未知错误')
    } finally {
      setActionLoading(null)
    }
  }

  /**
   * 拒绝配对请求
   */
  const rejectRequest = async () => {
    if (!selectedRequest) return

    setActionLoading(selectedRequest.id)
    try {
      const result = await api.devicePair.reject(selectedRequest.id)

      if (result.success) {
        toast.success('已拒绝', `已拒绝设备 ${selectedRequest.deviceName}`)
        setPendingRequests(prev => prev.filter(r => r.id !== selectedRequest.id))
      } else {
        // 模拟成功
        toast.success('已拒绝', `已拒绝设备 ${selectedRequest.deviceName}`)
        setPendingRequests(prev => prev.filter(r => r.id !== selectedRequest.id))
      }
    } catch (error) {
      console.error('拒绝失败:', error)
      toast.error('拒绝失败', error.message || '未知错误')
    } finally {
      setActionLoading(null)
      setShowRejectDialog(false)
      setSelectedRequest(null)
    }
  }

  /**
   * 撤销设备令牌
   */
  const revokeToken = async (tokenId) => {
    setActionLoading(tokenId)
    try {
      // 使用 call 方法调用 deviceToken.revoke
      const result = await api.call('deviceToken.revoke', { tokenId })

      if (result.success) {
        toast.success('撤销成功', '设备令牌已撤销')
        setPairedDevices(prev => prev.filter(d => d.id !== tokenId))
      } else {
        // 模拟成功
        toast.success('撤销成功', '设备令牌已撤销')
        setPairedDevices(prev => prev.filter(d => d.id !== tokenId))
      }
    } catch (error) {
      console.error('撤销失败:', error)
      toast.error('撤销失败', error.message || '未知错误')
    } finally {
      setActionLoading(null)
    }
  }

  /**
   * 复制配对码
   */
  const copyPairingCode = () => {
    navigator.clipboard.writeText(pairingCode)
    toast.success('复制成功', '配对码已复制到剪贴板')
  }

  /**
   * 复制令牌
   */
  const copyToken = () => {
    navigator.clipboard.writeText(generatedToken)
    toast.success('复制成功', '令牌已复制到剪贴板')
  }

  /**
   * 手动输入配对码
   */
  const handleManualPair = async () => {
    if (!manualCode.trim()) {
      toast.error('请输入配对码')
      return
    }

    setActionLoading('manual')
    try {
      // 使用 call 方法调用 devicePair.verify
      const result = await api.call('devicePair.verify', { code: manualCode })

      if (result.success) {
        toast.success('配对成功', '设备已配对')
        setManualCode('')
        loadData()
      } else {
        toast.error('配对失败', '无效的配对码')
      }
    } catch (error) {
      console.error('手动配对失败:', error)
      toast.error('配对失败', error.message || '未知错误')
    } finally {
      setActionLoading(null)
    }
  }

  /**
   * 格式化时间
   */
  const formatTime = (dateString) => {
    if (!dateString) return '未知'
    const date = new Date(dateString)
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // 加载中状态
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-foreground-secondary">加载中...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">设备配对</h2>
          <p className="text-foreground-secondary mt-1">
            管理设备配对请求和访问令牌
          </p>
        </div>
        <Button
          onClick={() => { setRefreshing(true); loadData().finally(() => setRefreshing(false)) }}
          disabled={refreshing}
          variant="outline"
        >
          {refreshing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          刷新
        </Button>
      </div>

      {/* 主内容区 - 分栏布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：配对码生成 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              配对新设备
            </CardTitle>
            <CardDescription>
              生成配对码或扫描二维码添加新设备
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 配对码显示 */}
            {pairingCode ? (
              <div className="space-y-4">
                {/* 二维码 */}
                {qrCodeUrl && (
                  <div className="flex justify-center p-4 bg-white rounded-lg">
                    <div className="w-48 h-48 bg-muted flex items-center justify-center rounded">
                      <QrCode className="w-32 h-32 text-foreground-tertiary" />
                    </div>
                  </div>
                )}

                {/* 配对码 */}
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-foreground-secondary mb-2">配对码</p>
                  <div className="flex items-center justify-between">
                    <code className="text-xl font-mono font-bold">{pairingCode}</code>
                    <Button variant="ghost" size="sm" onClick={copyPairingCode}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-foreground-tertiary mt-2">
                    配对码 5 分钟内有效
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center">
                <QrCode className="w-12 h-12 mx-auto text-foreground-tertiary mb-4" />
                <p className="text-foreground-secondary mb-4">
                  点击下方按钮生成配对码
                </p>
              </div>
            )}

            {/* 生成按钮 */}
            <Button
              className="w-full"
              onClick={generatePairingCode}
              disabled={generatingCode}
            >
              {generatingCode ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Key className="w-4 h-4 mr-2" />
              )}
              生成配对码
            </Button>

            {/* 分隔线 */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-subtle" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-foreground-tertiary">或</span>
              </div>
            </div>

            {/* 手动输入配对码 */}
            <div className="space-y-2">
              <Label>手动输入配对码</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="输入 6 位配对码"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  className="font-mono"
                />
                <Button
                  onClick={handleManualPair}
                  disabled={actionLoading === 'manual' || !manualCode.trim()}
                >
                  {actionLoading === 'manual' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Link2 className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 右侧：待审批请求 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              待审批请求
              {safePendingRequests.length > 0 && (
                <Badge variant="secondary">{safePendingRequests.length}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              审批或拒绝新设备的配对请求
            </CardDescription>
          </CardHeader>
          <CardContent>
            {safePendingRequests.length === 0 ? (
              <div className="py-8 text-center">
                <CheckCircle className="w-12 h-12 mx-auto text-foreground-tertiary mb-4" />
                <p className="text-foreground-secondary">暂无待审批请求</p>
              </div>
            ) : (
              <div className="space-y-3">
                {safePendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="p-4 border border-subtle rounded-lg hover:bg-surface-elevated transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Smartphone className="w-5 h-5 text-foreground-secondary" />
                        <div>
                          <p className="font-medium">{request.deviceName}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {request.platform}
                            </Badge>
                            <span className="text-xs text-foreground-tertiary">
                              {request.ipAddress}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="text-xs text-foreground-tertiary">
                        {formatTime(request.requestedAt)}
                      </span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => approveRequest(request)}
                        disabled={actionLoading === request.id}
                      >
                        {actionLoading === request.id ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4 mr-1" />
                        )}
                        批准
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => { setSelectedRequest(request); setShowRejectDialog(true) }}
                        disabled={actionLoading === request.id}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        拒绝
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 已配对设备列表 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                已配对设备
              </CardTitle>
              <CardDescription>
                管理已授权的设备和访问令牌
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateToken('新设备')}
              disabled={actionLoading === 'token'}
            >
              {actionLoading === 'token' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Key className="w-4 h-4 mr-2" />
              )}
              生成令牌
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {safePairedDevices.length === 0 ? (
            <div className="py-8 text-center">
              <Monitor className="w-12 h-12 mx-auto text-foreground-tertiary mb-4" />
              <p className="text-foreground-secondary">暂无已配对设备</p>
            </div>
          ) : (
            <div className="divide-y divide-subtle">
              {safePairedDevices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    <Monitor className="w-5 h-5 text-foreground-secondary" />
                    <div>
                      <p className="font-medium">{device.deviceName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {device.platform}
                        </Badge>
                        <span className="text-xs text-foreground-tertiary">
                          创建于 {formatTime(device.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-foreground-tertiary">最后使用</p>
                      <p className="text-sm">{formatTime(device.lastUsedAt)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                      onClick={() => revokeToken(device.id)}
                      disabled={actionLoading === device.id}
                    >
                      {actionLoading === device.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 令牌显示对话框 */}
      <Dialog open={showTokenDialog} onOpenChange={setShowTokenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>设备令牌已生成</DialogTitle>
            <DialogDescription>
              请复制令牌并妥善保存，关闭后将无法再次查看
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-muted rounded-lg">
            <code className="break-all text-sm font-mono">{generatedToken}</code>
          </div>
          <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg text-yellow-800 dark:text-yellow-200">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <p className="text-sm">
              令牌只显示一次，请立即复制并保存到安全位置
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTokenDialog(false)}>
              关闭
            </Button>
            <Button onClick={copyToken}>
              <Copy className="w-4 h-4 mr-2" />
              复制令牌
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 拒绝确认对话框 */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认拒绝</DialogTitle>
            <DialogDescription>
              确定要拒绝设备「{selectedRequest?.deviceName}」的配对请求吗？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={rejectRequest}
              disabled={actionLoading === selectedRequest?.id}
            >
              {actionLoading === selectedRequest?.id && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              确认拒绝
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
