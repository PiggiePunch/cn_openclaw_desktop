import React, { useState, useEffect } from 'react'
import api from '@/lib/api'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Badge } from './ui/badge'
import { Alert, AlertDescription } from './ui/alert'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import { Input } from './ui/input'
import {
  Shield,
  Camera,
  Mic,
  Monitor,
  FolderOpen,
  Wifi,
  Accessibility,
  RefreshCw,
  Check,
  X,
  AlertCircle,
  Loader2,
  Settings,
  ExternalLink,
  FileText,
  Search,
  Download,
  Filter,
  Clock,
  User,
  Activity,
} from 'lucide-react'

// 权限配置
const PERMISSIONS_CONFIG = {
  ScreenCapture: {
    name: '屏幕录制',
    description: '用于截图和屏幕监控功能',
    icon: Monitor,
    macOSSetting: '系统偏好设置 > 安全性与隐私 > 屏幕录制',
  },
  Camera: {
    name: '摄像头',
    description: '用于视频通话和拍照功能',
    icon: Camera,
    macOSSetting: '系统偏好设置 > 安全性与隐私 > 摄像头',
  },
  Microphone: {
    name: '麦克风',
    description: '用于语音输入和通话功能',
    icon: Mic,
    macOSSetting: '系统偏好设置 > 安全性与隐私 > 麦克风',
  },
  FileSystem: {
    name: '文件系统',
    description: '用于读写本地文件',
    icon: FolderOpen,
    macOSSetting: '系统偏好设置 > 安全性与隐私 > 文件和文件夹',
  },
  Network: {
    name: '网络访问',
    description: '用于网络请求和下载',
    icon: Wifi,
    macOSSetting: '系统偏好设置 > 安全性与隐私 > 防火墙',
  },
  Automation: {
    name: '辅助功能',
    description: '用于微信监控和 UI 自动化',
    icon: Accessibility,
    macOSSetting: '系统偏好设置 > 安全性与隐私 > 辅助功能',
  },
}

// 状态配置
const STATUS_CONFIG = {
  Granted: {
    label: '已授权',
    style: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    icon: Check,
  },
  Denied: {
    label: '已拒绝',
    style: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    icon: X,
  },
  NotDetermined: {
    label: '未确定',
    style: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    icon: AlertCircle,
  },
  Restricted: {
    label: '受限制',
    style: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    icon: AlertCircle,
  },
}

// 🔥 审计日志操作类型映射
const AUDIT_ACTION_CONFIG = {
  permission_request: { label: '权限请求', color: 'text-blue-600' },
  permission_granted: { label: '权限授权', color: 'text-green-600' },
  permission_denied: { label: '权限拒绝', color: 'text-red-600' },
  tool_call: { label: '工具调用', color: 'text-purple-600' },
  skill_execute: { label: 'Skill执行', color: 'text-orange-600' },
  session_create: { label: '创建会话', color: 'text-cyan-600' },
  session_delete: { label: '删除会话', color: 'text-red-600' },
  config_change: { label: '配置变更', color: 'text-yellow-600' },
  agent_spawn: { label: '创建Agent', color: 'text-indigo-600' },
  default: { label: '其他操作', color: 'text-gray-600' },
}

/**
 * 🔥 审计日志子组件
 */
function AuditLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [stats, setStats] = useState(null)

  const loadLogs = async () => {
    setLoading(true)
    const result = await api.audit.query(100, 0)
    if (result.success) {
      setLogs(result.data?.logs || [])
      setStats(result.data?.stats || null)
    } else {
      console.error('加载审计日志失败:', result.error)
      setLogs([])
    }
    setLoading(false)
  }

  const handleExport = async () => {
    const result = await api.audit.export('json')
    if (result.success) {
      // 创建下载
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      console.error('导出失败:', result.error)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [])

  const filteredLogs = logs.filter(log =>
    log.action?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.details?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.user?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatTime = (timestamp) => {
    if (!timestamp) return '-'
    return new Date(timestamp).toLocaleString('zh-CN')
  }

  const getActionConfig = (action) => {
    return AUDIT_ACTION_CONFIG[action] || AUDIT_ACTION_CONFIG.default
  }

  return (
    <div className="space-y-4">
      {/* 操作栏 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          记录系统中的所有重要操作和事件
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading}>
            {loading ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3 mr-1" />
            )}
            刷新
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-3 h-3 mr-1" />
            导出
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              <div>
                <div className="text-lg font-bold">{stats.total || logs.length}</div>
                <div className="text-xs text-muted-foreground">总记录</div>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-500" />
              <div>
                <div className="text-lg font-bold">{stats.today || 0}</div>
                <div className="text-xs text-muted-foreground">今日</div>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-500" />
              <div>
                <div className="text-lg font-bold">{stats.permission_changes || 0}</div>
                <div className="text-xs text-muted-foreground">权限变更</div>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-500" />
              <div>
                <div className="text-lg font-bold">{stats.warnings || 0}</div>
                <div className="text-xs text-muted-foreground">警告</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* 搜索栏 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="搜索日志..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* 日志列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">加载中...</span>
        </div>
      ) : filteredLogs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">暂无审计日志</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredLogs.map((log, index) => {
            const actionConfig = getActionConfig(log.action)
            return (
              <Card key={log.id || index} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-surface-elevated flex items-center justify-center flex-shrink-0">
                      <Activity className={`w-4 h-4 ${actionConfig.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-medium text-sm ${actionConfig.color}`}>
                          {actionConfig.label}
                        </span>
                        {log.severity === 'warning' && (
                          <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">
                            警告
                          </Badge>
                        )}
                        {log.severity === 'error' && (
                          <Badge variant="destructive" className="text-xs">
                            错误
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {log.details || log.message || '无详情'}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        {log.user && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {log.user}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(log.timestamp || log.created_at)}
                        </span>
                        {log.ip && (
                          <span className="flex items-center gap-1">
                            <Wifi className="w-3 h-3" />
                            {log.ip}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function PermissionManager() {
  const [permissions, setPermissions] = useState({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [requesting, setRequesting] = useState(null)
  const [error, setError] = useState(null)

  // 加载权限状态
  useEffect(() => {
    loadPermissions()
  }, [])

  const loadPermissions = async () => {
    setLoading(true)
    setError(null)
    const result = await api.permissions.getAll()
    if (result.success) {
      setPermissions(result.data || {})
    } else {
      console.error('加载权限失败:', result.error)
      setError(result.error)
    }
    setLoading(false)
  }

  const refreshPermissions = async () => {
    setRefreshing(true)
    setError(null)
    const refreshResult = await api.permissions.refresh()
    if (refreshResult.success) {
      const result = await api.permissions.getAll()
      if (result.success) {
        setPermissions(result.data || {})
      }
    } else {
      console.error('刷新权限失败:', refreshResult.error)
      setError(refreshResult.error)
    }
    setRefreshing(false)
  }

  const requestPermission = async (type) => {
    setRequesting(type)
    setError(null)
    const result = await api.permissions.request(type)
    if (result.success) {
      // 更新单个权限状态
      setPermissions(prev => ({
        ...prev,
        [type]: result.data
      }))
    } else {
      console.error('请求权限失败:', result.error)
      setError(`请求 ${PERMISSIONS_CONFIG[type]?.name || type} 权限失败: ${result.error}`)
    }
    setRequesting(null)
  }

  const openSystemSettings = () => {
    // macOS 打开系统偏好设置
    api.system.openUrl('x-apple.systempreferences:com.apple.preference.security?Privacy')
      .catch(err => console.error('打开系统设置失败:', err))
  }

  // 渲染单个权限卡片
  const renderPermissionCard = (type) => {
    const config = PERMISSIONS_CONFIG[type]
    if (!config) return null

    const status = permissions[type] || 'NotDetermined'
    const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.NotDetermined
    const IconComponent = config.icon
    const StatusIcon = statusConfig.icon
    const isRequesting = requesting === type

    return (
      <Card key={type} className="hover:shadow-md transition-shadow duration-normal">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <IconComponent className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">{config.name}</CardTitle>
                <CardDescription className="text-sm mt-0.5">
                  {config.description}
                </CardDescription>
              </div>
            </div>
            <Badge className={statusConfig.style}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusConfig.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {status === 'Denied' && (
                <span className="text-orange-600 dark:text-orange-400">
                  需要在系统设置中手动授权
                </span>
              )}
              {status === 'Restricted' && (
                <span className="text-orange-600 dark:text-orange-400">
                  权限受系统限制
                </span>
              )}
              {status === 'Granted' && (
                <span className="text-green-600 dark:text-green-400">
                  权限已正常工作
                </span>
              )}
              {status === 'NotDetermined' && (
                <span>点击请求授权按钮获取权限</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {status !== 'Granted' && (
                <Button
                  size="sm"
                  variant={status === 'Denied' ? 'outline' : 'default'}
                  onClick={() => requestPermission(type)}
                  disabled={isRequesting || refreshing}
                >
                  {isRequesting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      请求中...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 mr-1" />
                      {status === 'Denied' ? '重新请求' : '请求授权'}
                    </>
                  )}
                </Button>
              )}
              {status === 'Granted' && (
                <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20">
                  <Check className="w-3 h-3 mr-1" />
                  已就绪
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // 统计信息
  const grantedCount = Object.values(permissions).filter(s => s === 'Granted').length
  const totalCount = Object.keys(PERMISSIONS_CONFIG).length

  return (
    <div className="space-y-6 p-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">权限管理</h2>
          <p className="text-muted-foreground">管理应用所需的系统权限和审计日志</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={openSystemSettings}>
            <Settings className="w-4 h-4 mr-2" />
            系统设置
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshPermissions}
            disabled={refreshing || loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            刷新状态
          </Button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tabs 导航 */}
      <Tabs defaultValue="permissions" className="w-full">
        <TabsList>
          <TabsTrigger value="permissions" className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            权限管理
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            审计日志
          </TabsTrigger>
        </TabsList>

        {/* 权限管理 Tab */}
        <TabsContent value="permissions" className="mt-4 space-y-6">
          {/* 状态概览 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="w-5 h-5" />
                权限状态概览
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">已授权:</span>
                  <Badge variant="default" className="bg-green-600">
                    {grantedCount} / {totalCount}
                  </Badge>
                </div>
                <div className="flex-1">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all duration-300"
                      style={{ width: `${(grantedCount / totalCount) * 100}%` }}
                    />
                  </div>
                </div>
                {grantedCount === totalCount ? (
                  <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <Check className="w-3 h-3 mr-1" />
                    所有权限已就绪
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    部分权限待授权
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* macOS 提示 */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>macOS 用户提示：</strong>
              某些权限（如屏幕录制、辅助功能）需要在系统设置中手动授权。
              如果请求权限后仍显示"已拒绝"，请点击上方"系统设置"按钮，
              在"安全性与隐私"中找到对应权限并添加本应用。
            </AlertDescription>
          </Alert>

          {/* 权限列表 */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">加载权限状态...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.keys(PERMISSIONS_CONFIG).map(renderPermissionCard)}
            </div>
          )}

          {/* 权限说明 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertCircle className="w-5 h-5" />
                权限说明
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <Monitor className="w-4 h-4 mt-0.5 text-primary" />
                  <div>
                    <strong className="text-foreground">屏幕录制</strong> - 用于截图、屏幕监控和浏览器自动化功能
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Accessibility className="w-4 h-4 mt-0.5 text-primary" />
                  <div>
                    <strong className="text-foreground">辅助功能</strong> - 用于微信消息监控和 UI 自动化操作
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <FolderOpen className="w-4 h-4 mt-0.5 text-primary" />
                  <div>
                    <strong className="text-foreground">文件系统</strong> - 用于读写本地文件、保存配置和日志
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Wifi className="w-4 h-4 mt-0.5 text-primary" />
                  <div>
                    <strong className="text-foreground">网络访问</strong> - 用于 API 调用、网络搜索和下载
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 🔥 审计日志 Tab */}
        <TabsContent value="audit" className="mt-4">
          <AuditLogs />
        </TabsContent>
      </Tabs>
    </div>
  )
}
