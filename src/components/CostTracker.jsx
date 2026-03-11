import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import {
  DollarSign,
  TrendingUp,
  MessageSquare,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Activity,
  Zap,
  Bot,
} from 'lucide-react'
import { toast } from '@/hooks/useToast'
import api from '@/lib/api'
import { useAppStore } from '@/hooks/useAppStore'

// 格式化成本显示
const formatCost = (cost) => {
  if (!cost) return '$0.00'
  const num = parseFloat(cost)
  if (isNaN(num)) return cost
  if (num < 0.01) return `$${num.toFixed(6)}`
  if (num < 1) return `$${num.toFixed(4)}`
  return `$${num.toFixed(2)}`
}

// 格式化数字
const formatNumber = (num) => {
  if (!num) return '0'
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}

// 时间周期选项
const PERIOD_OPTIONS = [
  { value: '7', label: '近 7 天' },
  { value: '14', label: '近 14 天' },
  { value: '30', label: '近 30 天' },
  { value: '90', label: '近 90 天' },
]

export default function CostTracker() {
  // 使用全局状态
  const { agents, agentNames, isLoading: appLoading, actions } = useAppStore()

  // 本地状态
  const [costData, setCostData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedAgentId, setSelectedAgentId] = useState('main')
  const [period, setPeriod] = useState('30')
  const [expandedSessions, setExpandedSessions] = useState(new Set())

  // 初始化：加载智能体列表
  useEffect(() => {
    if (agents.length === 0) {
      actions.loadAgents(true)
    }
  }, [])

  // 加载成本数据
  const loadCostData = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await api.usage.cost(selectedAgentId, parseInt(period))
      if (result.success) {
        setCostData(result.data)
      } else {
        toast.error('加载失败', result.error)
      }
    } catch (error) {
      console.error('加载成本数据失败:', error)
      toast.error('加载失败', error.message || '未知错误')
    } finally {
      setIsLoading(false)
    }
  }, [selectedAgentId, period])

  // 智能体或周期变化时重新加载
  useEffect(() => {
    loadCostData()
  }, [loadCostData])

  // 切换会话展开状态
  const toggleSession = useCallback((sessionId) => {
    setExpandedSessions(prev => {
      const newExpanded = new Set(prev)
      if (newExpanded.has(sessionId)) {
        newExpanded.delete(sessionId)
      } else {
        newExpanded.add(sessionId)
      }
      return newExpanded
    })
  }, [])

  // 构建智能体选项（过滤掉 main/all 避免与默认选项冲突，过滤无效 id）
  const agentOptions = [
    { id: 'main', name: '默认助手' },
    { id: 'all', name: '全部智能体' },
    ...agents
      .filter(a => a.id && a.id !== 'main' && a.id !== 'all')
      .map(a => ({
        id: a.id,
        name: agentNames[a.id] || a.name || `智能体-${a.id}`
      }))
  ]

  const totals = costData?.totals || {}

  return (
    <div className="space-y-6 p-6">
      {/* 标题和操作区 */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold">成本追踪</h2>
          <p className="text-muted-foreground">API 使用成本统计与分析</p>
        </div>
        <div className="flex items-center gap-4">
          {/* 智能体选择 */}
          <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
            <SelectTrigger className="w-40">
              <Bot className="h-4 w-4 mr-2" />
              <SelectValue placeholder="选择智能体" />
            </SelectTrigger>
            <SelectContent>
              {agentOptions.map(opt => (
                <SelectItem key={opt.id} value={opt.id}>
                  {opt.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 时间周期选择 */}
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 刷新按钮 */}
          <Button
            variant="outline"
            size="sm"
            onClick={loadCostData}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </div>

      {/* 总览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              总成本
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCost(totals.totalCost)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              输入: {formatCost(totals.inputCost)} | 输出: {formatCost(totals.outputCost)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" />
              总 Token 数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totals.totalTokens)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              输入: {formatNumber(totals.input)} | 输出: {formatNumber(totals.output)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Zap className="h-4 w-4" />
              缓存命中
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber((totals.cacheRead || 0) + (totals.cacheWrite || 0))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              读: {formatNumber(totals.cacheRead)} | 写: {formatNumber(totals.cacheWrite)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              会话数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {costData?.sessions?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              近 {period} 天
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 会话列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            会话成本详情
          </CardTitle>
          <CardDescription>
            按会话分组的成本数据
            {selectedAgentId !== 'main' && selectedAgentId !== 'all' && (
              <Badge variant="secondary" className="ml-2">
                {agentNames[selectedAgentId] || selectedAgentId}
              </Badge>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              <RefreshCw className="h-6 w-6 mx-auto mb-2 animate-spin" />
              加载中...
            </div>
          ) : !costData?.sessions?.length ? (
            <div className="py-8 text-center text-muted-foreground">
              暂无会话数据
            </div>
          ) : (
            <div className="space-y-2">
              {costData.sessions.map((session) => (
                <div
                  key={session.sessionId}
                  className="border rounded-lg"
                >
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleSession(session.sessionId)}
                  >
                    <div className="flex items-center gap-4">
                      {expandedSessions.has(session.sessionId) ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <div className="font-medium">{session.sessionId}</div>
                        <div className="text-sm text-muted-foreground">
                          {session.messageCount || 0} 条消息
                          {session.model && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              {session.model}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="font-medium">{formatNumber(session.totalTokens)}</div>
                        <div className="text-xs text-muted-foreground">tokens</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-primary">
                          {formatCost(session.totalCost)}
                        </div>
                        <div className="text-xs text-muted-foreground">成本</div>
                      </div>
                    </div>
                  </div>

                  {expandedSessions.has(session.sessionId) && (
                    <div className="border-t p-4 bg-muted/30">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">输入 Token:</span>
                          <span className="ml-2 font-medium">{formatNumber(session.inputTokens || session.totalTokens)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">输出 Token:</span>
                          <span className="ml-2 font-medium">{formatNumber(session.outputTokens || 0)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">输入成本:</span>
                          <span className="ml-2 font-medium">{formatCost(session.inputCost)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">输出成本:</span>
                          <span className="ml-2 font-medium">{formatCost(session.outputCost)}</span>
                        </div>
                      </div>
                      {session.provider && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          提供商: {session.provider}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 更新时间 */}
      {costData?.updatedAt && (
        <div className="text-center text-sm text-muted-foreground">
          <Clock className="h-4 w-4 inline mr-1" />
          最后更新: {new Date(costData.updatedAt).toLocaleString('zh-CN')}
        </div>
      )}
    </div>
  )
}
