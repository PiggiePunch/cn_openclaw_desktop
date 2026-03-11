import React, { useState, useEffect, useRef } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardContent } from './ui/card'
import { Globe, RefreshCw, Camera, X, FileText, Loader2 } from 'lucide-react'

// 🆕 使用新的服务层
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

export default function Browser() {
  const [url, setUrl] = useState('https://www.google.com')
  const [currentUrl, setCurrentUrl] = useState('')
  const [snapshot, setSnapshot] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [history, setHistory] = useState([])
  const [consoleOpen, setConsoleOpen] = useState(false)
  const [consoleOutput, setConsoleOutput] = useState([])
  const iframeRef = useRef(null)
  const consoleRef = useRef(null)

  // 导航到 URL
  const handleNavigate = async () => {
    if (!url.trim()) return
    setIsLoading(true)
    // 🆕 使用统一 API 服务层
    const result = await api.browser.navigate(url.trim())
    if (result.success) {
      await loadSnapshot()
    } else {
      console.error('导航失败:', result.error)
      addConsole('error', '导航失败: ' + result.error)
      toast.error('导航失败', result.error)
    }
    setIsLoading(false)
  }

  // 加载页面快照
  const loadSnapshot = async () => {
    // 🆕 使用统一 API 服务层
    const result = await api.browser.snapshot()
    if (result.success) {
      setSnapshot(result.data)
      setCurrentUrl(result.data?.url)
      addConsole('info', `已加载: ${result.data?.title}`)
    } else {
      console.error('获取快照失败:', result.error)
      addConsole('error', '获取快照失败: ' + result.error)
    }
  }

  // 点击元素
  const handleClick = async (selector) => {
    // 🆕 使用统一 API 服务层
    const result = await api.browser.click(selector)
    if (result.success) {
      addConsole('info', `已点击: ${selector}`)
      await loadSnapshot()
    } else {
      addConsole('error', `点击失败: ${result.error}`)
    }
  }

  // 填写表单
  const handleFill = async (selector, value) => {
    // 🆕 使用统一 API 服务层
    const result = await api.browser.fill(selector, value)
    if (result.success) {
      addConsole('info', `已填写: ${selector} = ${value}`)
    } else {
      addConsole('error', `填写失败: ${result.error}`)
    }
  }

  // 执行 JavaScript
  const handleEvaluate = async (script) => {
    // 🆕 使用统一 API 服务层
    const result = await api.browser.evaluate(script)
    if (result.success) {
      addConsole('success', `结果: ${result.data}`)
      await loadSnapshot()
    } else {
      addConsole('error', `执行失败: ${result.error}`)
    }
  }

  // 截图
  const handleScreenshot = async () => {
    // 🆕 使用统一 API 服务层
    const result = await api.browser.screenshot()
    if (result.success) {
      // 可以在这里处理截图数据
      addConsole('info', '截图已保存')
      // 打开新标签页显示截图
      const win = window.open()
      win.document.write(`<img src="data:image/png;base64,${result.data}" />`)
    } else {
      addConsole('error', `截图失败: ${result.error}`)
      toast.error('截图失败', result.error)
    }
  }

  // 关闭浏览器
  const handleClose = async () => {
    // 🆕 使用统一 API 服务层
    const result = await api.browser.close()
    if (result.success) {
      setSnapshot(null)
      setCurrentUrl('')
      addConsole('info', '浏览器已关闭')
    } else {
      addConsole('error', `关闭失败: ${result.error}`)
    }
  }

  // 添加控制台输出
  const addConsole = (type, message) => {
    const timestamp = new Date().toLocaleTimeString()
    setConsoleOutput(prev => [...prev, { type, message, timestamp }])
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight
    }
  }

  // 快捷操作
  const quickActions = [
    {
      name: '搜索 Google',
      script: (query) => `window.location.href = 'https://www.google.com/search?q=${encodeURIComponent(query)}'`,
    },
    {
      name: '滚动到底部',
      script: () => 'window.scrollTo(0, document.body.scrollHeight)',
    },
    {
      name: '滚动到顶部',
      script: () => 'window.scrollTo(0, 0)',
    },
    {
      name: '获取所有链接',
      script: () => 'Array.from(document.querySelectorAll("a")).map(a => a.href).join("\\n")',
    },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* 工具栏 */}
      <div className="p-4 border-b border-border-subtle bg-white sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-tertiary" />
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleNavigate()}
              className="flex h-11 w-full rounded-lg border border-border bg-white px-3 py-2 pl-10 text-sm ring-offset-background placeholder:text-foreground-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all duration-normal ease-apple"
              placeholder="输入 URL..."
            />
          </div>
          <Button
            onClick={handleNavigate}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                加载中...
              </>
            ) : (
              <>
                <Globe className="w-4 h-4" />
                导航
              </>
            )}
          </Button>
          <Button
            onClick={loadSnapshot}
            variant="outline"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            刷新
          </Button>
          <Button
            onClick={handleScreenshot}
            variant="outline"
          >
            <Camera className="w-4 h-4 mr-2" />
            截图
          </Button>
          <Button
            onClick={handleClose}
            variant="outline"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <X className="w-4 h-4 mr-2" />
            关闭
          </Button>
        </div>

        {/* 快捷操作 */}
        <div className="flex items-center gap-2 mt-3">
          {quickActions.map((action, index) => (
            <Button
              key={index}
              onClick={() => handleEvaluate(action.script(url))}
              variant="secondary"
              size="sm"
              className="transition-all duration-normal ease-apple"
            >
              {action.name}
            </Button>
          ))}
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 页面预览 */}
        <div className="flex-1 bg-surface p-6">
          {snapshot ? (
            <div className="bg-white rounded-xl shadow-glass h-full overflow-hidden flex flex-col border border-border-subtle">
              {/* 页面标题栏 */}
              <div className="p-4 border-b border-border-subtle bg-surface-elevated">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium truncate block">{snapshot.title}</span>
                    <span className="text-xs text-foreground-tertiary truncate block">{currentUrl}</span>
                  </div>
                </div>
              </div>

              {/* 页面内容 */}
              <div className="flex-1 overflow-auto p-4">
                <pre className="text-sm text-foreground whitespace-pre-wrap font-mono">
                  {snapshot.content}
                </pre>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-foreground-secondary">
              <div className="text-center">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mx-auto mb-6">
                  <Globe className="w-12 h-12 text-primary" />
                </div>
                <p className="text-lg font-medium text-foreground mb-2">浏览器自动化工具</p>
                <p className="text-sm text-foreground-tertiary">输入 URL 并点击导航开始使用</p>
              </div>
            </div>
          )}
        </div>

        {/* 侧边栏 */}
        <div className="w-96 bg-white border-l border-border-subtle flex flex-col">
          {/* 控制台 */}
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b border-border-subtle flex items-center justify-between bg-surface-elevated">
              <span className="font-medium">控制台</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConsoleOutput([])}
                className="text-foreground-tertiary hover:text-foreground"
              >
                清空
              </Button>
            </div>
            <div
              ref={consoleRef}
              className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs bg-surface"
            >
              {consoleOutput.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-xl bg-surface-elevated flex items-center justify-center mx-auto mb-3">
                    <FileText className="w-6 h-6 text-foreground-tertiary" />
                  </div>
                  <p className="text-foreground-tertiary">等待操作...</p>
                </div>
              ) : (
                consoleOutput.map((log, index) => (
                  <div key={index} className="flex gap-2 p-2 rounded-lg bg-white border border-border-subtle">
                    <span className="text-foreground-tertiary">{log.timestamp}</span>
                    <span className={
                      log.type === 'error' ? 'text-destructive' :
                      log.type === 'success' ? 'text-green-600' :
                      'text-primary'
                    }>
                      [{log.type}]
                    </span>
                    <span className="flex-1 break-all text-foreground-secondary">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 常用操作 */}
          <div className="p-4 border-t border-border-subtle bg-surface-elevated">
            <h4 className="font-medium text-sm mb-3">常用操作</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-foreground-tertiary mb-1.5">点击元素</label>
                <Input
                  placeholder="选择器，如 #submit"
                  className="text-sm h-10"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleClick(e.target.value)
                    }
                  }}
                />
              </div>
              <div>
                <label className="block text-xs text-foreground-tertiary mb-1.5">填写表单</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="选择器"
                    className="flex-1 text-sm h-10"
                    id="fill-selector"
                  />
                  <Input
                    placeholder="值"
                    className="flex-1 text-sm h-10"
                    id="fill-value"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const selector = document.getElementById('fill-selector').value
                        const value = document.getElementById('fill-value').value
                        handleFill(selector, value)
                      }
                    }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-foreground-tertiary mb-1.5">执行脚本</label>
                <Input
                  placeholder="JavaScript 代码"
                  className="text-sm font-mono h-10"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleEvaluate(e.target.value)
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
