/**
 * ThinkingBlock - 思考过程展示组件
 * 用于展示 AI 的思考/推理过程
 */
import React, { useState } from 'react'
import { ChevronDown, ChevronRight, Brain } from 'lucide-react'

/**
 * 从内容中提取思考块
 * 支持多种格式：
 * 1. <thinking>...</thinking> 标签
 * 2. <think\>\...\</think\> XML 格式（MiniMax 等模型使用）
 * 3. ```thinking ... ``` 代码块格式
 * 4. ``` ... ``` 无语言标识的代码块（内容为思考过程）
 * 5. 【思考】... 标记
 */
export function extractThinking(content) {
  if (!content || typeof content !== 'string') {
    return { thinking: null, mainContent: content }
  }

  // 匹配 <thinking>...</thinking> 标签
  const htmlThinkingRegex = /<thinking>([\s\S]*?)<\/thinking>/gi
  const htmlMatches = [...content.matchAll(htmlThinkingRegex)]

  // 🔥 匹配 <think\>\...\</think\> XML 格式（MiniMax 等模型使用）
  const xmlThinkingRegex = /<think\\?>([\s\S]*?)<\/think\\?>/gi
  const xmlMatches = [...content.matchAll(xmlThinkingRegex)]

  // 匹配 ```thinking ... ``` 代码块格式
  const codeThinkingRegex = /```thinking\s*([\s\S]*?)```/gi
  const codeThinkingMatches = [...content.matchAll(codeThinkingRegex)]

  // 🔥 匹配 ``` ... ``` 无语言标识的代码块（开头直接换行，内容看起来像思考）
  // 格式：```\n内容\n```
  const plainCodeBlockRegex = /```\s*\n([\s\S]*?)```/gi
  const plainCodeMatches = [...content.matchAll(plainCodeBlockRegex)]

  // 过滤出思考类代码块（内容不包含代码特征，且长度适中）
  const thinkingCodeMatches = plainCodeMatches.filter(match => {
    const blockContent = match[1].trim()
    // 如果内容看起来像代码（包含大量符号或关键字），则不是思考块
    const codeIndicators = /[{}();=]/g
    const codeSymbolCount = (blockContent.match(codeIndicators) || []).length
    const isLikelyCode = codeSymbolCount > 5 || blockContent.includes('function ') || blockContent.includes('const ')
    return !isLikelyCode && blockContent.length > 10
  })

  // 匹配 【思考】... 标记（直到下一个标题或空行）
  const bracketThinkingRegex = /【思考】\s*([\s\S]*?)(?=\n#|\n\n\n|$)/gi
  const bracketMatches = [...content.matchAll(bracketThinkingRegex)]

  const allMatches = [...htmlMatches, ...xmlMatches, ...codeThinkingMatches, ...thinkingCodeMatches, ...bracketMatches]

  if (allMatches.length === 0) {
    return { thinking: null, mainContent: content }
  }

  // 提取所有思考内容
  const thinkingContent = allMatches.map(m => m[1].trim()).filter(Boolean).join('\n\n')

  // 移除思考标签后的主要内容
  let mainContent = content
    .replace(htmlThinkingRegex, '')
    .replace(xmlThinkingRegex, '')
    .replace(codeThinkingRegex, '')
    .replace(plainCodeBlockRegex, (match, content) => {
      // 只移除思考类代码块，保留真正的代码块
      const isThinkingBlock = thinkingCodeMatches.some(m => m[0] === match)
      return isThinkingBlock ? '' : match
    })
    .replace(bracketThinkingRegex, '')
    .trim()

  return {
    thinking: thinkingContent || null,
    mainContent: mainContent || null
  }
}

/**
 * 思考块组件
 */
export function ThinkingBlock({ content, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  if (!content) return null

  return (
    <div className="thinking-block">
      <button
        onClick={() => setExpanded(!expanded)}
        className="thinking-header flex items-center gap-2 w-full text-left
                   text-sm text-gray-500 hover:text-gray-700 py-1"
      >
        <Brain className="w-4 h-4" />
        <span className="font-medium">思考过程</span>
        {expanded ? (
          <ChevronDown className="w-4 h-4 ml-auto" />
        ) : (
          <ChevronRight className="w-4 h-4 ml-auto" />
        )}
      </button>
      {expanded && (
        <div className="thinking-content mt-2 pl-6 pr-4 py-2
                        bg-gray-50/50 rounded-lg text-sm text-gray-600
                        border-l-2 border-gray-300">
          <div className="whitespace-pre-wrap">{content}</div>
        </div>
      )}
    </div>
  )
}

export default ThinkingBlock
