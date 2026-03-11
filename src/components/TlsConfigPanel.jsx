import React, { useState, useEffect } from 'react'
import { Shield, RefreshCw, AlertCircle, CheckCircle, Copy } from 'lucide-react'
import { Card } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Switch } from './ui/switch'
import { Badge } from './ui/badge'
import { invoke } from '@tauri-apps/api/core'

/**
 * TLS 配置面板
 *
 * 功能:
 * - 启用/禁用 TLS
 * - 自动生成证书开关
 * - 配置证书/私钥路径
 * - 显示证书指纹
 * - 重新生成证书
 */
export default function TlsConfigPanel({ onConfigChange }) {
  const [tlsEnabled, setTlsEnabled] = useState(false)
  const [autoGenerate, setAutoGenerate] = useState(true)
  const [certPath, setCertPath] = useState('')
  const [keyPath, setKeyPath] = useState('')
  const [certExists, setCertExists] = useState(false)
  const [keyExists, setKeyExists] = useState(false)
  const [fingerprint, setFingerprint] = useState('')
  const [loading, setLoading] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadTlsStatus()
  }, [])

  const loadTlsStatus = async () => {
    try {
      const status = await invoke('get_gateway_tls_status')
      setTlsEnabled(status.enabled)
      setAutoGenerate(status.auto_generate)
      setCertPath(status.cert_path)
      setKeyPath(status.key_path)
      setCertExists(status.cert_exists)
      setKeyExists(status.key_exists)
      setFingerprint(status.fingerprint || '')
    } catch (e) {
      setError(`加载 TLS 状态失败: ${e}`)
    }
  }

  const handleSave = async () => {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      await invoke('update_gateway_tls_config', {
        enabled: tlsEnabled,
        autoGenerate,
        certPath: certPath || null,
        keyPath: keyPath || null,
      })
      setSuccess('TLS 配置已保存，重启 Gateway 生效')
      onConfigChange?.()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(`保存失败: ${e}`)
    }

    setLoading(false)
  }

  const handleRegenerate = async () => {
    setRegenerating(true)
    setError('')
    setSuccess('')

    try {
      const fp = await invoke('regenerate_tls_certificate')
      setFingerprint(fp)
      setCertExists(true)
      setKeyExists(true)
      setSuccess('证书已重新生成')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(`生成证书失败: ${e}`)
    }

    setRegenerating(false)
  }

  const copyFingerprint = () => {
    if (fingerprint) {
      navigator.clipboard.writeText(fingerprint)
      setSuccess('指纹已复制到剪贴板')
      setTimeout(() => setSuccess(''), 2000)
    }
  }

  const getStatusBadge = () => {
    if (!tlsEnabled) {
      return <Badge variant="secondary">未启用</Badge>
    }
    if (certExists && keyExists) {
      return (
        <Badge variant="default" className="bg-green-600">
          <CheckCircle className="w-3 h-3 mr-1" /> 已启用
        </Badge>
      )
    }
    return (
      <Badge variant="destructive">
        <AlertCircle className="w-3 h-3 mr-1" /> 证书缺失
      </Badge>
    )
  }

  return (
    <Card className="p-4">
      {/* 标题 */}
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold">TLS/HTTPS 配置</h3>
        {getStatusBadge()}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 text-red-600 p-2 rounded mb-4 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* 成功提示 */}
      {success && (
        <div className="bg-green-50 text-green-600 p-2 rounded mb-4 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {success}
        </div>
      )}

      <div className="space-y-4">
        {/* 启用 TLS */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">启用 TLS</p>
            <p className="text-sm text-muted-foreground">
              使用 wss:// 安全连接
            </p>
          </div>
          <Switch
            checked={tlsEnabled}
            onCheckedChange={setTlsEnabled}
          />
        </div>

        {tlsEnabled && (
          <>
            {/* 🔒 安全警告 */}
            {autoGenerate && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-sm">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />
                  <div>
                    <p className="font-medium">安全警告：自签名证书</p>
                    <ul className="mt-1 text-xs space-y-1 text-amber-700">
                      <li>• 自签名证书不受浏览器信任，会显示安全警告</li>
                      <li>• 无法防御中间人攻击 (MITM)</li>
                      <li>• 仅适用于本地开发和测试环境</li>
                      <li>• 生产环境请使用受信任 CA 签发的证书</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
            {/* 自动生成证书 */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">自动生成证书</p>
                <p className="text-sm text-muted-foreground">
                  首次启动时自动生成自签名证书
                </p>
              </div>
              <Switch
                checked={autoGenerate}
                onCheckedChange={setAutoGenerate}
              />
            </div>

            {/* 证书路径 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                证书路径 {certExists && <CheckCircle className="w-3 h-3 inline text-green-600" />}
              </label>
              <Input
                value={certPath}
                onChange={(e) => setCertPath(e.target.value)}
                placeholder="~/.openclaw/gateway/tls/gateway-cert.pem"
                className="font-mono text-xs"
              />
            </div>

            {/* 私钥路径 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                私钥路径 {keyExists && <CheckCircle className="w-3 h-3 inline text-green-600" />}
              </label>
              <Input
                value={keyPath}
                onChange={(e) => setKeyPath(e.target.value)}
                placeholder="~/.openclaw/gateway/tls/gateway-key.pem"
                className="font-mono text-xs"
              />
            </div>

            {/* 证书指纹 */}
            {fingerprint && (
              <div className="bg-slate-50 p-3 rounded">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-muted-foreground">证书指纹 (SHA-256)</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    onClick={copyFingerprint}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
                <code className="text-xs break-all text-slate-700">{fingerprint}</code>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerate}
                disabled={regenerating}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${regenerating ? 'animate-spin' : ''}`} />
                重新生成证书
              </Button>
            </div>
          </>
        )}

        {/* 保存按钮 */}
        <Button
          onClick={handleSave}
          disabled={loading}
          className="w-full"
        >
          {loading ? '保存中...' : '保存配置'}
        </Button>

        {/* 提示信息 */}
        {tlsEnabled && (
          <p className="text-xs text-muted-foreground text-center">
            保存配置后需重启 Gateway 才能生效
          </p>
        )}
      </div>
    </Card>
  )
}
