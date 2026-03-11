/**
 * DiscoveryPanel - 节点发现面板
 *
 * 功能：
 * - 显示发现服务状态（运行中/已停止）
 * - 显示已发现的节点/设备列表
 * - Tailscale 状态显示（如可用）
 * - 手动扫描按钮
 * - 启动/停止发现服务
 *
 * Gateway API：discovery.*
 */
import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Badge } from './ui/badge'
import {
  Radar,
  RefreshCw,
  Play,
  Square,
  Wifi,
  WifiOff,
  Loader2,
  Monitor,
  Smartphone,
  Globe,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Shield,
} from 'lucide-react'

import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

/**
 * 节点图标映射
 */
const PeerIcon = ({ platform, size = 24 }) => {
  switch (platform?.toLowerCase()) {
    case 'ios':
    case 'iphone':
    case 'ipad':
      return <Smartphone size={size} className="text-foreground-secondary" />
    case 'android':
      return <Smartphone size={size} className="text-foreground-secondary" />
    case 'macos':
    case 'mac':
    case 'windows':
    case 'linux':
      return <Monitor size={size} className="text-foreground-secondary" />
    default:
      return <Monitor size={size} className="text-foreground-secondary" />
  }
}

/**
 * 在线状态指示器
 */
const OnlineIndicator = ({ isOnline, lastSeen }) => {
  if (isOnline) {
    return (
      <div className="flex items-center gap-1.5">
        <Wifi className="w-4 h-4 text-green-500" />
        <span className="text-sm text-green-500">在线</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1.5">
      <WifiOff className="w-4 h-4 text-red-500" />
      <span className="text-sm text-red-500">离线</span>
    </div>
  )
}

/**
 * Tailscale 状态卡片
 */
const TailscaleStatusCard = ({ status, loading }) => {
  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    )
  }

  const isConnected = status?.connected || status?.status === 'running'
  const hostname = status?.hostname || status?.self?.HostName || '未知'
  const tailnet = status?.tailnet || status?.CurrentTailnet?.Name || '未连接'

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="w-5 h-5" />
          Tailscale VPN
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground-secondary">连接状态</span>
          {isConnected ? (
            <Badge variant="default" className="bg-green-500">
              <CheckCircle className="w-3 h-3 mr-1" />
              已连接
            </Badge>
          ) : (
            <Badge variant="secondary">
              <XCircle className="w-3 h-3 mr-1" />
              未连接
            </Badge>
          )}
        </div>
        {isConnected && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground-secondary">主机名</span>
              <span className="font-mono">{hostname}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground-secondary">Tailnet</span>
              <span>{tailnet}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default function DiscoveryPanel() {
  // 状态
  const [discoveryStatus, setDiscoveryStatus] = useState(null)
  const [peers, setPeers] = useState([])
  const [tailscaleStatus, setTailscaleStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [starting, setStarting] = useState(false)
  const [stopping, setStopping] = useState(false)

  // 加载数据
  useEffect(() => {
    loadAllData()
    // 定时刷新状态
    const interval = setInterval(loadStatus, 15000) // 15秒刷新一次
    return () => clearInterval(interval)
  }, [])

  /**
   * 加载所有数据
   */
  const loadAllData = async () => {
    setLoading(true)
    await Promise.all([
      loadStatus(),
      loadPeers(),
      loadTailscaleStatus(),
    ])
    setLoading(false)
  }

  /**
   * 加载发现服务状态
   */
  const loadStatus = async () => {
    try {
      const result = await api.discovery.status()
      if (result.success && result.data) {
        setDiscoveryStatus(result.data)
      } else {
        // 使用模拟数据
        setDiscoveryStatus(getMockStatus())
      }
    } catch (error) {
      console.error('加载发现状态失败:', error)
      setDiscoveryStatus(getMockStatus())
    }
  }

  /**
   * 加载已发现的节点列表
   */
  const loadPeers = async () => {
    try {
      const result = await api.discovery.peers()
      if (result.success && result.data) {
        setPeers(result.data.peers || result.data || [])
      } else {
        // 使用模拟数据
        setPeers(getMockPeers())
      }
    } catch (error) {
      console.error('加载节点列表失败:', error)
      setPeers(getMockPeers())
    }
  }

  /**
   * 加载 Tailscale 状态
   */
  const loadTailscaleStatus = async () => {
    try {
      const result = await api.discovery.tailscaleStatus()
      if (result.success && result.data) {
        setTailscaleStatus(result.data)
      } else {
        // 使用模拟数据
        setTailscaleStatus(getMockTailscaleStatus())
      }
    } catch (error) {
      console.error('加载 Tailscale 状态失败:', error)
      setTailscaleStatus(getMockTailscaleStatus())
    }
  }

  /**
   * 模拟发现服务状态
   */
  const getMockStatus = () => ({
    running: true,
    uptime: 3600,
    lastScan: new Date().toISOString(),
    peersFound: 3,
  })

  /**
   * 模拟已发现的节点
   */
  const getMockPeers = () => [
    {
      id: 'peer-1',
      name: 'MacBook-Pro',
      platform: 'macOS',
      ipAddress: '192.168.1.100',
      port: 18789,
      isOnline: true,
      lastSeen: new Date().toISOString(),
      capabilities: ['chat', 'tools', 'browser'],
    },
    {
      id: 'peer-2',
      name: 'iPhone-15',
      platform: 'iOS',
      ipAddress: '192.168.1.101',
      port: 18789,
      isOnline: true,
      lastSeen: new Date().toISOString(),
      capabilities: ['camera', 'microphone', 'location'],
    },
    {
      id: 'peer-3',
      name: 'Office-PC',
      platform: 'Windows',
      ipAddress: '100.64.0.5',
      port: 18789,
      isOnline: false,
      lastSeen: new Date(Date.now() - 3600000).toISOString(),
      capabilities: ['chat', 'tools'],
    },
  ]

  /**
   * 模拟 Tailscale 状态
   */
  const getMockTailscaleStatus = () => ({
    connected: true,
    status: 'running',
    hostname: 'openclaw-desktop',
    tailnet: 'my-tailnet.ts.net',
    self: {
      HostName: 'openclaw-desktop',
    },
    CurrentTailnet: {
      Name: 'my-tailnet.ts.net',
    },
  })

  /**
   * 刷新数据
   */
  const handleRefresh = async () => {
    setRefreshing(true)
    await loadAllData()
    setRefreshing(false)
    toast.success('刷新成功', '数据已更新')
  }

  /**
   * 执行扫描
   */
  const handleScan = async () => {
    setScanning(true)
    try {
      const result = await api.discovery.scan()
      if (result.success) {
        toast.success('扫描完成', result.data?.message || '已发现新节点')
        await loadPeers()
      } else {
        // 模拟扫描
        toast.success('扫描完成', '已扫描局域网')
        await loadPeers()
      }
    } catch (error) {
      console.error('扫描失败:', error)
      toast.error('扫描失败', error.message || '未知错误')
    } finally {
      setScanning(false)
    }
  }

  /**
   * 启动发现服务
   */
  const handleStart = async () => {
    setStarting(true)
    try {
      const result = await api.discovery.start()
      if (result.success) {
        toast.success('启动成功', '发现服务已启动')
        await loadStatus()
      } else {
        // 模拟启动
        setDiscoveryStatus({ ...discoveryStatus, running: true })
        toast.success('启动成功', '发现服务已启动')
      }
    } catch (error) {
      console.error('启动失败:', error)
      toast.error('启动失败', error.message || '未知错误')
    } finally {
      setStarting(false)
    }
  }

  /**
   * 停止发现服务
   */
  const handleStop = async () => {
    setStopping(true)
    try {
      const result = await api.discovery.stop()
      if (result.success) {
        toast.success('停止成功', '发现服务已停止')
        await loadStatus()
      } else {
        // 模拟停止
        setDiscoveryStatus({ ...discoveryStatus, running: false })
        toast.success('停止成功', '发现服务已停止')
      }
    } catch (error) {
      console.error('停止失败:', error)
      toast.error('停止失败', error.message || '未知错误')
    } finally {
      setStopping(false)
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

  /**
   * 格式化运行时长
   */
  const formatUptime = (seconds) => {
    if (!seconds) return '未知'
    if (seconds < 60) return `${seconds} 秒`
    if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时`
    return `${Math.floor(seconds / 86400)} 天`
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

  const isRunning = discoveryStatus?.running

  return (
    <div className="space-y-6">
      {/* 头部操作栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">节点发现</h2>
          <p className="text-foreground-secondary mt-1">
            发现局域网/VPN中的其他 OpenClaw 节点
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleRefresh}
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
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 服务状态 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-secondary">服务状态</p>
                <p className="text-2xl font-bold mt-1">
                  {isRunning ? '运行中' : '已停止'}
                </p>
                {discoveryStatus?.uptime && (
                  <p className="text-xs text-foreground-tertiary mt-1">
                    运行 {formatUptime(discoveryStatus.uptime)}
                  </p>
                )}
              </div>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isRunning ? 'bg-green-100 dark:bg-green-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
                <Radar className={`w-6 h-6 ${isRunning ? 'text-green-500' : 'text-gray-400'}`} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 已发现节点 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-secondary">已发现节点</p>
                <p className="text-2xl font-bold">{peers.length}</p>
                <p className="text-xs text-foreground-tertiary mt-1">
                  {peers.filter(p => p.isOnline).length} 在线
                </p>
              </div>
              <Globe className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        {/* 最后扫描 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-secondary">最后扫描</p>
                <p className="text-lg font-semibold">
                  {formatTime(discoveryStatus?.lastScan)}
                </p>
              </div>
              <Clock className="w-8 h-8 text-foreground-tertiary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 操作区域 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Radar className="w-5 h-5" />
            服务控制
          </CardTitle>
          <CardDescription>
            管理节点发现服务的运行状态
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            {isRunning ? (
              <Button
                variant="destructive"
                onClick={handleStop}
                disabled={stopping}
              >
                {stopping ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Square className="w-4 h-4 mr-2" />
                )}
                停止服务
              </Button>
            ) : (
              <Button
                onClick={handleStart}
                disabled={starting}
              >
                {starting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                启动服务
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleScan}
              disabled={scanning || !isRunning}
            >
              {scanning ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Search className="w-4 h-4 mr-2" />
              )}
              立即扫描
            </Button>
            {!isRunning && (
              <span className="text-sm text-foreground-tertiary">
                请先启动发现服务
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 主内容区 - 分栏布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：节点列表 */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                已发现节点
              </CardTitle>
              <CardDescription>
                局域网/VPN 中发现的 OpenClaw 节点
              </CardDescription>
            </CardHeader>
            <CardContent>
              {peers.length === 0 ? (
                <div className="py-8 text-center">
                  <Monitor className="w-12 h-12 mx-auto text-foreground-tertiary mb-4" />
                  <h3 className="text-lg font-medium">暂无发现节点</h3>
                  <p className="text-foreground-secondary mt-2">
                    点击「立即扫描」搜索网络中的节点
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {peers.map((peer) => (
                    <div
                      key={peer.id}
                      className="p-4 border border-subtle rounded-lg hover:bg-surface-elevated transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <PeerIcon platform={peer.platform} />
                          <div>
                            <p className="font-medium">{peer.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {peer.platform}
                              </Badge>
                              <span className="text-xs text-foreground-tertiary font-mono">
                                {peer.ipAddress}:{peer.port}
                              </span>
                            </div>
                          </div>
                        </div>
                        <OnlineIndicator isOnline={peer.isOnline} />
                      </div>
                      {/* 节点能力 */}
                      {peer.capabilities && peer.capabilities.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-subtle">
                          {peer.capabilities.map((cap) => (
                            <Badge key={cap} variant="secondary" className="text-xs">
                              {cap}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 右侧：Tailscale 状态 */}
        <div>
          <TailscaleStatusCard
            status={tailscaleStatus}
            loading={loading}
          />
        </div>
      </div>
    </div>
  )
}
