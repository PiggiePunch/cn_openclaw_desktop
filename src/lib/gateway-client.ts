/**
 * OpenClaw Gateway WebSocket 客户端
 *
 * 功能：
 * - 连接到 ws://127.0.0.1:18789
 * - 协议版本 3
 * - 支持 req/res/event 帧格式
 * - Token 认证
 */

import { toast } from '@/hooks/useToast';

// WebSocket 连接配置
const GATEWAY_URL = 'ws://127.0.0.1:18789';
const PROTOCOL_VERSION = 3;
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

// 消息类型
type MessageType = 'req' | 'res' | 'event';

// 帧格式
interface GatewayFrame {
  type: MessageType;
  id: string;
  method?: string;
  params?: any;
  payload?: any;
  error?: any;
}

// 回调类型
type MessageHandler = (frame: GatewayFrame) => void;
type ConnectHandler = () => void;
type DisconnectHandler = (error?: Error) => void;

/**
 * Gateway WebSocket 客户端类
 */
class GatewayClient {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private isManualClose = false;
  private pendingRequests: Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: number;
  }> = new Map();
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private eventHandlers: Map<string, MessageHandler[]> = new Map();
  private connectHandlers: ConnectHandler[] = [];
  private disconnectHandlers: DisconnectHandler[] = [];
  private connectionState: 'disconnected' | 'connecting' | 'connected' = 'disconnected';

  /**
   * 设置认证 Token
   */
  setToken(token: string | null) {
    this.token = token;
  }

  /**
   * 获取连接状态
   */
  getConnectionState() {
    return this.connectionState;
  }

  /**
   * 检查是否已连接
   */
  isConnected() {
    return this.connectionState === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * 连接到 Gateway
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected()) {
        resolve();
        return;
      }

      if (this.connectionState === 'connecting') {
        // 等待连接完成
        setTimeout(() => {
          if (this.isConnected()) {
            resolve();
          } else {
            reject(new Error('连接失败'));
          }
        }, 1000);
        return;
      }

      this.isManualClose = false;
      this.connectionState = 'connecting';

      try {
        this.ws = new WebSocket(GATEWAY_URL);

        this.ws.onopen = () => {
          console.log('[Gateway] WebSocket 连接已建立');
          this.connectionState = 'connected';
          this.reconnectAttempts = 0;

          // 发送认证
          if (this.token) {
            this.sendFrame({
              type: 'req',
              id: 'auth',
              method: 'auth',
              params: { token: this.token }
            });
          }

          // 触发连接回调
          this.connectHandlers.forEach(handler => handler());

          // 解决 Promise
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const frame: GatewayFrame = JSON.parse(event.data);
            this.handleMessage(frame);
          } catch (e) {
            console.error('[Gateway] 解析消息失败:', e);
          }
        };

        this.ws.onclose = (event) => {
          console.log('[Gateway] WebSocket 连接关闭', event.code, event.reason);
          this.connectionState = 'disconnected';

          // 清理待处理的请求
          this.pendingRequests.forEach(({ reject }) => {
            reject(new Error('连接已关闭'));
          });
          this.pendingRequests.clear();

          // 触发断开回调
          this.disconnectHandlers.forEach(handler => handler());

          // 自动重连
          if (!this.isManualClose && this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('[Gateway] WebSocket 错误:', error);
          if (this.connectionState === 'connecting') {
            reject(error);
          }
        };

      } catch (error) {
        this.connectionState = 'disconnected';
        reject(error);
      }
    });
  }

  /**
   * 断开连接
   */
  disconnect() {
    this.isManualClose = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectionState = 'disconnected';
  }

  /**
   * 调度重连
   */
  private scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = RECONNECT_DELAY * Math.min(this.reconnectAttempts, 5);

    console.log(`[Gateway] ${delay / 1000}秒后尝试重连 (${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

    setTimeout(() => {
      if (!this.isManualClose && this.connectionState !== 'connected') {
        this.connect().catch(error => {
          console.error('[Gateway] 重连失败:', error);
        });
      }
    }, delay);
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(frame: GatewayFrame) {
    // 处理响应
    if (frame.type === 'res') {
      const pending = this.pendingRequests.get(frame.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(frame.id);

        if (frame.error) {
          pending.reject(new Error(frame.error.message || '请求失败'));
        } else {
          pending.resolve(frame.payload);
        }
      }
    }

    // 处理事件
    if (frame.type === 'event') {
      const handlers = this.eventHandlers.get(frame.method || '');
      if (handlers) {
        handlers.forEach(handler => handler(frame));
      }
    }

    // 处理方法消息
    if (frame.method) {
      const handlers = this.messageHandlers.get(frame.method);
      if (handlers) {
        handlers.forEach(handler => handler(frame));
      }
    }
  }

  /**
   * 发送帧
   */
  private sendFrame(frame: GatewayFrame): string {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket 未连接');
    }

    const id = frame.id || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    frame.id = id;

    this.ws.send(JSON.stringify(frame));
    return id;
  }

  /**
   * 发送请求
   */
  async request<T = any>(method: string, params?: any, timeout = 30000): Promise<T> {
    // 确保已连接
    if (!this.isConnected()) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      const id = this.sendFrame({
        type: 'req',
        id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        method,
        params
      });

      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`请求超时: ${method}`));
      }, timeout);

      this.pendingRequests.set(id, { resolve: resolve as any, reject, timeout: timer });
    });
  }

  /**
   * 注册消息处理器
   */
  on(method: string, handler: MessageHandler) {
    const handlers = this.messageHandlers.get(method) || [];
    handlers.push(handler);
    this.messageHandlers.set(method, handlers);

    // 返回取消函数
    return () => {
      const handlers = this.messageHandlers.get(method);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * 注册事件处理器
   */
  onEvent(event: string, handler: MessageHandler) {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);

    // 返回取消函数
    return () => {
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * 注册连接回调
   */
  onConnect(handler: ConnectHandler) {
    this.connectHandlers.push(handler);
    return () => {
      const index = this.connectHandlers.indexOf(handler);
      if (index > -1) {
        this.connectHandlers.splice(index, 1);
      }
    };
  }

  /**
   * 注册断开回调
   */
  onDisconnect(handler: DisconnectHandler) {
    this.disconnectHandlers.push(handler);
    return () => {
      const index = this.disconnectHandlers.indexOf(handler);
      if (index > -1) {
        this.disconnectHandlers.splice(index, 1);
      }
    };
  }
}

// 导出单例
export const gatewayClient = new GatewayClient();

// 导出类
export { GatewayClient };

// 导出类型
export type { GatewayFrame, MessageType };
