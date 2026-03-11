/**
 * Tauri 事件监听 Hook
 *
 * 提供安全的事件监听，自动清理，防止内存泄漏
 *
 * @example
 * // 单个事件
 * useTauriEvent('chat:chunk', (event) => {
 *   console.log(event.payload)
 * })
 *
 * // 多个事件
 * useTauriEvents({
 *   'chat:chunk': handleChunk,
 *   'session-updated': handleSessionUpdate,
 * }, [dependency])
 */

import { useEffect, useRef, useCallback } from 'react'
import { listen } from '@tauri-apps/api/event'

/**
 * 单个事件监听 Hook
 *
 * @param {string} eventName - 事件名称
 * @param {function} handler - 事件处理函数
 * @param {array} deps - 依赖项数组
 */
export function useTauriEvent(eventName, handler, deps = []) {
  const savedHandler = useRef(handler)

  // 更新保存的 handler
  useEffect(() => {
    savedHandler.current = handler
  }, [handler])

  useEffect(() => {
    let unlisten = null
    let mounted = true

    const setupListener = async () => {
      try {
        unlisten = await listen(eventName, (event) => {
          // 只有组件仍然挂载时才调用 handler
          if (mounted && savedHandler.current) {
            try {
              savedHandler.current(event)
            } catch (err) {
              console.error(`[useTauriEvent] 处理事件 ${eventName} 时出错:`, err)
            }
          }
        })
      } catch (error) {
        console.error(`[useTauriEvent] 监听事件 ${eventName} 失败:`, error)
      }
    }

    setupListener()

    return () => {
      mounted = false
      if (unlisten) {
        unlisten()
      }
    }
  }, [eventName, ...deps])
}

/**
 * 多个事件监听 Hook
 *
 * @param {object} events - 事件名称到处理函数的映射
 * @param {array} deps - 依赖项数组
 *
 * @example
 * useTauriEvents({
 *   'chat:chunk': (e) => setChunk(e.payload),
 *   'chat:complete': (e) => setLoading(false),
 * }, [sessionId])
 */
export function useTauriEvents(events, deps = []) {
  const savedHandlers = useRef(events)

  // 更新保存的 handlers
  useEffect(() => {
    savedHandlers.current = events
  }, [events])

  useEffect(() => {
    const unlisteners = []
    let mounted = true

    const setupListeners = async () => {
      for (const [eventName, handler] of Object.entries(events)) {
        try {
          const unlisten = await listen(eventName, (event) => {
            // 只有组件仍然挂载时才调用 handler
            if (mounted && savedHandlers.current[eventName]) {
              try {
                savedHandlers.current[eventName](event)
              } catch (err) {
                console.error(`[useTauriEvents] 处理事件 ${eventName} 时出错:`, err)
              }
            }
          })
          unlisteners.push(unlisten)
        } catch (error) {
          console.error(`[useTauriEvents] 监听事件 ${eventName} 失败:`, error)
        }
      }
    }

    setupListeners()

    return () => {
      mounted = false
      unlisteners.forEach((unlisten) => unlisten())
    }
  }, [Object.keys(events).join(','), ...deps])
}

/**
 * 创建可手动控制的事件监听器
 *
 * @param {string} eventName - 事件名称
 * @returns {[function, function]} [subscribe, unsubscribe]
 *
 * @example
 * const [subscribe, unsubscribe] = useTauriEventControl('chat:chunk')
 *
 * useEffect(() => {
 *   subscribe((event) => {
 *     console.log(event.payload)
 *   })
 *   return () => unsubscribe()
 * }, [])
 */
export function useTauriEventControl(eventName) {
  const unlistenRef = useRef(null)
  const handlerRef = useRef(null)

  const subscribe = useCallback(async (handler) => {
    // 如果已有监听器，先移除
    if (unlistenRef.current) {
      await unlistenRef.current()
    }

    handlerRef.current = handler
    unlistenRef.current = await listen(eventName, (event) => {
      if (handlerRef.current) {
        try {
          handlerRef.current(event)
        } catch (err) {
          console.error(`[useTauriEventControl] 处理事件 ${eventName} 时出错:`, err)
        }
      }
    })
  }, [eventName])

  const unsubscribe = useCallback(async () => {
    if (unlistenRef.current) {
      await unlistenRef.current()
      unlistenRef.current = null
      handlerRef.current = null
    }
  }, [])

  // 组件卸载时自动清理
  useEffect(() => {
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current()
      }
    }
  }, [])

  return [subscribe, unsubscribe]
}

export default useTauriEvent
