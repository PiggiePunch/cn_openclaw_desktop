import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardContent } from './ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Badge } from './ui/badge'
import { Label } from './ui/label'
import {
  Key,
  Plus,
  Search,
  Eye,
  EyeOff,
  Trash2,
  Edit2,
  RefreshCw,
  Loader2,
  Shield,
  Save,
  X,
} from 'lucide-react'

// 使用新的服务层
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

export default function SecretsManager() {
  // 状态管理
  const [secrets, setSecrets] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [visibleKeys, setVisibleKeys] = useState({}) // 记录哪些密钥值是可见的

  // 对话框状态
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedKey, setSelectedKey] = useState(null)

  // 表单状态
  const [formData, setFormData] = useState({ key: '', value: '' })
  const [isSaving, setIsSaving] = useState(false)
  const [showValue, setShowValue] = useState(false)

  // 加载密钥列表
  useEffect(() => {
    loadSecrets()
  }, [])

  const loadSecrets = async () => {
    setIsLoading(true)
    const result = await api.secrets.list()
    if (result.success) {
      // secrets.list 返回的是 { key1: value1, key2: value2 } 格式
      // 转换为数组格式方便渲染
      const secretsArray = Object.entries(result.data || {}).map(([key, value]) => ({
        key,
        value,
      }))
      setSecrets(secretsArray)
    } else {
      console.error('加载密钥列表失败:', result.error)
      toast.error('加载失败', result.error)
    }
    setIsLoading(false)
  }

  // 过滤密钥列表
  const filteredSecrets = secrets.filter(secret =>
    secret.key.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // 切换密钥值显示/隐藏
  const toggleKeyVisibility = (key) => {
    setVisibleKeys(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  // 掩盖密钥值
  const maskValue = (value) => {
    if (!value) return '****'
    const len = value.length
    if (len <= 4) return '****'
    if (len <= 8) return value.slice(0, 2) + '****'
    return value.slice(0, 4) + '****' + value.slice(-4)
  }

  // 打开添加对话框
  const openAddDialog = () => {
    setFormData({ key: '', value: '' })
    setShowValue(false)
    setShowAddDialog(true)
  }

  // 打开编辑对话框
  const openEditDialog = (secret) => {
    setSelectedKey(secret.key)
    setFormData({ key: secret.key, value: secret.value })
    setShowValue(false)
    setShowEditDialog(true)
  }

  // 打开删除确认对话框
  const openDeleteDialog = (key) => {
    setSelectedKey(key)
    setShowDeleteDialog(true)
  }

  // 保存新密钥
  const handleAddSecret = async () => {
    if (!formData.key.trim()) {
      toast.error('错误', '密钥名称不能为空')
      return
    }
    if (!formData.value) {
      toast.error('错误', '密钥值不能为空')
      return
    }

    setIsSaving(true)
    const result = await api.secrets.set(formData.key.trim(), formData.value)
    if (result.success) {
      toast.success('添加成功', `密钥 "${formData.key}" 已添加`)
      setShowAddDialog(false)
      loadSecrets()
    } else {
      toast.error('添加失败', result.error)
    }
    setIsSaving(false)
  }

  // 更新密钥
  const handleEditSecret = async () => {
    if (!formData.value) {
      toast.error('错误', '密钥值不能为空')
      return
    }

    setIsSaving(true)
    const result = await api.secrets.set(selectedKey, formData.value)
    if (result.success) {
      toast.success('更新成功', `密钥 "${selectedKey}" 已更新`)
      setShowEditDialog(false)
      loadSecrets()
    } else {
      toast.error('更新失败', result.error)
    }
    setIsSaving(false)
  }

  // 删除密钥
  const handleDeleteSecret = async () => {
    setIsSaving(true)
    const result = await api.secrets.delete(selectedKey)
    if (result.success) {
      toast.success('删除成功', `密钥 "${selectedKey}" 已删除`)
      setShowDeleteDialog(false)
      loadSecrets()
    } else {
      toast.error('删除失败', result.error)
    }
    setIsSaving(false)
  }

  // 重新加载密钥
  const handleReload = async () => {
    setIsLoading(true)
    const result = await api.secrets.reload()
    if (result.success) {
      toast.success('重新加载成功', '密钥配置已重新加载')
      loadSecrets()
    } else {
      toast.error('重新加载失败', result.error)
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* 顶部栏：搜索 + 添加 + 刷新 */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Input
            placeholder="搜索密钥..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-9"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-tertiary" />
        </div>

        {/* 快捷统计 */}
        <Badge variant="secondary" className="gap-1">
          <Key className="w-3 h-3" />
          {secrets.length} 密钥
        </Badge>

        <Button size="sm" onClick={openAddDialog}>
          <Plus className="w-4 h-4 mr-1" />
          添加密钥
        </Button>

        <Button size="sm" variant="outline" onClick={handleReload} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          重新加载
        </Button>
      </div>

      {/* 提示信息 */}
      <Card className="bg-surface-elevated border-border">
        <CardContent className="p-3">
          <div className="flex items-start gap-2 text-sm text-foreground-secondary">
            <Shield className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground">密钥管理</p>
              <p className="text-xs mt-1">
                管理您的 API 密钥和敏感配置信息。这些密钥将被安全存储，供 Agent 和工具使用。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 密钥列表 */}
      {isLoading ? (
        <div className="text-center py-12 text-foreground-secondary">
          <Loader2 className="w-8 h-8 mx-auto animate-spin mb-2" />
          <div>加载中...</div>
        </div>
      ) : filteredSecrets.length === 0 ? (
        <div className="text-center py-12 text-foreground-secondary">
          <Key className="w-12 h-12 mx-auto mb-4 text-foreground-tertiary" />
          <div className="text-lg font-medium text-foreground mb-1">
            {searchQuery ? '没有找到匹配的密钥' : '暂无密钥'}
          </div>
          {!searchQuery && (
            <Button size="sm" onClick={openAddDialog} className="mt-2">
              <Plus className="w-4 h-4 mr-1" />
              添加第一个密钥
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {filteredSecrets.map(secret => (
            <Card
              key={secret.key}
              className="hover:shadow-md hover:border-primary/30 transition-all duration-200 group"
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-2.5">
                  {/* 图标 */}
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <Key className="w-4 h-4 text-amber-600" />
                  </div>

                  {/* 内容 */}
                  <div className="flex-1 min-w-0">
                    {/* 密钥名称 */}
                    <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors font-mono">
                      {secret.key}
                    </h3>

                    {/* 密钥值 */}
                    <div className="flex items-center gap-1 mt-1">
                      <p className="text-xs text-foreground-secondary truncate font-mono flex-1">
                        {visibleKeys[secret.key] ? secret.value : maskValue(secret.value)}
                      </p>
                      <button
                        onClick={() => toggleKeyVisibility(secret.key)}
                        className="text-muted-foreground hover:text-foreground p-0.5"
                        title={visibleKeys[secret.key] ? '隐藏' : '显示'}
                      >
                        {visibleKeys[secret.key] ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => openEditDialog(secret)}
                      title="编辑"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => openDeleteDialog(secret.key)}
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 添加密钥对话框 */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              添加新密钥
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 密钥名称 */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">密钥名称</Label>
              <Input
                placeholder="例如：OPENAI_API_KEY"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                className="font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                使用大写字母和下划线命名，例如：API_KEY、SECRET_TOKEN
              </p>
            </div>

            {/* 密钥值 */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">密钥值</Label>
              <div className="relative">
                <Input
                  type={showValue ? 'text' : 'password'}
                  placeholder="输入密钥值"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  className="pr-8 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowValue(!showValue)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              取消
            </Button>
            <Button onClick={handleAddSecret} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑密钥对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-4 h-4" />
              编辑密钥
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 密钥名称（只读） */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">密钥名称</Label>
              <Input
                value={selectedKey || ''}
                disabled
                className="font-mono bg-muted"
              />
            </div>

            {/* 密钥值 */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">密钥值</Label>
              <div className="relative">
                <Input
                  type={showValue ? 'text' : 'password'}
                  placeholder="输入新的密钥值"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  className="pr-8 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowValue(!showValue)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              取消
            </Button>
            <Button onClick={handleEditSecret} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              更新
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-4 h-4" />
              确认删除
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-foreground-secondary">
              确定要删除密钥 <span className="font-mono font-medium text-foreground">"{selectedKey}"</span> 吗？
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              此操作不可撤销，删除后相关功能可能无法正常工作。
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDeleteSecret} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-1" />
              )}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
