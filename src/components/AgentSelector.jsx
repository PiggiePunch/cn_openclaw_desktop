import React from 'react'
import { Bot } from 'lucide-react'

const AI_PROVIDERS_BASE = [
  { id: 'qwen', name: '通义千问' },
  { id: 'deepseek', name: 'DeepSeek' },
  { id: 'ernie', name: '文心一言' },
  { id: 'zhipu', name: '智谱 GLM' },
  { id: 'moonshot', name: '月之暗面' },
  { id: 'doubao', name: '豆包' },
]

export default function AgentSelector({ agents, selectedAgent, onSelectAgent, onCreateAgent }) {
  const selectedProvider = AI_PROVIDERS_BASE.find(p => p.id === selectedAgent?.provider)

  const handleChange = (e) => {
    const value = e.target.value
    if (value === 'none') {
      onSelectAgent(null)
    } else if (value === 'create') {
      onCreateAgent?.()
    } else {
      const agent = agents.find(a => a.id === value)
      onSelectAgent(agent || null)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {/* 智能体下拉选择器 */}
      <select
        value={selectedAgent?.id || 'none'}
        onChange={handleChange}
        className="border border-border-subtle rounded-md px-3 py-1.5 bg-surface text-foreground focus:ring-2 focus:ring-primary focus:border-transparent cursor-pointer text-sm md:text-base"
      >
        <option value="none">+ 切换智能体</option>
        {agents.map(agent => (
          <option key={agent.id} value={agent.id}>
            {agent.avatar} {agent.name}
          </option>
        ))}
        <option value="create">+ 创建新智能体</option>
      </select>

      {/* 智能体配置信息 */}
      {selectedAgent && (
        <div className="hidden md:flex items-center gap-2">
          <span className="text-xs text-foreground-secondary px-2 py-1 bg-surface-elevated rounded-md">
            {selectedProvider?.name} · {selectedAgent.model}
          </span>
          <span className="text-xs text-foreground-secondary px-2 py-1 bg-surface-elevated rounded-md">
            温度: {selectedAgent.temperature}
          </span>
        </div>
      )}
    </div>
  )
}
