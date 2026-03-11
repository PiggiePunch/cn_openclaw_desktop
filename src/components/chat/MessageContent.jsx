/**
 * MessageContent - 消息 Markdown 渲染组件
 * 支持 GFM、代码高亮、复制按钮
 */
import React, { useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Copy, Check } from 'lucide-react'

/**
 * 代码块组件（带复制按钮）
 */
function CodeBlock({ children, language }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(children)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('复制失败:', err)
    }
  }, [children])

  return (
    <div className="code-block-wrapper group relative">
      {language && (
        <span className="absolute top-2 left-3 text-xs text-gray-400 font-mono">
          {language}
        </span>
      )}
      <button
        onClick={handleCopy}
        className="copy-button absolute top-2 right-2 p-1.5 rounded-md
                   bg-gray-700 hover:bg-gray-600 text-gray-300
                   opacity-0 group-hover:opacity-100 transition-opacity"
        title={copied ? '已复制' : '复制代码'}
      >
        {copied ? (
          <Check className="w-4 h-4 text-green-400" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </button>
      <pre className="!mt-0 !pt-8">
        <code>{children}</code>
      </pre>
    </div>
  )
}

/**
 * 消息内容组件
 */
export function MessageContent({ content, isStreaming = false }) {
  if (!content) return null

  return (
    <div className={`message-content ${isStreaming ? 'streaming' : ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // 代码块
          pre: ({ children, ...props }) => {
            // 检查是否是代码块（有 className 说明是高亮代码）
            const codeElement = children?.props?.children
            const className = children?.props?.className || ''
            const match = /language-(\w+)/.exec(className)
            const language = match ? match[1] : null

            // 如果是代码块，包装一下
            if (className.includes('language-')) {
              return (
                <CodeBlock language={language}>
                  {typeof codeElement === 'string' ? codeElement : children}
                </CodeBlock>
              )
            }

            return <pre {...props}>{children}</pre>
          },
          // 内联代码
          code: ({ inline, className, children, ...props }) => {
            if (inline) {
              return (
                <code className="inline-code" {...props}>
                  {children}
                </code>
              )
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            )
          },
          // 表格
          table: ({ children }) => (
            <div className="table-wrapper overflow-x-auto my-3">
              <table className="markdown-table">{children}</table>
            </div>
          ),
          // 链接
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-link"
            >
              {children}
            </a>
          ),
          // 标题
          h1: ({ children }) => <h1 className="text-2xl font-bold my-4">{children}</h1>,
          h2: ({ children }) => <h2 className="text-xl font-bold my-3">{children}</h2>,
          h3: ({ children }) => <h3 className="text-lg font-semibold my-2">{children}</h3>,
          // 列表
          ul: ({ children }) => <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>,
          // 引用
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/30 pl-4 my-2 text-gray-600 italic">
              {children}
            </blockquote>
          ),
          // 段落
          p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export default MessageContent
