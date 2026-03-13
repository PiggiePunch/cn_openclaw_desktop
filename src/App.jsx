import { useState, useEffect } from 'react'
import { Sidebar, PageContainer } from './components/layout'
import { Button } from './components/ui/button'
import { Toaster } from './components/ui/toaster'
import SystemStatusConfig from './components/SystemStatusConfig'
import Chat from './components/Chat'
import Skills from './components/Skills'
import Schedule from './components/Schedule'
import Browser from './components/Browser'
import MemoryCenter from './components/MemoryCenter'
import ToolManager from './components/ToolManager'
import AISettings from './components/AISettings'
import SettingsPage from './components/SettingsPage'
import ChannelManager from './components/ChannelManager'
import CostTracker from './components/CostTracker'
import PatternLibrary from './components/PatternLibrary'
import HeartbeatMonitor from './components/HeartbeatMonitor'
import AuditLog from './components/AuditLog'
// 新增页面组件
import NodeManager from './components/NodeManager'
import DevicePairing from './components/DevicePairing'
import DiscoveryPanel from './components/DiscoveryPanel'
import Canvas from './components/Canvas'
import ModelsManager from './components/ModelsManager'
import TTS from './components/TTS'
import AutoReply from './components/AutoReply'
import ProactiveMessaging from './components/ProactiveMessaging'
import SubAgentManager from './components/SubAgentManager'
import A2ACommunication from './components/A2ACommunication'
import SecretsManager from './components/SecretsManager'
import FailoverStatus from './components/FailoverStatus'
import EnhancedOnboardingGuide, { isOnboardingCompleted } from './components/EnhancedOnboardingGuide'
import { UpdateDialog, RestartDialog } from './components/Updater'
import WorkspaceEditor from './components/workspace/WorkspaceEditor'
import useAutoUpdate from './hooks/useAutoUpdate'
import { RefreshCw } from 'lucide-react'

// 🆕 使用新的服务层
import api from './lib/api'

function App() {
  const [currentPage, setCurrentPage] = useState('chat')
  const [config, setConfig] = useState(null)
  const [systemInfo, setSystemInfo] = useState(null)
  const [showAISettings, setShowAISettings] = useState(false)
  const [showSystemConfig, setShowSystemConfig] = useState(false)

  // 🔥 智能体切换状态
  const [switchToAgent, setSwitchToAgent] = useState(null)

  // 更新对话框状态
  const [showUpdateDialog, setShowUpdateDialog] = useState(false)
  const [showRestartDialog, setShowRestartDialog] = useState(false)

  // 引导状态
  const [showOnboarding, setShowOnboarding] = useState(!isOnboardingCompleted())
  const [userSettings, setUserSettings] = useState(null)

  // 🔥 OpenClaw 安装状态
  const [installStatus, setInstallStatus] = useState(null)  // null=检测中, true=已安装, false=未安装
  const [isInstalling, setIsInstalling] = useState(false)
  const [installError, setInstallError] = useState(null)

  // 自动更新 Hook
  const { hasUpdate } = useAutoUpdate()

  const isTauriRuntime = () => {
    if (typeof window === 'undefined') return false
    return Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__?.core)
  }

  useEffect(() => {
    // 🔥 清理旧的 localStorage 缓存（迁移到 Workspace 系统）
    localStorage.removeItem('agent_metadata')

    // 🔥 初始化流程：先确保 Gateway 准备就绪，再加载数据
    const init = async () => {
      // 1. 首先确保 OpenClaw 已安装并运行（包含设置 auth token）
      if (isTauriRuntime()) {
        await ensureOpenClawReady()
      } else {
        console.log('🌐 非 Tauri 运行环境，跳过安装/进程初始化')
      }
      // 1.5 启动后执行一次引用修复，避免已删除智能体被 cron/通道残留反复“复活”。
      await runStartupRepair()
      // 2. Gateway 准备就绪后，再加载其他数据
      loadConfig()
      loadSystemInfo()
      loadUserSettings()
    }
    init()
  }, [])

  // 🔥 确保 OpenClaw 已安装并运行
  const ensureOpenClawReady = async () => {
    if (!isTauriRuntime()) return

    // 防止重复调用（防抖标记）
    if (window.__gatewayStarting) {
      console.log('⏳ Gateway 启动中，跳过重复请求')
      return
    }

    // 如果正在显示引导，不需要自动启动（引导流程会处理）
    if (showOnboarding) return

    // 设置防抖标记
    window.__gatewayStarting = true

    try {
      console.log('🔍 检查 OpenClaw 安装状态...')
      setInstallError(null)

      // 1. 检查 OpenClaw 是否安装
      const checkResult = await api.install.checkStatus()
      if (!checkResult.success) {
        console.error('❌ 检查安装状态失败:', checkResult.error)
        setInstallStatus(false)
        setInstallError(checkResult.error)
        return
      }

      console.log('📦 OpenClaw 安装状态:', checkResult.data)

      // 如果已安装，直接启动 Gateway
      if (checkResult.data?.installed) {
        setInstallStatus(true)
        await startGatewayIfNeeded()
        return
      }

      // 2. 未安装，自动安装
      console.log('⬇️ OpenClaw 未安装，开始自动安装...')
      setInstallStatus(false)
      setIsInstalling(true)

      const installResult = await api.install.install()
      setIsInstalling(false)

      if (installResult.success && installResult.data?.installed) {
        console.log('✅ OpenClaw 安装成功!')
        setInstallStatus(true)
        // 安装成功后启动 Gateway
        await startGatewayIfNeeded()
      } else {
        console.error('❌ OpenClaw 安装失败:', installResult.error || installResult.data?.error)
        setInstallError(installResult.error || installResult.data?.error || '安装失败')
      }
    } finally {
      // 清除防抖标记
      window.__gatewayStarting = false
    }
  }

  // 🔥 启动 Gateway（如果未运行）
  const startGatewayIfNeeded = async () => {
    const statusResult = await api.bundledGateway.status()
    if (!statusResult.success) {
      // 状态命令失败时，先探测现有 Gateway；若不存在再尝试启动 bundled
      const probeResult = await api.call('health', {}, { silent: true })
      if (probeResult.success) {
        console.log('✅ Gateway 可访问（状态命令失败但服务可用），继续使用')
        return
      }

      console.warn('⚠️ 读取 Gateway 状态失败，尝试直接启动 bundled Gateway...')
      const startResult = await api.bundledGateway.start()
      if (startResult.success) {
        console.log('✅ Gateway 启动成功（状态失败兜底路径）')
      } else {
        console.error('❌ Gateway 启动失败（状态失败兜底路径）:', startResult.error)
      }
      return
    }

    if (statusResult.success && !statusResult.data?.running) {
      // 兜底：如果已有外部 Gateway 在 18789 运行，则直接复用，不再强制启动 bundled 进程
      const probeResult = await api.call('health', {}, { silent: true })
      if (probeResult.success) {
        console.log('✅ 检测到已运行的 Gateway（外部进程），直接复用')
        return
      }

      console.log('🔄 Gateway 未运行，自动启动中...')
      const startResult = await api.bundledGateway.start()
      if (startResult.success) {
        console.log('✅ Gateway 自动启动成功')
      } else {
        console.error('❌ Gateway 自动启动失败:', startResult.error)
      }
    } else if (statusResult.success && statusResult.data?.running) {
      console.log('✅ Gateway 已在运行')
    }
  }

  const runStartupRepair = async () => {
    try {
      const [channelsResult, sessionsResult, cronResult] = await Promise.all([
        api.config.cleanupInvalidChannelAgentBindings(),
        api.sessions.cleanupInvalidAgentReferences(),
        api.cron.repairInvalidAgentBindings({ disableInvalid: true }),
      ])

      console.log('🧹 启动修复完成:', {
        channelsRemoved: channelsResult?.data?.removed || 0,
        sessionsRemoved: sessionsResult?.data?.removed || 0,
        cronFixed: cronResult?.data?.fixed || 0,
      })
    } catch (error) {
      console.warn('启动修复失败（忽略，不阻塞启动）:', error)
    }
  }

  // 🔥 处理智能体切换（从 WorkspaceEditor 跳转到聊天）
  const handleSwitchAgent = (agentId) => {
    setSwitchToAgent(agentId)
    setCurrentPage('chat')
    // 切换后重置状态，避免重复触发
    setTimeout(() => setSwitchToAgent(null), 100)
  }

  // 加载用户设置
  const loadUserSettings = () => {
    try {
      const stored = localStorage.getItem('openclaw_user_settings')
      if (stored) {
        setUserSettings(JSON.parse(stored))
      }
    } catch (e) {
      console.error('加载用户设置失败:', e)
    }
  }

  // 引导完成回调
  const handleOnboardingComplete = (settings) => {
    setShowOnboarding(false)
    setUserSettings(settings)
  }

  const loadConfig = async () => {
    // 🆕 使用统一 API 服务层
    const result = await api.config.get()
    if (result.success) {
      setConfig(result.data)
    } else {
      console.error('加载配置失败:', result.error)
    }
  }

  const loadSystemInfo = async () => {
    // 使用统一 API 服务层（方法名是 info 不是 getInfo）
    const result = await api.system.info()
    if (result.success) {
      setSystemInfo(result.data)
    } else {
      console.error('获取系统信息失败:', result.error)
    }
  }

  const renderSettings = () => (
    <PageContainer
      title="设置"
      description="配置 AI 服务和应用设置"
      actions={
        <Button variant="outline" onClick={loadConfig}>
          <RefreshCw className="w-4 h-4 mr-2" />
          刷新
        </Button>
      }
    >
      <SettingsPage
        config={config}
        systemInfo={systemInfo}
        hasUpdate={hasUpdate}
        onOpenAISettings={() => setShowAISettings(true)}
        onCheckUpdate={() => setShowUpdateDialog(true)}
        onRefresh={loadConfig}
      />
    </PageContainer>
  )

  // 显示引导界面
  if (showOnboarding) {
    return <EnhancedOnboardingGuide onComplete={handleOnboardingComplete} />
  }

  return (
    <div className="h-dvh flex bg-background overflow-hidden">
      {/* Toast 通知容器 */}
      <Toaster />

      {/* 侧边栏 */}
      <Sidebar
        currentPage={currentPage === 'tools' ? 'toolManager' : currentPage}
        onPageChange={(page) => setCurrentPage(page === 'tools' ? 'toolManager' : page)}
      />

      {/* 主内容区 - 统一用 flex-1 保证铺满剩余空间 */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* 使用 CSS 隐藏代替条件渲染，保留组件状态 */}
        <div className={`absolute inset-0 overflow-hidden flex flex-col ${currentPage === 'chat' ? '' : 'hidden'}`}>
          <Chat key={userSettings?.createdAt || 'default'} switchToAgent={switchToAgent} />
        </div>
        <div className={`absolute inset-0 overflow-auto ${currentPage === 'settings' ? '' : 'hidden'}`}>
          {renderSettings()}
        </div>
        {/* 其他页面 - 使用 CSS 隐藏 */}
        <div className={`absolute inset-0 overflow-auto ${currentPage === 'skills' ? '' : 'hidden'}`}>
          <PageContainer title="Skills" description="管理和配置 AI 技能">
            <Skills />
          </PageContainer>
        </div>
        <div className={`absolute inset-0 overflow-auto ${currentPage === 'schedule' ? '' : 'hidden'}`}>
          <PageContainer title="定时任务" description="创建和管理自动化任务">
            <Schedule />
          </PageContainer>
        </div>
        <div className={`absolute inset-0 overflow-auto ${currentPage === 'memory' ? '' : 'hidden'}`}>
          <PageContainer title="记忆中心" description="向量搜索驱动的智能记忆系统">
            <MemoryCenter />
          </PageContainer>
        </div>
        <div className={`absolute inset-0 overflow-auto ${currentPage === 'browser' ? '' : 'hidden'}`}>
          <PageContainer title="浏览器工具" description="自动化浏览器操作">
            <Browser />
          </PageContainer>
        </div>
        <div className={`absolute inset-0 overflow-auto ${currentPage === 'toolManager' || currentPage === 'tools' ? '' : 'hidden'}`}>
          <PageContainer title="工具管理" description="创建和管理自定义工具">
            <ToolManager />
          </PageContainer>
        </div>
        <div className={`absolute inset-0 overflow-auto ${currentPage === 'agents' ? '' : 'hidden'}`}>
          <PageContainer title="智能体管理" description="配置你的 AI 助手身份、人格和行为">
            <WorkspaceEditor onSwitchAgent={handleSwitchAgent} />
          </PageContainer>
        </div>

        {/* 通道管理 */}
        <div className={`absolute inset-0 overflow-auto ${currentPage === 'channels' ? '' : 'hidden'}`}>
          <PageContainer title="通道管理" description="管理自动回复和微信监控通道">
            <ChannelManager />
          </PageContainer>
        </div>

        {/* 成本追踪 */}
        <div className={`absolute inset-0 overflow-auto ${currentPage === 'cost' ? '' : 'hidden'}`}>
          <PageContainer title="成本追踪" description="API 调用成本统计">
            <CostTracker />
          </PageContainer>
        </div>

        {/* 心跳监控 */}
        <div className={`absolute inset-0 overflow-auto ${currentPage === 'heartbeat' ? '' : 'hidden'}`}>
          <PageContainer title="心跳监控" description="Agent 心跳状态监控">
            <HeartbeatMonitor />
          </PageContainer>
        </div>

        {/* 审计日志 */}
        <div className={`absolute inset-0 overflow-auto ${currentPage === 'audit' ? '' : 'hidden'}`}>
          <PageContainer title="审计日志" description="系统操作审计记录">
            <AuditLog />
          </PageContainer>
        </div>

        {/* 故障转移 */}
        <div className={`absolute inset-0 overflow-auto ${currentPage === 'failover' ? '' : 'hidden'}`}>
          <PageContainer title="故障转移" description="AI 模型提供商故障转移状态监控">
            <FailoverStatus />
          </PageContainer>
        </div>

        {/* 模式库管理 */}
        <div className={`absolute inset-0 overflow-auto ${currentPage === 'patterns' ? '' : 'hidden'}`}>
          <PageContainer title="模式库" description="智能体的成功模式和反模式管理">
            <PatternLibrary />
          </PageContainer>
        </div>

        {/* 节点设备管理 */}
        <div className={`absolute inset-0 overflow-auto ${currentPage === 'nodes' ? '' : 'hidden'}`}>
          <PageContainer title="节点设备管理" description="管理已连接的 iOS/Android/macOS 设备">
            <NodeManager />
          </PageContainer>
        </div>

        {/* 设备配对 */}
        <div className={`absolute inset-0 overflow-auto ${currentPage === 'pairing' ? '' : 'hidden'}`}>
          <PageContainer title="设备配对" description="配对新设备和管理访问令牌">
            <DevicePairing />
          </PageContainer>
        </div>

        {/* 节点发现 */}
        <div className={`absolute inset-0 overflow-auto ${currentPage === 'discovery' ? '' : 'hidden'}`}>
          <PageContainer title="节点发现" description="发现局域网/VPN 中的其他节点">
            <DiscoveryPanel />
          </PageContainer>
        </div>

        {/* Canvas 画布 */}
        <div className={`absolute inset-0 overflow-hidden ${currentPage === 'canvas' ? '' : 'hidden'}`}>
          <Canvas />
        </div>

        {/* 模型管理 */}
        <div className={`absolute inset-0 overflow-auto ${currentPage === 'models' ? '' : 'hidden'}`}>
          <PageContainer title="模型管理" description="查看、切换和配置 AI 模型">
            <ModelsManager />
          </PageContainer>
        </div>

        {/* TTS 语音合成 */}
        <div className={`absolute inset-0 overflow-auto ${currentPage === 'tts' ? '' : 'hidden'}`}>
          <PageContainer title="TTS 语音合成" description="配置语音合成服务">
            <TTS />
          </PageContainer>
        </div>

        {/* 自动回复 */}
        <div className={`absolute inset-0 overflow-auto ${currentPage === 'autoreply' ? '' : 'hidden'}`}>
          <PageContainer title="自动回复" description="配置自动回复规则">
            <AutoReply />
          </PageContainer>
        </div>

        {/* 主动消息 */}
        <div className={`absolute inset-0 overflow-auto ${currentPage === 'proactive' ? '' : 'hidden'}`}>
          <PageContainer title="主动消息" description="配置 Agent 主动发送消息行为">
            <ProactiveMessaging />
          </PageContainer>
        </div>

        {/* 子智能体管理 */}
        <div className={`absolute inset-0 overflow-auto ${currentPage === 'subagents' ? '' : 'hidden'}`}>
          <PageContainer title="子智能体管理" description="管理和监控子智能体">
            <SubAgentManager />
          </PageContainer>
        </div>

        {/* A2A 通信 */}
        <div className={`absolute inset-0 overflow-auto ${currentPage === 'a2a' ? '' : 'hidden'}`}>
          <PageContainer title="A2A 通信" description="智能体间通信管理">
            <A2ACommunication />
          </PageContainer>
        </div>

        {/* 密钥管理 */}
        <div className={`absolute inset-0 overflow-auto ${currentPage === 'secrets' ? '' : 'hidden'}`}>
          <PageContainer title="密钥管理" description="管理 API 密钥和敏感配置">
            <SecretsManager />
          </PageContainer>
        </div>

        {/* AI 设置弹窗 */}
        {showAISettings && (
          <AISettings
            onClose={() => setShowAISettings(false)}
            onConfigSaved={() => {
              loadConfig()
              setShowAISettings(false)
            }}
          />
        )}

        {/* 系统状态配置弹窗 */}
        <SystemStatusConfig
          open={showSystemConfig}
          onOpenChange={setShowSystemConfig}
        />

        {/* 更新对话框 */}
        <UpdateDialog
          open={showUpdateDialog}
          onOpenChange={setShowUpdateDialog}
          onUpdateComplete={() => {
            setShowUpdateDialog(false)
            setShowRestartDialog(true)
          }}
        />

        {/* 重启对话框 */}
        <RestartDialog
          open={showRestartDialog}
          onOpenChange={setShowRestartDialog}
        />
      </main>
    </div>
  )
}

export default App
