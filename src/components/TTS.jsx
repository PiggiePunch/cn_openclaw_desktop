import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Badge } from './ui/badge'
import { Switch } from './ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Volume2, Play, Settings, Loader2, Mic, Languages, RefreshCw } from 'lucide-react'

// 🆕 使用新的服务层
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

// TTS 提供商配置组件
function TTSProviderConfig({ provider, config, onChange }) {
  if (provider === 'edge') {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>语音</Label>
          <Select value={config.voice || 'en-US-MichelleNeural'} onValueChange={(v) => onChange({ ...config, voice: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en-US-MichelleNeural">Michelle (US English)</SelectItem>
              <SelectItem value="en-US-GuyNeural">Guy (US English)</SelectItem>
              <SelectItem value="en-US-JennyNeural">Jenny (US English)</SelectItem>
              <SelectItem value="zh-CN-XiaoxiaoNeural">晓晓 (中文)</SelectItem>
              <SelectItem value="zh-CN-YunxiNeural">云希 (中文)</SelectItem>
              <SelectItem value="zh-CN-YunyangNeural">云扬 (中文)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>语速</Label>
          <Input
            placeholder="+0%"
            value={config.rate || ''}
            onChange={(e) => onChange({ ...config, rate: e.target.value || null })}
          />
        </div>
      </div>
    )
  }

  if (provider === 'openai') {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>API Key</Label>
          <Input
            type="password"
            placeholder="sk-..."
            value={config.api_key || ''}
            onChange={(e) => onChange({ ...config, api_key: e.target.value || null })}
          />
        </div>
        <div className="space-y-2">
          <Label>模型</Label>
          <Select value={config.model || 'gpt-4o-mini-tts'} onValueChange={(v) => onChange({ ...config, model: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-4o-mini-tts">GPT-4o Mini TTS</SelectItem>
              <SelectItem value="tts-1">TTS-1</SelectItem>
              <SelectItem value="tts-1-hd">TTS-1 HD</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>语音</Label>
          <Select value={config.voice || 'alloy'} onValueChange={(v) => onChange({ ...config, voice: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alloy">Alloy</SelectItem>
              <SelectItem value="echo">Echo</SelectItem>
              <SelectItem value="fable">Fable</SelectItem>
              <SelectItem value="onyx">Onyx</SelectItem>
              <SelectItem value="nova">Nova</SelectItem>
              <SelectItem value="shimmer">Shimmer</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    )
  }

  if (provider === 'elevenlabs') {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>API Key</Label>
          <Input
            type="password"
            placeholder="API Key"
            value={config.api_key || ''}
            onChange={(e) => onChange({ ...config, api_key: e.target.value || null })}
          />
        </div>
        <div className="space-y-2">
          <Label>Voice ID</Label>
          <Input
            placeholder="Voice ID"
            value={config.voice_id || ''}
            onChange={(e) => onChange({ ...config, voice_id: e.target.value })}
          />
        </div>
      </div>
    )
  }

  return <div className="text-muted-foreground text-sm">选择一个提供商进行配置</div>
}

export default function TTS() {
  const [status, setStatus] = useState(null)
  const [config, setConfig] = useState({
    enabled: false,
    provider: 'edge',
    auto: 'off',
    max_text_length: 4096,
    edge: { voice: 'zh-CN-XiaoxiaoNeural', lang: 'zh-CN' },
    openai: { model: 'gpt-4o-mini-tts', voice: 'alloy' },
    elevenlabs: { voice_id: '' }
  })
  const [testText, setTestText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSynthesizing, setIsSynthesizing] = useState(false)
  const [voices, setVoices] = useState([])
  const [lastResult, setLastResult] = useState(null)

  useEffect(() => {
    loadStatus()
    loadVoices()
  }, [])

  const loadStatus = async () => {
    setIsLoading(true)
    // 🆕 使用统一 API 服务层
    const result = await api.tts.status()
    if (result.success) {
      setStatus(result.data)
      if (result.data) {
        setConfig(prev => ({
          ...prev,
          enabled: result.data.enabled,
          provider: result.data.provider
        }))
      }
    } else {
      console.error('加载 TTS 状态失败:', result.error)
    }
    setIsLoading(false)
  }

  const loadVoices = async () => {
    const result = await api.tts.voices(config.provider)
    if (result.success) {
      setVoices(result.data?.voices || [])
    } else {
      console.error('加载语音列表失败:', result.error)
    }
  }

  const handleProviderChange = async (newProvider) => {
    setConfig(prev => ({ ...prev, provider: newProvider }))
    // 重新加载语音列表
    const result = await api.tts.voices(newProvider)
    if (result.success) {
      setVoices(result.data?.voices || [])
    } else {
      console.error('加载语音列表失败:', result.error)
    }
  }

  const handleConfigChange = async (newConfig) => {
    setConfig(newConfig)
    const result = await api.tts.configure(newConfig)
    if (!result.success) {
      console.error('保存配置失败:', result.error)
      toast.error('保存失败', result.error)
    }
  }

  const handleSynthesize = async () => {
    if (!testText.trim()) return

    setIsSynthesizing(true)
    setLastResult(null)

    // 🆕 使用统一 API 服务层
    const result = await api.tts.synthesize(testText, config.voice)
    setLastResult(result)

    if (result.success && result.data?.audio_path) {
      // 播放音频
      const audio = new Audio(`file://${result.data.audio_path}`)
      audio.play().catch(e => console.error('播放失败:', e))
      toast.success('合成成功', '音频已生成')
    } else {
      console.error('合成失败:', result.error)
      toast.error('合成失败', result.error)
    }
    setIsSynthesizing(false)
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">文字转语音</h2>
          <p className="text-muted-foreground">配置 TTS 系统进行文字转语音</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadStatus} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* 状态卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            系统状态
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">状态:</span>
                <Badge variant={status?.enabled ? 'default' : 'secondary'}>
                  {status?.enabled ? '已启用' : '已禁用'}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">提供商:</span>
                <Badge variant="outline">{status?.provider || 'edge'}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">自动模式:</span>
                <Badge variant="outline">{status?.auto || 'off'}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="tts-toggle" className="text-sm">启用 TTS</Label>
              <Switch
                id="tts-toggle"
                checked={config.enabled}
                onCheckedChange={(checked) => handleConfigChange({ ...config, enabled: checked })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 提供商配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            提供商配置
          </CardTitle>
          <CardDescription>选择和配置 TTS 提供商</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>提供商</Label>
            <Select value={config.provider} onValueChange={handleProviderChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="edge">
                  <div className="flex items-center gap-2">
                    <Mic className="h-4 w-4" />
                    Edge TTS (免费)
                  </div>
                </SelectItem>
                <SelectItem value="openai">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4" />
                    OpenAI TTS
                  </div>
                </SelectItem>
                <SelectItem value="elevenlabs">
                  <div className="flex items-center gap-2">
                    <Languages className="h-4 w-4" />
                    ElevenLabs
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <TTSProviderConfig
            provider={config.provider}
            config={config[config.provider] || {}}
            onChange={(providerConfig) => handleConfigChange({
              ...config,
              [config.provider]: providerConfig
            })}
          />

          <div className="space-y-2">
            <Label>自动模式</Label>
            <Select value={config.auto} onValueChange={(v) => handleConfigChange({ ...config, auto: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">关闭</SelectItem>
                <SelectItem value="always">总是</SelectItem>
                <SelectItem value="inbound">仅入站消息</SelectItem>
                <SelectItem value="tagged">标记消息</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>最大文本长度</Label>
            <Input
              type="number"
              value={config.max_text_length}
              onChange={(e) => handleConfigChange({ ...config, max_text_length: parseInt(e.target.value) || 4096 })}
            />
          </div>
        </CardContent>
      </Card>

      {/* 测试合成 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            测试合成
          </CardTitle>
          <CardDescription>输入文本测试 TTS 效果</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="输入要合成的文本..."
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            rows={3}
          />
          <div className="flex items-center gap-4">
            <Button onClick={handleSynthesize} disabled={isSynthesizing || !testText.trim()}>
              {isSynthesizing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  合成中...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  合成并播放
                </>
              )}
            </Button>
          </div>

          {lastResult && (
            <div className={`p-4 rounded-lg ${lastResult.success ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950'}`}>
              <p className="text-sm font-medium">
                {lastResult.success ? '✅ 合成成功' : '❌ 合成失败'}
              </p>
              {lastResult.error && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{lastResult.error}</p>
              )}
              {lastResult.audio_path && (
                <p className="text-sm text-muted-foreground mt-1 break-all">
                  文件: {lastResult.audio_path}
                </p>
              )}
              {lastResult.latency_ms && (
                <p className="text-sm text-muted-foreground mt-1">
                  耗时: {lastResult.latency_ms}ms
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 可用语音 */}
      {voices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              可用语音
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {voices.map((voice) => (
                <div
                  key={voice.id}
                  className="p-2 rounded border text-sm hover:bg-muted cursor-pointer"
                  onClick={() => {
                    const providerConfig = { ...config[config.provider], voice: voice.id }
                    handleConfigChange({ ...config, [config.provider]: providerConfig })
                  }}
                >
                  <div className="font-medium">{voice.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {voice.languages?.join(', ')} {voice.gender && `• ${voice.gender}`}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
