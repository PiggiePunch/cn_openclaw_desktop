import React from 'react'
import { Bot } from 'lucide-react'
import { Button } from './ui/button'

export default function NoAgentPrompt({ onCreateAgent, onCreateFromTemplate }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-surface p-6">
      <div className="text-center max-w-md">
        {/* 图标 */}
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-surface-elevated border border-border-subtle flex items-center justify-center">
          <Bot className="w-8 h-8 text-foreground-secondary" />
        </div>

        {/* 标题 */}
        <h2 className="text-xl font-semibold mb-2 text-foreground">
          请先选择或创建智能体
        </h2>

        {/* 说明 */}
        <p className="text-sm text-foreground-secondary mb-6">
          智能体包含模型配置、系统提示词和工具权限，是进行对话的必要条件。
        </p>

        {/* 操作按钮 */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={onCreateAgent} className="min-w-[140px]">
            创建智能体
          </Button>
          {onCreateFromTemplate && (
            <Button
              variant="outline"
              onClick={onCreateFromTemplate}
              className="min-w-[140px]"
            >
              从模板创建
            </Button>
          )}
        </div>

        {/* 提示信息 */}
        <p className="text-xs text-foreground-tertiary mt-6">
          💡 提示：创建智能体后，可以通过顶部的选择器快速切换
        </p>
      </div>
    </div>
  )
}
