/**
 * HeartbeatMonitor - 心跳监控组件
 *
 * 功能：
 * - 显示心跳服务状态（运行中/已停止）
 * - 显示最近心跳记录列表
 * - 配置心跳间隔
 * - 手动触发心跳按钮
 * - 启动/停止心跳服务
 *
 * Gateway API：heartbeat.*
 */
import React, { useState, useEffect, useCallback } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import {
  Activity,
  Play,
  Square,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Settings,
  Zap,
  Heart,
} from 'lucide-react'

import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

/**
 * 状态指示器
 */
const StatusBadge = ({ isRunning }) => {
  if (isRunning) {
    return (
      <Badge variant="default" className="bg-green-500 hover:bg-green-600">
        <CheckCircle className="w-3 h-3 mr-1" />
        运行中
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="bg-gray-500 hover:bg-gray-600 text-white">
      <XCircle className="w-3 h-3 mr-1" />
      已停止
    </Badge>
  )
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
    second: '2-digit',
  })
}

/**
 * 格式化相对时间
 */
const formatRelativeTime = (dateString) => {
  if (!dateString) return '未知'
  const date = new Date(dateString)
  const now = new Date()
  const diff = now - date

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return `${Math.floor(diff / 86400000)} 天前`
}

export default function HeartbeatMonitor() {
  // 状态
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // 配置状态
  const [intervalValue, setIntervalValue] = useState(60)
  const [showConfig, setShowConfig] = useState(false)

  // 心跳记录
  const [records, setRecords] = useState([])

  /**
   * 加载心跳状态
   */
  const loadStatus = useCallback(async () => {
    try {
      const result = await api.heartbeat.status()

      if (result.success && result.data) {
        setStatus(result.data)
        // 设置默认间隔值
        if (result.data.interval) {
          setIntervalValue(result.data.interval)
        }
        // 设置心跳记录
        if (result.data.records) {
          setRecords(result.data.records)
        }
      } else {
        // API 未实现时使用模拟数据
        console.warn('心跳 API 未实现，使用模拟数据')
        setMockData()
      }
    } catch (error) {
      console.error('加载心跳状态失败:', error)
      setMockData()
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  /**
   * 模拟数据（用于开发测试）
   */
  const setMockData = () => {
    const mockStatus = {
      running: true,
      interval: 60,
      lastHeartbeat: new Date().toISOString(),
      nextHeartbeat: new Date(Date.now() + 60000).toISOString(),
      totalHeartbeats: 156,
      startTime: new Date(Date.now() - 86400000).toISOString(),
    }
    const mockRecords = [
      {
        id: '1',
        timestamp: new Date().toISOString(),
        success: true,
        latency: 45,
        message: '心跳成功',
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 60000).toISOString(),
        success: true,
        latency: 38,
        message: '心跳成功',
      },
      {
        id: '3',
        timestamp: new Date(Date.now() - 120000).toISOString(),
        success: true,
        latency: 52,
        message: '心跳成功',
      },
      {
        id: '4',
        timestamp: new Date(Date.now() - 180000).toISOString(),
        success: false,
        latency: 0,
        message: '连接超时',
      },
      {
        id: '5',
        timestamp: new Date(Date.now() - 240000).toISOString(),
        success: true,
        latency: 41,
        message: '心跳成功',
      },
    ]
    setStatus(mockStatus)
    setRecords(mockRecords)
  }

  // 初始化加载
  useEffect(() => {
    loadStatus()
    // 定时刷新状态
    const interval = setInterval(loadStatus, 10000) // 10秒刷新一次
    return () => clearInterval(interval)
  }, [loadStatus])

  /**
   * 刷新状态
   */
  const handleRefresh = async () => {
    setRefreshing(true)
    await loadStatus()
    toast.success('刷新成功', '心跳状态已更新')
  }

  /**
   * 启动心跳服务
   */
  const handleStart = async () => {
    setActionLoading(true)
    try {
      const result = await api.heartbeat.start()
      if (result.success) {
        toast.success('启动成功', '心跳服务已启动')
        await loadStatus()
      } else {
        toast.error('启动失败', result.error || '未知错误')
      }
    } catch (error) {
      console.error('启动心跳服务失败:', error)
      toast.error('启动失败', error.message || '未知错误')
    } finally {
      setActionLoading(false)
    }
  }

  /**
   * 停止心跳服务
   */
  const handleStop = async () => {
    setActionLoading(true)
    try {
      const result = await api.heartbeat.stop()
      if (result.success) {
        toast.success('停止成功', '心跳服务已停止')
        await loadStatus()
      } else {
        toast.error('停止失败', result.error || '未知错误')
      }
    } catch (error) {
      console.error('停止心跳服务失败:', error)
      toast.error('停止失败', error.message || '未知错误')
    } finally {
      setActionLoading(false)
    }
  }

  /**
   * 手动触发心跳
   */
  const handleRunOnce = async () => {
    setActionLoading(true)
    try {
      const result = await api.heartbeat.runOnce()
      if (result.success) {
        toast.success('触发成功', '已执行一次心跳检测')
        await loadStatus()
      } else {
        toast.error('触发失败', result.error || '未知错误')
      }
    } catch (error) {
      console.error('触发心跳失败:', error)
      toast.error('触发失败', error.message || '未知错误')
    } finally {
      setActionLoading(false)
    }
  }

  /**
   * 保存配置
   */
  const handleSaveConfig = async () => {
    if (intervalValue < 10) {
      toast.error('配置错误', '心跳间隔不能小于 10 秒')
      return
    }

    setActionLoading(true)
    try {
      const result = await api.heartbeat.configure({ interval: intervalValue })
      if (result.success) {
        toast.success('保存成功', `心跳间隔已设置为 ${intervalValue} 秒`)
        setShowConfig(false)
        await loadStatus()
      } else {
        toast.error('保存失败', result.error || '未知错误')
      }
    } catch (error) {
      console.error('保存配置失败:', error)
      toast.error('保存失败', error.message || '未知错误')
    } finally {
      setActionLoading(false)
    }
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

  const isRunning = status?.running || false
  const successCount = records.filter(r => r.success).length
  const failCount = records.filter(r => !r.success).length
  const avgLatency = records.filter(r => r.success).length > 0
    ? Math.round(records.filter(r => r.success).reduce((sum, r) => sum + r.latency, 0) / records.filter(r => r.success).length)
    : 0

  return (
    <div className="space-y-6 p-6">
      {/* 头部操作栏 */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold">心跳监控</h2>
          <p className="text-foreground-secondary mt-1">
            Agent 心跳状态监控与配置
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

      {/* 状态卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 服务状态 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-secondary">服务状态</p>
                <div className="mt-2">
                  <StatusBadge isRunning={isRunning} />
                </div>
              </div>
              <Heart className={`w-8 h-8 ${isRunning ? 'text-green-500 animate-pulse' : 'text-gray-400'}`} />
            </div>
          </CardContent>
        </Card>

        {/* 心跳间隔 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-secondary">心跳间隔</p>
                <p className="text-2xl font-bold mt-1">{status?.interval || 60}s</p>
              </div>
              <Clock className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        {/* 总心跳次数 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-secondary">总心跳次数</p>
                <p className="text-2xl font-bold mt-1">{status?.totalHeartbeats || 0}</p>
              </div>
              <Activity className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        {/* 平均延迟 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-secondary">平均延迟</p>
                <p className="text-2xl font-bold mt-1">{avgLatency}ms</p>
              </div>
              <Zap className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 操作区 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            服务控制
          </CardTitle>
          <CardDescription>
            启动、停止心跳服务或手动触发心跳检测
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            {isRunning ? (
              <Button
                variant="destructive"
                onClick={handleStop}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Square className="w-4 h-4 mr-2" />
                )}
                停止服务
              </Button>
            ) : (
              <Button
                variant="default"
                onClick={handleStart}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                启动服务
              </Button>
            )}

            <Button
              variant="outline"
              onClick={handleRunOnce}
              disabled={actionLoading}
            >
              <Zap className="w-4 h-4 mr-2" />
              立即执行
            </Button>

            <Button
              variant="outline"
              onClick={() => setShowConfig(!showConfig)}
            >
              <Settings className="w-4 h-4 mr-2" />
              配置
            </Button>
          </div>

          {/* 配置面板 */}
          {showConfig && (
            <div className="mt-4 pt-4 border-t border-subtle">
              <div className="flex items-end gap-4">
                <div className="flex-1 max-w-xs">
                  <label className="text-sm font-medium mb-2 block">
                    心跳间隔（秒）
                  </label>
                  <Input
                    type="number"
                    min={10}
                    max={3600}
                    value={intervalValue}
                    onChange={(e) => setIntervalValue(parseInt(e.target.value) || 60)}
                    placeholder="60"
                  />
                  <p className="text-xs text-foreground-tertiary mt-1">
                    范围: 10-3600 秒
                  </p>
                </div>
                <Button
                  onClick={handleSaveConfig}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  保存配置
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 心跳记录 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            最近心跳记录
          </CardTitle>
          <CardDescription>
            显示最近的心跳检测结果
            <span className="ml-2 text-green-500">成功: {successCount}</span>
            <span className="ml-2 text-red-500">失败: {failCount}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <div className="py-8 text-center text-foreground-secondary">
              <Activity className="w-12 h-12 mx-auto text-foreground-tertiary mb-4" />
              <p>暂无心跳记录</p>
            </div>
          ) : (
            <div className="space-y-2">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-subtle hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {record.success ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                    <div>
                      <p className="font-medium">{record.message}</p>
                      <p className="text-xs text-foreground-tertiary">
                        {formatTime(record.timestamp)}
                        <span className="ml-2">({formatRelativeTime(record.timestamp)})</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {record.success && (
                      <Badge variant="outline" className="font-mono">
                        {record.latency}ms
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 服务信息 */}
      {status?.startTime && (
        <div className="text-center text-sm text-foreground-tertiary">
          服务启动于: {formatTime(status.startTime)}
          {status.lastHeartbeat && (
            <span className="ml-4">
              最后心跳: {formatRelativeTime(status.lastHeartbeat)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
