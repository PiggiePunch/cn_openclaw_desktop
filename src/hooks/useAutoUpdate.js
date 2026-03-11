// 自动更新 Hook
// 管理应用自动更新的状态和逻辑

import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import { useTauriEvent } from './useTauriEvent'

/**
 * 自动更新 Hook
 * @param {Object} options 配置选项
 * @param {number} options.checkInterval 检查间隔（毫秒），默认 24 小时
 * @param {number} options.initialDelay 初始延迟（毫秒），默认 5 秒
 * @param {boolean} options.autoCheck 是否自动检查，默认 true
 * @returns {Object} 更新状态和方法
 */
export function useAutoUpdate(options = {}) {
  const {
    checkInterval = 24 * 60 * 60 * 1000, // 24 小时
    initialDelay = 5000, // 5 秒
    autoCheck = true,
  } = options

  // 更新状态
  const [updateInfo, setUpdateInfo] = useState(null)
  const [isChecking, setIsChecking] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(null)
  const [error, setError] = useState(null)
  const [currentVersion, setCurrentVersion] = useState(null)

  // 加载当前版本
  useEffect(() => {
    api.updates.getVersion()
      .then(result => result.success && setCurrentVersion(result.data))
      .catch(console.error)
  }, [])

  // 监听下载进度事件（使用 useTauriEvent）
  useTauriEvent('update-download-progress', (event) => {
    setDownloadProgress(event.payload)
  }, [])

  // 检查更新
  const checkForUpdates = useCallback(async () => {
    setIsChecking(true)
    setError(null)

    const result = await api.updates.check()
    if (result.success) {
      setUpdateInfo(result.data)
      // 保存最后检查时间
      localStorage.setItem('openclaw_last_update_check', Date.now().toString())
      setIsChecking(false)
      return result.data
    } else {
      // 静默处理更新检查失败（更新服务器可能未部署）
      // 仅在开发模式下打印日志
      if (import.meta.env.DEV) {
        console.warn('[AutoUpdate] 检查更新失败（更新服务器可能未部署）:', result.error)
      }
      setIsChecking(false)
      return null
    }
  }, [])

  // 下载并安装更新
  const downloadUpdate = useCallback(async () => {
    setIsDownloading(true)
    setError(null)
    setDownloadProgress(null)

    const result = await api.updates.download()
    if (result.success) {
      setIsDownloading(false)
      return true
    } else {
      setError(result.error)
      console.error('下载更新失败:', result.error)
      setIsDownloading(false)
      return false
    }
  }, [])

  // 重启应用
  const restartApp = useCallback(() => {
    api.updates.restart().catch(console.error)
  }, [])

  // 自动检查逻辑
  useEffect(() => {
    if (!autoCheck) return

    const checkIfNeeded = async () => {
      const lastCheck = localStorage.getItem('openclaw_last_update_check')
      const now = Date.now()

      // 如果从未检查或超过检查间隔，则检查更新
      if (!lastCheck || now - parseInt(lastCheck) > checkInterval) {
        await checkForUpdates()
      }
    }

    // 延迟初始检查
    const timer = setTimeout(checkIfNeeded, initialDelay)

    return () => clearTimeout(timer)
  }, [autoCheck, checkInterval, initialDelay, checkForUpdates])

  // 格式化文件大小
  const formatSize = useCallback((bytes) => {
    if (!bytes) return '未知'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }, [])

  return {
    // 状态
    updateInfo,
    isChecking,
    isDownloading,
    downloadProgress,
    error,
    currentVersion,
    hasUpdate: !!updateInfo,

    // 方法
    checkForUpdates,
    downloadUpdate,
    restartApp,
    formatSize,
    clearError: () => setError(null),
  }
}

export default useAutoUpdate
