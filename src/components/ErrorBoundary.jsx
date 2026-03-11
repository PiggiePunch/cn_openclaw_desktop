import { Component } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'

/**
 * 全局错误边界组件
 * 捕获 React 渲染过程中的未处理异常，防止整个应用崩溃
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error) {
    // 更新 state 以便下一次渲染显示降级 UI
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    // 记录错误信息
    console.error('[ErrorBoundary] 捕获到未处理的错误:', error)
    console.error('[ErrorBoundary] 错误堆栈:', errorInfo?.componentStack)

    this.setState({
      errorInfo,
    })

    // 可以在这里上报错误到日志服务
    // TODO: 集成错误上报
  }

  handleReload = () => {
    // 重置状态并重新渲染
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
    // 刷新页面
    window.location.reload()
  }

  handleReset = () => {
    // 仅重置状态，不刷新页面
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  render() {
    if (this.state.hasError) {
      // 自定义降级 UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background p-8">
          <div className="max-w-md w-full space-y-6 text-center">
            {/* 图标 */}
            <div className="flex justify-center">
              <div className="rounded-full bg-destructive/10 p-4">
                <AlertTriangle className="h-12 w-12 text-destructive" />
              </div>
            </div>

            {/* 标题 */}
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">
                出了一些问题
              </h1>
              <p className="text-muted-foreground">
                应用遇到了一个意外错误。请尝试刷新页面或重置应用状态。
              </p>
            </div>

            {/* 错误详情（开发模式） */}
            {import.meta.env.DEV && this.state.error && (
              <div className="bg-muted/50 rounded-lg p-4 text-left">
                <p className="text-sm font-medium text-destructive mb-2">
                  错误信息：
                </p>
                <pre className="text-xs text-muted-foreground overflow-auto max-h-32 whitespace-pre-wrap">
                  {this.state.error.message || String(this.state.error)}
                </pre>
                {this.state.errorInfo?.componentStack && (
                  <>
                    <p className="text-sm font-medium text-destructive mt-3 mb-2">
                      组件堆栈：
                    </p>
                    <pre className="text-xs text-muted-foreground overflow-auto max-h-32 whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </>
                )}
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                variant="outline"
                onClick={this.handleReset}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                重置状态
              </Button>
              <Button
                onClick={this.handleReload}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                刷新页面
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
