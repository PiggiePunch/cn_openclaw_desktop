import React from "react"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

export function LoadingSpinner({ className, size = "default" }) {
  const sizeClasses = {
    sm: "h-4 w-4",
    default: "h-6 w-6",
    lg: "h-8 w-8",
    xl: "h-12 w-12",
  }

  return (
    <Loader2
      className={cn(
        "animate-spin text-primary",
        sizeClasses[size],
        className
      )}
    />
  )
}

export function LoadingScreen({
  message = "加载中...",
  className,
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 p-8",
        className
      )}
    >
      <LoadingSpinner size="xl" />
      {message && (
        <p className="text-sm text-foreground-secondary">{message}</p>
      )}
    </div>
  )
}

export function LoadingDots({ className }) {
  return (
    <div className={cn("loading-dots flex gap-1", className)}>
      <span />
      <span />
      <span />
    </div>
  )
}

export function LoadingSkeleton({
  className,
  count = 1,
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-4 w-full rounded loading-skeleton"
          style={{
            width: i === count - 1 ? "60%" : "100%",
          }}
        />
      ))}
    </div>
  )
}

export function PageLoading({ message = "加载中..." }) {
  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <LoadingScreen message={message} />
    </div>
  )
}

// 内联加载器 - 用于按钮内
export function InlineLoader({ className }) {
  return (
    <LoadingSpinner className={cn("h-4 w-4", className)} size="sm" />
  )
}

// 全屏覆盖加载器
export function FullScreenLoader({ message = "加载中..." }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-8 shadow-lg">
        <LoadingSpinner size="xl" />
        {message && (
          <p className="text-sm text-foreground-secondary">{message}</p>
        )}
      </div>
    </div>
  )
}

// 带边框的加载器
export function BorderedLoader({ className }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <LoadingSpinner size="sm" />
      <span className="text-sm text-foreground-secondary">处理中...</span>
    </div>
  )
}
