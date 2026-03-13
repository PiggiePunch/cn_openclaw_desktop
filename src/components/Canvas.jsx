import React, { useCallback, useEffect, useState } from 'react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

const DEFAULT_CANVAS_PATH = '/__openclaw__/canvas/'
const DEFAULT_GATEWAY_PORT = 18789

function parsePort(value, fallback) {
  const parsed = Number(value)
  if (Number.isFinite(parsed) && parsed > 0 && parsed <= 65535) return parsed
  return fallback
}

function normalizePath(pathValue) {
  const value = typeof pathValue === 'string' ? pathValue.trim() : ''
  if (!value) return DEFAULT_CANVAS_PATH
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

function buildCandidateUrls(config) {
  const gatewayPort = parsePort(config?.gateway?.port, DEFAULT_GATEWAY_PORT)
  const canvasPort = parsePort(
    config?.canvasHost?.port ?? config?.gateway?.canvasHost?.port,
    gatewayPort,
  )
  const canvasPath = normalizePath(
    config?.canvasHost?.path ?? config?.gateway?.canvasHost?.path ?? DEFAULT_CANVAS_PATH,
  )

  const ports = Array.from(new Set([canvasPort, gatewayPort]))
  const hosts = ['127.0.0.1', 'localhost']

  const candidates = []
  for (const port of ports) {
    for (const host of hosts) {
      candidates.push(`http://${host}:${port}${canvasPath}`)
    }
  }
  return candidates
}

async function probeCanvasHost(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2500)
  try {
    await fetch(url, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    })
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

export default function Canvas() {
  const [canvasUrl, setCanvasUrl] = useState('')
  const [checking, setChecking] = useState(true)
  const [iframeLoading, setIframeLoading] = useState(true)
  const [connectionError, setConnectionError] = useState('')
  const [iframeKey, setIframeKey] = useState(0)

  const resolveCanvasHost = useCallback(async () => {
    setChecking(true)
    setConnectionError('')

    try {
      const configResult = await api.config.get()
      const config = configResult.success ? configResult.data : {}
      const candidates = buildCandidateUrls(config)

      for (const url of candidates) {
        const reachable = await probeCanvasHost(url)
        if (reachable) {
          setCanvasUrl(url)
          setChecking(false)
          return
        }
      }

      // 所有探测失败时，仍然给出可打开的默认地址，方便用户手动重试
      setCanvasUrl(candidates[0] || `http://127.0.0.1:${DEFAULT_GATEWAY_PORT}${DEFAULT_CANVAS_PATH}`)
      setConnectionError('未能探测到可访问的 Canvas Host，请确认 Gateway 已启动。')
    } catch (error) {
      setCanvasUrl(`http://127.0.0.1:${DEFAULT_GATEWAY_PORT}${DEFAULT_CANVAS_PATH}`)
      setConnectionError('获取配置失败，已回退到默认 Canvas 地址。')
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    resolveCanvasHost()
  }, [resolveCanvasHost])

  const handleReload = async () => {
    setIframeLoading(true)
    setIframeKey((prev) => prev + 1)
    await resolveCanvasHost()
  }

  const handleOpenExternal = () => {
    if (!canvasUrl) return
    window.open(canvasUrl, '_blank', 'noopener,noreferrer')
  }

  const handleCopyUrl = async () => {
    if (!canvasUrl) return
    try {
      await navigator.clipboard.writeText(canvasUrl)
      toast.success('已复制', 'Canvas 地址已复制到剪贴板')
    } catch (error) {
      toast.error('复制失败', '请手动复制地址')
    }
  }

  if (checking) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-foreground-secondary">正在连接 Canvas Host...</span>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-subtle bg-surface flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">Canvas Host</h3>
            {connectionError ? (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="w-3 h-3 mr-1" />
                连接异常
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">
                <CheckCircle2 className="w-3 h-3 mr-1 text-green-600" />
                已连接
              </Badge>
            )}
          </div>
          <p className="text-xs text-foreground-tertiary truncate mt-1">{canvasUrl}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleReload}>
            <RefreshCw className="w-4 h-4 mr-1" />
            刷新
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyUrl}>
            <Copy className="w-4 h-4 mr-1" />
            复制地址
          </Button>
          <Button variant="outline" size="sm" onClick={handleOpenExternal}>
            <ExternalLink className="w-4 h-4 mr-1" />
            外部打开
          </Button>
        </div>
      </div>

      {connectionError && (
        <div className="px-4 py-3 border-b border-subtle bg-amber-50 text-amber-900 text-sm">
          <p>{connectionError}</p>
          <p className="mt-1 text-xs">
            可先在终端确认 Gateway 日志出现 `canvas host mounted`，再点击“刷新”。
          </p>
        </div>
      )}
      {!connectionError && (
        <div className="px-4 py-2 border-b border-subtle bg-muted/40 text-xs text-foreground-secondary">
          桌面端预览 Canvas 时显示 `Bridge: missing · iOS=no · Android=no` 属于正常现象；
          该 Bridge 仅在 iOS/Android 节点 WebView 内为 ready。
        </div>
      )}

      <div className="flex-1 relative bg-muted/20">
        {iframeLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/70">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2 text-foreground-secondary">正在加载 Canvas 页面...</span>
          </div>
        )}
        <iframe
          key={iframeKey}
          src={canvasUrl}
          title="OpenClaw Canvas Host"
          className="w-full h-full border-0"
          onLoad={() => setIframeLoading(false)}
          onError={() => {
            setIframeLoading(false)
            setConnectionError('Canvas 页面加载失败，请尝试外部打开或检查 Gateway。')
          }}
        />
      </div>
    </div>
  )
}
