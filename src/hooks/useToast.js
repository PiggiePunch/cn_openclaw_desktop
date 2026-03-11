import * as React from "react"

// ============================================================================
// Toast 通知系统 - 状态管理 Hook
// ============================================================================

// 配置常量
const TOAST_LIMIT = 5
const TOAST_DURATION = 5000 // 5秒自动关闭

// 生成唯一 ID
let toastCount = 0
function genId() {
  return `toast-${++toastCount}`
}

// 模块级状态存储（无需 Provider）
const toastTimeouts = new Map()
const listeners = []
let memoryState = { toasts: [] }

// Reducer 函数
function reducer(state, action) {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }
    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }
    case "DISMISS_TOAST": {
      const { toastId } = action
      if (toastId) {
        removeFromQueue(toastId)
        return {
          ...state,
          toasts: state.toasts.filter((t) => t.id !== toastId),
        }
      }
      // 移除所有 - 确保清除所有超时
      state.toasts.forEach((t) => removeFromQueue(t.id))
      return { ...state, toasts: [] }
    }
    default:
      return state
  }
}

// 通知所有监听器
function dispatch(action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => listener(memoryState))
}

// 从关闭队列中移除
function removeFromQueue(toastId) {
  if (toastTimeouts.has(toastId)) {
    clearTimeout(toastTimeouts.get(toastId))
    toastTimeouts.delete(toastId)
  }
}

// 核心 toast 函数
function toast(props) {
  const id = genId()

  const update = (props) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    })

  const dismiss = () => {
    dispatch({ type: "DISMISS_TOAST", toastId: id })
  }

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  // 自动关闭
  const duration = props.duration ?? TOAST_DURATION
  if (duration !== Infinity) {
    const timeout = setTimeout(() => {
      dismiss()
    }, duration)
    toastTimeouts.set(id, timeout)
  }

  return { id, dismiss, update }
}

// 便捷方法
toast.success = (title, description, options = {}) =>
  toast({ title, description, variant: "success", ...options })

toast.error = (title, description, options = {}) =>
  toast({ title, description, variant: "destructive", ...options })

toast.warning = (title, description, options = {}) =>
  toast({ title, description, variant: "warning", ...options })

toast.info = (title, description, options = {}) =>
  toast({ title, description, variant: "info", ...options })

// Hook
function useToast() {
  const [state, setState] = React.useState(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [])

  return {
    ...state,
    toast,
    dismiss: (toastId) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

export { useToast, toast }
