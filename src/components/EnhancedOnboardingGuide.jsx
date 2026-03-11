import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { Textarea } from './ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import {
  Loader2,
  Rocket,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Play,
  XCircle,
  Save,
  Zap,
  PenTool,
  ArrowLeft,
  User,
  Bot,
  Download,
  AlertCircle,
} from 'lucide-react'
import api from '@/lib/api'
import {
  AGENT_TEMPLATES,
  generateSoulFromTemplate,
  generateAgentsFromTemplate,
  generateUserFromTemplate,
  generateIdentityFromTemplate,
} from './agent-templates'

// 引导步骤枚举
const ONBOARDING_STEPS = {
  WELCOME: 0,      // 欢迎页
  AI_CONFIG: 1,    // AI 配置
  TEMPLATE: 2,     // 模板选择（新手模式）
  MANUAL: 3,       // 手动配置（大师模式）
  COMPLETE: 4,     // 完成
}

// 引导模式
const GUIDE_MODES = {
  TEMPLATE: 'template',   // 快速模板（新手）
  MANUAL: 'manual',       // 手动配置（大师）
}

// localStorage key
const ONBOARDING_KEY = 'openclaw_onboarding_completed'

// AI 提供商配置
const AI_PROVIDERS = [
  { id: 'qwen', name: '🇨🇳 通义千问', defaultUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { id: 'deepseek', name: '🇨🇳 DeepSeek', defaultUrl: 'https://api.deepseek.com/v1' },
  { id: 'zhipu', name: '🇨🇳 智谱 GLM', defaultUrl: 'https://open.bigmodel.cn/api/paas/v4' },
  { id: 'minimax', name: '🇨🇳 MiniMax', defaultUrl: 'https://api.minimaxi.com/v1' },
  { id: 'moonshot', name: '🇨🇳 月之暗面', defaultUrl: 'https://api.moonshot.cn/v1' },
  { id: 'doubao', name: '🇨🇳 豆包', defaultUrl: 'https://ark.cn-beijing.volces.com/api/v3' },
  { id: 'ernie', name: '🇨🇳 文心一言', defaultUrl: '' },
  { id: 'openai', name: '🌍 OpenAI', defaultUrl: 'https://api.openai.com/v1' },
  { id: 'anthropic', name: '🌍 Anthropic', defaultUrl: 'https://api.anthropic.com/v1' },
  { id: 'google', name: '🌍 Google Gemini', defaultUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  { id: 'custom', name: '🔗 自定义/OpenAI兼容', defaultUrl: '', isCustom: true },
]

// 预设智能体 Emoji
const AGENT_EMOJIS = ['🤖', '🧠', '👾', '🦾', '🦸', '🧚', '🦊', '🐱', '🐼', '🐲']

// 检查是否已完成引导
export function isOnboardingCompleted() {
  return localStorage.getItem(ONBOARDING_KEY) === 'true'
}

// 标记引导完成
export function completeOnboarding() {
  localStorage.setItem(ONBOARDING_KEY, 'true')
}

// 重置引导状态
export async function resetOnboarding() {
  localStorage.removeItem(ONBOARDING_KEY)
  localStorage.removeItem('openclaw_user_settings')
}

export default function EnhancedOnboardingGuide({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(ONBOARDING_STEPS.WELCOME)
  const [guideMode, setGuideMode] = useState(null)
  const [gatewayStatus, setGatewayStatus] = useState(null)
  const [isStartingGateway, setIsStartingGateway] = useState(false)

  // 🔥 OpenClaw 安装状态
  const [installStatus, setInstallStatus] = useState(null)  // null=检测中, true=已安装, false=未安装
  const [isInstalling, setIsInstalling] = useState(false)
  const [installError, setInstallError] = useState(null)

  // AI 配置
  const [selectedProvider, setSelectedProvider] = useState('qwen')
  const [selectedModel, setSelectedModel] = useState('')
  const [customBaseUrl, setCustomBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [configSaved, setConfigSaved] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [isSavingModel, setIsSavingModel] = useState(false)

  // 用户信息
  const [userName, setUserName] = useState('')

  // 手动配置（大师模式）
  const [agentName, setAgentName] = useState('小助手')
  const [agentEmoji, setAgentEmoji] = useState('🤖')
  const [agentDescription, setAgentDescription] = useState('')
  const [agentPersonality, setAgentPersonality] = useState('')
  const [agentBehavior, setAgentBehavior] = useState('')

  // 模板选择
  const [selectedTemplate, setSelectedTemplate] = useState(null)

  // 初始化
  useEffect(() => {
    checkOpenClawInstall()
    loadCurrentConfig()
  }, [])

  // 🔥 检查 OpenClaw 安装状态
  const checkOpenClawInstall = async () => {
    console.log('🔍 检查 OpenClaw 安装状态...')
    setInstallError(null)

    const checkResult = await api.install.checkStatus()
    if (!checkResult.success) {
      console.error('❌ 检查安装状态失败:', checkResult.error)
      setInstallStatus(false)
      setInstallError(checkResult.error)
      return
    }

    console.log('📦 OpenClaw 安装状态:', checkResult.data)
    setInstallStatus(checkResult.data?.installed || false)

    // 如果已安装，检查 Gateway 状态
    if (checkResult.data?.installed) {
      await checkGatewayStatus()
    }
  }

  // 🔥 安装 OpenClaw
  const handleInstallOpenClaw = async () => {
    console.log('⬇️ 开始安装 OpenClaw...')
    setIsInstalling(true)
    setInstallError(null)

    const installResult = await api.install.install()
    setIsInstalling(false)

    if (installResult.success && installResult.data?.installed) {
      console.log('✅ OpenClaw 安装成功!')
      setInstallStatus(true)
      // 安装成功后检查 Gateway
      await checkGatewayStatus()
    } else {
      console.error('❌ OpenClaw 安装失败:', installResult.error || installResult.data?.error)
      setInstallError(installResult.error || installResult.data?.error || '安装失败，请重试')
    }
  }

  const checkGatewayStatus = async () => {
    const result = await api.bundledGateway.status()
    if (result.success) {
      setGatewayStatus(result.data)
    } else {
      setGatewayStatus({ running: false })
    }
  }

  const loadCurrentConfig = async () => {
    const result = await api.config.get()
    if (result.success) {
      const cfg = result.data
      if (cfg?.ai_provider?.current) {
        setSelectedProvider(cfg.ai_provider.current)
        const providerConfig = cfg.ai_provider[cfg.ai_provider.current]
        if (providerConfig?.custom_models?.[0]) {
          setSelectedModel(providerConfig.custom_models[0])
        } else if (providerConfig?.model) {
          setSelectedModel(providerConfig.model)
        }
        if (providerConfig?.api_key) {
          setApiKey(providerConfig.api_key)
        }
        if (providerConfig?.base_url) {
          setCustomBaseUrl(providerConfig.base_url)
        }
      }
      if (cfg?.user?.name) {
        setUserName(cfg.user.name)
      }
    }
  }

  const getCurrentDefaultUrl = () => {
    const provider = AI_PROVIDERS.find(p => p.id === selectedProvider)
    return provider?.defaultUrl || ''
  }

  const handleStartGateway = async () => {
    setIsStartingGateway(true)
    setInstallError(null)

    // 🔥 先检查 OpenClaw 是否安装
    if (!installStatus) {
      console.log('⬇️ OpenClaw 未安装，开始自动安装...')
      setIsInstalling(true)
      const installResult = await api.install.install()
      setIsInstalling(false)

      if (installResult.success && installResult.data?.installed) {
        console.log('✅ OpenClaw 安装成功!')
        setInstallStatus(true)
      } else {
        console.error('❌ OpenClaw 安装失败:', installResult.error || installResult.data?.error)
        setInstallError(installResult.error || installResult.data?.error || '安装失败')
        setIsStartingGateway(false)
        return
      }
    }

    // 启动 Gateway
    console.log('🚀 启动 Gateway...')
    const startResult = await api.bundledGateway.start()
    if (startResult.success) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      const statusResult = await api.bundledGateway.status()
      if (statusResult.success) {
        setGatewayStatus(statusResult.data)
      }
    } else {
      console.error('❌ Gateway 启动失败:', startResult.error)
      setInstallError(startResult.error)
    }
    setIsStartingGateway(false)
  }

  const handleTestConnection = async () => {
    if (!apiKey || !selectedModel) {
      setTestResult({ success: false, message: '请填写 API Key 和模型名称' })
      return
    }
    setTestingConnection(true)
    setTestResult(null)
    const urlToUse = customBaseUrl.trim() || null
    const result = await api.testConnection(selectedProvider, selectedModel, apiKey, urlToUse)
    if (result.success) {
      setTestResult(result.data)
    } else {
      setTestResult({ success: false, message: result.error })
    }
    setTestingConnection(false)
  }

  const handleSaveModel = async () => {
    setIsSavingModel(true)
    try {
      const cfgResult = await api.config.get()
      const cfg = cfgResult.success ? cfgResult.data : {}

      if (!cfg.ai_provider) cfg.ai_provider = {}
      cfg.ai_provider.current = selectedProvider

      if (!cfg.ai_provider[selectedProvider]) cfg.ai_provider[selectedProvider] = {}

      cfg.ai_provider[selectedProvider].model = selectedModel
      cfg.ai_provider[selectedProvider].custom_models = [selectedModel]
      cfg.ai_provider[selectedProvider].enabled = true

      if (apiKey.trim()) {
        cfg.ai_provider[selectedProvider].api_key = apiKey.trim()
      }

      if (customBaseUrl.trim()) {
        cfg.ai_provider[selectedProvider].base_url = customBaseUrl.trim()
      } else {
        const defaultUrl = getCurrentDefaultUrl()
        if (defaultUrl) {
          cfg.ai_provider[selectedProvider].base_url = defaultUrl
        }
      }

      await api.config.set(cfg)
      await api.config.syncToGateway()

      setConfigSaved(true)
      setTestResult({ success: true, message: '配置已保存！' })

      // 进入下一步
      setTimeout(() => {
        if (guideMode === GUIDE_MODES.TEMPLATE) {
          setCurrentStep(ONBOARDING_STEPS.TEMPLATE)
        } else {
          setCurrentStep(ONBOARDING_STEPS.MANUAL)
        }
      }, 800)
    } catch (e) {
      console.error('保存模型配置失败:', e)
      setTestResult({ success: false, message: '保存失败: ' + e.message })
    }
    setIsSavingModel(false)
  }

  const handleTemplateSelect = async (template) => {
    setSelectedTemplate(template)

    // 生成配置
    const config = {
      identity: template.identity,
      soul: generateSoulFromTemplate(template),
      agents: generateAgentsFromTemplate(template),
      user: generateUserFromTemplate(template, userName),
      identityFull: generateIdentityFromTemplate(template),
      tools: template.tools,
    }

    await saveConfiguration(config, userName, template.identity.name, template.emoji)
    setCurrentStep(ONBOARDING_STEPS.COMPLETE)

    setTimeout(() => {
      completeOnboarding()
      onComplete?.({
        agentName: template.identity.name,
        agentEmoji: template.emoji,
        userName,
      })
    }, 1500)
  }

  const handleManualComplete = async () => {
    const config = {
      soul: `# SOUL.md - 你是谁\n\n_你不是聊天机器人。你正在成为某个人。_\n\n${agentPersonality || '## 性格特点\n- 友好、专业、乐于助人'}`,
      agents: `# AGENTS.md - 行为准则\n\n_这些是你必须遵循的规则。_\n\n${agentBehavior || '## 核心原则\n1. 始终保持专业和友好\n2. 准确理解用户需求'}`,
      user: `# USER.md - 关于你的用户\n\n## 基本信息\n- **名字**：${userName || '用户'}\n- **时区**：Asia/Shanghai`,
      identityFull: `# IDENTITY.md - 身份信息\n\n- **名称**：${agentName}\n- **形象**：${agentEmoji}\n- **描述**：${agentDescription || '你的智能助手'}`,
    }

    await saveConfiguration(config, userName, agentName, agentEmoji)
    setCurrentStep(ONBOARDING_STEPS.COMPLETE)

    setTimeout(() => {
      completeOnboarding()
      onComplete?.({
        agentName,
        agentEmoji,
        userName,
      })
    }, 1500)
  }

  const saveConfiguration = async (config, userName, agentName, agentEmoji) => {
    // 保存用户设置到 localStorage
    localStorage.setItem('openclaw_user_settings', JSON.stringify({
      agentName,
      agentEmoji,
      userName,
      createdAt: Date.now(),
    }))

    // 保存用户信息到配置文件
    const cfgResult = await api.config.get()
    if (cfgResult.success) {
      const cfg = cfgResult.data
      cfg.user = { name: userName, agent_name: agentName }
      await api.config.set(cfg)
    }

    // 同步到 Workspace
    await api.identity.update('main', agentName, agentEmoji, null, `${userName} 的智能助手`)

    // 保存配置文件
    if (config.soul) {
      await api.workspace.saveFile('main', 'SOUL.md', config.soul)
    }
    if (config.agents) {
      await api.workspace.saveFile('main', 'AGENTS.md', config.agents)
    }
    if (config.user) {
      await api.workspace.saveFile('main', 'USER.md', config.user)
    }

    try {
      await api.workspace.saveFile('main', 'BOOTSTRAP.md', '')
    } catch (e) {}
  }

  // 渲染欢迎页
  const renderWelcome = () => (
    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
        <Rocket className="w-8 h-8 text-primary" />
      </div>
      <div>
        <h2 className="text-xl font-bold mb-1">欢迎使用 OpenClaw</h2>
        <p className="text-sm text-muted-foreground">启动 Gateway 服务以开始使用</p>
      </div>

      {/* 🔥 安装状态显示 */}
      {installStatus === null && (
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 text-sm">
          <Loader2 className="w-4 h-4 inline mr-1 animate-spin" /> 检测安装状态...
        </div>
      )}

      {installStatus === false && !isInstalling && (
        <div className="space-y-3 w-full max-w-sm">
          <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm">
            <AlertCircle className="w-4 h-4 inline mr-1" /> OpenClaw 未安装，需要先安装核心组件
          </div>
          <Button
            size="lg"
            onClick={handleStartGateway}
            disabled={isStartingGateway || isInstalling}
            className="w-full px-6"
          >
            <Download className="w-4 h-4 mr-2" /> 安装并启动
          </Button>
        </div>
      )}

      {isInstalling && (
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 text-sm">
          <Loader2 className="w-4 h-4 inline mr-1 animate-spin" /> 正在安装 OpenClaw，请稍候...
        </div>
      )}

      {installError && (
        <div className="space-y-2 w-full max-w-sm">
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
            <XCircle className="w-4 h-4 inline mr-1" /> {installError}
          </div>
          <Button variant="outline" size="sm" onClick={handleStartGateway}>
            重试
          </Button>
        </div>
      )}

      {installStatus === true && (
        <>
          {gatewayStatus?.running ? (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-600 text-sm">
              <CheckCircle2 className="w-4 h-4 inline mr-1" /> Gateway 已启动
            </div>
          ) : (
            <Button size="lg" onClick={handleStartGateway} disabled={isStartingGateway} className="px-6">
              {isStartingGateway ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 启动中...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> 启动服务</>
              )}
            </Button>
          )}

          {gatewayStatus?.running && (
            <Button variant="outline" onClick={() => setCurrentStep(ONBOARDING_STEPS.AI_CONFIG)}>
              开始配置 <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </>
      )}
    </div>
  )

  // 渲染 AI 配置
  const renderAIConfig = () => (
    <div className="flex-1 flex flex-col space-y-3">
      <div className="text-center mb-2">
        <h2 className="text-lg font-bold">配置 AI 模型</h2>
        <p className="text-xs text-muted-foreground">选择服务商并填写配置信息</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <div className="space-y-1">
            <label className="text-xs">服务商</label>
            <Select value={selectedProvider} onValueChange={(v) => {
              setSelectedProvider(v)
              setTestResult(null)
              setConfigSaved(false)
            }}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_PROVIDERS.map(p => (
                  <SelectItem key={p.id} value={p.id} className="text-sm">{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs">模型名称 <span className="text-destructive">*</span></label>
            <Input
              value={selectedModel}
              onChange={(e) => { setSelectedModel(e.target.value); setTestResult(null); setConfigSaved(false) }}
              placeholder="如: qwen-plus"
              className="h-9 text-sm"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="space-y-1">
            <label className="text-xs">API Key <span className="text-destructive">*</span></label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setTestResult(null); setConfigSaved(false) }}
              placeholder="sk-xxx"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs">API 地址</label>
            <Input
              value={customBaseUrl}
              onChange={(e) => { setCustomBaseUrl(e.target.value); setTestResult(null); setConfigSaved(false) }}
              placeholder={getCurrentDefaultUrl() || "https://api.xxx.com/v1"}
              className="h-9 text-sm"
            />
          </div>
        </div>
      </div>

      {/* 用户名 */}
      <div className="space-y-1">
        <label className="text-xs">你的称呼</label>
        <Input
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          placeholder="如：小明"
          className="h-9 text-sm"
        />
      </div>

      {/* 测试结果 */}
      {testResult && (
        <div className={`p-2 rounded text-xs flex items-center gap-2 ${
          testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {testResult.success ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
          {testResult.message}
        </div>
      )}

      {/* 模式选择 */}
      {configSaved && (
        <div className="space-y-2 pt-2 border-t">
          <div className="text-xs text-muted-foreground text-center">选择配置方式</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setGuideMode(GUIDE_MODES.TEMPLATE)
                setCurrentStep(ONBOARDING_STEPS.TEMPLATE)
              }}
              className="p-3 rounded-lg border text-left transition-all hover:border-primary/50 hover:bg-primary/5"
            >
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-green-600" />
                <div>
                  <div className="font-medium text-sm">新手模式</div>
                  <div className="text-[10px] text-muted-foreground">预制模板，一键开始</div>
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setGuideMode(GUIDE_MODES.MANUAL)
                setCurrentStep(ONBOARDING_STEPS.MANUAL)
              }}
              className="p-3 rounded-lg border text-left transition-all hover:border-primary/50 hover:bg-primary/5"
            >
              <div className="flex items-center gap-2">
                <PenTool className="w-5 h-5 text-gray-600" />
                <div>
                  <div className="font-medium text-sm">大师模式</div>
                  <div className="text-[10px] text-muted-foreground">细粒度自定义配置</div>
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* 按钮组 */}
      <div className="flex gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleTestConnection}
          disabled={testingConnection || !selectedModel || !apiKey}
          className="flex-1"
        >
          {testingConnection ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
          测试连接
        </Button>
        <Button
          size="sm"
          onClick={handleSaveModel}
          disabled={isSavingModel || !selectedModel || !apiKey}
          className="flex-1"
        >
          {isSavingModel ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
          {configSaved ? '已保存' : '保存并继续'}
        </Button>
      </div>

      <div className="pt-1">
        <Button variant="ghost" size="sm" onClick={() => setCurrentStep(ONBOARDING_STEPS.WELCOME)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> 返回
        </Button>
      </div>
    </div>
  )

  // 渲染模板选择（新手模式）
  const renderTemplate = () => (
    <div className="flex-1 flex flex-col space-y-3">
      <div className="text-center mb-2">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Badge variant="secondary" className="text-[10px]">新手模式</Badge>
        </div>
        <h2 className="text-lg font-bold">选择智能体模板</h2>
        <p className="text-xs text-muted-foreground">选择一个最符合你需求的模板</p>
      </div>

      <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-[220px]">
        {AGENT_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => handleTemplateSelect(template)}
            className={`p-2 rounded-lg border text-left transition-all hover:border-primary/50 ${
              selectedTemplate?.id === template.id ? 'border-primary bg-primary/5' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">{template.emoji}</span>
              <div>
                <div className="font-medium text-sm">{template.name}</div>
                <div className="text-[10px] text-muted-foreground line-clamp-1">{template.description}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="pt-2">
        <Button variant="ghost" size="sm" onClick={() => setCurrentStep(ONBOARDING_STEPS.AI_CONFIG)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> 返回
        </Button>
      </div>
    </div>
  )

  // 渲染手动配置（大师模式）
  const renderManual = () => (
    <div className="flex-1 flex flex-col space-y-3 overflow-y-auto">
      <div className="text-center mb-1">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Badge variant="secondary" className="text-[10px]">大师模式</Badge>
        </div>
        <h2 className="text-lg font-bold">自定义智能体</h2>
        <p className="text-xs text-muted-foreground">精细化配置你的专属智能体</p>
      </div>

      {/* 身份信息 */}
      <div className="space-y-2">
        <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <User className="w-3 h-3" /> 身份信息
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px]">智能体名称</label>
            <Input
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="如：小助手"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px]">形象</label>
            <div className="flex flex-wrap gap-1">
              {AGENT_EMOJIS.slice(0, 6).map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setAgentEmoji(emoji)}
                  className={`w-6 h-6 text-sm rounded border transition-all ${
                    agentEmoji === emoji
                      ? 'bg-primary/20 border-primary'
                      : 'bg-muted hover:bg-primary/10 border-border'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[10px]">一句话介绍</label>
          <Input
            value={agentDescription}
            onChange={(e) => setAgentDescription(e.target.value)}
            placeholder="如：你的专属编程搭档"
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* 人格定义 */}
      <div className="space-y-2">
        <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Bot className="w-3 h-3" /> 人格定义
        </div>
        <div className="space-y-1">
          <label className="text-[10px]">性格特点、回应风格、沟通偏好</label>
          <Textarea
            value={agentPersonality}
            onChange={(e) => setAgentPersonality(e.target.value)}
            placeholder={`示例：
## 性格特点
- 专业严谨，注重代码质量
- 耐心细致，善于解释复杂概念

## 回应风格
- 代码优先，用实际例子说明
- 结构化输出，步骤清晰`}
            rows={4}
            className="text-xs"
          />
        </div>
      </div>

      {/* 行为准则 */}
      <div className="space-y-2">
        <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="w-3 h-3" /> 行为准则
        </div>
        <div className="space-y-1">
          <label className="text-[10px]">核心原则、行为边界、优先级</label>
          <Textarea
            value={agentBehavior}
            onChange={(e) => setAgentBehavior(e.target.value)}
            placeholder={`示例：
## 核心原则
1. 代码质量优先
2. 安全意识
3. 最佳实践

## 行为边界
- 不生成恶意代码
- 不绕过安全限制`}
            rows={3}
            className="text-xs"
          />
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2 pt-2 border-t">
        <Button variant="ghost" size="sm" onClick={() => setCurrentStep(ONBOARDING_STEPS.AI_CONFIG)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> 返回
        </Button>
        <Button size="sm" onClick={handleManualComplete} className="flex-1">
          <CheckCircle2 className="w-3 h-3 mr-1" /> 完成配置
        </Button>
      </div>
    </div>
  )

  // 渲染完成页
  const renderComplete = () => (
    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
        <CheckCircle2 className="w-8 h-8 text-green-500" />
      </div>
      <div>
        <h2 className="text-xl font-bold mb-1">准备就绪！</h2>
        <p className="text-sm text-muted-foreground">
          你的专属智能助手已准备好为你服务！
        </p>
      </div>
      <div className="flex items-center gap-2 text-primary text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>正在进入主界面...</span>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-xl shadow-2xl border-0">
        <CardContent className="p-6">
          {/* 步骤内容 */}
          <div className="min-h-[380px] max-h-[480px] flex flex-col">
            {currentStep === ONBOARDING_STEPS.WELCOME && renderWelcome()}
            {currentStep === ONBOARDING_STEPS.AI_CONFIG && renderAIConfig()}
            {currentStep === ONBOARDING_STEPS.TEMPLATE && renderTemplate()}
            {currentStep === ONBOARDING_STEPS.MANUAL && renderManual()}
            {currentStep === ONBOARDING_STEPS.COMPLETE && renderComplete()}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
