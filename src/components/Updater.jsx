// 更新组件
// 提供手动检查更新和更新对话框功能

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog'
import { Button } from './ui/button'
import { Progress } from './ui/progress'
import { Badge } from './ui/badge'
import {
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Info,
  Sparkles,
} from 'lucide-react'
import useAutoUpdate from '@/hooks/useAutoUpdate'

/**
 * 更新对话框组件
 */
export function UpdateDialog({ open, onOpenChange, onUpdateComplete }) {
  const {
    updateInfo,
    isChecking,
    isDownloading,
    downloadProgress,
    error,
    currentVersion,
    checkForUpdates,
    downloadUpdate,
    restartApp,
    clearError,
  } = useAutoUpdate({ autoCheck: false })

  // 处理下载完成
  const handleDownloadComplete = async () => {
    const success = await downloadUpdate()
    if (success && onUpdateComplete) {
      onUpdateComplete()
    }
  }

  // 渲染内容
  const renderContent = () => {
    // 错误状态
    if (error) {
      return (
        <div className="py-4">
          <div className="flex items-center gap-3 text-red-600 mb-4">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">更新失败</span>
          </div>
          <p className="text-sm text-foreground-secondary mb-4">{error}</p>
          <Button variant="outline" onClick={clearError}>
            重试
          </Button>
        </div>
      )
    }

    // 下载中
    if (isDownloading) {
      return (
        <div className="py-4 space-y-4">
          <div className="flex items-center gap-3">
            <Download className="w-5 h-5 animate-bounce text-primary" />
            <span className="font-medium">正在下载更新...</span>
          </div>
          <Progress
            value={downloadProgress?.percent || 0}
            className="h-2"
          />
          {downloadProgress && (
            <div className="flex justify-between text-sm text-foreground-secondary">
              <span>
                {downloadProgress.percent.toFixed(1)}%
              </span>
              <span>
                {(downloadProgress.downloaded / 1024 / 1024).toFixed(1)} MB
                {downloadProgress.total > 0 &&
                  ` / ${(downloadProgress.total / 1024 / 1024).toFixed(1)} MB`}
              </span>
            </div>
          )}
        </div>
      )
    }

    // 检查中
    if (isChecking) {
      return (
        <div className="py-8 flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
          <span className="text-foreground-secondary">正在检查更新...</span>
        </div>
      )
    }

    // 发现更新
    if (updateInfo) {
      return (
        <div className="py-4 space-y-4">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-yellow-500" />
            <span className="font-medium">发现新版本</span>
            <Badge variant="secondary">{updateInfo.version}</Badge>
          </div>

          <div className="bg-surface-elevated rounded-lg p-4 space-y-2">
            <div className="text-sm text-foreground-secondary">
              当前版本: <span className="text-foreground">{currentVersion}</span>
            </div>
            <div className="text-sm text-foreground-secondary">
              最新版本: <span className="text-primary font-medium">{updateInfo.version}</span>
            </div>
            {updateInfo.date && (
              <div className="text-sm text-foreground-secondary">
                发布日期: {updateInfo.date}
              </div>
            )}
          </div>

          {updateInfo.notes && (
            <div className="border border-border-subtle rounded-lg p-4">
              <div className="text-sm font-medium mb-2">更新说明</div>
              <p className="text-sm text-foreground-secondary whitespace-pre-wrap">
                {updateInfo.notes}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              稍后提醒
            </Button>
            <Button onClick={handleDownloadComplete}>
              <Download className="w-4 h-4 mr-2" />
              立即更新
            </Button>
          </DialogFooter>
        </div>
      )
    }

    // 已是最新版本
    return (
      <div className="py-8 flex flex-col items-center gap-4">
        <CheckCircle className="w-12 h-12 text-green-500" />
        <div className="text-center">
          <div className="font-medium mb-1">已是最新版本</div>
          <div className="text-sm text-foreground-secondary">
            当前版本: {currentVersion}
          </div>
        </div>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          关闭
        </Button>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            软件更新
          </DialogTitle>
          <DialogDescription>
            检查并安装 OpenClaw AI 助手的最新版本
          </DialogDescription>
        </DialogHeader>

        {renderContent()}
      </DialogContent>
    </Dialog>
  )
}

/**
 * 检查更新按钮组件
 */
export function CheckUpdateButton({ onCheckStart, onHasUpdate }) {
  const { checkForUpdates, isChecking, updateInfo } = useAutoUpdate({
    autoCheck: false,
  })

  const handleClick = async () => {
    onCheckStart?.()
    const info = await checkForUpdates()
    if (info) {
      onHasUpdate?.(info)
    }
  }

  return (
    <Button
      variant="outline"
      className="w-full justify-start"
      onClick={handleClick}
      disabled={isChecking}
    >
      <RefreshCw className={`w-4 h-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
      {isChecking ? '检查中...' : '检查更新'}
    </Button>
  )
}

/**
 * 更新设置卡片组件
 */
export function UpdateSettingsCard({ onOpenUpdateDialog }) {
  const { currentVersion, hasUpdate, checkForUpdates, isChecking } = useAutoUpdate()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">当前版本</div>
          <div className="text-sm text-foreground-secondary">{currentVersion || '加载中...'}</div>
        </div>
        {hasUpdate && (
          <Badge variant="default" className="bg-green-500">
            有新版本
          </Badge>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">自动检查更新</div>
          <div className="text-sm text-foreground-secondary">启动时自动检查更新</div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" className="sr-only peer" defaultChecked />
          <div className="w-11 h-6 bg-input peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring peer-focus:ring-offset-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:border-input after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
        </label>
      </div>

      <Button
        variant="outline"
        className="w-full justify-start"
        onClick={onOpenUpdateDialog}
        disabled={isChecking}
      >
        <RefreshCw className={`w-4 h-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
        {isChecking ? '检查中...' : '检查更新'}
      </Button>
    </div>
  )
}

/**
 * 下载完成重启对话框
 */
export function RestartDialog({ open, onOpenChange }) {
  const { restartApp } = useAutoUpdate({ autoCheck: false })

  const handleRestart = () => {
    restartApp()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-600">
            <CheckCircle className="w-5 h-5" />
            更新下载完成
          </DialogTitle>
          <DialogDescription>
            更新已下载完成，需要重启应用以完成安装。
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-green-800">
              <p className="font-medium mb-1">重启提示</p>
              <p>点击"立即重启"按钮后，应用将自动关闭并重新启动以完成更新安装。请确保已保存所有工作。</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            稍后重启
          </Button>
          <Button onClick={handleRestart}>
            立即重启
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default UpdateDialog
