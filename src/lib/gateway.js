/**
 * OpenClaw Gateway WebSocket 客户端
 *
 * 通过 WebSocket 直接连接原版 OpenClaw Gateway (ws://127.0.0.1:18789)
 * 实现请求/响应匹配、事件监听、自动重连、心跳保活等功能
 */

import {
  loadOrCreateDeviceIdentity,
  signDevicePayload,
  buildDeviceAuthPayload,
} from './device-identity'

// ============================================================================
// 常量定义
// ============================================================================

const DEFAULT_URL = 'ws://127.0.0.1:18789'
const RECONNECT_DELAY = 3000 // 重连延迟（毫秒）
const HEARTBEAT_INTERVAL = 30000 // 心跳间隔（毫秒）
const REQUEST_TIMEOUT = 60000 // 请求超时（毫秒）

// 连接状态枚举
export const ConnectionState = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
}

// ============================================================================
// OpenClawGateway 类
// ============================================================================

export class OpenClawGateway {
  constructor(url = DEFAULT_URL) {
    this.url = url
    this.ws = null
    this.requestId = 0
    this.pendingRequests = new Map() // 存储待处理的请求
    this.eventHandlers = new Map() // 事件处理器映射
    this.state = ConnectionState.DISCONNECTED
    this.stateListeners = new Set() // 状态变化监听器

    // 重连相关
    this.reconnectTimer = null
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 10
    this.shouldReconnect = true

    // 心跳相关
    this.heartbeatTimer = null

    // 握手信息（必须符合 Gateway 协议规范）
    this.clientInfo = {
      id: 'openclaw-control-ui',  // 必须是 GatewayClientId 枚举值之一
      version: '1.0.0',
      platform: 'desktop',
      mode: 'ui',  // 必须是 GatewayClientMode 枚举值之一
    }

    // 握手相关状态
    this.connectNonce = null  // 收到的 challenge nonce
    this.connectResolve = null  // connect Promise 的 resolve
    this.connectReject = null  // connect Promise 的 reject

        // Gateway 认证 token（从配置文件读取）
    this.authToken = null

    // 连接锁（防止并发连接）
    this.connectingPromise = null
  }

  /**
   * 设置认证 token
   */
  setAuthToken(token) {
    this.authToken = token
  }

  /**
   * 是否已设置认证 token
   */
  hasAuthToken() {
    return typeof this.authToken === 'string' && this.authToken.length > 0
  }

  // ============================================================================
  // 连接管理
  // ============================================================================

  /**
   * 连接 Gateway 并完成握手
   * @returns {Promise<Object>} 握手响应
   */
  async connect() {
    // 如果正在连接，返回同一个 Promise（防止并发连接）
    if (this.connectingPromise) {
      return this.connectingPromise
    }

    // 如果已连接，直接返回
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return { connected: true }
    }

    // 创建新的连接 Promise 并存储（锁机制）
    this.connectingPromise = this._doConnect()

    try {
      const result = await this.connectingPromise
      return result
    } finally {
      this.connectingPromise = null  // 释放锁
    }
  }

  /**
   * 实际执行连接（内部方法）
   * @private
   */
  async _doConnect() {
    this._setState(ConnectionState.CONNECTING)
    this.shouldReconnect = true
    this.connectNonce = null

    return new Promise((resolve, reject) => {
      // 存储 Promise 的 resolve/reject，供 challenge 处理后调用
      this.connectResolve = resolve
      this.connectReject = reject

      try {
        console.log(`[Gateway] 正在连接 ${this.url}...`)
        this.ws = new WebSocket(this.url)

        // 连接超时处理
        const connectTimeout = setTimeout(() => {
          this.connectResolve = null
          this.connectReject = null
          reject(new Error('连接超时'))
          this.ws?.close()
        }, 15000)

        this.ws.onopen = () => {
          clearTimeout(connectTimeout)
          console.log('[Gateway] WebSocket 已连接，等待 challenge...')
          // 不主动发送 connect，等待 Gateway 发送 connect.challenge 事件
        }

        this.ws.onmessage = (event) => {
          this._handleMessage(event.data)
        }

        this.ws.onerror = (error) => {
          clearTimeout(connectTimeout)
          console.error('[Gateway] WebSocket 错误:', error)
        }

        this.ws.onclose = (event) => {
          clearTimeout(connectTimeout)
          const closeReason = event.reason || ''
          console.log('[Gateway] WebSocket 关闭:', event.code, closeReason)
          if (this.connectReject) {
            this.connectReject(new Error(`连接关闭: ${event.code} ${closeReason}`))
            this.connectResolve = null
            this.connectReject = null
          }
          this._handleDisconnect(closeReason)
        }
      } catch (error) {
        this._setState(ConnectionState.DISCONNECTED)
        this.connectResolve = null
        this.connectReject = null
        reject(error)
      }
    })
  }

  /**
   * 处理 connect.challenge 事件，发送 connect 请求
   * 注意：nonce 直接传递给 _sendConnectRequest，避免竞态条件
   */
  async _handleConnectChallenge(payload) {
    console.log('[Gateway] 收到 challenge:', payload)

    // 直接从 payload 获取 nonce，传递给 _sendConnectRequest（避免竞态条件）
    const nonce = payload?.nonce || ''

    // 发送 connect 请求
    try {
      const response = await this._sendConnectRequest(nonce)
      console.log('[Gateway] 握手成功:', response)

      this._setState(ConnectionState.CONNECTED)
      this.reconnectAttempts = 0
      this._startHeartbeat()

      if (this.connectResolve) {
        this.connectResolve(response)
        this.connectResolve = null
        this.connectReject = null
      }
    } catch (error) {
      console.error('[Gateway] 握手失败:', error)
      this._setState(ConnectionState.DISCONNECTED)

      if (this.connectReject) {
        this.connectReject(error)
        this.connectResolve = null
        this.connectReject = null
      }
    }
  }

  /**
   * 发送 connect 请求（收到 challenge 后调用）
   * @param {string} nonce - 从 challenge 获取的 nonce（直接传递，避免竞态条件）
   */
  async _sendConnectRequest(nonce) {
    return new Promise(async (resolve, reject) => {
      const id = `req-${++this.requestId}`

      try {
        // 加载或创建设备身份
        const deviceIdentity = await loadOrCreateDeviceIdentity()

        // 当前时间戳
        const signedAt = Date.now()

        // 构建完整的签名 payload（v2 格式，必须与 Gateway 服务器验证逻辑一致）
        const nonceToSign = nonce || ''
        const scopes = ['operator.admin', 'operator.approvals', 'operator.pairing']
        const authPayload = buildDeviceAuthPayload({
          deviceId: deviceIdentity.deviceId,
          clientId: this.clientInfo.id,
          clientMode: this.clientInfo.mode,
          role: 'operator',
          scopes,
          signedAtMs: signedAt,
          token: this.authToken || '',
          nonce: nonceToSign,
        })
        // 对完整 payload 签名（而不是只签 nonce！）
        const signature = await signDevicePayload(deviceIdentity.privateKey, authPayload)

        // 构建握手请求（使用 device 字段，不是 identity）
        const handshakePayload = {
          type: 'req',
          id,
          method: 'connect',
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: this.clientInfo,
            role: 'operator',
            scopes: ['operator.admin', 'operator.approvals', 'operator.pairing'],
            device: {
              id: deviceIdentity.deviceId,
              publicKey: deviceIdentity.publicKey,
              signature,
              signedAt,
              nonce: nonceToSign,
            },
            // 总是传递 auth 字段，即使 token 为空
            auth: { token: this.authToken || '' },
          },
        }

        // 设置超时
        const timeout = setTimeout(() => {
          this.pendingRequests.delete(id)
          reject(new Error('握手超时'))
        }, REQUEST_TIMEOUT)

        // 存储待处理请求
        this.pendingRequests.set(id, {
          resolve: (response) => {
            clearTimeout(timeout)
            resolve(response)
          },
          reject: (error) => {
            clearTimeout(timeout)
            reject(error)
          },
        })

        // 发送握手消息
        this.ws.send(JSON.stringify(handshakePayload))
        console.log('[Gateway] 发送 connect 请求（含设备身份）:', {
          id,
          deviceId: deviceIdentity.deviceId.substring(0, 8) + '...',
          hasToken: !!this.authToken,
        })
      } catch (error) {
        console.error('[Gateway] 设备身份认证失败:', error)
        reject(error)
      }
    })
  }

  /**
   * 断开连接
   */
  disconnect() {
    console.log('[Gateway] 主动断开连接')
    this.shouldReconnect = false
    this._cleanup()

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this._setState(ConnectionState.DISCONNECTED)
  }

  /**
   * 处理断开连接
   * @param {string} [closeReason] - 关闭原因，用于检测认证失败
   */
  _handleDisconnect(closeReason) {
    this._stopHeartbeat()
    this._clearReconnectTimer()

    // 拒绝所有待处理的请求
    for (const [id, { reject }] of this.pendingRequests) {
      reject(new Error('连接已断开'))
    }
    this.pendingRequests.clear()

    this._setState(ConnectionState.DISCONNECTED)

    // 检测是否是认证失败导致的封禁，如果是则停止重连
    const authFailed = closeReason?.includes('too many failed authentication attempts')
    if (authFailed) {
      console.warn('[Gateway] 检测到认证失败次数过多，停止重连。请在设置中重新配对设备。')
      this.shouldReconnect = false
      // 通知用户需要重新配对
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('gateway:authFailed', {
          detail: { message: '认证失败次数过多，请重新配对设备' }
        }))
      }
      return
    }

    // 尝试重连
    if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
      this._scheduleReconnect()
    }
  }

  /**
   * 安排重连
   */
  _scheduleReconnect() {
    this.reconnectAttempts++
    const delay = RECONNECT_DELAY * Math.min(this.reconnectAttempts, 5) // 指数退避，最多 5 倍

    console.log(`[Gateway] 将在 ${delay}ms 后尝试第 ${this.reconnectAttempts} 次重连...`)
    this._setState(ConnectionState.RECONNECTING)

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect()
      } catch (error) {
        console.error('[Gateway] 重连失败:', error)
        // 重连失败后会再次触发 onclose，继续重连
      }
    }, delay)
  }

  /**
   * 清理重连定时器
   */
  _clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  /**
   * 清理资源
   */
  _cleanup() {
    this._stopHeartbeat()
    this._clearReconnectTimer()
  }

  // ============================================================================
  // 心跳保活
  // ============================================================================

  /**
   * 启动心跳
   */
  _startHeartbeat() {
    this._stopHeartbeat()

    this.heartbeatTimer = setInterval(async () => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          // Gateway 不支持 ping，使用 health 作为轻量保活请求
          await this.call('health', {})
        } catch (error) {
          console.warn('[Gateway] 心跳失败:', error)
        }
      }
    }, HEARTBEAT_INTERVAL)
  }

  /**
   * 停止心跳
   */
  _stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  // ============================================================================
  // 消息处理
  // ============================================================================

  /**
   * 处理收到的消息
   */
  _handleMessage(data) {
    try {
      const frame = JSON.parse(data)
      // console.log('[Gateway] 收到消息:', frame)

      if (frame.type === 'res') {
        this._handleResponse(frame)
      } else if (frame.type === 'event') {
        this._handleEvent(frame.event, frame.payload)
      } else if (frame.type === 'stream') {
        this._handleStream(frame)
      } else {
        console.warn('[Gateway] 未知消息类型:', frame.type)
      }
    } catch (error) {
      console.error('[Gateway] 解析消息失败:', error, data)
    }
  }

  /**
   * 处理响应
   */
  _handleResponse(frame) {
    const { id, ok, payload, error } = frame
    const pending = this.pendingRequests.get(id)

    if (pending) {
      if (ok) {
        pending.resolve(payload)
      } else {
        pending.reject(this._normalizeGatewayError(error))
      }
      this.pendingRequests.delete(id)
    } else {
      console.warn('[Gateway] 收到未知请求的响应:', id)
    }
  }

  /**
   * 处理事件
   */
  _handleEvent(eventName, payload) {
    // 特殊处理 connect.challenge 事件
    if (eventName === 'connect.challenge') {
      this._handleConnectChallenge(payload)
      return
    }

    console.log(`[Gateway] 收到事件 [${eventName}]:`, payload)

    const handlers = this.eventHandlers.get(eventName)
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(payload)
        } catch (error) {
          console.error(`[Gateway] 事件处理器错误 [${eventName}]:`, error)
        }
      }
    }

    // 同时通知通配符监听器
    const wildcardHandlers = this.eventHandlers.get('*')
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        try {
          handler(eventName, payload)
        } catch (error) {
          console.error('[Gateway] 通配符事件处理器错误:', error)
        }
      }
    }
  }

  /**
   * 处理流式数据
   */
  _handleStream(frame) {
    const { id, chunk, done, error } = frame

    // 查找是否有对应的流处理器
    const pending = this.pendingRequests.get(id)
    if (pending && pending.onStream) {
      if (error) {
        pending.onStream({ error: this._normalizeGatewayError(error) })
        this.pendingRequests.delete(id)
      } else if (done) {
        pending.onStream({ done: true })
        this.pendingRequests.delete(id)
      } else {
        pending.onStream({ chunk })
      }
    }
  }

  /**
   * 规范化 Gateway 错误对象，保留 code/details，避免 [object Object]
   */
  _normalizeGatewayError(error) {
    if (!error) return new Error('请求失败')

    if (error instanceof Error) return error

    if (typeof error === 'string') {
      return new Error(error)
    }

    if (typeof error === 'object') {
      const rawMessage = error.message ?? error.error ?? error.reason
      let message = ''
      if (typeof rawMessage === 'string') {
        message = rawMessage
      } else if (rawMessage !== undefined) {
        try {
          message = JSON.stringify(rawMessage)
        } catch {
          message = String(rawMessage)
        }
      } else {
        try {
          message = JSON.stringify(error)
        } catch {
          message = String(error)
        }
      }
      const err = new Error(message || '请求失败')
      if (error.code) err.code = error.code
      if (error.details) err.details = error.details
      if (error.data) err.data = error.data
      err.raw = error
      return err
    }

    return new Error(String(error))
  }

  // ============================================================================
  // API 调用
  // ============================================================================

  /**
   * 调用 Gateway 方法
   * @param {string} method - 方法名（如 'chat.send', 'config.get'）
   * @param {Object} params - 参数
   * @param {Object} options - 选项（timeout 等）
   * @returns {Promise<any>} 响应结果
   */
  async call(method, params = {}, options = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('未连接到 Gateway')
    }

    const id = `req-${++this.requestId}`
    const timeout = options.timeout || REQUEST_TIMEOUT

    return new Promise((resolve, reject) => {
      // 设置超时
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`请求超时: ${method}`))
      }, timeout)

      // 存储待处理请求
      this.pendingRequests.set(id, {
        resolve: (response) => {
          clearTimeout(timeoutId)
          resolve(response)
        },
        reject: (error) => {
          clearTimeout(timeoutId)
          reject(error)
        },
        onStream: options.onStream, // 流式回调
      })

      // 发送请求
      const payload = {
        type: 'req',
        id,
        method,
        params,
      }

      // console.log(`[Gateway] 发送请求 [${method}]:`, payload)
      this.ws.send(JSON.stringify(payload))
    })
  }

  /**
   * 流式调用（用于 chat 等需要流式响应的场景）
   * @param {string} method - 方法名
   * @param {Object} params - 参数
   * @param {Function} onChunk - 收到数据块的回调
   * @param {Object} options - 选项
   */
  async callStream(method, params = {}, onChunk, options = {}) {
    return this.call(method, params, {
      ...options,
      onStream: onChunk,
    })
  }

  // ============================================================================
  // 事件监听
  // ============================================================================

  /**
   * 监听事件
   * @param {string} event - 事件名（如 'agent', 'chat', 'presence'）或 '*' 监听所有事件
   * @param {Function} handler - 事件处理器
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event).add(handler)
  }

  /**
   * 移除事件监听
   * @param {string} event - 事件名
   * @param {Function} handler - 事件处理器
   */
  off(event, handler) {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.delete(handler)
      if (handlers.size === 0) {
        this.eventHandlers.delete(event)
      }
    }
  }

  /**
   * 移除所有事件监听
   * @param {string} event - 事件名（可选，不传则移除所有）
   */
  offAll(event) {
    if (event) {
      this.eventHandlers.delete(event)
    } else {
      this.eventHandlers.clear()
    }
  }

  // ============================================================================
  // 状态管理
  // ============================================================================

  /**
   * 设置连接状态并通知监听器
   */
  _setState(state) {
    if (this.state !== state) {
      this.state = state
      console.log(`[Gateway] 状态变更: ${state}`)

      for (const listener of this.stateListeners) {
        try {
          listener(state)
        } catch (error) {
          console.error('[Gateway] 状态监听器错误:', error)
        }
      }
    }
  }

  /**
   * 监听连接状态变化
   * @param {Function} listener - 状态变化监听器
   * @returns {Function} 取消监听函数
   */
  onStateChange(listener) {
    this.stateListeners.add(listener)
    // 立即通知当前状态
    listener(this.state)

    return () => {
      this.stateListeners.delete(listener)
    }
  }

  /**
   * 获取当前连接状态
   */
  getState() {
    return this.state
  }

  /**
   * 是否已连接
   */
  isConnected() {
    return this.state === ConnectionState.CONNECTED
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  /**
   * 更新客户端信息
   */
  setClientInfo(clientInfo) {
    this.clientInfo = { ...this.clientInfo, ...clientInfo }
  }

  /**
   * 设置重连配置
   */
  setReconnectConfig(maxAttempts) {
    this.maxReconnectAttempts = maxAttempts
  }
}

// ============================================================================
// 单例管理
// ============================================================================

let gatewayInstance = null

/**
 * 获取 Gateway 单例实例
 * @param {string} url - Gateway URL
 * @returns {OpenClawGateway}
 */
export function getGateway(url = DEFAULT_URL) {
  if (!gatewayInstance) {
    gatewayInstance = new OpenClawGateway(url)
  }
  return gatewayInstance
}

/**
 * 重置 Gateway 单例（用于测试或重新配置）
 */
export function resetGateway() {
  if (gatewayInstance) {
    gatewayInstance.disconnect()
    gatewayInstance = null
  }
}

export default OpenClawGateway
