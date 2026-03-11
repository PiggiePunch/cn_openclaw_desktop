import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './index.css'

// 🔥 全局未处理 Promise Rejection 捕获
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Global] 未处理的 Promise Rejection:', event.reason)
  // 阻止默认行为（在控制台显示错误但不崩溃）
  event.preventDefault()
})

// 🔥 全局未捕获错误捕获
window.addEventListener('error', (event) => {
  console.error('[Global] 未捕获的错误:', event.error)
  // 允许错误继续传播到 ErrorBoundary
})

// 🔧 移除 StrictMode 避免 useEffect 双重执行（开发模式）
// StrictMode 会导致 useEffect 执行两次，造成会话列表等重复加载
ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
