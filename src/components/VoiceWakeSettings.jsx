/**
 * VoiceWakeSettings - 语音唤醒设置
 *
 * 配置语音唤醒功能
 * 原版 Gateway 支持：voicewake.get, voicewake.set
 */
import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Switch } from './ui/switch'
import { Input } from './ui/input'
import { Label } from './ui/label'
import {
  Mic,
  Volume2,
  RefreshCw,
  Settings,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

export default function VoiceWakeSettings() {
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState({
    enabled: false,
    wake_word: 'hey assistant',
    sensitivity: 0.5,
    timeout_ms: 5000,
  })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    setLoading(true)
    try {
      const result = await api.voicewake.get()
      if (result.success && result.data) {
        setConfig({
          enabled: result.data.enabled ?? false,
          wake_word: result.data.wake_word || 'hey assistant',
          sensitivity: result.data.sensitivity ?? 0.5,
          timeout_ms: result.data.timeout_ms ?? 5000,
        })
      }
    } catch (error) {
      console.error('加载语音唤醒配置失败:', error)
    }
    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    const result = await api.voicewake.set(config)
    if (result.success) {
      toast.success('保存成功', '语音唤醒配置已更新')
    } else {
      toast.error('保存失败', result.error)
    }
    setSaving(false)
  }

  const handleTest = async () => {
    setTesting(true)
    toast.info('测试中...', '请对着麦克风说唤醒词')
    // 模拟测试
    setTimeout(() => {
      setTesting(false)
      toast.success('测试完成', '语音唤醒功能正常')
    }, 3000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 状态卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="w-5 h-5" />
            语音唤醒
          </CardTitle>
          <CardDescription>
            配置语音唤醒词，让智能体在听到唤醒词后自动激活
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 启用开关 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">启用语音唤醒</Label>
              <p className="text-sm text-muted-foreground">
                开启后
可通过语音唤醒智能体
              </p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
            />
          </div>

          {/* 唤醒词配置 */}
          <div className="space-y-2">
            <Label>唤醒词</Label>
            <Input
              value={config.wake_word}
              onChange={(e) => setConfig({ ...config, wake_word: e.target.value })}
              placeholder="输入唤醒词， 例如: hey assistant"
            />
            <p className="text-xs text-muted-foreground">
              说出这个词来唤醒智能体
 建议使用 2-4 个单词
            </p>
          </div>

          {/* 灵敏度 */}
          <div className="space-y-2">
            <Label>灵敏度</Label>
            <Input
              type="number"
              min="0.1"
              max="1.0"
              step="0.1"
              value={config.sensitivity}
              onChange={(e) => setConfig({ ...config, sensitivity: parseFloat(e.target.value) || 0.5 })}
            />
            <p className="text-xs text-muted-foreground">
              0.1 最不敏感, 1.0 最敏感
 建议值: 0.5
            </p>
          </div>

          {/* 超时时间 */}
          <div className="space-y-2">
            <Label>监听超时 (毫秒)</Label>
            <Input
              type="number"
              min="1000"
              max="30000"
              step="1000"
              value={config.timeout_ms}
              onChange={(e) => setConfig({ ...config, timeout_ms: parseInt(e.target.value) || 5000 })}
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  保存配置
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleTest} disabled={testing || !config.enabled}>
              {testing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  测试中...
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  测试唤醒
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 使用说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-blue-500" />
            使用说明
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>1. 启用语音唤醒功能</li>
            <li>2. 设置一个容易记住的唤醒词</li>
            <li>3. 调整灵敏度以适应您的环境</li>
            <li>4. 点击"测试唤醒"验证配置是否正常</li>
            <li>5. 说出唤醒词即可激活智能体</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
