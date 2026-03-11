import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table'
import {
  FileText,
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight,
  Search,
  ToggleLeft,
  ToggleRight,
  Clock,
  User,
  Globe,
  Activity,
} from 'lucide-react'
import { toast } from '@/hooks/useToast'
import api from '@/lib/api'

// 每页显示数量选项
const PAGE_SIZE_OPTIONS = [20, 50, 100]

// 格式化时间
const formatTime = (timestamp) => {
  if (!timestamp) return '-'
  try {
    const date = new Date(timestamp)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return timestamp
  }
}

// 获取操作类型对应的 Badge 样式
const getActionBadgeVariant = (action) => {
  if (!action) return 'secondary'
  const actionLower = action.toLowerCase()
  if (actionLower.includes('create') || actionLower.includes('add') || actionLower.includes('install')) {
    return 'success'
  }
  if (actionLower.includes('delete') || actionLower.includes('remove') || actionLower.includes('uninstall')) {
    return 'destructive'
  }
  if (actionLower.includes('update') || actionLower.includes('modify') || actionLower.includes('edit')) {
    return 'warning'
  }
  if (actionLower.includes('get') || actionLower.includes('list') || actionLower.includes('query')) {
    return 'secondary'
  }
  return 'default'
}

// 截断详情文本
const truncateDetails = (details, maxLength = 100) => {
  if (!details) return '-'
  const str = typeof details === 'object' ? JSON.stringify(details) : String(details)
  if (str.length <= maxLength) return str
  return str.substring(0, maxLength) + '...'
}

export default function AuditLog() {
  // 日志数据
  const [logs, setLogs] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [total, setTotal] = useState(0)

  // 分页状态
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // 搜索筛选
  const [searchTerm, setSearchTerm] = useState('')
  const [searchInput, setSearchInput] = useState('')

  // 自动刷新
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState(null)

  // 导出状态
  const [isExporting, setIsExporting] = useState(false)

  // 加载日志数据
  const loadLogs = useCallback(async () => {
    setIsLoading(true)
    try {
      const offset = (page - 1) * pageSize
      const result = await api.audit.query(pageSize, offset)

      if (result.success) {
        // 处理返回数据格式
        const data = result.data
        if (Array.isArray(data)) {
          setLogs(data)
          setTotal(data.length < pageSize ? offset + data.length : offset + pageSize + 1)
        } else if (data?.logs) {
          setLogs(data.logs)
          setTotal(data.total || data.logs.length)
        } else if (data?.entries) {
          setLogs(data.entries)
          setTotal(data.total || data.entries.length)
        } else {
          setLogs([])
          setTotal(0)
        }
      } else {
        toast.error('加载失败', result.error)
      }
    } catch (error) {
      console.error('加载审计日志失败:', error)
      toast.error('加载失败', error.message || '未知错误')
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize])

  // 初始加载和分页变化时重新加载
  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  // 自动刷新逻辑
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(loadLogs, 10000) // 每 10 秒刷新
      setRefreshInterval(interval)
      return () => clearInterval(interval)
    } else {
      if (refreshInterval) {
        clearInterval(refreshInterval)
        setRefreshInterval(null)
      }
    }
  }, [autoRefresh, loadLogs])

  // 搜索过滤日志
  const filteredLogs = React.useMemo(() => {
    if (!searchTerm) return logs
    const term = searchTerm.toLowerCase()
    return logs.filter(log => {
      const action = (log.action || log.operation || '').toLowerCase()
      const user = (log.user || log.userId || log.username || '').toLowerCase()
      const ip = (log.ip || log.ipAddress || '').toLowerCase()
      const details = typeof log.details === 'string' ? log.details : JSON.stringify(log.details || {})
      return action.includes(term) || user.includes(term) || ip.includes(term) || details.toLowerCase().includes(term)
    })
  }, [logs, searchTerm])

  // 处理搜索
  const handleSearch = () => {
    setSearchTerm(searchInput)
    setPage(1) // 搜索时重置页码
  }

  // 处理搜索输入回车
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // 导出日志
  const handleExport = async (format) => {
    setIsExporting(true)
    try {
      const result = await api.audit.export(format)
      if (result.success) {
        // 处理导出结果
        const data = result.data
        let content, filename, mimeType

        if (format === 'csv') {
          content = data
          filename = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`
          mimeType = 'text/csv;charset=utf-8;'
        } else {
          content = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
          filename = `audit_log_${new Date().toISOString().slice(0, 10)}.json`
          mimeType = 'application/json'
        }

        // 创建下载
        const blob = new Blob([content], { type: mimeType })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)

        toast.success('导出成功', `已导出 ${filename}`)
      } else {
        toast.error('导出失败', result.error)
      }
    } catch (error) {
      console.error('导出审计日志失败:', error)
      toast.error('导出失败', error.message || '未知错误')
    } finally {
      setIsExporting(false)
    }
  }

  // 总页数
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-6 p-6">
      {/* 标题和操作区 */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold">审计日志</h2>
          <p className="text-muted-foreground">系统操作审计记录</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* 自动刷新开关 */}
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="gap-2"
          >
            {autoRefresh ? (
              <ToggleRight className="h-4 w-4" />
            ) : (
              <ToggleLeft className="h-4 w-4" />
            )}
            {autoRefresh ? '自动刷新中' : '自动刷新'}
          </Button>

          {/* 刷新按钮 */}
          <Button
            variant="outline"
            size="sm"
            onClick={loadLogs}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>

          {/* 导出按钮 */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('json')}
            disabled={isExporting}
          >
            <Download className="h-4 w-4 mr-2" />
            导出 JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('csv')}
            disabled={isExporting}
          >
            <Download className="h-4 w-4 mr-2" />
            导出 CSV
          </Button>
        </div>
      </div>

      {/* 搜索和筛选区 */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4 flex-wrap">
            {/* 搜索框 */}
            <div className="flex items-center gap-2 flex-1 min-w-64">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="搜索操作、用户、IP 或详情..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="w-full pl-10 pr-4 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <Button size="sm" onClick={handleSearch}>
                搜索
              </Button>
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchInput('')
                    setSearchTerm('')
                  }}
                >
                  清除
                </Button>
              )}
            </div>

            {/* 每页数量选择 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">每页显示:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setPage(1)
                }}
                className="border rounded px-2 py-1 bg-background"
              >
                {PAGE_SIZE_OPTIONS.map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 日志列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            操作记录
          </CardTitle>
          <CardDescription>
            共 {total} 条记录
            {searchTerm && ` (筛选后 ${filteredLogs.length} 条)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              <RefreshCw className="h-6 w-6 mx-auto mb-2 animate-spin" />
              加载中...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              {searchTerm ? '没有找到匹配的记录' : '暂无审计日志'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-44">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      时间
                    </div>
                  </TableHead>
                  <TableHead className="w-36">
                    <div className="flex items-center gap-1">
                      <Activity className="h-4 w-4" />
                      操作
                    </div>
                  </TableHead>
                  <TableHead className="w-28">
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      用户
                    </div>
                  </TableHead>
                  <TableHead className="w-28">
                    <div className="flex items-center gap-1">
                      <Globe className="h-4 w-4" />
                      IP 地址
                    </div>
                  </TableHead>
                  <TableHead>详情</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log, index) => (
                  <TableRow key={log.id || log.timestamp || index}>
                    <TableCell className="text-sm">
                      {formatTime(log.timestamp || log.createdAt || log.time)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getActionBadgeVariant(log.action || log.operation)}>
                        {log.action || log.operation || '-'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.user || log.userId || log.username || '-'}
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {log.ip || log.ipAddress || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      <span title={typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}>
                        {truncateDetails(log.details, 80)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* 分页控制 */}
          {total > pageSize && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                第 {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} 条，共 {total} 条
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || isLoading}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  上一页
                </Button>
                <span className="text-sm">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || isLoading}
                >
                  下一页
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 统计信息 */}
      <div className="text-center text-sm text-muted-foreground">
        {autoRefresh && (
          <span className="flex items-center justify-center gap-1">
            <ToggleRight className="h-4 w-4 text-green-500" />
            每 10 秒自动刷新
          </span>
        )}
      </div>
    </div>
  )
}
