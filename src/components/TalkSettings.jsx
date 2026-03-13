/**
 * TalkSettings - 语音通话设置
 *
 * 配置语音通话功能
 * 原版 Gateway 支持：talk.config, talk.mode
 */
import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Badge } from './ui/badge'
import { Switch } from './ui/switch'
import { Input } from './ui/input'
import { Label } from './ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import {
  Phone,
  PhoneOff,
  Volume2,
  VolumeX,
  RefreshCw,
  Settings,
  CheckCircle,
  AlertCircle,
  Mic,
  MicOff,
} from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

export default function TalkSettings() {
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState({
    enabled: false,
    mode: 'push-to-talk',
    input_device: 'default',
    output_device: 'default',
    vad_enabled: true,
    vad_threshold: 0.5,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    setLoading(true)
    try {
      const result = await api.talk.config()
      if (result.success && result.data) {
        setConfig({
          enabled: result.data.enabled ?? false,
          mode: result.data.mode || 'push-to-talk',
          input_device: result.data.input_device || 'default',
          output_device: result.data.output_device || 'default',
          vad_enabled: result.data.vad_enabled ?? true,
          vad_threshold: result.data.vad_threshold ?? 0.5,
        })
      } else {
        // 处理未知方法错误（Gateway 未实现 talk.config API）
        const error = result.error || ''
        if (error.includes('unknown method')) {
          console.log('[TalkSettings] talk.config 方法不可用，使用默认配置')
        } else {
          console.error('加载语音通话配置失败:', error)
        }
      }
    } catch (error) {
      console.error('加载语音通话配置失败:', error)
    }
    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // 使用 talk.mode 设置模式
      if (config.mode) {
        await api.talk.mode(config.mode)
      }
      toast.success('保存成功', '语音通话配置已更新')
    } catch (error) {
      toast.error('保存失败', error.message)
    }
    setSaving(false)
  }

  const handleModeChange = async (newMode) => {
    setConfig({ ...config, mode: newMode })
    // 实时切换模式
    const result = await api.talk.mode(newMode)
    if (result.success) {
      toast.success('模式已切换', `切换到 ${newMode === 'push-to-talk' ? '按键说话' : '语音活动检测'} 模式`)
    }
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
            <Phone className="w-5 h-5" />
            语音通话
          </CardTitle>
          <CardDescription>
            配置语音通话功能
 实现语音交互
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 启用开关 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">启用语音通话</Label>
              <p className="text-sm text-muted-foreground">
                开启后可通过语音与智能体交互
              </p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
            />
          </div>

          {/* 通话模式 */}
          <div className="space-y-2">
            <Label>通话模式</Label>
            <Select value={config.mode} onValueChange={handleModeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="push-to-talk">
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4" />
                    按键说话 (Push-to-Talk)
                  </div>
                </SelectItem>
                <SelectItem value="voice-activity">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4" />
                    语音活动检测 (VAD)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {config.mode === 'push-to-talk'
                ? '按住指定按键时说话，松开结束'
                : '检测到语音活动时自动开始/结束录音'}
            </p>
          </div>

          {/* VAD 设置（仅在语音活动检测模式下显示） */}
          {config.mode === 'voice-activity' && (
            <div className="space-y-4 p-4 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between">
                <Label>启用语音活动检测</Label>
                <Switch
                  checked={config.vad_enabled}
                  onCheckedChange={(checked) => setConfig({ ...config, vad_enabled: checked })}
                />
              </div>
              {config.vad_enabled && (
                <div className="space-y-2">
                  <Label>VAD 阈值</Label>
                  <Input
                    type="number"
                    min="0.1"
                    max="1.0"
                    step="0.1"
                    value={config.vad_threshold}
                    onChange={(e) => setConfig({ ...config, vad_threshold: parseFloat(e.target.value) || 0.5 })}
                  />
                  <p className="text-xs text-muted-foreground">
                    较低的值更敏感，较高的值需要更大的声音
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 保存按钮 */}
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
          </div>
        </CardContent>
      </Card>

      {/* 模式说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-blue-500" />
            模式说明
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <Mic className="w-4 h-4 text-green-500" />
                <span className="font-medium">按键说话 (Push-to-Talk)</span>
              </div>
              <p className="text-sm text-muted-foreground">
                按住空格键或指定按键时开始录音，松开结束并发送。适合嘈杂环境。
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <Volume2 className="w-4 h-4 text-blue-500" />
                <span className="font-medium">语音活动检测 (VAD)</span>
              </div>
              <p className="text-sm text-muted-foreground">
                自动检测语音开始和结束，无需手动操作。适合安静环境。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
