import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Badge } from './ui/badge'
import { Alert, AlertTitle, AlertDescription } from './ui/alert'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import {
  Network,
  Send,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Users,
  Plus,
  Trash2,
  Loader2,
  Radio,
  Activity,
  Eye,
  Globe,
  Wifi,
  WifiOff,
  Search,
  Play,
  Pause,
} from 'lucide-react'

// 🆕 使用新的服务层
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

// Agent 状态映射
const STATUS_CONFIG = {
  active: { color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle2, label: '活跃' },
  inactive: { color: 'text-gray-600', bg: 'bg-gray-50', icon: Clock, label: '未激活' },
  busy: { color: 'text-yellow-600', bg: 'bg-yellow-50', icon: Activity, label: '忙碌' },
  error: { color: 'text-red-600', bg: 'bg-red-50', icon: XCircle, label: '错误' },
}

export default function A2ACommunication() {
  const [agents, setAgents] = useState([])
  const [stats, setStats] = useState(null)
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [callMessage, setCallMessage] = useState('')
  const [isCalling, setIsCalling] = useState(false)
  const [callResult, setCallResult] = useState(null)
  const [showCallDialog, setShowCallDialog] = useState(false)
  const [showRegisterDialog, setShowRegisterDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [showBroadcastDialog, setShowBroadcastDialog] = useState(false)
  const [selectedAgents, setSelectedAgents] = useState([])
  const [broadcastMsg, setBroadcastMsg] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const [newAgent, setNewAgent] = useState({
    id: '',
    name: '',
    description: '',
    capabilities: '',
  })

  useEffect(() => {
    initA2A()
  }, [])

  const initA2A = async () => {
    setIsLoading(true)
    // 🆕 使用统一 API 服务层
    const result = await api.a2a.init()
    if (result.success) {
      setIsInitialized(true)
      await loadAgents()
      await loadStats()
    } else {
      console.error('初始化 A2A 失败:', result.error)
      toast.error('初始化失败', result.error)
    }
    setIsLoading(false)
  }

  const loadAgents = async () => {
    setIsLoading(true)
    // 🆕 使用统一 API 服务层
    const result = await api.a2a.list(null)
    if (result.success) {
      setAgents(result.data || [])
    } else {
      console.error('加载 Agent 列表失败:', result.error)
    }
    setIsLoading(false)
  }

  const loadStats = async () => {
    // 🆕 使用统一 API 服务层
    const result = await api.a2a.stats()
    if (result.success) {
      setStats(result.data)
    } else {
      console.error('加载统计数据失败:', result.error)
    }
  }

  const callAgent = async () => {
    if (!selectedAgent || !callMessage.trim()) return
    setIsCalling(true)
    // 🆕 使用统一 API 服务层
    const result = await api.a2a.call(selectedAgent.id, callMessage)
    if (result.success) {
      setCallResult(result.data)
      setShowCallDialog(false)
      setCallMessage('')
      toast.success('调用成功', 'Agent 已响应')
    } else {
      console.error('调用 Agent 失败:', result.error)
      setCallResult({
        agent_id: selectedAgent,
        success: false,
        response: null,
        error: result.error,
        duration_ms: 0,
      })
      toast.error('调用失败', result.error)
    }
    setIsCalling(false)
  }

  const handleBroadcast = async () => {
    if (selectedAgents.length === 0 || !broadcastMsg.trim()) return
    setIsCalling(true)
    // 🆕 使用统一 API 服务层
    const result = await api.a2a.broadcast(broadcastMsg, false)
    if (result.success) {
      setCallResult({ success: true, results: result.data })
      setShowBroadcastDialog(false)
      setBroadcastMsg('')
      setSelectedAgents([])
      toast.success('广播成功', '消息已发送到所有 Agent')
    } else {
      console.error('广播消息失败:', result.error)
      toast.error('广播失败', result.error)
    }
    setIsCalling(false)
  }

  const registerAgent = async () => {
    if (!newAgent.id || !newAgent.name) return
    setIsLoading(true)
    // 🆕 使用统一 API 服务层
    const result = await api.a2a.register({
      id: newAgent.id,
      name: newAgent.name,
      description: newAgent.description,
      capabilities: newAgent.capabilities.split(',').map(c => c.trim()).filter(c => c),
    })
    if (result.success) {
      setShowRegisterDialog(false)
      setNewAgent({ id: '', name: '', description: '', capabilities: '' })
      await loadAgents()
      await loadStats()
      toast.success('注册成功', `Agent「${newAgent.name}」已注册`)
    } else {
      console.error('注册 Agent 失败:', result.error)
      toast.error('注册失败', result.error)
    }
    setIsLoading(false)
  }

  const unregisterAgent = async (agentId) => {
    if (!confirm(`确定要注销 Agent ${agentId} 吗？`)) return
    setIsLoading(true)
    // 🆕 使用统一 API 服务层
    const result = await api.a2a.unregister(agentId)
    if (result.success) {
      await loadAgents()
      await loadStats()
      toast.success('注销成功', `Agent ${agentId} 已注销`)
    } else {
      console.error('注销 Agent 失败:', result.error)
      toast.error('注销失败', result.error)
    }
    setIsLoading(false)
  }

  const toggleAgentSelection = (agentId) => {
    setSelectedAgents(prev =>
      prev.includes(agentId) ? prev.filter(id => id !== agentId) : [...prev, agentId]
    )
  }

  const filteredAgents = agents.filter(agent =>
    agent.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {/* Tabs 导航 */}
      <Tabs defaultValue="agents" className="w-full">
        <TabsList>
          <TabsTrigger value="agents" className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            节点通信
          </TabsTrigger>
          <TabsTrigger value="discovery" className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" />
            网络发现
          </TabsTrigger>
        </TabsList>

        {/* 节点通信 Tab */}
        <TabsContent value="agents" className="mt-4 space-y-4">
          {/* 顶部栏 */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Input
                placeholder="搜索 Agent..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10 h-9"
              />
              <Network className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-tertiary" />
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Users className="w-3 h-3" />
                {stats?.total_agents || agents.length}
              </Badge>
              <Badge variant="secondary" className="gap-1 text-green-600">
                <CheckCircle2 className="w-3 h-3" />
                {stats?.active_count || 0} 活跃
              </Badge>
            </div>

            <Button size="sm" variant="outline" onClick={() => { loadAgents(); loadStats(); }} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
            <Button size="sm" onClick={() => setShowRegisterDialog(true)}>
              <Plus className="w-4 h-4 mr-1" />
              注册
            </Button>
            {selectedAgents.length > 0 && (
              <Button size="sm" variant="secondary" onClick={() => setShowBroadcastDialog(true)}>
                <Radio className="w-4 h-4 mr-1" />
                广播 ({selectedAgents.length})
              </Button>
            )}
          </div>

          {!isInitialized && (
            <Alert variant="warning">
              <Zap className="w-4 h-4" />
              <AlertTitle>A2A 未初始化</AlertTitle>
              <AlertDescription>Agent 间通信系统尚未初始化</AlertDescription>
            </Alert>
          )}

          {/* Agent 网格列表 */}
          {isLoading ? (
            <div className="text-center py-12 text-foreground-secondary">
              <Loader2 className="w-8 h-8 mx-auto animate-spin mb-2" />
              <div>加载中...</div>
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="text-center py-12 text-foreground-secondary">
              <Users className="w-16 h-16 mx-auto mb-4 text-foreground-tertiary" />
              <div className="text-lg font-medium text-foreground mb-1">暂无可用 Agent</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredAgents.map(agent => {
                const statusConfig = STATUS_CONFIG[agent.status] || STATUS_CONFIG.inactive
                const StatusIcon = statusConfig.icon
                const isSelected = selectedAgents.includes(agent.id)

                return (
                  <Card
                    key={agent.id}
                    className={`group hover:shadow-md transition-all duration-200 cursor-pointer ${
                      isSelected ? 'ring-2 ring-primary border-primary/50' : 'hover:border-primary/30'
                    }`}
                    onClick={() => toggleAgentSelection(agent.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2.5">
                        <div className={`w-9 h-9 rounded-lg ${statusConfig.bg} flex items-center justify-center flex-shrink-0`}>
                          <StatusIcon className={`w-4.5 h-4.5 ${statusConfig.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-sm font-medium truncate">{agent.id}</span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 h-4 ${statusConfig.color}`}
                            >
                              {statusConfig.label}
                            </Badge>
                          </div>
                          <div className="text-xs text-foreground-secondary mt-0.5">{agent.name}</div>
                          <p className="text-[11px] text-foreground-tertiary line-clamp-1 mt-1">
                            {agent.description}
                          </p>
                          {agent.capabilities.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {agent.capabilities.slice(0, 2).map(cap => (
                                <Badge key={cap} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                  {cap}
                                </Badge>
                              ))}
                              {agent.capabilities.length > 2 && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                  +{agent.capabilities.length - 2}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-border-subtle">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedAgent(agent)
                            setShowCallDialog(true)
                          }}
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          disabled={agent.status !== 'active'}
                        >
                          <Send className="w-3 h-3 mr-1" />
                          调用
                        </Button>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation()
                            unregisterAgent(agent.id)
                          }}
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* 🔥 网络发现 Tab */}
        <TabsContent value="discovery" className="mt-4">
          <NetworkDiscovery />
        </TabsContent>
      </Tabs>

      {/* 调用对话框 */}
      <Dialog open={showCallDialog} onOpenChange={setShowCallDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>调用: {selectedAgent?.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-foreground-tertiary">消息</Label>
              <Textarea
                value={callMessage}
                onChange={e => setCallMessage(e.target.value)}
                placeholder="输入要发送的消息..."
                rows={3}
                className="mt-1 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowCallDialog(false)}>取消</Button>
            <Button size="sm" onClick={callAgent} disabled={!callMessage.trim() || isCalling}>
              {isCalling ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
              发送
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 广播对话框 */}
      <Dialog open={showBroadcastDialog} onOpenChange={setShowBroadcastDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>广播消息 ({selectedAgents.length})</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {selectedAgents.map(id => {
                const agent = agents.find(a => a.id === id)
                return (
                  <Badge key={id} variant="secondary" className="text-xs">
                    {agent?.name || id}
                  </Badge>
                )
              })}
            </div>
            <div>
              <Label className="text-xs text-foreground-tertiary">消息</Label>
              <Textarea
                value={broadcastMsg}
                onChange={e => setBroadcastMsg(e.target.value)}
                placeholder="输入广播消息..."
                rows={3}
                className="mt-1 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowBroadcastDialog(false)}>取消</Button>
            <Button size="sm" onClick={handleBroadcast} disabled={!broadcastMsg.trim() || isCalling}>
              {isCalling ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Radio className="w-3 h-3 mr-1" />}
              广播
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 注册对话框 */}
      <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>注册新 Agent</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-foreground-tertiary">ID *</Label>
              <Input
                value={newAgent.id}
                onChange={e => setNewAgent({ ...newAgent, id: e.target.value })}
                placeholder="agent-custom"
                className="mt-1 h-9"
              />
            </div>
            <div>
              <Label className="text-xs text-foreground-tertiary">名称 *</Label>
              <Input
                value={newAgent.name}
                onChange={e => setNewAgent({ ...newAgent, name: e.target.value })}
                placeholder="自定义 Agent"
                className="mt-1 h-9"
              />
            </div>
            <div>
              <Label className="text-xs text-foreground-tertiary">描述</Label>
              <Input
                value={newAgent.description}
                onChange={e => setNewAgent({ ...newAgent, description: e.target.value })}
                placeholder="功能描述"
                className="mt-1 h-9"
              />
            </div>
            <div>
              <Label className="text-xs text-foreground-tertiary">能力（逗号分隔）</Label>
              <Input
                value={newAgent.capabilities}
                onChange={e => setNewAgent({ ...newAgent, capabilities: e.target.value })}
                placeholder="tool1, tool2"
                className="mt-1 h-9"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowRegisterDialog(false)}>取消</Button>
            <Button size="sm" onClick={registerAgent} disabled={!newAgent.id || !newAgent.name || isLoading}>
              {isLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}
              注册
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 结果对话框 */}
      {callResult && (
        <Dialog open={!!callResult} onOpenChange={() => setCallResult(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>调用结果</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {callResult.results ? (
                callResult.results.map((result, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg text-sm ${result.success ? 'bg-green-50' : 'bg-red-50'}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {result.success ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600" />
                      )}
                      <span className="font-mono text-xs">{result.agent_id}</span>
                      <span className="text-[10px] text-foreground-secondary ml-auto">{result.duration_ms}ms</span>
                    </div>
                    {result.response && <div className="text-xs">{result.response}</div>}
                    {result.error && <div className="text-xs text-red-600">{result.error}</div>}
                  </div>
                ))
              ) : (
                <div className={`p-3 rounded-lg text-sm ${callResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {callResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                    <span className="text-[10px] text-foreground-secondary ml-auto">{callResult.duration_ms}ms</span>
                  </div>
                  {callResult.response && <div className="text-xs whitespace-pre-wrap">{callResult.response}</div>}
                  {callResult.error && <div className="text-xs text-red-600">{callResult.error}</div>}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button size="sm" onClick={() => setCallResult(null)}>关闭</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

/**
 * 🔥 网络发现子组件
 */
function NetworkDiscovery() {
  const [discoveryStatus, setDiscoveryStatus] = useState(null)
  const [peers, setPeers] = useState([])
  const [tailscaleStatus, setTailscaleStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)

  const loadDiscoveryStatus = async () => {
    setLoading(true)
    const [statusRes, peersRes, tailscaleRes] = await Promise.allSettled([
      api.discovery.status(),
      api.discovery.peers(),
      api.discovery.tailscaleStatus(),
    ])

    const statusData = statusRes.status === 'fulfilled' ? statusRes.value : null
    const peersData = peersRes.status === 'fulfilled' ? peersRes.value : null
    const tailscaleData = tailscaleRes.status === 'fulfilled' ? tailscaleRes.value : null

    setDiscoveryStatus(statusData?.success ? statusData.data : null)
    setPeers(peersData?.success ? (peersData.data?.peers || []) : [])
    setTailscaleStatus(tailscaleData?.success ? tailscaleData.data : null)
    setLoading(false)
  }

  const handleScan = async () => {
    setScanning(true)
    const result = await api.discovery.scan()
    if (result.success) {
      // 等待扫描完成后重新加载
      setTimeout(loadDiscoveryStatus, 2000)
    } else {
      console.error('扫描失败:', result.error)
    }
    setScanning(false)
  }

  const handleStartDiscovery = async () => {
    const result = await api.discovery.start()
    if (result.success) {
      loadDiscoveryStatus()
    } else {
      console.error('启动发现服务失败:', result.error)
    }
  }

  const handleStopDiscovery = async () => {
    const result = await api.discovery.stop()
    if (result.success) {
      loadDiscoveryStatus()
    } else {
      console.error('停止发现服务失败:', result.error)
    }
  }

  useEffect(() => {
    loadDiscoveryStatus()
  }, [])

  const isRunning = discoveryStatus?.running || false

  return (
    <div className="space-y-4">
      {/* 操作栏 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          发现局域网或 Tailscale 网络中的其他 Agent 节点
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadDiscoveryStatus} disabled={loading}>
            {loading ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3 mr-1" />
            )}
            刷新
          </Button>
          <Button variant="outline" size="sm" onClick={handleScan} disabled={scanning || !isRunning}>
            {scanning ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <Search className="w-3 h-3 mr-1" />
            )}
            扫描
          </Button>
          {isRunning ? (
            <Button variant="outline" size="sm" onClick={handleStopDiscovery}>
              <Pause className="w-3 h-3 mr-1" />
              停止服务
            </Button>
          ) : (
            <Button size="sm" onClick={handleStartDiscovery}>
              <Play className="w-3 h-3 mr-1" />
              启动服务
            </Button>
          )}
        </div>
      </div>

      {/* 状态卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 发现服务状态 */}
        <Card className={isRunning ? 'border-green-200 bg-green-50/50' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                isRunning ? 'bg-green-100' : 'bg-gray-100'
              }`}>
                {isRunning ? (
                  <Wifi className="w-5 h-5 text-green-600" />
                ) : (
                  <WifiOff className="w-5 h-5 text-gray-400" />
                )}
              </div>
              <div>
                <div className="font-medium">发现服务</div>
                <div className="text-xs text-muted-foreground">
                  {isRunning ? '运行中' : '已停止'}
                </div>
              </div>
              <Badge variant={isRunning ? 'default' : 'secondary'} className="ml-auto">
                {isRunning ? '活跃' : '未启动'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* 发现节点数 */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Globe className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="font-medium">发现节点</div>
                <div className="text-xs text-muted-foreground">
                  {peers.length} 个节点
                </div>
              </div>
              <div className="ml-auto text-2xl font-bold text-blue-600">
                {peers.length}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tailscale 状态 */}
        <Card className={tailscaleStatus?.connected ? 'border-purple-200 bg-purple-50/50' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                tailscaleStatus?.connected ? 'bg-purple-100' : 'bg-gray-100'
              }`}>
                <Network className={`w-5 h-5 ${
                  tailscaleStatus?.connected ? 'text-purple-600' : 'text-gray-400'
                }`} />
              </div>
              <div>
                <div className="font-medium">Tailscale</div>
                <div className="text-xs text-muted-foreground">
                  {tailscaleStatus?.connected ? '已连接' : '未连接'}
                </div>
              </div>
              <Badge variant={tailscaleStatus?.connected ? 'default' : 'secondary'} className="ml-auto">
                {tailscaleStatus?.connected ? '在线' : '离线'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 节点列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">发现的节点</CardTitle>
          <CardDescription>
            通过局域网或 Tailscale 网络发现的其他 Agent 节点
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">加载中...</span>
            </div>
          ) : peers.length === 0 ? (
            <div className="text-center py-8">
              <Globe className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">暂无发现的节点</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                点击"扫描"按钮搜索网络中的节点
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {peers.map((peer, index) => (
                <div
                  key={peer.id || index}
                  className="flex items-center justify-between p-3 rounded-lg bg-surface-elevated hover:bg-surface-elevated/80 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      peer.online ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      <Network className={`w-4 h-4 ${
                        peer.online ? 'text-green-600' : 'text-gray-400'
                      }`} />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{peer.name || peer.id}</div>
                      <div className="text-xs text-muted-foreground">{peer.address}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {peer.online && (
                      <Badge variant="outline" className="text-green-600 border-green-300">
                        在线
                      </Badge>
                    )}
                    <Button variant="ghost" size="sm" className="h-7">
                      <Plus className="w-3 h-3 mr-1" />
                      添加
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
