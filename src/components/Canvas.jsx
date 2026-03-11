/**
 * Canvas - Agent 可视化工作区
 *
 * 功能：
 * - Agent 可视化工作区
 * - 支持节点拖拽、连线
 * - 工作流可视化展示
 * - 缩放、平移支持
 *
 * 这是一个轻量级的 Canvas 实现，用于可视化 Agent 工作流
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Badge } from './ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog'
import { Input } from './ui/input'
import { Label } from './ui/label'
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Move,
  Plus,
  Trash2,
  Play,
  Pause,
  Loader2,
  Bot,
  MessageSquare,
  Wrench,
  GitBranch,
  Database,
  RefreshCw,
  Download,
  Upload,
  Grid3X3,
  Settings,
} from 'lucide-react'

import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

/**
 * 节点类型配置
 */
const NODE_TYPES = {
  agent: {
    icon: Bot,
    label: 'Agent',
    color: 'bg-blue-500',
    borderColor: 'border-blue-500',
  },
  input: {
    icon: MessageSquare,
    label: '输入',
    color: 'bg-green-500',
    borderColor: 'border-green-500',
  },
  tool: {
    icon: Wrench,
    label: '工具',
    color: 'bg-orange-500',
    borderColor: 'border-orange-500',
  },
  condition: {
    icon: GitBranch,
    label: '条件',
    color: 'bg-purple-500',
    borderColor: 'border-purple-500',
  },
  output: {
    icon: Database,
    label: '输出',
    color: 'bg-red-500',
    borderColor: 'border-red-500',
  },
}

/**
 * 默认节点数据
 */
const DEFAULT_NODES = [
  { id: 'node-1', type: 'input', x: 100, y: 150, label: '用户输入', data: {} },
  { id: 'node-2', type: 'agent', x: 350, y: 150, label: 'AI Agent', data: { model: 'gpt-4' } },
  { id: 'node-3', type: 'tool', x: 600, y: 80, label: '搜索工具', data: { name: 'web_search' } },
  { id: 'node-4', type: 'output', x: 600, y: 220, label: '输出响应', data: {} },
]

const DEFAULT_EDGES = [
  { id: 'edge-1', source: 'node-1', target: 'node-2' },
  { id: 'edge-2', source: 'node-2', target: 'node-3' },
  { id: 'edge-3', source: 'node-2', target: 'node-4' },
]

export default function Canvas() {
  // 状态
  const [nodes, setNodes] = useState(DEFAULT_NODES)
  const [edges, setEdges] = useState(DEFAULT_EDGES)
  const [loading, setLoading] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragNode, setDragNode] = useState(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [showNodeDialog, setShowNodeDialog] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [showGrid, setShowGrid] = useState(true)

  // Refs
  const canvasRef = useRef(null)
  const containerRef = useRef(null)

  // 加载画布数据
  useEffect(() => {
    loadCanvas()
  }, [])

  /**
   * 加载画布数据
   */
  const loadCanvas = async () => {
    setLoading(true)
    try {
      // 尝试从 Gateway 加载工作流数据
      const result = await api.call('workflow.get', {})

      if (result.success && result.data) {
        setNodes(result.data.nodes || DEFAULT_NODES)
        setEdges(result.data.edges || DEFAULT_EDGES)
      }
    } catch (error) {
      console.log('使用默认画布数据')
    } finally {
      setLoading(false)
    }
  }

  /**
   * 保存画布数据
   */
  const saveCanvas = async () => {
    try {
      await api.call('workflow.save', { nodes, edges })
      toast.success('保存成功', '画布数据已保存')
    } catch (error) {
      console.error('保存画布失败:', error)
      // 不显示错误，因为 API 可能未实现
    }
  }

  /**
   * 缩放控制
   */
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.3))
  const handleResetZoom = () => { setZoom(1); setOffset({ x: 0, y: 0 }) }

  /**
   * 鼠标滚轮缩放
   */
  const handleWheel = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      setZoom(prev => Math.min(Math.max(prev + delta, 0.3), 2))
    }
  }, [])

  /**
   * 开始拖拽节点
   */
  const handleNodeMouseDown = (e, nodeId) => {
    e.stopPropagation()
    setIsDragging(true)
    setDragNode(nodeId)
    setSelectedNode(nodeId)
  }

  /**
   * 拖拽移动
   */
  const handleMouseMove = useCallback((e) => {
    if (isDragging && dragNode && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const x = (e.clientX - rect.left - offset.x) / zoom
      const y = (e.clientY - rect.top - offset.y) / zoom

      setNodes(prev => prev.map(node =>
        node.id === dragNode
          ? { ...node, x: x - 80, y: y - 30 }
          : node
      ))
    } else if (isPanning) {
      const dx = e.clientX - panStart.x
      const dy = e.clientY - panStart.y
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }))
      setPanStart({ x: e.clientX, y: e.clientY })
    }
  }, [isDragging, dragNode, isPanning, panStart, zoom, offset])

  /**
   * 结束拖拽
   */
  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false)
      setDragNode(null)
    }
    if (isPanning) {
      setIsPanning(false)
    }
  }, [isDragging, isPanning])

  /**
   * 画布平移开始
   */
  const handleCanvasMouseDown = (e) => {
    if (e.target === canvasRef.current || e.target === containerRef.current) {
      setIsPanning(true)
      setPanStart({ x: e.clientX, y: e.clientY })
      setSelectedNode(null)
    }
  }

  /**
   * 添加节点
   */
  const addNode = (type) => {
    const config = NODE_TYPES[type]
    const newId = `node-${Date.now()}`
    const newNode = {
      id: newId,
      type,
      x: 300 - offset.x / zoom,
      y: 200 - offset.y / zoom,
      label: `${config.label} ${nodes.length + 1}`,
      data: {},
    }
    setNodes(prev => [...prev, newNode])
    toast.success('添加成功', `已添加 ${config.label} 节点`)
  }

  /**
   * 删除选中节点
   */
  const deleteSelectedNode = () => {
    if (!selectedNode) return

    setNodes(prev => prev.filter(n => n.id !== selectedNode))
    setEdges(prev => prev.filter(e => e.source !== selectedNode && e.target !== selectedNode))
    setSelectedNode(null)
    toast.success('删除成功', '节点已删除')
  }

  /**
   * 导出画布
   */
  const exportCanvas = () => {
    const data = JSON.stringify({ nodes, edges }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `canvas-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('导出成功', '画布已导出为 JSON 文件')
  }

  /**
   * 渲染节点
   */
  const renderNode = (node) => {
    const config = NODE_TYPES[node.type]
    const Icon = config.icon
    const isSelected = selectedNode === node.id

    return (
      <div
        key={node.id}
        className={`
          absolute w-40 p-3 rounded-lg border-2 cursor-move select-none
          transition-shadow duration-200
          ${config.color} ${config.borderColor}
          ${isSelected ? 'ring-2 ring-primary ring-offset-2 shadow-lg' : 'shadow-md'}
          hover:shadow-lg
        `}
        style={{
          left: node.x * zoom + offset.x,
          top: node.y * zoom + offset.y,
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
        }}
        onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
      >
        <div className="flex items-center gap-2 text-white">
          <Icon className="w-5 h-5" />
          <span className="font-medium text-sm truncate">{node.label}</span>
        </div>
        {node.type === 'agent' && node.data.model && (
          <div className="mt-1 text-xs text-white/80">
            {node.data.model}
          </div>
        )}
        {node.type === 'tool' && node.data.name && (
          <div className="mt-1 text-xs text-white/80">
            {node.data.name}
          </div>
        )}
      </div>
    )
  }

  /**
   * 渲染连线
   */
  const renderEdge = (edge) => {
    const sourceNode = nodes.find(n => n.id === edge.source)
    const targetNode = nodes.find(n => n.id === edge.target)

    if (!sourceNode || !targetNode) return null

    const x1 = (sourceNode.x + 160) * zoom + offset.x
    const y1 = (sourceNode.y + 30) * zoom + offset.y
    const x2 = targetNode.x * zoom + offset.x
    const y2 = (targetNode.y + 30) * zoom + offset.y

    // 计算贝塞尔曲线控制点
    const midX = (x1 + x2) / 2
    const ctrlOffset = Math.abs(x2 - x1) / 3

    return (
      <path
        key={edge.id}
        d={`M ${x1} ${y1} C ${x1 + ctrlOffset} ${y1}, ${x2 - ctrlOffset} ${y2}, ${x2} ${y2}`}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={2}
        className="transition-colors"
        markerEnd="url(#arrowhead)"
      />
    )
  }

  // 加载中状态
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-foreground-secondary">加载画布...</span>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* 工具栏 */}
      <div className="flex items-center justify-between p-3 border-b border-subtle bg-surface">
        <div className="flex items-center gap-2">
          {/* 添加节点菜单 */}
          <div className="flex items-center gap-1 mr-4">
            <span className="text-sm text-foreground-secondary mr-2">添加:</span>
            {Object.entries(NODE_TYPES).map(([type, config]) => {
              const Icon = config.icon
              return (
                <Button
                  key={type}
                  variant="outline"
                  size="sm"
                  onClick={() => addNode(type)}
                  title={`添加${config.label}节点`}
                >
                  <Icon className="w-4 h-4" />
                </Button>
              )
            })}
          </div>

          <div className="w-px h-6 bg-subtle" />

          {/* 操作按钮 */}
          <Button
            variant="outline"
            size="sm"
            onClick={deleteSelectedNode}
            disabled={!selectedNode}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            删除
          </Button>
          <Button variant="outline" size="sm" onClick={saveCanvas}>
            <Download className="w-4 h-4 mr-1" />
            保存
          </Button>
          <Button variant="outline" size="sm" onClick={exportCanvas}>
            <Upload className="w-4 h-4 mr-1" />
            导出
          </Button>
        </div>

        {/* 缩放控制 */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowGrid(!showGrid)}>
            <Grid3X3 className="w-4 h-4" />
          </Button>
          <div className="w-px h-6 bg-subtle" />
          <Button variant="outline" size="sm" onClick={handleZoomOut}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-sm w-16 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="outline" size="sm" onClick={handleZoomIn}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleResetZoom}>
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 画布区域 */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-muted/30"
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* 网格背景 */}
        {showGrid && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
                linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)
              `,
              backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
              backgroundPosition: `${offset.x}px ${offset.y}px`,
            }}
          />
        )}

        {/* SVG 连线层 */}
        <svg
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        >
          {/* 箭头定义 */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill="hsl(var(--primary))"
              />
            </marker>
          </defs>
          {/* 渲染连线 */}
          {edges.map(renderEdge)}
        </svg>

        {/* 节点层 */}
        <div className="absolute inset-0">
          {nodes.map(renderNode)}
        </div>

        {/* 空状态提示 */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <GitBranch className="w-12 h-12 mx-auto text-foreground-tertiary mb-4" />
              <h3 className="text-lg font-medium">画布为空</h3>
              <p className="text-foreground-secondary mt-2">
                点击上方按钮添加节点
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 底部状态栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-subtle bg-surface text-sm text-foreground-secondary">
        <div className="flex items-center gap-4">
          <span>节点: {nodes.length}</span>
          <span>连线: {edges.length}</span>
          {selectedNode && (
            <span className="text-primary">
              已选中: {nodes.find(n => n.id === selectedNode)?.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Move className="w-4 h-4" />
          <span>拖拽移动节点 | 空白处拖拽平移 | Ctrl+滚轮缩放</span>
        </div>
      </div>
    </div>
  )
}
