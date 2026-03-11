/**
 * OpenClaw 安装引导组件
 *
 * 首次启动时检测 ~/.openclaw/ 是否存在
 * 不存在则显示安装引导界面
 */

import { useState, useEffect } from 'react'
import { Download, CheckCircle, AlertCircle, Loader2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

/**
 * 安装引导组件
 */
export default function InstallGuide({ onComplete }) {
  const [status, setStatus] = useState('checking') // checking | installing | success | error
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  const [installResult, setInstallResult] = useState(null)

  useEffect(() => {
    checkAndInstall()
  }, [])

  // 检查并安装
  const checkAndInstall = async () => {
    try {
      setStatus('checking')

      // 检查安装状态
      const result = await window.__TAURI__.core.invoke('check_install_status')

      if (!result.needs_install) {
        // 已安装
        setStatus('success')
        setInstallResult(result)
        // 延迟一下再完成，让用户看到成功状态
        setTimeout(() => {
          onComplete?.(result)
        }, 1500)
        return
      }

      // 需要安装
      setStatus('installing')
      setProgress(10)

      // 触发安装
      const installResult = await window.__TAURI__.core.invoke('install_openclaw')
      setInstallResult(installResult)

      setProgress(100)

      if (installResult.installed) {
        setStatus('success')
        setTimeout(() => {
          onComplete?.(installResult)
        }, 1500)
      } else {
        setStatus('error')
        setError(installResult.error || '安装失败')
      }
    } catch (err) {
      console.error('安装检查失败:', err)
      setStatus('error')
      setError(err.message || '未知错误')
    }
  }

  // 重试安装
  const retryInstall = () => {
    setError(null)
    checkAndInstall()
  }

  // 渲染检查状态
  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <Card className="w-[400px] bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6 text-center">
            <Loader2 className="w-12 h-12 mx-auto mb-4 text-blue-400 animate-spin" />
            <h2 className="text-xl font-semibold text-white mb-2">检查安装状态...</h2>
            <p className="text-slate-400">正在检测 OpenClaw 是否已安装</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 渲染安装中状态
  if (status === 'installing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <Card className="w-[400px] bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Download className="w-5 h-5 text-blue-400" />
              安装 OpenClaw
            </CardTitle>
            <CardDescription className="text-slate-400">
              正在下载并配置 OpenClaw 核心组件
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={progress} className="mb-4" />
            <p className="text-sm text-slate-400 text-center">
              {progress < 30 && '正在获取版本信息...'}
              {progress >= 30 && progress < 60 && '正在下载 OpenClaw...'}
              {progress >= 60 && progress < 90 && '正在安装依赖...'}
              {progress >= 90 && '正在完成配置...'}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 渲染成功状态
  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <Card className="w-[400px] bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-400" />
            <h2 className="text-xl font-semibold text-white mb-2">安装完成!</h2>
            <p className="text-slate-400 mb-4">
              OpenClaw {installResult?.version || 'latest'} 已安装
            </p>
            <p className="text-sm text-slate-500">
              正在启动应用...
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 渲染错误状态
  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <Card className="w-[400px] bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-400" />
              安装失败
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-400">{error}</p>
            </div>
            <Button onClick={retryInstall} className="w-full">
              <ArrowRight className="w-4 h-4 mr-2" />
              重试
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}
