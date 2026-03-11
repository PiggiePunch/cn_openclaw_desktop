/**
 * OpenClaw 统一 API 服务层
 *
 * 通过 WebSocket 直接调用原版 OpenClaw Gateway (ws://127.0.0.1:18789)
 * 提供统一的错误处理和日志记录
 */

import { getGateway, ConnectionState } from './gateway'
import { toast } from '@/hooks/useToast'
import { invoke } from '@tauri-apps/api/core'

// ============================================================================
// 错误处理配置
// ============================================================================

const ERROR_CONFIG = {
  showToast: true,        // 是否显示错误 toast
  logToConsole: true,     // 是否记录到控制台
  silentCodes: [],        // 不显示 toast 的错误码
}

/**
 * 配置错误处理行为
 */
export function configureErrorHandling(config) {
  Object.assign(ERROR_CONFIG, config)
}

// ============================================================================
// 错误处理
// ============================================================================

/**
 * 统一错误处理器
 */
function handleError(error, context = {}) {
  const { method, silent = false } = context

  // 提取错误消息
  const message = typeof error === 'string'
    ? error
    : error?.message || error?.toString() || '未知错误'

  // 控制台日志
  if (ERROR_CONFIG.logToConsole) {
    console.error(`[API Error] ${method || 'unknown'}:`, error)
  }

  // 显示 toast（除非静默模式）
  if (ERROR_CONFIG.showToast && !silent) {
    toast.error('操作失败', message)
  }

  // 返回标准化错误对象
  return {
    success: false,
    error: message,
    originalError: error,
  }
}

/**
 * 包装 Gateway 调用，添加统一错误处理
 */
async function wrapGatewayCall(method, params = {}, options = {}) {
  const gateway = getGateway()

  // 检查连接状态
  if (!gateway.isConnected()) {
    console.warn(`[API] Gateway 未连接，尝试连接...`)
    try {
      await gateway.connect()
    } catch (connectError) {
      return handleError(connectError, { method, ...options })
    }
  }

  try {
    const result = await gateway.call(method, params, options)
    return { success: true, data: result }
  } catch (error) {
    return handleError(error, { method, ...options })
  }
}

/**
 * 流式调用包装
 */
async function wrapGatewayStreamCall(method, params = {}, onChunk, options = {}) {
  const gateway = getGateway()

  // 检查连接状态
  if (!gateway.isConnected()) {
    console.warn(`[API] Gateway 未连接，尝试连接...`)
    try {
      await gateway.connect()
    } catch (connectError) {
      return handleError(connectError, { method, ...options })
    }
  }

  try {
    const result = await gateway.call(method, params, {
      ...options,
      onStream: onChunk,
    })
    return { success: true, data: result }
  } catch (error) {
    return handleError(error, { method, ...options })
  }
}

// ============================================================================
// 便捷 API（Gateway 方法封装）
// ============================================================================

const api = {
  // ========== 原始方法 ==========
  call: wrapGatewayCall,
  callStream: wrapGatewayStreamCall,

  // ========== 配置相关 ==========
  config: {
    get: async () => wrapGatewayCall('config.get', {}),
    set: async (config) => wrapGatewayCall('config.set', { config }),
    update: async (partialConfig) => {
      // 先获取当前配置，再合并更新
      const currentResult = await wrapGatewayCall('config.get', {})
      if (currentResult.success) {
        const mergedConfig = {
          ...currentResult.data,
          ...partialConfig,
        }
        return wrapGatewayCall('config.set', { config: mergedConfig })
      }
      return currentResult
    },
  },

  // ========== 网关相关 ==========
  gateway: {
    status: () => wrapGatewayCall('gateway.status', {}),
    info: () => wrapGatewayCall('gateway.info', {}),
  },

  // ========== 会话相关 ==========
  sessions: {
    list: (agentId) => wrapGatewayCall('sessions.list', { agentId }),
    get: (sessionKey) => wrapGatewayCall('sessions.get', { sessionKey }),
    getMessages: (sessionKey) => wrapGatewayCall('sessions.getMessages', { sessionKey }),
    create: (agentId, sessionName) => wrapGatewayCall('sessions.create', { agentId, sessionName: sessionName || null }),
    delete: (sessionKey) => wrapGatewayCall('sessions.delete', { sessionKey }),
    clearAll: () => wrapGatewayCall('sessions.clearAll', {}),
  },

  // ========== 聊天相关 ==========
  chat: {
    send: (params) => wrapGatewayCall('chat.send', params),
    sendStream: (params, onChunk) => wrapGatewayStreamCall('chat.send', params, onChunk),
    abort: (sessionId) => wrapGatewayCall('chat.abort', { sessionId }),
    history: (sessionKey, options) => wrapGatewayCall('chat.history', { sessionKey, ...options }),
  },

  // ========== 智能体相关 ==========
  agents: {
    list: () => wrapGatewayCall('agents.list', {}),
    get: (agentId) => wrapGatewayCall('agents.get', { agentId }),
    create: (params) => wrapGatewayCall('agents.create', params),
    update: (agentId, params) => wrapGatewayCall('agents.update', { agentId, ...params }),
    delete: (agentId) => wrapGatewayCall('agents.delete', { agentId }),
    // 智能体文件
    files: {
      list: (agentId) => wrapGatewayCall('agents.files.list', { agentId }),
      get: (agentId, filename) => wrapGatewayCall('agents.files.get', { agentId, filename }),
      set: (agentId, filename, content) => wrapGatewayCall('agents.files.set', { agentId, filename, content }),
      delete: (agentId, filename) => wrapGatewayCall('agents.files.delete', { agentId, filename }),
    },
  },

  // ========== Skills 相关 ==========
  skills: {
    list: (params) => wrapGatewayCall('skills.list', params || {}),
    get: (skillId) => wrapGatewayCall('skills.get', { skillId }),
    execute: (skillId, input, sessionId) => wrapGatewayCall('skills.execute', { skillId, input, sessionId }),
    pause: (skillId) => wrapGatewayCall('skills.pause', { skillId }),
    resume: (skillId) => wrapGatewayCall('skills.resume', { skillId }),
    unregister: (skillId) => wrapGatewayCall('skills.unregister', { skillId }),
    create: (params) => wrapGatewayCall('skills.create', params),
    install: (source, name) => wrapGatewayCall('skills.install', { source, name }),
    // Skill 编辑
    getContent: (skillId) => wrapGatewayCall('skills.getContent', { skillId }),
    updateContent: (params) => wrapGatewayCall('skills.updateContent', params),
    // ClawHub
    clawhubSearch: (query) => wrapGatewayCall('skills.clawhub.search', { query }),
    clawhubInstall: (slug) => wrapGatewayCall('skills.clawhub.install', { slug }),
    clawhubUpdate: (slug) => wrapGatewayCall('skills.clawhub.update', { slug }),
    // 依赖管理
    getDependencies: (skillId) => wrapGatewayCall('skills.getDependencies', { skillId }),
    installDependencies: (skillId) => wrapGatewayCall('skills.installDependencies', { skillId }),
  },

  // ========== 定时任务相关 ==========
  cron: {
    list: () => wrapGatewayCall('cron.list', {}),
    get: (taskId) => wrapGatewayCall('cron.get', { taskId }),
    create: (task) => wrapGatewayCall('cron.create', { task }),
    update: (taskId, task) => wrapGatewayCall('cron.update', { taskId, task }),
    delete: (taskId) => wrapGatewayCall('cron.delete', { taskId }),
    toggle: (taskId) => wrapGatewayCall('cron.toggle', { taskId }),
    runNow: (taskId) => wrapGatewayCall('cron.runNow', { taskId }),
    history: () => wrapGatewayCall('cron.history', {}),
  },

  // ========== 记忆相关 ==========
  memory: {
    stats: () => wrapGatewayCall('memory.stats', {}),
    list: (limit, offset) => wrapGatewayCall('memory.list', { limit, offset }),
    search: (query, limit) => wrapGatewayCall('memory.search', { query, limit }),
    get: (id) => wrapGatewayCall('memory.get', { id }),
    store: (content, metadata) => wrapGatewayCall('memory.store', { content, metadata }),
    delete: (id) => wrapGatewayCall('memory.delete', { id }),
    reindex: () => wrapGatewayCall('memory.reindex', {}),
    import: (path) => wrapGatewayCall('memory.import', { path }),
    export: (path) => wrapGatewayCall('memory.export', { path }),
  },

  // ========== 工具相关 ==========
  tools: {
    catalog: () => wrapGatewayCall('tools.catalog', {}),
    list: () => wrapGatewayCall('tools.list', {}),
    get: (name) => wrapGatewayCall('tools.get', { name }),
    call: (name, args) => wrapGatewayCall('tools.call', { name, arguments: args }),
    callStream: (name, args, onChunk) => wrapGatewayStreamCall('tools.callStream', { name, arguments: args }, onChunk),
    // 工具管理
    discover: (params) => wrapGatewayCall('tools.discover', params),
    register: (params) => wrapGatewayCall('tools.register', params),
    update: (params) => wrapGatewayCall('tools.update', params),
    delete: (name) => wrapGatewayCall('tools.delete', { name }),
  },

  // ========== Workspace 相关 ==========
  workspace: {
    load: (agentId) => wrapGatewayCall('workspace.load', { agentId }),
    save: (agentId, files) => wrapGatewayCall('workspace.save', { agentId, files }),
    listFiles: (agentId) => wrapGatewayCall('workspace.listFiles', { agentId }),
    readFile: (agentId, fileName) => wrapGatewayCall('workspace.readFile', { agentId, fileName }),
    saveFile: (agentId, fileName, content) => wrapGatewayCall('workspace.saveFile', { agentId, fileName, content }),
    deleteFile: (agentId, fileName) => wrapGatewayCall('workspace.deleteFile', { agentId, fileName }),
    resetTemplates: (agentId) => wrapGatewayCall('workspace.resetTemplates', { agentId }),
  },

  // ========== 浏览器相关 ==========
  browser: {
    status: () => wrapGatewayCall('browser.status', {}),
    navigate: (url) => wrapGatewayCall('browser.navigate', { url }),
    snapshot: () => wrapGatewayCall('browser.snapshot', {}),
    click: (selector) => wrapGatewayCall('browser.click', { selector }),
    fill: (selector, value) => wrapGatewayCall('browser.fill', { selector, value }),
    evaluate: (script) => wrapGatewayCall('browser.evaluate', { script }),
    screenshot: () => wrapGatewayCall('browser.screenshot', {}),
    close: () => wrapGatewayCall('browser.close', {}),
    hover: (selector) => wrapGatewayCall('browser.hover', { selector }),
    drag: (startSelector, endSelector) => wrapGatewayCall('browser.drag', { startSelector, endSelector }),
    selectOption: (selector, value) => wrapGatewayCall('browser.selectOption', { selector, value }),
    pressKey: (key) => wrapGatewayCall('browser.pressKey', { key }),
    waitFor: (selector, timeout) => wrapGatewayCall('browser.waitFor', { selector, timeout }),
    waitForText: (text, timeout) => wrapGatewayCall('browser.waitForText', { text, timeout }),
    getText: (selector) => wrapGatewayCall('browser.getText', { selector }),
    getAttribute: (selector, attribute) => wrapGatewayCall('browser.getAttribute', { selector, attribute }),
  },

  // ========== 通道相关 ==========
  channels: {
    status: () => wrapGatewayCall('channels.status', {}),
    list: () => wrapGatewayCall('channels.list', {}),
    get: (channelId) => wrapGatewayCall('channels.get', { channelId }),
    configure: (channelId, config) => wrapGatewayCall('channels.configure', { channelId, config }),
    start: (channelId) => wrapGatewayCall('channels.start', { channelId }),
    stop: (channelId) => wrapGatewayCall('channels.stop', { channelId }),
    restart: (channelId) => wrapGatewayCall('channels.restart', { channelId }),
  },

  // ========== 权限相关 ==========
  permissions: {
    check: (permission) => wrapGatewayCall('permissions.check', { permission }),
    request: (permission) => wrapGatewayCall('permissions.request', { permission }),
    list: () => wrapGatewayCall('permissions.list', {}),
  },

  // ========== 反思/模式库相关 ==========
  reflection: {
    trigger: (messages) => wrapGatewayCall('reflection.trigger', { messages }),
    getHistory: () => wrapGatewayCall('reflection.getHistory', {}),
    getPatterns: (category, patternType) => wrapGatewayCall('reflection.getPatterns', { category, patternType }),
    addPattern: (pattern) => wrapGatewayCall('reflection.addPattern', { pattern }),
  },

  // ========== Failover 相关 ==========
  failover: {
    status: () => wrapGatewayCall('failover.status', {}),
    history: () => wrapGatewayCall('failover.history', {}),
    reset: () => wrapGatewayCall('failover.reset', {}),
    configure: (config) => wrapGatewayCall('failover.configure', config),
  },

  // ========== 主动消息相关 ==========
  proactive: {
    status: () => wrapGatewayCall('proactive.status', {}),
    trigger: () => wrapGatewayCall('proactive.trigger', {}),
    configure: (config) => wrapGatewayCall('proactive.configure', config),
    start: () => wrapGatewayCall('proactive.start', {}),
    stop: () => wrapGatewayCall('proactive.stop', {}),
  },

  // ========== TTS 相关 ==========
  tts: {
    status: () => wrapGatewayCall('tts.status', {}),
    voices: (provider) => wrapGatewayCall('tts.voices', provider ? { provider } : {}),
    synthesize: (text, voiceId) => wrapGatewayCall('tts.synthesize', { text, voiceId }),
    configure: (config) => wrapGatewayCall('tts.configure', config),
  },

  // ========== 自动回复相关 ==========
  autoReply: {
    list: () => wrapGatewayCall('autoReply.list', {}),
    create: (rule) => wrapGatewayCall('autoReply.create', { rule }),
    update: (ruleId, rule) => wrapGatewayCall('autoReply.update', { ruleId, rule }),
    delete: (ruleId) => wrapGatewayCall('autoReply.delete', { ruleId }),
    enable: (ruleId) => wrapGatewayCall('autoReply.enable', { ruleId }),
    disable: (ruleId) => wrapGatewayCall('autoReply.disable', { ruleId }),
    status: () => wrapGatewayCall('autoReply.status', {}),
  },

  // ========== 系统使用量/成本相关 ==========
  usage: {
    cost: (agentId, period) => wrapGatewayCall('usage.cost', { agentId, period }),
    stats: (agentId) => wrapGatewayCall('usage.stats', { agentId }),
  },

  // ========== 测试连接 ==========
  testConnection: (provider, model, apiKey, baseUrl) =>
    wrapGatewayCall('testConnection', { provider, model, apiKey, baseUrl }),

  // ========== 系统相关 ==========
  system: {
    info: () => wrapGatewayCall('system.info', {}),
    logs: () => wrapGatewayCall('system.logs', {}),
  },

  // ========== 模型相关 ==========
  models: {
    list: () => wrapGatewayCall('models.list', {}),
    get: (modelId) => wrapGatewayCall('models.get', { modelId }),
    current: () => wrapGatewayCall('models.current', {}),
    setDefault: (modelId) => wrapGatewayCall('models.setDefault', { modelId }),
  },

  // ========== 节点/设备相关 ==========
  node: {
    list: () => wrapGatewayCall('node.list', {}),
    get: (nodeId) => wrapGatewayCall('node.get', { nodeId }),
    pair: (nodeId) => wrapGatewayCall('node.pair', { nodeId }),
    unpair: (nodeId) => wrapGatewayCall('node.unpair', { nodeId }),
  },

  // ========== 设备配对相关 ==========
  devicePair: {
    list: () => wrapGatewayCall('devicePair.list', {}),
    approve: (pairId) => wrapGatewayCall('devicePair.approve', { pairId }),
    reject: (pairId) => wrapGatewayCall('devicePair.reject', { pairId }),
  },

  // ========== Presence 相关 ==========
  presence: {
    get: () => wrapGatewayCall('presence.get', {}),
    update: (status) => wrapGatewayCall('presence.update', { status }),
  },

  // ========== 心跳相关 ==========
  heartbeat: {
    status: () => wrapGatewayCall('heartbeat.status', {}),
    start: () => wrapGatewayCall('heartbeat.start', {}),
    stop: () => wrapGatewayCall('heartbeat.stop', {}),
    configure: (params) => wrapGatewayCall('heartbeat.configure', params),
    runOnce: () => wrapGatewayCall('heartbeat.runOnce', {}),
  },

  // ========== 审计日志相关 ==========
  audit: {
    query: (limit = 100, offset = 0) => wrapGatewayCall('audit.query', { limit, offset }),
    export: (format = 'json') => wrapGatewayCall('audit.export', { format }),
  },

  // ========== 模式库相关 ==========
  patterns: {
    list: (params = {}) => wrapGatewayCall('patterns.list', params),
    search: (query, params = {}) => wrapGatewayCall('patterns.search', { query, ...params }),
    get: (id) => wrapGatewayCall('patterns.get', { id }),
    feedback: (sessionId, isPositive, feedback, context = '') =>
      wrapGatewayCall('patterns.feedback', {
        session_id: sessionId,
        is_positive: isPositive,
        feedback,
        context,
      }),
    delete: (id) => wrapGatewayCall('patterns.delete', { id }),
    incrementEvidence: (id) => wrapGatewayCall('patterns.incrementEvidence', { id }),
    stats: () => wrapGatewayCall('patterns.stats', {}),
    getConfig: () => wrapGatewayCall('patterns.getConfig', {}),
    save: () => wrapGatewayCall('patterns.save', {}),
  },

  // ========== 日志相关 ==========
  logs: {
    tail: (options) => wrapGatewayCall('logs.tail', options || {}),
  },

  // ========== 密钥相关 ==========
  secrets: {
    list: () => wrapGatewayCall('secrets.list', {}),
    get: (key) => wrapGatewayCall('secrets.get', { key }),
    set: (key, value) => wrapGatewayCall('secrets.set', { key, value }),
    delete: (key) => wrapGatewayCall('secrets.delete', { key }),
    reload: () => wrapGatewayCall('secrets.reload', {}),
  },

  // ========== 推送相关 ==========
  push: {
    test: (deviceToken) => wrapGatewayCall('push.test', { deviceToken }),
  },

  // ========== 引导相关 ==========
  wizard: {
    status: () => wrapGatewayCall('wizard.status', {}),
    start: () => wrapGatewayCall('wizard.start', {}),
    complete: () => wrapGatewayCall('wizard.complete', {}),
    skip: () => wrapGatewayCall('wizard.skip', {}),
  },

  // ========== 身份相关 ==========
  identity: {
    get: (agentId) => wrapGatewayCall('identity.get', { agentId }),
    update: (agentId, params) => wrapGatewayCall('identity.update', { agentId, ...params }),
  },

  // ========== 子智能体相关 ==========
  subagents: {
    list: () => wrapGatewayCall('subagents.list', {}),
    spawn: (config) => wrapGatewayCall('subagents.spawn', { config }),
    terminate: (agentId) => wrapGatewayCall('subagents.terminate', { agentId }),
    stats: () => wrapGatewayCall('subagents.stats', {}),
    presets: () => wrapGatewayCall('subagents.presets', {}),
    cleanup: () => wrapGatewayCall('subagents.cleanup', {}),
  },

  // ========== A2A 通信相关 ==========
  a2a: {
    list: (filterStatus) => wrapGatewayCall('a2a.list', filterStatus ? { filterStatus } : {}),
    call: (agentId, message) => wrapGatewayCall('a2a.call', { agentId, message }),
    broadcast: (message, excludeSelf) => wrapGatewayCall('a2a.broadcast', { message, excludeSelf }),
    register: (info) => wrapGatewayCall('a2a.register', { info }),
    unregister: (agentId) => wrapGatewayCall('a2a.unregister', { agentId }),
    stats: () => wrapGatewayCall('a2a.stats', {}),
  },

  // ========== Discovery 相关 ==========
  discovery: {
    status: () => wrapGatewayCall('discovery.status', {}),
    peers: () => wrapGatewayCall('discovery.peers', {}),
    tailscaleStatus: () => wrapGatewayCall('discovery.tailscale.status', {}),
    scan: () => wrapGatewayCall('discovery.scan', {}),
    start: () => wrapGatewayCall('discovery.start', {}),
    stop: () => wrapGatewayCall('discovery.stop', {}),
  },

  // ========== Gateway 连接管理 ==========
  gatewayConnection: {
    connect: async () => {
      const gateway = getGateway()
      try {
        await gateway.connect()
        return { success: true }
      } catch (error) {
        return handleError(error, { method: 'connect' })
      }
    },
    disconnect: () => {
      const gateway = getGateway()
      gateway.disconnect()
      return { success: true }
    },
    getState: () => {
      const gateway = getGateway()
      return { success: true, data: gateway.getState() }
    },
    isConnected: () => {
      const gateway = getGateway()
      return { success: true, data: gateway.isConnected() }
    },
  },

  // ========== 事件监听 ==========
  events: {
    on: (event, handler) => {
      const gateway = getGateway()
      gateway.on(event, handler)
    },
    off: (event, handler) => {
      const gateway = getGateway()
      gateway.off(event, handler)
    },
    onStateChange: (listener) => {
      const gateway = getGateway()
      return gateway.onStateChange(listener)
    },
  },

  // ========== OpenClaw 安装管理（Tauri 命令）==========
  install: {
    // 检查安装状态
    checkStatus: async () => {
      try {
        const result = await invoke('check_install_status')
        return { success: true, data: result }
      } catch (error) {
        return handleError(error, { method: 'check_install_status' })
      }
    },
    // 触发自动安装
    install: async () => {
      try {
        const result = await invoke('install_openclaw')
        return { success: true, data: result }
      } catch (error) {
        return handleError(error, { method: 'install_openclaw' })
      }
    },
    // 检查更新
    checkUpdate: async () => {
      try {
        const result = await invoke('check_openclaw_update')
        return { success: true, data: result }
      } catch (error) {
        return handleError(error, { method: 'check_openclaw_update' })
      }
    },
    // 执行更新
    update: async () => {
      try {
        const result = await invoke('update_openclaw')
        return { success: true, data: result }
      } catch (error) {
        return handleError(error, { method: 'update_openclaw' })
      }
    },
    // 获取 OpenClaw 路径
    getPath: async () => {
      try {
        const result = await invoke('get_openclaw_path')
        return { success: true, data: result }
      } catch (error) {
        return handleError(error, { method: 'get_openclaw_path' })
      }
    },
  },

  // ========== Gateway 进程管理（Tauri 命令）==========
  bundledGateway: {
    // 启动打包的 Gateway
    start: async () => {
      try {
        const result = await invoke('start_bundled_gateway')
        return { success: true, data: result }
      } catch (error) {
        return handleError(error, { method: 'start_bundled_gateway' })
      }
    },
    // 停止打包的 Gateway
    stop: async () => {
      try {
        const result = await invoke('stop_bundled_gateway')
        return { success: true, data: result }
      } catch (error) {
        return handleError(error, { method: 'stop_bundled_gateway' })
      }
    },
    // 获取 Gateway 状态
    status: async () => {
      try {
        const result = await invoke('bundled_gateway_status')
        return { success: true, data: result }
      } catch (error) {
        return handleError(error, { method: 'bundled_gateway_status' })
      }
    },
    // 重启 Gateway
    restart: async () => {
      try {
        const result = await invoke('restart_bundled_gateway')
        return { success: true, data: result }
      } catch (error) {
        return handleError(error, { method: 'restart_bundled_gateway' })
      }
    },
    // 健康检查
    healthCheck: async () => {
      try {
        const result = await invoke('bundled_gateway_health_check')
        return { success: true, data: result }
      } catch (error) {
        return handleError(error, { method: 'bundled_gateway_health_check' })
      }
    },
  },

  // ========== 更新管理（Tauri 命令）==========
  updates: {
    // 获取当前版本
    getVersion: async () => {
      try {
        const result = await invoke('get_app_version')
        return { success: true, data: result }
      } catch (error) {
        return handleError(error, { method: 'get_app_version' })
      }
    },
    // 检查更新
    check: async () => {
      try {
        const result = await invoke('check_for_updates')
        return { success: true, data: result }
      } catch (error) {
        return handleError(error, { method: 'check_for_updates' })
      }
    },
    // 下载更新
    download: async () => {
      try {
        const result = await invoke('download_update')
        return { success: true, data: result }
      } catch (error) {
        return handleError(error, { method: 'download_update' })
      }
    },
    // 安装更新
    install: async () => {
      try {
        const result = await invoke('install_update')
        return { success: true, data: result }
      } catch (error) {
        return handleError(error, { method: 'install_update' })
      }
    },
  },
}

export default api
export { wrapGatewayCall, wrapGatewayStreamCall, ConnectionState }
