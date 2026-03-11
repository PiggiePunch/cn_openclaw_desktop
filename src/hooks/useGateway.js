/**
 * Gateway 状态管理 Hook
 *
 * 提供 Gateway 连接状态的 React 集成：
 * - 连接状态（connecting/connected/disconnected/reconnecting）
 * - 自动重连逻辑
 * - 全局单例管理
 * - React 状态集成
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { getGateway, ConnectionState } from '@/lib/gateway'

/**
 * useGateway Hook
 *
 * 管理与 Gateway 的连接状态，提供连接/断开方法
 *
 * @returns {Object} Gateway 状态和操作方法
 */
export function useGateway() {
  const [connectionState, setConnectionState] = useState(ConnectionState.DISCONNECTED)
  const [error, setError] = useState(null)
  const [lastConnected, setLastConnected] = useState(null)

  // 防止重复连接的标志
  const isConnectingRef = useRef(false)

  // 获取 Gateway 单例
  const gateway = getGateway()

  /**
   * 连接到 Gateway
   */
  const connect = useCallback(async () => {
    // 防止重复连接
    if (isConnectingRef.current) {
      console.log('[useGateway] 已有连接正在进行中，跳过')
      return
    }

    // 已连接则跳过
    if (gateway.isConnected()) {
      console.log('[useGateway] 已连接，跳过')
      return
    }

    isConnectingRef.current = true
    setError(null)

    try {
      console.log('[useGateway] 开始连接...')
      await gateway.connect()
      setLastConnected(new Date())
      console.log('[useGateway] 连接成功')
    } catch (err) {
      console.error('[useGateway] 连接失败:', err)
      setError(err.message || '连接失败')
    } finally {
      isConnectingRef.current = false
    }
  }, [gateway])

  /**
   * 断开连接
   */
  const disconnect = useCallback(() => {
    console.log('[useGateway] 断开连接')
    gateway.disconnect()
    setError(null)
  }, [gateway])

  /**
   * 重新连接
   */
  const reconnect = useCallback(async () => {
    console.log('[useGateway] 重新连接')
    disconnect()
    // 等待一小段时间后再连接
    await new Promise(resolve => setTimeout(resolve, 500))
    await connect()
  }, [connect, disconnect])

  // 监听连接状态变化
  useEffect(() => {
    const unsubscribe = gateway.onStateChange((state) => {
      setConnectionState(state)

      // 连接成功时清除错误
      if (state === ConnectionState.CONNECTED) {
        setError(null)
      }
    })

    // 如果当前未连接，自动连接
    if (!gateway.isConnected() && !isConnectingRef.current) {
      connect()
    }

    return () => {
      unsubscribe()
    }
  }, [gateway, connect])

  // 计算派生状态
  const isConnected = connectionState === ConnectionState.CONNECTED
  const isConnecting = connectionState === ConnectionState.CONNECTING
  const isReconnecting = connectionState === ConnectionState.RECONNECTING
  const isDisconnected = connectionState === ConnectionState.DISCONNECTED

  return {
    // 状态
    connectionState,
    isConnected,
    isConnecting,
    isReconnecting,
    isDisconnected,
    error,
    lastConnected,

    // 方法
    connect,
    disconnect,
    reconnect,
  }
}

/**
 * useGatewayEvents Hook
 *
 * 监听 Gateway 事件
 *
 * @param {string} eventName - 事件名或 '*' 监听所有事件
 * @param {Function} handler - 事件处理器
 */
export function useGatewayEvent(eventName, handler) {
  const gateway = getGateway()

  useEffect(() => {
    gateway.on(eventName, handler)

    return () => {
      gateway.off(eventName, handler)
    }
  }, [gateway, eventName, handler])
}

/**
 * useGatewayConnectionStatus Hook
 *
 * 提供连接状态的简化版本，适合 UI 显示
 *
 * @returns {Object} 连接状态信息
 */
export function useGatewayConnectionStatus() {
  const { connectionState, error, isConnected, reconnect } = useGateway()

  // 根据状态生成显示文本
  const getStatusText = () => {
    switch (connectionState) {
      case ConnectionState.CONNECTED:
        return '已连接'
      case ConnectionState.CONNECTING:
        return '连接中...'
      case ConnectionState.RECONNECTING:
        return '重连中...'
      case ConnectionState.DISCONNECTED:
        return '未连接'
      default:
        return '未知状态'
    }
  }

  // 根据状态生成颜色类
  const getStatusColor = () => {
    switch (connectionState) {
      case ConnectionState.CONNECTED:
        return 'text-green-500'
      case ConnectionState.CONNECTING:
      case ConnectionState.RECONNECTING:
        return 'text-yellow-500'
      case ConnectionState.DISCONNECTED:
        return 'text-red-500'
      default:
        return 'text-gray-500'
    }
  }

  return {
    isConnected,
    statusText: getStatusText(),
    statusColor: getStatusColor(),
    error,
    reconnect,
  }
}

/**
 * useGatewayAutoConnect Hook
 *
 * 组件挂载时自动连接，卸载时保持连接（因为是单例）
 * 适合需要在应用启动时连接的场景
 *
 * @param {Object} options - 配置选项
 * @param {boolean} options.autoConnect - 是否自动连接（默认 true）
 */
export function useGatewayAutoConnect(options = {}) {
  const { autoConnect = true } = options
  const { connectionState, connect, error } = useGateway()

  useEffect(() => {
    if (autoConnect && connectionState === ConnectionState.DISCONNECTED) {
      connect()
    }
  }, [autoConnect, connectionState, connect])

  return {
    connectionState,
    error,
  }
}

// 导出 ConnectionState 以便外部使用
export { ConnectionState }

export default useGateway
