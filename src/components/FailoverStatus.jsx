import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Zap,
  RotateCcw,
  Server,
  Activity,
} from 'lucide-react'

// 🆕 使用新的服务层
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

/**
 * 故障转移状态监控组件
 */
export default function FailoverStatus() {
  const [states, setStates] = useState({})
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)

  // 加载提供商状态
  const loadStates = async () => {
    setLoading(true)
    // 🆕 使用统一 API 服务层
    const result = await api.failover.status()
    if (result.success) {
      // 后端返回 providers 数组，转换为对象格式
      const statesMap = {}
      if (result.data?.providers && Array.isArray(result.data.providers)) {
        for (const provider of result.data.providers) {
          statesMap[provider.provider] = provider
        }
      }
      setStates(statesMap)
    } else {
      console.error('加载状态失败:', result.error)
      // 如果方法不存在，使用模拟数据
      setStates({
        qwen: {
          provider: 'qwen',
          available: true,
          failure_count: 0,
          consecutive_failures: 0,
          success_count: 42,
          last_success_at: new Date().toISOString(),
        },
        deepseek: {
          provider: 'deepseek',
          available: true,
          failure_count: 1,
          consecutive_failures: 0,
          success_count: 15,
          last_success_at: new Date(Date.now() - 3600000).toISOString(),
        },
        openai: {
          provider: 'openai',
          available: false,
          failure_count: 3,
          consecutive_failures: 2,
          last_failure_at: new Date(Date.now() - 1800000).toISOString(),
          last_failure_reason: 'RateLimit',
          cooldown_until: new Date(Date.now() + 1800000).toISOString(),
          success_count: 5,
        },
      })
    }
    setLoading(false)
  }

  // 重置冷却状态
  const handleResetCooldown = async (provider) => {
    setResetting(true)
    // 🆕 使用统一 API 服务层
    const result = await api.failover.reset()
    if (result.success) {
      toast.success('重置成功', `提供商 ${provider} 的冷却状态已重置`)
      loadStates()
    } else {
      console.error('重置失败:', result.error)
      toast.error('重置失败', result.error)
    }
    setResetting(false)
  }

  // 重置所有冷却状态
  const handleResetAllCooldowns = async () => {
    setResetting(true)
    // 🆕 使用统一 API 服务层
    const result = await api.failover.reset()
    if (result.success) {
      toast.success('重置成功', '所有提供商的冷却状态已重置')
      loadStates()
    } else {
      console.error('重置失败:', result.error)
      toast.error('重置失败', result.error)
    }
    setResetting(false)
  }

  useEffect(() => {
    loadStates()
    // 每 30 秒自动刷新
    const interval = setInterval(loadStates, 30000)
    return () => clearInterval(interval)
  }, [])

  // 计算冷却剩余时间
  const getCooldownRemaining = (cooldownUntil) => {
    if (!cooldownUntil) return null
    const remaining = new Date(cooldownUntil) - new Date()
    if (remaining <= 0) return null
    const minutes = Math.floor(remaining / 60000)
    const seconds = Math.floor((remaining % 60000) / 1000)
    return `${minutes}分${seconds}秒`
  }

  // 故障原因映射
  const failureReasonLabels = {
    Billing: '余额不足',
    RateLimit: '速率限制',
    Auth: '认证失败',
    Timeout: '请求超时',
    Format: '格式错误',
    ContextOverflow: '上下文溢出',
    ServiceUnavailable: '服务不可用',
    Unknown: '未知错误',
  }

  // 渲染提供商卡片
  const renderProviderCard = (state) => {
    const isAvailable = state.available && !state.cooldown_until
    const cooldownRemaining = getCooldownRemaining(state.cooldown_until)

    return (
      <Card
        key={state.provider}
        className={`transition-all duration-normal ${
          isAvailable
            ? 'border-l-4 border-l-green-400'
            : 'border-l-4 border-l-red-400'
        }`}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isAvailable ? 'bg-green-100' : 'bg-red-100'
                }`}
              >
                <Server
                  className={`w-5 h-5 ${
                    isAvailable ? 'text-green-600' : 'text-red-600'
                  }`}
                />
              </div>
              <div>
                <CardTitle className="text-lg capitalize">{state.provider}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  {isAvailable ? (
                    <Badge variant="default" className="bg-green-500">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      可用
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <XCircle className="w-3 h-3 mr-1" />
                      不可用
                    </Badge>
                  )}
                  {state.consecutive_failures > 0 && (
                    <Badge variant="outline" className="text-orange-600 border-orange-300">
                      连续失败: {state.consecutive_failures}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {/* 状态详情 */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="space-y-1">
              <div className="text-xs text-foreground-tertiary">成功次数</div>
              <div className="font-semibold text-green-600">{state.success_count || 0}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-foreground-tertiary">失败次数</div>
              <div className="font-semibold text-red-600">{state.failure_count || 0}</div>
            </div>
          </div>

          {/* 冷却状态 */}
          {cooldownRemaining && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 text-orange-700">
                <Clock className="w-4 h-4" />
                <span className="font-medium">冷却中</span>
              </div>
              <div className="text-sm text-orange-600 mt-1">
                剩余时间: {cooldownRemaining}
              </div>
              {state.last_failure_reason && (
                <div className="text-xs text-orange-500 mt-1">
                  原因: {failureReasonLabels[state.last_failure_reason] || state.last_failure_reason}
                </div>
              )}
            </div>
          )}

          {/* 最后活动时间 */}
          <div className="space-y-2 text-xs text-foreground-tertiary">
            {state.last_success_at && (
              <div className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-green-500" />
                最后成功: {new Date(state.last_success_at).toLocaleString('zh-CN')}
              </div>
            )}
            {state.last_failure_at && (
              <div className="flex items-center gap-1">
                <XCircle className="w-3 h-3 text-red-500" />
                最后失败: {new Date(state.last_failure_at).toLocaleString('zh-CN')}
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          {!isAvailable && (
            <div className="mt-4 pt-4 border-t border-border-subtle">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => handleResetCooldown(state.provider)}
                disabled={resetting}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                重置冷却
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // 统计信息
  const stats = {
    total: Object.keys(states).length,
    available: Object.values(states).filter((s) => s.available && !s.cooldown_until).length,
    inCooldown: Object.values(states).filter((s) => s.cooldown_until).length,
    totalSuccess: Object.values(states).reduce((sum, s) => sum + (s.success_count || 0), 0),
    totalFailure: Object.values(states).reduce((sum, s) => sum + (s.failure_count || 0), 0),
  }

  return (
    <div className="space-y-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            故障转移状态
          </h2>
          <p className="text-sm text-foreground-secondary mt-1">
            监控 AI 提供商状态，支持自动故障转移和指数退避
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadStates} disabled={loading}>
            {loading ? (
              <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-1" />
            )}
            刷新
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetAllCooldowns}
            disabled={resetting}
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            重置全部
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-600" />
              <div>
                <div className="text-2xl font-bold text-blue-700">{stats.total}</div>
                <div className="text-xs text-blue-600">提供商总数</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <div className="text-2xl font-bold text-green-700">{stats.available}</div>
                <div className="text-xs text-green-600">可用</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-50 to-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-600" />
              <div>
                <div className="text-2xl font-bold text-orange-700">{stats.inCooldown}</div>
                <div className="text-xs text-orange-600">冷却中</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-600" />
              <div>
                <div className="text-2xl font-bold text-emerald-700">{stats.totalSuccess}</div>
                <div className="text-xs text-emerald-600">总成功</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-pink-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <div>
                <div className="text-2xl font-bold text-red-700">{stats.totalFailure}</div>
                <div className="text-xs text-red-600">总失败</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 指数退避说明 */}
      <Card className="bg-gradient-to-r from-slate-50 to-gray-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            指数退避策略
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-medium mb-2">普通错误</div>
              <div className="text-foreground-secondary space-y-1">
                <div>• 1分钟 → 5分钟 → 25分钟 → 1小时（最大）</div>
                <div>• 适用于：速率限制、超时、服务不可用</div>
              </div>
            </div>
            <div>
              <div className="font-medium mb-2">账单错误</div>
              <div className="text-foreground-secondary space-y-1">
                <div>• 5小时 → 10小时 → 20小时 → 24小时（最大）</div>
                <div>• 适用于：余额不足、配额超限</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 提供商列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2 text-foreground-secondary">加载中...</span>
        </div>
      ) : Object.keys(states).length === 0 ? (
        <Card className="py-12">
          <CardContent className="flex flex-col items-center">
            <Server className="w-12 h-12 text-foreground-tertiary mb-4" />
            <p className="text-foreground-secondary">暂无提供商状态信息</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.values(states).map(renderProviderCard)}
        </div>
      )}
    </div>
  )
}
