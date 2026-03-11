import React from 'react'
import { cn } from '@/lib/utils'

export default function PageContainer({
  title,
  description,
  actions,
  children,
  className
}) {
  return (
    <div className={cn("flex-1 flex flex-col min-h-0 bg-background overflow-hidden", className)}>
      {/* 页面头部 - Big Sur 毛玻璃效果 */}
      <header className="flex-shrink-0 glass glass-border">
        <div className="px-6 py-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground tracking-tight">
                {title}
              </h1>
              {description && (
                <p className="text-sm text-foreground-secondary mt-1">
                  {description}
                </p>
              )}
            </div>
            {actions && (
              <div className="flex items-center gap-2">
                {actions}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 页面内容 - 可滚动区域 */}
      <div className="flex-1 overflow-auto p-6">
        {children}
      </div>
    </div>
  )
}
