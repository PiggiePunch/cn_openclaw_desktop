import React from 'react'
import { useToast } from '@/hooks/useToast'
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastTitle,
} from './toast'
import { cn } from '@/lib/utils'
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react'

// 根据类型获取图标
const getIcon = (variant) => {
  switch (variant) {
    case 'success':
      return <CheckCircle className="w-5 h-5 text-green-600" />
    case 'destructive':
      return <XCircle className="w-5 h-5 text-red-600" />
    case 'warning':
      return <AlertTriangle className="w-5 h-5 text-yellow-600" />
    case 'info':
      return <Info className="w-5 h-5 text-blue-600" />
    default:
      return null
  }
}

/**
 * Toast 通知容器组件
 * 固定在右上角，显示所有活跃的 toast 通知
 */
export function Toaster() {
  const { toasts } = useToast()

  return (
    <div
      className={cn(
        "fixed top-0 right-0 z-[100] flex flex-col gap-2 w-full max-w-sm p-4",
        "pointer-events-none"
      )}
    >
      {toasts.map(({ id, title, description, variant, action, onOpenChange, ...props }) => {
        // onOpenChange 由 useToast 内部管理，这里忽略该属性避免传递给原生 DOM
        const icon = getIcon(variant)
        return (
          <Toast
            key={id}
            variant={variant}
            className="pointer-events-auto animate-in slide-in-from-top-full"
            {...props}
          >
            <div className="flex items-start gap-3">
              {icon && (
                <div className="shrink-0 mt-0.5">
                  {icon}
                </div>
              )}
              <div className="grid gap-1 flex-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
    </div>
  )
}

export default Toaster
