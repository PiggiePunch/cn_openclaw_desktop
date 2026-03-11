import React from 'react'
import { Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { Card } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

export default function GatewayStatusCard({ status, onToggle }) {
  const isRunning = status?.running
  const isConnected = status?.websocket_connected
  const isConnecting = status?.starting

  const getStatusInfo = () => {
    if (isConnecting) {
      return {
        icon: <Loader2 className="w-4 h-4 animate-spin" />,
        text: 'Gateway 启动中...',
        color: 'text-yellow-600',
        bg: 'bg-yellow-50',
        dot: 'bg-yellow-500'
      }
    }
    if (isRunning && isConnected) {
      return {
        icon: <CheckCircle className="w-4 h-4" />,
        text: 'Gateway 运行中',
        color: 'text-green-600',
        bg: 'bg-green-50',
        dot: 'bg-green-500'
      }
    }
    if (isRunning) {
      return {
        icon: <AlertCircle className="w-4 h-4" />,
        text: 'Gateway 连接中...',
        color: 'text-yellow-600',
        bg: 'bg-yellow-50',
        dot: 'bg-yellow-500'
      }
    }
    return {
      icon: <XCircle className="w-4 h-4" />,
      text: 'Gateway 未运行',
      color: 'text-red-600',
      bg: 'bg-red-50',
      dot: 'bg-red-500'
    }
  }

  const statusInfo = getStatusInfo()

  return (
    <Card className="overflow-hidden">
      <div className={`p-4 ${statusInfo.bg}`}>
        {/* 状态头部 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${statusInfo.dot}`} />
            <span className={`text-sm font-medium ${statusInfo.color}`}>
              {statusInfo.text}
            </span>
          </div>
          {statusInfo.icon}
        </div>

        {/* 详细信息 */}
        {isRunning && (
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-foreground-secondary">WebSocket:</span>
              <Badge variant={isConnected ? 'default' : 'secondary'}>
                {isConnected ? '✓ 已连接' : '✗ 未连接'}
              </Badge>
            </div>
            {status?.port && (
              <div className="flex items-center justify-between">
                <span className="text-foreground-secondary">端口:</span>
                <span className="font-mono">{status.port}</span>
              </div>
            )}
          </div>
        )}

        {/* 操作按钮 */}
        {!isRunning && onToggle && (
          <Button
            size="sm"
            onClick={onToggle}
            className="w-full mt-3"
            disabled={isConnecting}
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                启动中...
              </>
            ) : (
              '启动 Gateway'
            )}
          </Button>
        )}
      </div>
    </Card>
  )
}
