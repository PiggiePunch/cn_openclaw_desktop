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
// 配置格式转换（桌面版 <-> 原版 openclaw）
// ============================================================================

/**
 * 将 channels 中的 accounts 数组转换为对象格式（原版 openclaw 兼容）
 *
 * 桌面版格式: accounts: [{ id: "coder", bot_token: "xxx", ... }, ...]
 * 原版格式:   accounts: { "coder": { bot_token: "xxx", ... }, ... }
 *
 * @param {object} config - 原始配置
 * @returns {object} - 转换后的配置
 */
function convertAccountsArrayToObject(config) {
  if (!config || typeof config !== 'object') return config

  // 深拷贝避免修改原对象
  const result = JSON.parse(JSON.stringify(config))

  // 需要转换的通道类型
  const channelTypes = ['telegram', 'discord', 'slack']

  if (result.channels) {
    for (const channelType of channelTypes) {
      const channel = result.channels[channelType]
      if (channel && Array.isArray(channel.accounts)) {
        // 将数组转换为对象
        const accountsObj = {}
        for (const account of channel.accounts) {
          if (account && account.id) {
            // 提取账户数据，排除 id 字段（id 变成 key）
            const { id, ...accountData } = account

            if (channelType === 'telegram') {
              const botToken = accountData.botToken ?? accountData.bot_token ?? ''
              const allowFrom = Array.isArray(accountData.allowFrom)
                ? accountData.allowFrom
                : (Array.isArray(accountData.allowed_users) ? accountData.allowed_users : [])
              const groups = (() => {
                if (accountData.groups && typeof accountData.groups === 'object' && !Array.isArray(accountData.groups)) {
                  return accountData.groups
                }
                if (Array.isArray(accountData.allowed_groups)) {
                  const mapped = {}
                  for (const groupId of accountData.allowed_groups) {
                    if (typeof groupId === 'string' && groupId.trim()) {
                      mapped[groupId.trim()] = { enabled: true, requireMention: false }
                    }
                  }
                  return mapped
                }
                return {}
              })()

              accountsObj[id] = {
                ...accountData,
                botToken,
                allowFrom,
                groups,
              }

              delete accountsObj[id].bot_token
              delete accountsObj[id].allowed_users
              delete accountsObj[id].allowed_groups
              delete accountsObj[id].proxy_url
            } else {
              accountsObj[id] = accountData
            }
          }
        }
        channel.accounts = accountsObj
        console.log(`[API] 转换 ${channelType}.accounts: 数组 -> 对象`)
      }
    }
  }

  return result
}

/**
 * 将 channels 中的 accounts 对象转换为数组格式（桌面版 UI 兼容）
 *
 * @param {object} config - 原版配置
 * @returns {object} - 转换后的配置
 */
function convertAccountsObjectToArray(config) {
  if (!config || typeof config !== 'object') return config

  // 深拷贝避免修改原对象
  const result = JSON.parse(JSON.stringify(config))

  // 需要转换的通道类型
  const channelTypes = ['telegram', 'discord', 'slack']

  if (result.channels) {
    for (const channelType of channelTypes) {
      const channel = result.channels[channelType]
      if (channel && channel.accounts && typeof channel.accounts === 'object' && !Array.isArray(channel.accounts)) {
        // 将对象转换为数组
        const accountsArray = Object.entries(channel.accounts).map(([id, accountData]) => {
          const raw = accountData && typeof accountData === 'object' ? accountData : {}

          if (channelType === 'telegram') {
            const allowedGroups = Array.isArray(raw.allowed_groups)
              ? raw.allowed_groups
              : Object.keys(raw.groups || {})
            const allowedUsers = Array.isArray(raw.allowed_users)
              ? raw.allowed_users
              : (Array.isArray(raw.allowFrom) ? raw.allowFrom : [])

            return {
              id,
              ...raw,
              bot_token: raw.bot_token ?? raw.botToken ?? '',
              allowed_groups: allowedGroups,
              allowed_users: allowedUsers,
              proxy_url: raw.proxy_url ?? raw.proxyUrl ?? '',
            }
          }

          return {
            id,
            ...raw,
          }
        })
        channel.accounts = accountsArray
        console.log(`[API] 转换 ${channelType}.accounts: 对象 -> 数组`)
      }
    }
  }

  return result
}

const CONFIG_WRAPPER_FIELDS = new Set([
  'path',
  'exists',
  'raw',
  'parsed',
  'resolved',
  'valid',
  'config',
  'hash',
  'issues',
  'warnings',
  'legacyIssues',
])

const UI_ONLY_CONFIG_FIELDS = new Set([
  'ai_provider',
])

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function cloneJsonObject(value, fallback = {}) {
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    try {
      return JSON.parse(JSON.stringify(fallback))
    } catch {
      return {}
    }
  }
}

function unwrapGatewayConfigPayload(payload) {
  if (!isPlainObject(payload)) return payload

  if (isPlainObject(payload.config)) return payload.config
  if (isPlainObject(payload.resolved)) return payload.resolved
  if (isPlainObject(payload.parsed)) return payload.parsed

  return payload
}

function stripConfigWrapperFields(config) {
  if (!isPlainObject(config)) return {}
  for (const key of CONFIG_WRAPPER_FIELDS) {
    if (key in config) delete config[key]
  }
  return config
}

function extractProviderModelIds(provider) {
  if (!isPlainObject(provider)) return []

  const ids = []
  const pushId = (rawId) => {
    const id = typeof rawId === 'string' ? rawId.trim() : ''
    if (!id || ids.includes(id)) return
    ids.push(id)
  }

  if (Array.isArray(provider.models)) {
    for (const model of provider.models) {
      if (typeof model === 'string') {
        pushId(model)
      } else if (isPlainObject(model)) {
        pushId(model.id || model.name)
      }
    }
  }

  if (typeof provider.model === 'string') {
    pushId(provider.model)
  }

  return ids
}

const DEFAULT_PROVIDER_BASE_URLS = {
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  deepseek: 'https://api.deepseek.com/v1',
  moonshot: 'https://api.moonshot.cn/v1',
  doubao: 'https://ark.cn-beijing.volces.com/api/v3',
  minimax: 'https://api.minimaxi.com/anthropic',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta',
}

const LEGACY_MINIMAX_BASE_URLS = new Set([
  'https://api.minimaxi.com',
  'https://api.minimaxi.com/v1',
  'https://api.minimax.chat',
  'https://api.minimax.chat/v1',
])

function normalizeProviderBaseUrl(providerId, baseUrl) {
  const trimmed = typeof baseUrl === 'string' ? baseUrl.trim() : ''
  if (!trimmed) return ''

  const withoutTrailingSlash = trimmed.replace(/\/+$/, '')
  if (providerId !== 'minimax') return withoutTrailingSlash

  const lower = withoutTrailingSlash.toLowerCase()
  if (LEGACY_MINIMAX_BASE_URLS.has(lower)) {
    return DEFAULT_PROVIDER_BASE_URLS.minimax
  }

  return withoutTrailingSlash
}

function parsePrimaryModelRef(config) {
  const primaryRaw = typeof config?.agents?.defaults?.model?.primary === 'string'
    ? config.agents.defaults.model.primary.trim()
    : ''
  if (!primaryRaw || !primaryRaw.includes('/')) return null
  const [providerId, ...rest] = primaryRaw.split('/')
  const modelId = rest.join('/').trim()
  if (!providerId || !modelId) return null
  return { providerId: providerId.trim(), modelId }
}

function buildUiAiProviderFromModels(config) {
  if (!isPlainObject(config)) return {}

  const providers = isPlainObject(config.models?.providers) ? config.models.providers : {}
  const existingAiProvider = isPlainObject(config.ai_provider) ? config.ai_provider : {}
  const generated = {}

  for (const [providerId, providerConfig] of Object.entries(providers)) {
    if (!isPlainObject(providerConfig)) continue
    const modelIds = extractProviderModelIds(providerConfig)

    generated[providerId] = {
      enabled: true,
      api_key: typeof providerConfig.apiKey === 'string' ? providerConfig.apiKey : '',
      base_url: normalizeProviderBaseUrl(providerId, providerConfig.baseUrl),
      model: modelIds[0] || '',
      custom_models: modelIds,
    }
  }

  for (const [providerId, providerConfig] of Object.entries(existingAiProvider)) {
    if (providerId === 'current' || providerId === 'embedding') continue
    if (!generated[providerId] || !isPlainObject(providerConfig)) continue

    generated[providerId] = {
      ...generated[providerId],
      ...providerConfig,
      model: typeof providerConfig.model === 'string' && providerConfig.model.trim()
        ? providerConfig.model.trim()
        : generated[providerId].model,
      custom_models: Array.isArray(providerConfig.custom_models)
        ? providerConfig.custom_models.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim())
        : generated[providerId].custom_models,
    }
  }

  const primaryRef = parsePrimaryModelRef(config)
  if (primaryRef && !generated[primaryRef.providerId]) {
    generated[primaryRef.providerId] = {
      enabled: true,
      api_key: '',
      base_url: '',
      model: primaryRef.modelId,
      custom_models: [primaryRef.modelId],
    }
  }

  const isGeneratedProviderUsable = (providerId) => {
    const item = generated[providerId]
    if (!isPlainObject(item)) return false
    if (item.enabled === false) return false
    const hasApiKey = typeof item.api_key === 'string' && item.api_key.trim().length > 0
    const hasModel = Array.isArray(item.custom_models) && item.custom_models.length > 0
    return hasApiKey && hasModel
  }

  let current = typeof existingAiProvider.current === 'string' && existingAiProvider.current.trim()
    ? existingAiProvider.current.trim()
    : ''
  if ((!current || !generated[current] || !isGeneratedProviderUsable(current)) && primaryRef?.providerId && isGeneratedProviderUsable(primaryRef.providerId)) {
    current = primaryRef.providerId
  }
  if (!current || !generated[current] || !isGeneratedProviderUsable(current)) {
    current = Object.keys(generated).find((providerId) => isGeneratedProviderUsable(providerId)) || ''
  }
  if (!current || !generated[current]) {
    current = Object.keys(generated)[0] || 'qwen'
  }

  const result = {
    ...generated,
    current,
  }

  if (isPlainObject(existingAiProvider.embedding)) {
    result.embedding = existingAiProvider.embedding
  }

  return result
}

function mergeAiProviderIntoModels(config) {
  if (!isPlainObject(config)) return {}
  const aiProvider = isPlainObject(config.ai_provider) ? config.ai_provider : null
  if (!aiProvider) return config

  const models = isPlainObject(config.models) ? cloneJsonObject(config.models) : {}
  const providers = isPlainObject(models.providers) ? cloneJsonObject(models.providers) : {}
  const preferredProviderId = typeof aiProvider.current === 'string' ? aiProvider.current.trim() : ''

  for (const [providerId, providerConfig] of Object.entries(aiProvider)) {
    if (providerId === 'current' || providerId === 'embedding') continue
    if (!isPlainObject(providerConfig)) continue
    if (providerConfig.enabled === false) continue

    const nextProvider = isPlainObject(providers[providerId])
      ? providers[providerId]
      : {}

    if (typeof nextProvider.baseUrl !== 'string') {
      nextProvider.baseUrl = DEFAULT_PROVIDER_BASE_URLS[providerId] || ''
    }
    if (typeof nextProvider.apiKey !== 'string') {
      nextProvider.apiKey = ''
    }

    if (typeof providerConfig.api_key === 'string') {
      const normalizedApiKey = providerConfig.api_key.trim()
      if (!isRedactedSecretString(normalizedApiKey)) {
        nextProvider.apiKey = normalizedApiKey
      }
    }
    if (typeof providerConfig.base_url === 'string') {
      nextProvider.baseUrl = normalizeProviderBaseUrl(providerId, providerConfig.base_url)
    }
    nextProvider.baseUrl = normalizeProviderBaseUrl(providerId, nextProvider.baseUrl)

    // 保留脱敏占位符，交给后端 save_openclaw_config 里的
    // preserve_model_provider_api_keys 使用旧配置恢复真实 key。
    // 这里删除会导致“未编辑 provider 的 key 被清空”。

    if (providerId === 'minimax') {
      nextProvider.api = 'anthropic-messages'
      nextProvider.authHeader = true
    }

    const modelIds = Array.isArray(providerConfig.custom_models)
      ? providerConfig.custom_models
          .filter((id) => typeof id === 'string' && id.trim())
          .map((id) => id.trim())
      : (
          typeof providerConfig.model === 'string' && providerConfig.model.trim()
            ? [providerConfig.model.trim()]
            : []
        )

    if (modelIds.length > 0) {
      const existingModels = Array.isArray(nextProvider.models) ? nextProvider.models : []
      const existingMap = new Map()
      for (const model of existingModels) {
        const modelId = typeof model === 'string'
          ? model.trim()
          : (typeof model?.id === 'string' ? model.id.trim() : '')
        if (modelId) existingMap.set(modelId, model)
      }

      nextProvider.models = modelIds.map((modelId) => {
        const existing = existingMap.get(modelId)
        if (existing) return existing
        return { id: modelId, name: modelId }
      })
    }

    providers[providerId] = nextProvider
  }

  models.providers = providers
  config.models = models

  const pickPrimary = () => {
    const entries = Object.entries(providers).filter(([, provider]) => isPlainObject(provider))
    if (entries.length === 0) return null

    const findModelByProvider = (targetProviderId) => {
      const provider = providers[targetProviderId]
      if (!isPlainObject(provider)) return null
      const hasApiKey = typeof provider.apiKey === 'string' && provider.apiKey.trim().length > 0
      if (!hasApiKey) return null
      const modelIds = extractProviderModelIds(provider)
      if (modelIds.length === 0) return null
      return { providerId: targetProviderId, modelId: modelIds[0] }
    }

    if (preferredProviderId) {
      const preferred = findModelByProvider(preferredProviderId)
      if (preferred) return preferred
    }

    for (const [providerId] of entries) {
      const candidate = findModelByProvider(providerId)
      if (candidate) return candidate
    }
    return null
  }

  const primary = pickPrimary()
  if (primary) {
    if (!isPlainObject(config.agents)) config.agents = {}
    if (!isPlainObject(config.agents.defaults)) config.agents.defaults = {}
    if (!isPlainObject(config.agents.defaults.model)) config.agents.defaults.model = {}
    config.agents.defaults.model.primary = `${primary.providerId}/${primary.modelId}`
  }

  return config
}

function normalizeConfigForUi(rawPayload) {
  const unwrapped = unwrapGatewayConfigPayload(rawPayload)
  if (!isPlainObject(unwrapped)) return {}

  const config = stripConfigWrapperFields(cloneJsonObject(unwrapped))
  const withChannelAccounts = convertAccountsObjectToArray(config)
  withChannelAccounts.ai_provider = buildUiAiProviderFromModels(withChannelAccounts)
  return withChannelAccounts
}

function prepareConfigForPersistence(rawConfig) {
  const unwrapped = unwrapGatewayConfigPayload(rawConfig)
  if (!isPlainObject(unwrapped)) return {}

  let nextConfig = stripConfigWrapperFields(cloneJsonObject(unwrapped))
  nextConfig = mergeAiProviderIntoModels(nextConfig)

  for (const key of UI_ONLY_CONFIG_FIELDS) {
    if (key in nextConfig) delete nextConfig[key]
  }

  return convertAccountsArrayToObject(nextConfig)
}

// ============================================================================
// 错误处理配置
// ============================================================================

const ERROR_CONFIG = {
  showToast: true,        // 是否显示错误 toast
  logToConsole: true,     // 是否记录到控制台
  silentCodes: [],        // 不显示 toast 的错误码
}

const loggedWarnings = new Set()

function warnOnce(key, message) {
  if (loggedWarnings.has(key)) return
  loggedWarnings.add(key)
  console.warn(message)
}

function isTauriRuntime() {
  if (typeof window === 'undefined') return false
  return Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__?.core)
}

async function invokeTauri(command, args) {
  if (!isTauriRuntime()) {
    throw new Error(`Tauri runtime 不可用，无法调用命令: ${command}`)
  }
  return invoke(command, args)
}

function toSafeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeLocalAgentRow(row) {
  if (!row || typeof row !== 'object') return null
  const id = toSafeString(row.id || row.agent_id || row.agentId)
  if (!id) return null

  const name = toSafeString(row.name) || id
  const emoji = toSafeString(row.emoji) || '🤖'
  const workspace = toSafeString(row.workspace)
  return {
    id,
    name,
    display_name: name,
    emoji,
    workspace,
    identity: {
      name,
      emoji,
    },
  }
}

async function loadLocalAgentsFromTauri() {
  if (!isTauriRuntime()) return null
  try {
    const result = await invokeTauri('list_local_agents')
    const rows = Array.isArray(result) ? result.map(normalizeLocalAgentRow).filter(Boolean) : []
    return rows
  } catch (error) {
    console.warn('[API] 读取本地智能体列表失败:', error)
    return null
  }
}

async function loadLocalWorkspaceFromTauri(agentId) {
  if (!isTauriRuntime()) return null
  try {
    const result = await invokeTauri('load_local_agent_workspace', { agentId: String(agentId || 'main') })
    if (!result || typeof result !== 'object') return null
    return result
  } catch (error) {
    console.warn(`[API] 读取本地 workspace 失败 (${agentId}):`, error)
    return null
  }
}

async function readLocalWorkspaceFileFromTauri(agentId, fileName) {
  if (!isTauriRuntime()) return null
  try {
    const result = await invokeTauri('read_local_agent_workspace_file', {
      agentId: String(agentId || 'main'),
      fileName: String(fileName || ''),
    })
    return typeof result === 'string' ? result : String(result ?? '')
  } catch (error) {
    console.warn(`[API] 读取本地 workspace 文件失败 (${agentId}/${fileName}):`, error)
    return null
  }
}

async function saveLocalWorkspaceFileFromTauri(agentId, fileName, content) {
  if (!isTauriRuntime()) return false
  try {
    await invokeTauri('save_local_agent_workspace_file', {
      agentId: String(agentId || 'main'),
      fileName: String(fileName || ''),
      content: String(content ?? ''),
    })
    return true
  } catch (error) {
    console.warn(`[API] 写入本地 workspace 文件失败 (${agentId}/${fileName}):`, error)
    return false
  }
}

function normalizeArray(value, preferredKeys = []) {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== 'object') return []

  for (const key of preferredKeys) {
    if (Array.isArray(value[key])) return value[key]
  }

  return Object.values(value).filter(item => item && typeof item === 'object')
}

function generateIdempotencyKey(prefix = 'webchat') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function normalizeChatSendParams(rawParams = {}) {
  const params = typeof rawParams === 'object' && rawParams !== null ? rawParams : {}
  const sessionKey = typeof params.sessionKey === 'string' && params.sessionKey.trim()
    ? params.sessionKey.trim()
    : 'main'

  const message = (() => {
    if (typeof params.message === 'string') return params.message
    if (typeof params.text === 'string') return params.text
    if (typeof params.content === 'string') return params.content
    return ''
  })()

  const idempotencyKey = typeof params.idempotencyKey === 'string' && params.idempotencyKey.trim()
    ? params.idempotencyKey.trim()
    : (typeof params.runId === 'string' && params.runId.trim()
      ? params.runId.trim()
      : generateIdempotencyKey())

  const payload = {
    sessionKey,
    message,
    idempotencyKey,
  }

  if (typeof params.thinking === 'string' && params.thinking.trim()) {
    payload.thinking = params.thinking
  }
  if (typeof params.deliver === 'boolean') {
    payload.deliver = params.deliver
  }
  if (typeof params.timeoutMs === 'number' && Number.isFinite(params.timeoutMs) && params.timeoutMs >= 0) {
    payload.timeoutMs = Math.floor(params.timeoutMs)
  }
  if (Array.isArray(params.attachments)) {
    payload.attachments = params.attachments
  }
  if (params.systemInputProvenance && typeof params.systemInputProvenance === 'object') {
    payload.systemInputProvenance = params.systemInputProvenance
  }
  if (typeof params.systemProvenanceReceipt === 'string') {
    payload.systemProvenanceReceipt = params.systemProvenanceReceipt
  }

  const provider = typeof params.provider === 'string' && params.provider.trim()
    ? params.provider.trim()
    : null

  const rawModel = typeof params.model === 'string' && params.model.trim()
    ? params.model.trim()
    : null

  const model = (() => {
    if (!rawModel) return null
    if (rawModel.includes('/')) return rawModel
    if (provider) return `${provider}/${rawModel}`
    return rawModel
  })()

  return { payload, sessionKey, model }
}

const CRON_ANNOUNCE_CHANNELS = new Set([
  'last',
  'telegram',
  'discord',
  'slack',
  'mattermost',
  'signal',
  'imessage',
  'whatsapp',
])

function sanitizeCronDeliveryInput(rawDelivery, options = {}) {
  const forceDefaultNone = options.forceDefaultNone === true
  if (!isPlainObject(rawDelivery)) {
    return forceDefaultNone ? { mode: 'none' } : undefined
  }

  const modeRaw = typeof rawDelivery.mode === 'string' ? rawDelivery.mode.trim().toLowerCase() : ''
  const mode = modeRaw === 'deliver' ? 'announce' : modeRaw

  if (!mode) return forceDefaultNone ? { mode: 'none' } : undefined
  if (mode === 'none') return { mode: 'none' }

  if (mode === 'webhook') {
    const webhookUrl = typeof rawDelivery.to === 'string' ? rawDelivery.to.trim() : ''
    if (!/^https?:\/\//i.test(webhookUrl)) {
      return { mode: 'none' }
    }
    return { mode: 'webhook', to: webhookUrl }
  }

  if (mode === 'announce') {
    const channel = typeof rawDelivery.channel === 'string' ? rawDelivery.channel.trim().toLowerCase() : ''
    const to = typeof rawDelivery.to === 'string' ? rawDelivery.to.trim() : ''
    const accountId = typeof rawDelivery.accountId === 'string' ? rawDelivery.accountId.trim() : ''
    const bestEffort = typeof rawDelivery.bestEffort === 'boolean' ? rawDelivery.bestEffort : undefined

    // webchat 不是 cron announce 的稳定外发通道；必须回退到 none，避免随机串路由。
    if (channel === 'webchat') return { mode: 'none' }

    // announce 强制需要明确目标，避免回退到 last-route 造成“时好时坏”。
    if (!to) return { mode: 'none' }

    if (channel && !CRON_ANNOUNCE_CHANNELS.has(channel)) {
      return { mode: 'none' }
    }

    const normalized = { mode: 'announce', to }
    if (channel) normalized.channel = channel
    if (accountId) normalized.accountId = accountId
    if (bestEffort !== undefined) normalized.bestEffort = bestEffort
    return normalized
  }

  return { mode: 'none' }
}

function sanitizeCronCreateInput(rawTask) {
  const task = isPlainObject(rawTask) ? { ...rawTask } : {}
  const sessionTarget = typeof task.sessionTarget === 'string' ? task.sessionTarget.trim().toLowerCase() : ''
  const payloadKind = typeof task?.payload?.kind === 'string' ? task.payload.kind.trim() : ''
  const shouldForceDelivery = sessionTarget === 'isolated' && payloadKind === 'agentTurn'
  const normalizedDelivery = sanitizeCronDeliveryInput(task.delivery, { forceDefaultNone: shouldForceDelivery })
  if (normalizedDelivery) {
    task.delivery = normalizedDelivery
  } else {
    delete task.delivery
  }
  return task
}

function sanitizeCronUpdatePatch(rawPatch) {
  const patch = isPlainObject(rawPatch) ? { ...rawPatch } : {}
  if ('delivery' in patch) {
    const normalizedDelivery = sanitizeCronDeliveryInput(patch.delivery, { forceDefaultNone: false })
    if (normalizedDelivery) {
      patch.delivery = normalizedDelivery
    } else {
      delete patch.delivery
    }
  }
  return patch
}

const KNOWN_AGENT_CACHE_TTL_MS = 10_000
const SAFE_AGENT_ID_RE = /^[A-Za-z0-9_-]+$/
let knownAgentIdsCache = null
let knownAgentIdsCacheAt = 0
let knownAgentIdsInFlight = null
const cleanedUnknownSessionKeys = new Set()
const cleanedUnknownAgentIds = new Set()

function normalizeSessionKeyValue(rawSessionKey) {
  const raw = typeof rawSessionKey === 'string' ? rawSessionKey.trim() : ''
  if (!raw) return 'main'
  const lowered = raw.toLowerCase()
  if (lowered === 'main' || lowered === 'agent:main' || lowered === 'agent:main:main') {
    return 'main'
  }
  if (!raw.startsWith('agent:')) return raw

  const parts = raw.split(':')
  if (parts.length === 2) {
    return `${raw}:main`
  }
  return raw
}

function extractAgentIdFromSessionKey(rawSessionKey) {
  const normalized = normalizeSessionKeyValue(rawSessionKey)
  if (normalized === 'main') return 'main'
  if (!normalized.startsWith('agent:')) return 'main'
  const parts = normalized.split(':')
  return String(parts[1] || 'main').trim() || 'main'
}

function collectKnownAgentIdsFromRows(rows) {
  const set = new Set(['main', 'default'])
  if (!Array.isArray(rows)) return set
  for (const row of rows) {
    const id = String(row?.id || row?.agent_id || row?.agentId || '').trim()
    if (!id) continue
    set.add(id)
  }
  return set
}

async function getKnownAgentIdSet(options = {}) {
  const forceRefresh = options.forceRefresh === true
  const allowStale = options.allowStale !== false
  const now = Date.now()

  if (
    !forceRefresh &&
    Array.isArray(knownAgentIdsCache) &&
    (now - knownAgentIdsCacheAt) < KNOWN_AGENT_CACHE_TTL_MS
  ) {
    return new Set(knownAgentIdsCache)
  }

  if (!forceRefresh && knownAgentIdsInFlight) {
    try {
      const inFlight = await knownAgentIdsInFlight
      return new Set(inFlight)
    } catch {
      if (allowStale && Array.isArray(knownAgentIdsCache)) {
        return new Set(knownAgentIdsCache)
      }
      return null
    }
  }

  knownAgentIdsInFlight = (async () => {
    const result = await api.agents.list()
    if (!result.success || !Array.isArray(result.data)) {
      throw new Error(result.error || '加载智能体列表失败')
    }
    const set = collectKnownAgentIdsFromRows(result.data)
    const next = Array.from(set)
    knownAgentIdsCache = next
    knownAgentIdsCacheAt = Date.now()
    return next
  })()

  try {
    const latest = await knownAgentIdsInFlight
    return new Set(latest)
  } catch {
    if (allowStale && Array.isArray(knownAgentIdsCache)) {
      return new Set(knownAgentIdsCache)
    }
    return null
  } finally {
    knownAgentIdsInFlight = null
  }
}

async function cleanupInvalidSessionAndAgentArtifacts(sessionKeys = [], agentIds = []) {
  const uniqueSessionKeys = Array.from(new Set(
    (Array.isArray(sessionKeys) ? sessionKeys : [])
      .map((key) => normalizeSessionKeyValue(key))
      .filter(Boolean),
  ))
  const uniqueAgentIds = Array.from(new Set(
    (Array.isArray(agentIds) ? agentIds : [])
      .map((id) => String(id || '').trim())
      .filter((id) => id && id !== 'main' && SAFE_AGENT_ID_RE.test(id)),
  ))

  let removedSessionRefs = 0
  let removedAgentDirs = 0

  for (const key of uniqueSessionKeys) {
    if (cleanedUnknownSessionKeys.has(key)) continue
    cleanedUnknownSessionKeys.add(key)
    try {
      const result = await wrapGatewayCall('sessions.delete', { key }, { silent: true })
      if (result.success) removedSessionRefs += 1
    } catch {
      // ignore
    }
  }

  if (isTauriRuntime()) {
    for (const agentId of uniqueAgentIds) {
      if (cleanedUnknownAgentIds.has(agentId)) continue
      cleanedUnknownAgentIds.add(agentId)
      try {
        await invokeTauri('delete_local_agent_data', { agentId })
        removedAgentDirs += 1
      } catch {
        // ignore
      }
    }
  }

  return {
    removedSessionRefs,
    removedAgentDirs,
  }
}

async function filterSessionsByKnownAgents(rows, options = {}) {
  const cleanup = options.cleanup !== false
  const list = Array.isArray(rows) ? rows : []
  const knownAgentIds = await getKnownAgentIdSet({ allowStale: true })
  if (!(knownAgentIds instanceof Set) || knownAgentIds.size === 0) {
    return {
      sessions: list,
      removedSessionKeys: [],
      removedAgentIds: [],
    }
  }

  const sessions = []
  const removedSessionKeys = []
  const removedAgentIds = new Set()

  for (const row of list) {
    const sessionKey = normalizeSessionKeyValue(row?.session_key || row?.sessionKey || row?.key || '')
    if (!sessionKey) continue
    const agentId = extractAgentIdFromSessionKey(sessionKey)
    if (agentId !== 'main' && !knownAgentIds.has(agentId)) {
      removedSessionKeys.push(sessionKey)
      removedAgentIds.add(agentId)
      continue
    }
    sessions.push({
      ...row,
      session_key: sessionKey,
      sessionKey: sessionKey,
    })
  }

  if (cleanup && removedSessionKeys.length > 0) {
    await cleanupInvalidSessionAndAgentArtifacts(removedSessionKeys, Array.from(removedAgentIds))
  }

  return {
    sessions,
    removedSessionKeys,
    removedAgentIds: Array.from(removedAgentIds),
  }
}

async function guardSessionKeyWithKnownAgent(rawSessionKey, options = {}) {
  const cleanup = options.cleanup !== false
  const sessionKey = normalizeSessionKeyValue(rawSessionKey)
  const agentId = extractAgentIdFromSessionKey(sessionKey)
  if (agentId === 'main') {
    return { allowed: true, sessionKey, agentId }
  }

  const knownAgentIds = await getKnownAgentIdSet({ allowStale: true })
  if (!(knownAgentIds instanceof Set) || knownAgentIds.size === 0) {
    return { allowed: true, sessionKey, agentId }
  }

  if (knownAgentIds.has(agentId)) {
    return { allowed: true, sessionKey, agentId }
  }

  if (cleanup) {
    await cleanupInvalidSessionAndAgentArtifacts([sessionKey], [agentId])
  }

  return {
    allowed: false,
    sessionKey,
    agentId,
    reason: `智能体不存在: ${agentId}`,
  }
}

function getCronTaskId(task) {
  const id = task?.id ?? task?.jobId ?? task?.job_id ?? task?.taskId ?? task?.task_id
  return id == null ? '' : String(id).trim()
}

function getCronTaskAgentId(task) {
  return String(
    task?.agentId ||
    task?.agent_id ||
    task?.agent_config?.agent_id ||
    '',
  ).trim()
}

function getCronTaskSessionKey(task) {
  return String(task?.sessionKey || task?.session_key || '').trim()
}

function collectCronPayloadAgentIds(task) {
  const refs = new Set()
  const agentId = String(task?.agentId || task?.agent_id || '').trim()
  if (agentId) refs.add(agentId)

  const sessionKey = getCronTaskSessionKey(task)
  if (sessionKey) {
    const sessionAgentId = extractAgentIdFromSessionKey(sessionKey)
    if (sessionAgentId) refs.add(sessionAgentId)
  }

  return Array.from(refs)
}

async function validateCronPayloadAgentBindings(task) {
  const refs = collectCronPayloadAgentIds(task)
  if (refs.length === 0) return { ok: true, invalidAgentIds: [] }

  const knownAgentIds = await getKnownAgentIdSet({ allowStale: true })
  if (!(knownAgentIds instanceof Set) || knownAgentIds.size === 0) {
    return { ok: true, invalidAgentIds: [] }
  }

  const invalidAgentIds = refs.filter((id) => id !== 'main' && !knownAgentIds.has(id))
  if (invalidAgentIds.length > 0) {
    const sessionKey = getCronTaskSessionKey(task)
    await cleanupInvalidSessionAndAgentArtifacts(
      sessionKey ? [sessionKey] : [],
      invalidAgentIds,
    )
    return { ok: false, invalidAgentIds }
  }

  return { ok: true, invalidAgentIds: [] }
}

async function repairInvalidCronAgentBindings(options = {}) {
  const disableInvalid = options.disableInvalid !== false
  const listResult = await wrapGatewayCall('cron.list', { includeDisabled: true }, { silent: true })
  if (!listResult.success) return listResult

  const tasks = normalizeArray(listResult.data, ['items', 'tasks', 'list', 'jobs'])
    .filter((task) => task && typeof task === 'object')
  const knownAgentIds = await getKnownAgentIdSet({ allowStale: true })
  if (!(knownAgentIds instanceof Set) || knownAgentIds.size === 0) {
    return {
      success: true,
      data: { checked: tasks.length, fixed: 0, failed: 0, skipped: tasks.length },
    }
  }

  const staleSessionKeys = []
  const staleAgentIds = new Set()
  const failures = []
  let fixed = 0

  for (const task of tasks) {
    const taskId = getCronTaskId(task)
    if (!taskId) continue

    const agentId = getCronTaskAgentId(task)
    const sessionKey = normalizeSessionKeyValue(getCronTaskSessionKey(task))
    const sessionAgentId = extractAgentIdFromSessionKey(sessionKey)

    const invalidAgentId = agentId && agentId !== 'main' && !knownAgentIds.has(agentId)
    const invalidSessionAgentId = sessionAgentId !== 'main' && !knownAgentIds.has(sessionAgentId)
    if (!invalidAgentId && !invalidSessionAgentId) continue

    const patch = {}
    if (disableInvalid) patch.enabled = false
    if (invalidAgentId) {
      patch.agentId = null
      staleAgentIds.add(agentId)
    }
    if (invalidSessionAgentId) {
      patch.sessionKey = 'main'
      patch.sessionTarget = 'main'
      staleSessionKeys.push(sessionKey)
      staleAgentIds.add(sessionAgentId)
    }

    const updateResult = await wrapGatewayCall(
      'cron.update',
      { id: taskId, patch },
      { silent: true },
    )
    if (updateResult.success) {
      fixed += 1
    } else {
      failures.push({
        id: taskId,
        error: updateResult.error || '更新失败',
      })
    }
  }

  if (staleSessionKeys.length > 0 || staleAgentIds.size > 0) {
    await cleanupInvalidSessionAndAgentArtifacts(staleSessionKeys, Array.from(staleAgentIds))
  }

  return {
    success: true,
    data: {
      checked: tasks.length,
      fixed,
      failed: failures.length,
      failures,
    },
  }
}

async function cleanupInvalidChannelAgentBindings() {
  const configResult = await api.config.get()
  if (!configResult.success) return configResult

  const knownAgentIds = await getKnownAgentIdSet({ allowStale: true })
  if (!(knownAgentIds instanceof Set) || knownAgentIds.size === 0) {
    return { success: true, data: { removed: 0, saved: false } }
  }
  knownAgentIds.add('default')

  const fullConfig = cloneJsonObject(configResult.data || {})
  if (!isPlainObject(fullConfig.channels)) {
    return { success: true, data: { removed: 0, saved: false } }
  }
  const channels = fullConfig.channels
  let removed = 0

  const cleanupArrayOrObjectAccounts = (channelName) => {
    const channel = channels[channelName]
    if (!isPlainObject(channel) || channel.accounts == null) return

    if (Array.isArray(channel.accounts)) {
      const raw = channel.accounts
      const kept = raw.filter((account) => {
        const id = String(account?.id || '').trim()
        return id && knownAgentIds.has(id)
      })
      removed += (raw.length - kept.length)
      channel.accounts = kept
      return
    }

    if (isPlainObject(channel.accounts)) {
      const next = {}
      for (const [id, account] of Object.entries(channel.accounts)) {
        const accountId = String(id || '').trim()
        if (!accountId || !knownAgentIds.has(accountId)) {
          removed += 1
          continue
        }
        next[accountId] = account
      }
      channel.accounts = next
    }
  }

  cleanupArrayOrObjectAccounts('telegram')
  cleanupArrayOrObjectAccounts('discord')
  cleanupArrayOrObjectAccounts('slack')
  cleanupArrayOrObjectAccounts('feishu')

  if (removed <= 0) {
    return { success: true, data: { removed: 0, saved: false } }
  }

  const saveResult = await api.config.set(fullConfig)
  if (!saveResult.success) return saveResult

  return {
    success: true,
    data: {
      removed,
      saved: true,
    },
  }
}

function normalizeAgentIdLike(input) {
  const raw = String(input || '').trim().toLowerCase()
  const cleaned = raw.replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return cleaned || `agent-${Date.now()}`
}

function buildIdentityMarkdown(name, emoji = '🤖', avatar = '') {
  const safeName = String(name || 'Assistant').trim() || 'Assistant'
  const safeEmoji = String(emoji || '🤖').trim() || '🤖'
  const safeAvatar = String(avatar || '').trim()

  return `---
name: ${safeName}
emoji: "${safeEmoji}"
${safeAvatar ? `avatar: "${safeAvatar}"\n` : ''}---

# 身份信息

这个文件定义了智能体的基本身份信息。`
}

function toSessionRow(item) {
  if (typeof item === 'string') {
    const sessionKey = item.trim() || 'main'
    return {
      session_key: sessionKey,
      sessionKey,
      session_id: null,
      created_at: null,
      updated_at: null,
      message_count: 0,
      title: sessionKey === 'main' ? '默认会话' : sessionKey,
    }
  }

  const row = item && typeof item === 'object' ? item : {}
  const sessionKey = row?.session_key || row?.sessionKey || row?.key || ''
  const rawCount =
    row?.message_count ??
    row?.messageCount ??
    row?.count ??
    row?.total_messages ??
    0
  const numericCount = Number(rawCount)
  return {
    ...row,
    session_key: sessionKey,
    sessionKey,
    session_id: row?.session_id || row?.sessionId || null,
    created_at: row?.created_at || row?.createdAt || row?.updated_at || row?.updatedAt || null,
    updated_at: row?.updated_at || row?.updatedAt || null,
    message_count: Number.isFinite(numericCount) ? numericCount : 0,
    title: row?.title || row?.name || row?.label || row?.session_name || '未命名会话',
  }
}

function normalizeAgentRecord(raw, keyHint = '') {
  let candidate = raw
  let inferredId = typeof keyHint === 'string' ? keyHint.trim() : ''

  if (Array.isArray(candidate)) {
    const [id, identity] = candidate
    if (typeof id === 'string' && id.trim()) inferredId = id.trim()

    if (identity && typeof identity === 'object' && !Array.isArray(identity)) {
      candidate = { identity }
    } else if (typeof identity === 'string') {
      candidate = { workspace: identity }
    } else {
      candidate = {}
    }
  } else if (typeof candidate === 'string') {
    if (!inferredId) return null
    candidate = { workspace: candidate }
  }

  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    if (!inferredId) return null
    candidate = {}
  }

  const id =
    inferredId ||
    String(candidate.id || candidate.agent_id || candidate.agentId || candidate.key || '').trim()

  if (!id) return null

  const identitySource = candidate.identity && typeof candidate.identity === 'object'
    ? candidate.identity
    : {}

  const displayName =
    candidate.display_name ||
    candidate.displayName ||
    candidate.name ||
    identitySource.name ||
    id

  const emoji = candidate.emoji || identitySource.emoji || '🤖'

  return {
    ...candidate,
    id,
    name: displayName,
    display_name: displayName,
    emoji,
    identity: {
      ...identitySource,
      name: displayName,
      emoji,
      ...(typeof candidate.description === 'string' && !identitySource.description
        ? { description: candidate.description }
        : {}),
    },
  }
}

function normalizeAgentsListPayload(data) {
  const rows = []
  const seen = new Set()
  const skipMapKeys = new Set([
    'ok', 'success', 'error', 'errors', 'message', 'messages', 'status',
    'meta', 'count', 'total', 'page', 'pages',
  ])

  const push = (entry, keyHint = '') => {
    const row = normalizeAgentRecord(entry, keyHint)
    if (!row || seen.has(row.id)) return
    seen.add(row.id)
    rows.push(row)
  }

  const pushArray = (arr) => {
    for (const entry of arr) {
      push(entry)
    }
  }

  if (Array.isArray(data)) {
    pushArray(data)
    return rows
  }

  if (!data || typeof data !== 'object') {
    return rows
  }

  const single = normalizeAgentRecord(data)
  if (single) {
    return [single]
  }

  let consumed = false
  for (const key of ['agents', 'items', 'list']) {
    const bucket = data[key]
    if (Array.isArray(bucket)) {
      pushArray(bucket)
      consumed = true
      continue
    }

    if (bucket && typeof bucket === 'object' && !Array.isArray(bucket)) {
      for (const [id, value] of Object.entries(bucket)) {
        push(value, id)
      }
      consumed = true
    }
  }

  if (consumed) return rows

  for (const [id, value] of Object.entries(data)) {
    if (skipMapKeys.has(id)) continue
    if (typeof value === 'number' || typeof value === 'boolean') continue
    push(value, id)
  }

  return rows
}

function normalizeWorkspacePayload(data, fallbackAgentId = 'main') {
  const safeFallbackId = typeof fallbackAgentId === 'string' && fallbackAgentId.trim()
    ? fallbackAgentId.trim()
    : 'main'

  const source = data && typeof data === 'object' && !Array.isArray(data) ? data : {}
  const identitySource = source.identity && typeof source.identity === 'object'
    ? source.identity
    : {}

  let channels = source.channels
  if (typeof channels === 'string') {
    try {
      channels = JSON.parse(channels)
    } catch {
      channels = []
    }
  }
  if (!Array.isArray(channels)) channels = []

  const name =
    identitySource.name ||
    source.name ||
    source.display_name ||
    source.displayName ||
    (safeFallbackId === 'main' ? '默认助手' : safeFallbackId)

  const emoji = identitySource.emoji || source.emoji || '🤖'

  return {
    ...source,
    identity: {
      ...identitySource,
      name,
      emoji,
      ...(typeof source.description === 'string' && !identitySource.description
        ? { description: source.description }
        : {}),
    },
    channels,
    files: normalizeArray(source.files, ['files', 'items', 'list']),
  }
}

function extractWorkspaceFileContent(data) {
  if (typeof data === 'string') return data
  if (data == null) return ''

  if (Array.isArray(data)) {
    return data.map((item) => {
      if (typeof item === 'string') return item
      try {
        return JSON.stringify(item)
      } catch {
        return String(item)
      }
    }).join('\n')
  }

  if (typeof data === 'object') {
    const content =
      data.content ??
      data.file?.content ??
      data.text ??
      data.value ??
      data.markdown ??
      data.body

    if (typeof content === 'string') return content
    if (typeof content === 'number' || typeof content === 'boolean') return String(content)

    try {
      return JSON.stringify(data, null, 2)
    } catch {
      return String(data)
    }
  }

  return String(data)
}

function flattenToolCatalog(data) {
  // tools.catalog 形态：{ groups: [{ tools: [...] }] }
  const groups = normalizeArray(data, ['groups', 'items'])
  if (groups.length > 0 && groups[0]?.tools) {
    const list = []
    for (const group of groups) {
      const tools = normalizeArray(group?.tools)
      for (const tool of tools) {
        list.push({
          name: tool?.name || tool?.id || '',
          description: tool?.description || tool?.label || '',
          category: group?.id || 'other',
          source: tool?.source || group?.source,
          pluginId: tool?.pluginId || group?.pluginId,
        })
      }
    }
    return list.filter(t => t.name)
  }

  // 兼容其他形态
  const list = normalizeArray(data, ['tools', 'list', 'items'])
  return list.map((tool) => ({
    ...tool,
    name: tool?.name || tool?.id || '',
    description: tool?.description || tool?.label || '',
  })).filter(t => t.name)
}

function extractErrorMessage(error) {
  if (!error) return '未知错误'
  if (typeof error === 'string') return error
  if (error instanceof Error && typeof error.message === 'string' && error.message.trim()) {
    return error.message
  }

  const msg =
    error?.message ||
    error?.error?.message ||
    error?.error ||
    error?.reason ||
    error?.details?.message

  if (typeof msg === 'string' && msg.trim()) return msg

  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

function getErrorCode(error) {
  return error?.code || error?.error?.code || error?.raw?.code || null
}

function isUnknownMethodError(error) {
  const code = getErrorCode(error)
  const message = extractErrorMessage(error).toLowerCase()
  return message.includes('unknown method') || (code === 'INVALID_REQUEST' && message.includes('method'))
}

function isRedactedSecretString(value) {
  if (typeof value !== 'string') return false
  const v = value.trim()
  if (!v) return false
  if (v === '__OPENCLAW_REDACTED__') return true
  if (v.includes('REDACTED')) return true
  return /^\*{4,}$/.test(v)
}

// Gateway token 初始化锁（防止并发重复读取配置）
let tokenInitPromise = null
let tokenAutoLoadDisabled = false

function isGatewayTokenMismatchError(error) {
  const message = extractErrorMessage(error).toLowerCase()
  const detailsCode = String(
    error?.details?.code ||
    error?.raw?.details?.code ||
    error?.originalError?.details?.code ||
    ''
  ).toUpperCase()

  return detailsCode === 'AUTH_TOKEN_MISMATCH' || message.includes('token mismatch')
}

function isLikelyGatewayAuthClose(error) {
  const message = extractErrorMessage(error).toLowerCase()
  return (
    message.includes('连接关闭: 1006') ||
    message.includes('connection closed: 1006') ||
    message.includes('unauthorized') ||
    message.includes('auth')
  )
}

/**
 * 确保 Gateway 认证 token 已加载
 *
 * 场景：
 * - 应用首屏渲染时，页面组件可能早于 App 初始化触发 API 调用
 * - 此时如果 token 尚未设置，connect 握手会被 Gateway 拒绝（token_missing）
 */
async function ensureGatewayAuthToken(gateway, options = {}) {
  const { force = false } = options

  // 已有 token，无需重复读取
  if (!force && gateway.hasAuthToken?.()) return
  if (tokenAutoLoadDisabled) return

  // 并发复用同一个初始化 Promise
  if (tokenInitPromise) {
    await tokenInitPromise
    return
  }

  tokenInitPromise = (async () => {
    if (!isTauriRuntime()) {
      console.log('[API] 非 Tauri 运行环境，跳过 Gateway token 自动加载')
      return
    }

    try {
      let token = ''
      try {
        token = await invokeTauri('resolve_gateway_auth_token')
      } catch (resolveError) {
        console.warn('[API] resolve_gateway_auth_token 失败，回退读取配置文件:', resolveError)
      }

      if (!token) {
        const configJson = await invokeTauri('get_openclaw_config')
        const config = JSON.parse(configJson || '{}')
        token = config?.gateway?.auth?.token
      }

      if (typeof token === 'string' && token.trim() && !isRedactedSecretString(token)) {
        gateway.setAuthToken(token)
        console.log(force ? '[API] 已强制刷新 Gateway auth token' : '[API] 已加载 Gateway auth token')
      } else {
        console.log('[API] 配置中无可用 Gateway auth token，将尝试无 token 连接')
      }
    } catch (error) {
      // 配置读取失败不阻塞后续流程，交由 connect 错误处理兜底
      console.warn('[API] 读取 Gateway auth token 失败:', error)
      const msg = extractErrorMessage(error).toLowerCase()
      if (msg.includes('access control') || msg.includes('denied') || msg.includes('forbidden')) {
        tokenAutoLoadDisabled = true
      }
    }
  })()

  try {
    await tokenInitPromise
  } finally {
    tokenInitPromise = null
  }
}

async function runProviderConnectivityTest(provider, model, apiKey, baseUrl) {
  if (!isTauriRuntime()) {
    return {
      success: true,
      data: {
        success: false,
        message: '仅 Tauri 桌面环境支持在线连通性测试。',
      },
    }
  }

  try {
    const result = await invokeTauri('test_model_connection', {
      provider,
      model,
      apiKey,
      baseUrl,
    })
    return { success: true, data: result }
  } catch (error) {
    return handleError(error, { method: 'test_model_connection' })
  }
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
  const message = extractErrorMessage(error)

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
    code: getErrorCode(error),
    originalError: error,
  }
}

async function tryUnknownMethodFallback(method, params = {}, options = {}) {
  const call = (m, p = {}) => wrapGatewayCall(m, p, { ...options, silent: true, _skipFallback: true })

  switch (method) {
    case 'skills.list': {
      const status = await call('skills.status', params)
      if (status.success) {
        const skills = normalizeArray(status.data, ['skills', 'entries', 'items'])
          .map((skill, idx) => ({
            ...skill,
            id: skill?.id || skill?.skillKey || skill?.name || `skill-${idx}`,
            name: skill?.name || skill?.id || `skill-${idx}`,
          }))
        return { success: true, data: { ...(status.data || {}), skills } }
      }
      return { success: true, data: { skills: [] } }
    }
    case 'skills.stats': {
      const status = await call('skills.status', params)
      const skills = status.success ? normalizeArray(status.data, ['skills', 'entries', 'items']) : []
      return {
        success: true,
        data: {
          total: skills.length,
          ready: skills.filter(s => s?.eligible !== false).length,
          disabled: skills.filter(s => s?.disabled === true).length,
        },
      }
    }
    case 'tools.list': {
      const catalog = await call('tools.catalog', params)
      if (catalog.success) {
        return { success: true, data: flattenToolCatalog(catalog.data) }
      }
      return { success: true, data: [] }
    }
    case 'sessions.getMessages': {
      const sessionKey = params?.sessionKey || params?.key || 'main'
      const res = await call('chat.history', { sessionKey })
      if (res.success) {
        return { success: true, data: normalizeArray(res.data, ['messages', 'items']) }
      }
      return { success: true, data: [] }
    }
    case 'memory.stats':
      return { success: true, data: { total: 0, count: 0 } }
    case 'memory.list':
      return { success: true, data: { memories: [] } }
    case 'memory.get':
      return { success: true, data: null }
    case 'memory.store':
    case 'memory.delete':
    case 'memory.reindex':
    case 'memory.import':
    case 'memory.export':
      return { success: false, error: '当前 Gateway 版本不支持记忆写入/管理接口' }
    case 'memory.search': {
      const query = typeof params?.query === 'string' ? params.query.trim().toLowerCase() : ''
      const limit = Number.isFinite(params?.limit) ? Math.max(1, Math.floor(params.limit)) : 10

      const list = await tryUnknownMethodFallback('memory.list', { limit: 200, offset: 0 }, options)
      if (!list.success) {
        return { success: true, data: { results: [] } }
      }

      const rows = normalizeArray(list.data, ['memories', 'items', 'results', 'list'])
      const searched = query
        ? rows.filter((item) => {
            const haystack = [
              item?.content,
              item?.text,
              item?.snippet,
              item?.summary,
              item?.title,
              item?.metadata?.title,
              item?.metadata?.summary,
            ]
              .filter(Boolean)
              .map((v) => String(v).toLowerCase())
              .join('\n')
            return haystack.includes(query)
          })
        : rows

      const results = searched.slice(0, limit).map((item) => ({
        id: item?.id || item?.memory_id || item?.key || null,
        score: typeof item?.score === 'number'
          ? item.score
          : (typeof item?.similarity === 'number' ? item.similarity : 0),
        snippet: item?.snippet || item?.content || item?.text || item?.summary || '',
        content: item?.content || item?.text || item?.snippet || item?.summary || '',
        metadata: item?.metadata || {},
      }))

      return { success: true, data: { results } }
    }
    case 'tts.voices': {
      const providers = await call('tts.providers', {})
      if (providers.success) {
        return { success: true, data: normalizeArray(providers.data, ['providers', 'items', 'voices']) }
      }
      return { success: true, data: [] }
    }
    case 'testConnection':
      return runProviderConnectivityTest(
        params?.provider,
        params?.model,
        params?.apiKey,
        params?.baseUrl,
      )
    case 'workflow.get':
      return { success: true, data: { nodes: [], edges: [] } }
    case 'workflow.save':
      return { success: true, data: { ok: true } }
    case 'workspace.load':
      return {
        success: true,
        data: {
          identity: { name: params?.agentId === 'main' ? '默认助手' : `智能体-${params?.agentId || 'unknown'}` },
          files: [],
        },
      }
    case 'workspace.listFiles': {
      const agentId = String(params?.agentId || 'main')
      const res = await call('agents.files.list', { agentId })
      if (res.success) {
        return { success: true, data: normalizeArray(res.data, ['files', 'items']) }
      }
      return res
    }
    case 'workspace.readFile': {
      const agentId = String(params?.agentId || 'main')
      const fileName = String(params?.fileName || params?.filename || params?.name || '')
      if (!fileName) return { success: false, error: '缺少 fileName 参数' }
      let res = await call('agents.files.get', { agentId, name: fileName })
      if (!res.success) {
        res = await call('agents.files.get', { agentId, filename: fileName, fileName })
      }
      if (res.success) {
        const content = typeof res.data === 'string'
          ? res.data
          : (res.data?.file?.content ?? res.data?.content ?? '')
        return { success: true, data: String(content ?? '') }
      }
      return res
    }
    case 'workspace.saveFile': {
      const agentId = String(params?.agentId || 'main')
      const fileName = String(params?.fileName || params?.filename || params?.name || '')
      if (!fileName) return { success: false, error: '缺少 fileName 参数' }
      let res = await call('agents.files.set', {
        agentId,
        name: fileName,
        content: String(params?.content ?? ''),
      })
      if (!res.success) {
        res = await call('agents.files.set', {
          agentId,
          filename: fileName,
          fileName,
          content: String(params?.content ?? ''),
        })
      }
      return res
    }
    case 'workspace.deleteFile':
      return { success: false, error: '当前 Gateway 版本不支持删除 workspace 文件' }
    case 'workspace.resetTemplates':
      return { success: false, error: '当前 Gateway 版本不支持重置模板' }
    case 'workspace.save':
      return { success: true, data: { ok: true } }
    case 'autoReply.list':
      return { success: true, data: [] }
    case 'autoReply.status':
      return { success: true, data: { enabled: false, running: false } }
    case 'autoReply.create':
    case 'autoReply.update':
    case 'autoReply.delete':
    case 'autoReply.enable':
    case 'autoReply.disable':
      return { success: false, error: '当前 Gateway 版本不支持自动回复管理接口' }
    case 'proactive.status':
      return { success: true, data: { enabled: false, running: false } }
    case 'proactive.configure':
    case 'proactive.start':
    case 'proactive.stop':
    case 'proactive.trigger':
      return { success: false, error: '当前 Gateway 版本不支持主动消息控制接口' }
    case 'audit.query':
      return { success: true, data: [] }
    case 'audit.export':
      return { success: false, error: '当前 Gateway 版本不支持审计导出' }
    case 'reflection.getHistory':
      return { success: true, data: [] }
    case 'reflection.getPatterns':
      return { success: true, data: [] }
    case 'reflection.trigger':
      return { success: false, error: '当前 Gateway 版本不支持反思/记忆沉淀触发接口' }
    case 'reflection.addPattern':
      return { success: false, error: '当前 Gateway 版本不支持模式写入接口' }
    case 'patterns.list':
      return { success: true, data: [] }
    case 'patterns.search':
      return { success: true, data: [] }
    case 'patterns.get':
      return { success: true, data: null }
    case 'patterns.stats':
      return { success: true, data: {} }
    case 'patterns.getConfig':
      return { success: true, data: {} }
    case 'patterns.feedback':
    case 'patterns.delete':
    case 'patterns.incrementEvidence':
    case 'patterns.save':
      return { success: false, error: '当前 Gateway 版本不支持模式库写入接口' }
    case 'secrets.list':
      return { success: true, data: { secrets: [] } }
    case 'secrets.get':
      return { success: true, data: null }
    case 'secrets.set':
    case 'secrets.delete':
    case 'secrets.reload':
      return { success: false, error: '当前 Gateway 版本不支持密钥管理接口' }
    case 'subagents.list':
      return { success: true, data: [] }
    case 'subagents.stats':
      return { success: true, data: {} }
    case 'subagents.presets':
      return { success: true, data: [] }
    case 'subagents.spawn':
    case 'subagents.terminate':
    case 'subagents.cleanup':
      return { success: false, error: '当前 Gateway 版本不支持子 Agent 管理接口' }
    case 'a2a.list':
      return { success: true, data: [] }
    case 'a2a.stats':
      return { success: true, data: {} }
    case 'a2a.call':
    case 'a2a.broadcast':
    case 'a2a.register':
    case 'a2a.unregister':
      return { success: false, error: '当前 Gateway 版本不支持 A2A 管理接口' }
    case 'tts.status':
      return { success: true, data: { enabled: false, provider: '', voice: '' } }
    case 'tts.synthesize':
    case 'tts.configure':
      return { success: false, error: '当前 Gateway 版本不支持 TTS 控制接口' }
    case 'talk.config':
      return { success: true, data: { enabled: false, mode: 'manual' } }
    case 'talk.mode':
      return { success: false, error: '当前 Gateway 版本不支持语音通话模式设置' }
    case 'voicewake.get':
      return { success: true, data: { enabled: false, wakeWord: 'Hey Claw', sensitivity: 0.6 } }
    case 'voicewake.set':
      return { success: false, error: '当前 Gateway 版本不支持语音唤醒配置' }
    case 'exec.approvals.get':
      return { success: true, data: { mode: 'off', defaultDecision: 'allow', nodeDecisions: {} } }
    case 'exec.approvals.set':
    case 'exec.approvals.node.set':
      return { success: false, error: '当前 Gateway 版本不支持执行审批配置' }
    default:
      return null
  }
}

/**
 * 包装 Gateway 调用，添加统一错误处理
 */
async function wrapGatewayCall(method, params = {}, options = {}) {
  const gateway = getGateway()
  const {
    _skipFallback = false,
    _tokenRefreshRetried = false,
    _suppressUnknownMethodWarn = false,
    ...callOptions
  } = options

  // 连接前先确保 token 就绪，避免首屏并发导致 token_missing
  await ensureGatewayAuthToken(gateway)

  // 检查连接状态
  if (!gateway.isConnected()) {
    const state = gateway.getState?.()
    if (state !== ConnectionState.CONNECTING && state !== ConnectionState.RECONNECTING) {
      console.warn(`[API] Gateway 未连接，尝试连接...`)
    }
    try {
      await gateway.connect()
    } catch (connectError) {
      if (
        !_tokenRefreshRetried &&
        (isGatewayTokenMismatchError(connectError) || isLikelyGatewayAuthClose(connectError))
      ) {
        console.warn('[API] 连接失败，尝试刷新 token 后重连...')
        await ensureGatewayAuthToken(gateway, { force: true })
        gateway.disconnect()
        return wrapGatewayCall(method, params, { ...options, _tokenRefreshRetried: true })
      }
      return handleError(connectError, { method, ...options })
    }
  }

  try {
    const result = await gateway.call(method, params, callOptions)
    return { success: true, data: result }
  } catch (error) {
    if (
      !_tokenRefreshRetried &&
      (isGatewayTokenMismatchError(error) || isLikelyGatewayAuthClose(error))
    ) {
      console.warn('[API] 调用失败，尝试刷新 token 后重试...')
      await ensureGatewayAuthToken(gateway, { force: true })
      gateway.disconnect()
      return wrapGatewayCall(method, params, { ...options, _tokenRefreshRetried: true })
    }
    if (!_skipFallback && isUnknownMethodError(error)) {
      const fallback = await tryUnknownMethodFallback(method, params, options)
      if (fallback) {
        if (!_suppressUnknownMethodWarn) {
          warnOnce(`unknown-method:${method}`, `[API] 方法 ${method} 不存在，已使用兼容回退`)
        }
        return fallback
      }
    }
    return handleError(error, { method, ...options })
  }
}

/**
 * 流式调用包装
 */
async function wrapGatewayStreamCall(method, params = {}, onChunk, options = {}) {
  const gateway = getGateway()
  const { _tokenRefreshRetried = false, ...callOptions } = options

  // 连接前先确保 token 就绪，避免首屏并发导致 token_missing
  await ensureGatewayAuthToken(gateway)

  // 检查连接状态
  if (!gateway.isConnected()) {
    const state = gateway.getState?.()
    if (state !== ConnectionState.CONNECTING && state !== ConnectionState.RECONNECTING) {
      console.warn(`[API] Gateway 未连接，尝试连接...`)
    }
    try {
      await gateway.connect()
    } catch (connectError) {
      if (
        !_tokenRefreshRetried &&
        (isGatewayTokenMismatchError(connectError) || isLikelyGatewayAuthClose(connectError))
      ) {
        console.warn('[API] 流式连接失败，尝试刷新 token 后重连...')
        await ensureGatewayAuthToken(gateway, { force: true })
        gateway.disconnect()
        return wrapGatewayStreamCall(method, params, onChunk, { ...options, _tokenRefreshRetried: true })
      }
      return handleError(connectError, { method, ...options })
    }
  }

  try {
    const result = await gateway.call(method, params, {
      ...callOptions,
      onStream: onChunk,
    })
    return { success: true, data: result }
  } catch (error) {
    if (
      !_tokenRefreshRetried &&
      (isGatewayTokenMismatchError(error) || isLikelyGatewayAuthClose(error))
    ) {
      console.warn('[API] 流式调用失败，尝试刷新 token 后重试...')
      await ensureGatewayAuthToken(gateway, { force: true })
      gateway.disconnect()
      return wrapGatewayStreamCall(method, params, onChunk, { ...options, _tokenRefreshRetried: true })
    }
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
    get: async () => {
      // Tauri 环境优先直接读取本地配置文件，避免 Gateway 返回裁剪/包装配置导致字段丢失
      if (isTauriRuntime()) {
        try {
          const configJson = await invokeTauri('get_openclaw_config')
          const parsed = JSON.parse(configJson || '{}')
          return { success: true, data: normalizeConfigForUi(parsed) }
        } catch (tauriError) {
          console.warn('[API] get_openclaw_config 失败，回退 Gateway config.get:', tauriError)
        }
      }

      const result = await wrapGatewayCall('config.get', {})
      if (result.success) {
        result.data = normalizeConfigForUi(result.data)
      }
      return result
    },
    set: async (config) => {
      const normalizedConfig = prepareConfigForPersistence(config)

      // 优先使用 Tauri 命令直接写文件，绕过 Gateway 的 baseHash 问题
      try {
        const configJson = JSON.stringify(normalizedConfig, null, 2)
        await invokeTauri('save_openclaw_config', { configJson })
        console.log('[API] 配置已通过 Tauri 命令保存')
        return { success: true }
      } catch (tauriError) {
        // Tauri 命令失败，尝试 Gateway API（可能因 baseHash 问题失败）
        console.warn('[API] Tauri 保存配置失败，尝试 Gateway API:', tauriError)
        return wrapGatewayCall('config.set', { config: normalizedConfig })
      }
    },
    update: async (partialConfig) => {
      // 先获取当前配置，再合并更新
      const currentResult = await api.config.get()
      if (currentResult.success) {
        const mergedConfig = {
          ...currentResult.data,
          ...partialConfig,
        }
        // 使用新的 set 方法（优先 Tauri 命令）
        return api.config.set(mergedConfig)
      }
      return currentResult
    },
    // 兼容旧页面调用：当前版本配置通过 config.set 已落盘，Gateway 侧暂无独立 sync 方法
    syncToGateway: async () => ({ success: true, data: { synced: true } }),
    cleanupInvalidChannelAgentBindings: async () => cleanupInvalidChannelAgentBindings(),
  },

  // ========== 网关相关 ==========
  gateway: {
    // Gateway 健康检查（方法名是 health，不是 gateway.health）
    start: () => api.bundledGateway.start(),
    stop: () => api.bundledGateway.stop(),
    restart: () => api.bundledGateway.restart(),
    status: () => wrapGatewayCall('status', {}),
    health: () => wrapGatewayCall('health', {}),
    httpApiStatus: async () => ({
      success: true,
      data: {
        running: false,
        auth_enabled: false,
        base_url: '',
        bind_addr: '127.0.0.1',
        port: 0,
        endpoints: [],
      },
    }),
    chat: async (sessionId, messages = []) => {
      const list = Array.isArray(messages) ? messages : []
      const latestUser = [...list].reverse().find((msg) =>
        msg && typeof msg === 'object' && msg.role === 'user' && typeof msg.content === 'string',
      )
      const fallbackText = list
        .filter((msg) => msg && typeof msg === 'object' && typeof msg.content === 'string')
        .map((msg) => String(msg.content))
        .join('\n')
      const text = (latestUser?.content || fallbackText || '').trim() || '你好'
      const result = await api.chat.send({ sessionKey: sessionId || 'main', text })
      if (!result.success) return result

      const raw = result.data || {}
      const content = typeof raw?.content === 'string'
        ? raw.content
        : (typeof raw?.text === 'string' ? raw.text : (typeof raw?.message === 'string' ? raw.message : ''))

      return {
        success: true,
        data: { ...raw, content },
      }
    },
  },

  // ========== 会话相关 ==========
  sessions: {
    list: async (agentId) => {
      const safeAgentId = typeof agentId === 'string' ? agentId.trim() : ''
      if (safeAgentId && safeAgentId !== 'main') {
        const knownAgentIds = await getKnownAgentIdSet({ allowStale: true })
        if ((knownAgentIds instanceof Set) && knownAgentIds.size > 0 && !knownAgentIds.has(safeAgentId)) {
          await cleanupInvalidSessionAndAgentArtifacts([], [safeAgentId])
          return { success: true, data: [] }
        }
      }

      const params = {}
      if (safeAgentId) params.agentId = safeAgentId
      const result = await wrapGatewayCall('sessions.list', params)
      if (result.success) {
        const rows = normalizeArray(result.data, ['sessions', 'items', 'list']).map(toSessionRow)
        const filtered = await filterSessionsByKnownAgents(rows, { cleanup: true })
        result.data = filtered.sessions
      }
      return result
    },
    listAgentSessions: async (agentId) => {
      const result = await api.sessions.list(agentId)
      if (result.success) {
        const prefix = `agent:${String(agentId || '').trim()}:`
        result.data = (result.data || []).filter((row) => row.session_key?.startsWith(prefix))
      }
      return result
    },
    get: async (sessionKey) => {
      const guard = await guardSessionKeyWithKnownAgent(sessionKey, { cleanup: true })
      if (!guard.allowed) {
        return {
          success: true,
          data: null,
          skipped: true,
          reason: guard.reason,
        }
      }
      return wrapGatewayCall('sessions.get', { key: guard.sessionKey })
    },
    getMessages: async (sessionKey) => {
      const guard = await guardSessionKeyWithKnownAgent(sessionKey, { cleanup: true })
      if (!guard.allowed) {
        return {
          success: true,
          data: [],
          skipped: true,
          reason: guard.reason,
        }
      }

      const result = await wrapGatewayCall('chat.history', { sessionKey: guard.sessionKey })
      if (result.success) {
        result.data = normalizeArray(result.data, ['messages', 'items'])
      }
      return result
    },
    // Gateway 当前版本无 sessions.create；会话在 chat.send 时自动创建
    create: async (agentId, sessionName) => {
      const safeAgent = String(agentId || 'main').trim() || 'main'
      if (safeAgent !== 'main') {
        const knownAgentIds = await getKnownAgentIdSet({ allowStale: true })
        if ((knownAgentIds instanceof Set) && knownAgentIds.size > 0 && !knownAgentIds.has(safeAgent)) {
          await cleanupInvalidSessionAndAgentArtifacts([], [safeAgent])
          return { success: false, error: `智能体不存在: ${safeAgent}` }
        }
      }

      const rawName = String(sessionName || 'main').trim() || 'main'
      const normalized = rawName.toLowerCase().replace(/[^a-z0-9_-]/g, '-')
      const sessionKey = safeAgent === 'main'
        ? 'main'
        : `agent:${safeAgent}:${normalized || 'main'}`
      if (sessionKey !== 'main') {
        await wrapGatewayCall('sessions.patch', {
          key: sessionKey,
          ...(rawName && rawName !== 'main' ? { label: rawName } : {}),
        }, { silent: true })
      }
      return { success: true, data: sessionKey }
    },
    delete: async (sessionKey) => {
      const result = await wrapGatewayCall('sessions.delete', { key: sessionKey }, { silent: true })
      if (result.success) {
        const deleted = result.data?.deleted
        if (deleted === false && isTauriRuntime()) {
          try {
            const localResult = await invokeTauri('purge_local_session_key', { sessionKey })
            const removedCount = Number(localResult?.removed_count ?? localResult?.removedCount ?? 0)
            if (Number.isFinite(removedCount) && removedCount > 0) {
              return {
                success: true,
                data: {
                  ...(result.data || {}),
                  deleted: true,
                  forced: true,
                  local: localResult,
                },
              }
            }
          } catch (tauriError) {
            console.warn('[API] purge_local_session_key 失败:', tauriError)
          }
        }
        return result
      }

      const message = String(result.error || '').toLowerCase()
      const isNotFound = message.includes('not found') || message.includes('不存在') || message.includes('no such')
      if (isNotFound) {
        return { success: true, data: { ok: true, alreadyDeleted: true } }
      }

      return handleError(new Error(result.error || '删除会话失败'), {
        method: 'sessions.delete',
      })
    },
    deleteSingle: async (sessionKey) => api.sessions.delete(sessionKey),
    clearAll: () => Promise.resolve({ success: true, data: { ok: true } }),
    cleanupInvalidAgentReferences: async () => {
      const result = await wrapGatewayCall('sessions.list', {}, { silent: true })
      if (!result.success) return result

      const rows = normalizeArray(result.data, ['sessions', 'items', 'list']).map(toSessionRow)
      const filtered = await filterSessionsByKnownAgents(rows, { cleanup: true })
      return {
        success: true,
        data: {
          total: rows.length,
          removed: filtered.removedSessionKeys.length,
          removedAgents: filtered.removedAgentIds,
        },
      }
    },
  },

  // ========== 聊天相关 ==========
  chat: {
    send: async (params) => {
      const { payload, sessionKey, model } = normalizeChatSendParams(params)
      const guard = await guardSessionKeyWithKnownAgent(sessionKey, { cleanup: true })
      if (!guard.allowed) {
        return { success: false, error: `会话绑定的智能体不存在：${guard.agentId}` }
      }
      payload.sessionKey = guard.sessionKey

      if (model) {
        await wrapGatewayCall('sessions.patch', { key: guard.sessionKey, model }, { silent: true })
      }
      return wrapGatewayCall('chat.send', payload)
    },
    // 原版 Gateway chat.send 通过 chat 事件流推送增量，这里保留旧签名兼容
    sendStream: async (params, onChunk) => {
      const result = await api.chat.send(params)
      if (typeof onChunk === 'function') {
        onChunk({ acknowledged: result.success, runId: result.data?.runId })
      }
      return result
    },
    abort: (sessionKey, runId) => wrapGatewayCall('chat.abort', { sessionKey, runId }),
    history: async (sessionKey, options) => {
      const guard = await guardSessionKeyWithKnownAgent(sessionKey, { cleanup: true })
      if (!guard.allowed) {
        return { success: true, data: [] }
      }
      return wrapGatewayCall('chat.history', { sessionKey: guard.sessionKey, ...options })
    },
  },

  // ========== 智能体相关 ==========
  agents: {
    list: async () => {
      const localRows = await loadLocalAgentsFromTauri()
      const result = await wrapGatewayCall('agents.list', {}, { silent: true })

      const gatewayRows = result.success ? normalizeAgentsListPayload(result.data) : []
      if (!result.success && !localRows) {
        return result
      }

      const merged = new Map()
      for (const row of gatewayRows) {
        if (!row?.id) continue
        merged.set(row.id, row)
      }
      if (Array.isArray(localRows)) {
        for (const row of localRows) {
          if (!row?.id) continue
          const prev = merged.get(row.id) || {}
          merged.set(row.id, {
            ...prev,
            ...row,
            identity: {
              ...(prev.identity || {}),
              ...(row.identity || {}),
            },
          })
        }
      }

      const list = Array.from(merged.values()).filter((row) => row?.id)
      list.sort((a, b) => {
        if (a.id === 'main') return -1
        if (b.id === 'main') return 1
        return String(a.id).localeCompare(String(b.id))
      })

      return { success: true, data: list }
    },
    get: async (agentId) => {
      const result = await wrapGatewayCall('agents.get', { agentId }, { silent: true })
      if (result.success) return result

      const localRows = await loadLocalAgentsFromTauri()
      if (Array.isArray(localRows)) {
        const row = localRows.find((item) => item.id === String(agentId || ''))
        if (row) return { success: true, data: row }
      }
      return result
    },
    create: async (params) => {
      const payload = { ...(params || {}) }
      const requestedName = typeof payload.name === 'string' && payload.name.trim()
        ? payload.name.trim()
        : 'new-agent'
      const normalizedAgentId = normalizeAgentIdLike(requestedName)

      if (normalizedAgentId === 'main') {
        return {
          success: false,
          error: `名称「${requestedName}」会被解析为保留 ID「main」，请换一个名称（例如：my-main-agent）`,
        }
      }

      // 创建时始终使用安全 agentId（网关会把 name 作为 agentId 归一化）。
      payload.name = normalizedAgentId

      if (typeof payload.workspace !== 'string' || !payload.workspace.trim()) {
        payload.workspace = `~/.openclaw/agents/${normalizedAgentId}`
      }

      if (typeof payload.avatar !== 'string') {
        delete payload.avatar
      } else {
        payload.avatar = payload.avatar.trim()
      }

      if (typeof payload.emoji !== 'string') {
        delete payload.emoji
      } else {
        payload.emoji = payload.emoji.trim()
      }

      const result = await wrapGatewayCall('agents.create', payload)
      if (!result.success) {
        const message = String(result.error || '')
        if (message.includes('"main" is reserved')) {
          return {
            success: false,
            error: `名称「${requestedName}」会被解析为保留 ID「main」，请换一个名称（例如：my-main-agent）`,
          }
        }
        return result
      }

      const data = result.data && typeof result.data === 'object' ? result.data : {}
      const agentId = String(data.agentId || data.agent_id || data.id || '').trim()
      if (!agentId) return result

      result.data = {
        ...data,
        id: agentId,
        agentId,
        agent_id: agentId,
      }

      // 若用户输入的是展示名（如中文），写入 IDENTITY.md 以便列表显示真实名称。
      if (requestedName && requestedName !== normalizedAgentId) {
        const identityContent = buildIdentityMarkdown(
          requestedName,
          payload.emoji || '🤖',
          payload.avatar || '',
        )
        try {
          const savedLocal = await saveLocalWorkspaceFileFromTauri(agentId, 'IDENTITY.md', identityContent)
          if (!savedLocal) {
            await wrapGatewayCall(
              'workspace.saveFile',
              { agentId, fileName: 'IDENTITY.md', content: identityContent },
              { silent: true },
            )
          } else {
            // 最佳努力同步到 Gateway，失败不影响创建成功。
            await wrapGatewayCall(
              'workspace.saveFile',
              { agentId, fileName: 'IDENTITY.md', content: identityContent },
              { silent: true },
            )
          }
          result.data.displayName = requestedName
        } catch (err) {
          console.warn('[API] 写入新智能体 IDENTITY.md 失败（忽略）:', err)
        }
      }

      return result
    },
    update: (agentId, params) => wrapGatewayCall('agents.update', { agentId, ...params }),
    delete: async (agentId) => {
      const safeAgentId = String(agentId || '').trim()
      if (!safeAgentId) {
        return { success: false, error: '缺少 agentId' }
      }

      const result = await wrapGatewayCall('agents.delete', { agentId: safeAgentId }, { silent: true })
      if (result.success) return result

      const message = String(result.error || '').toLowerCase()
      const isNotFound = message.includes('not found') || message.includes('不存在') || message.includes('no such')
      const isUnknownMethod = message.includes('unknown method') || message.includes('method not found')

      // Gateway 中不存在该智能体时，回退删除本地遗留目录（agents/<id>, workspace-<id>）
      if ((isNotFound || isUnknownMethod) && isTauriRuntime()) {
        try {
          const localResult = await invokeTauri('delete_local_agent_data', { agentId: safeAgentId })
          return {
            success: true,
            data: {
              ok: true,
              gatewayDeleted: false,
              localDeleted: true,
              local: localResult,
            },
          }
        } catch (tauriError) {
          return handleError(tauriError, { method: 'delete_local_agent_data' })
        }
      }

      return handleError(new Error(result.error || '删除智能体失败'), {
        method: 'agents.delete',
      })
    },
    // 智能体文件
    files: {
      list: (agentId) => wrapGatewayCall('agents.files.list', { agentId }),
      get: (agentId, filename) => wrapGatewayCall('agents.files.get', { agentId, name: filename }),
      set: (agentId, filename, content) => wrapGatewayCall('agents.files.set', { agentId, name: filename, content }),
      delete: (agentId, filename) => wrapGatewayCall('agents.files.delete', { agentId, filename }),
    },
  },

  // ========== Skills 相关 ==========
  skills: {
    list: async (params) => {
      const result = await wrapGatewayCall('skills.status', params || {})
      if (result.success) {
        const skills = normalizeArray(result.data, ['skills', 'entries', 'items']).map((skill, idx) => ({
          ...skill,
          id: skill?.id || skill?.skillKey || skill?.name || `skill-${idx}`,
          name: skill?.name || skill?.id || `skill-${idx}`,
        }))
        result.data = { ...(result.data || {}), skills }
      }
      return result
    },
    stats: async () => {
      const result = await api.skills.list()
      if (!result.success) return result
      const skills = normalizeArray(result.data, ['skills', 'items'])
      return {
        success: true,
        data: {
          total: skills.length,
          ready: skills.filter((s) => s?.eligible !== false).length,
          disabled: skills.filter((s) => s?.disabled === true).length,
        },
      }
    },
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
    list: () => wrapGatewayCall('cron.list', { includeDisabled: true }),
    get: () => wrapGatewayCall('cron.status', {}),
    create: async (task) => {
      const payload = sanitizeCronCreateInput(task || {})
      const validation = await validateCronPayloadAgentBindings(payload)
      if (!validation.ok) {
        return {
          success: false,
          error: `定时任务绑定了不存在的智能体: ${validation.invalidAgentIds.join(', ')}`,
        }
      }
      return wrapGatewayCall('cron.add', payload)
    },
    update: async (taskId, task) => {
      const patch = sanitizeCronUpdatePatch(task || {})
      const validation = await validateCronPayloadAgentBindings(patch)
      if (!validation.ok) {
        return {
          success: false,
          error: `定时任务绑定了不存在的智能体: ${validation.invalidAgentIds.join(', ')}`,
        }
      }
      return wrapGatewayCall('cron.update', { id: taskId, patch })
    },
    delete: (taskId) => wrapGatewayCall('cron.remove', { id: taskId }),
    toggle: async (taskId) => {
      const listResult = await wrapGatewayCall('cron.list', { includeDisabled: true })
      if (!listResult.success) return listResult
      const items = normalizeArray(listResult.data, ['items', 'tasks', 'list', 'jobs'])
      const current = items.find((item) => item?.id === taskId || item?.jobId === taskId)
      if (!current) return { success: false, error: '任务不存在' }
      return wrapGatewayCall('cron.update', { id: taskId, patch: { enabled: !current.enabled } })
    },
    runNow: (taskId) => wrapGatewayCall('cron.run', { id: taskId, mode: 'force' }),
    history: () => wrapGatewayCall('cron.runs', { scope: 'all', limit: 100 }),
    repairInvalidAgentBindings: (options = {}) => repairInvalidCronAgentBindings(options),
  },

  // ========== 记忆相关 ==========
  memory: {
    stats: () => wrapGatewayCall('memory.stats', {}),
    list: async (limit, offset) => {
      const result = await wrapGatewayCall('memory.list', { limit, offset })
      if (result.success) {
        const memories = normalizeArray(result.data, ['memories', 'items', 'results', 'list'])
        result.data = { ...(result.data || {}), memories }
      }
      return result
    },
    search: (query, limit) => wrapGatewayCall('memory.search', { query, limit }),
    get: (id) => wrapGatewayCall('memory.get', { id }),
    store: (content, metadata) => wrapGatewayCall('memory.store', { content, metadata }),
    delete: (id) => wrapGatewayCall('memory.delete', { id }),
    reindex: () => wrapGatewayCall('memory.reindex', {}),
    import: (path) => wrapGatewayCall('memory.import', { path }),
    export: (path) => wrapGatewayCall('memory.export', { path }),
    // 兼容旧前端调用：统一返回 { results: [...] } 形态
    searchGateway: async (query, limit = 3) => {
      const result = await wrapGatewayCall('memory.search', { query, limit }, { _suppressUnknownMethodWarn: true })
      if (!result.success) return result

      const rows = normalizeArray(result.data, ['results', 'items', 'memories'])
      return {
        success: true,
        data: {
          results: rows.map((item) => ({
            id: item?.id,
            score: typeof item?.score === 'number'
              ? item.score
              : (typeof item?.similarity === 'number' ? item.similarity : 0),
            snippet: item?.snippet || item?.content || item?.text || '',
            content: item?.content || item?.text || item?.snippet || '',
            metadata: item?.metadata || {},
          })),
        },
      }
    },
    // 原版 Gateway 不提供 memory.sync，前端做静默兼容
    sync: async () => ({ success: true, data: { imported: 0, skipped: 0 } }),
  },

  // ========== 工具相关 ==========
  tools: {
    catalog: () => wrapGatewayCall('tools.catalog', {}),
    list: async () => {
      const result = await wrapGatewayCall('tools.catalog', {})
      if (result.success) {
        result.data = flattenToolCatalog(result.data)
      }
      return result
    },
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
    load: async (agentId) => {
      const safeAgentId = String(agentId || 'main')
      const localData = await loadLocalWorkspaceFromTauri(safeAgentId)
      if (localData) {
        return { success: true, data: normalizeWorkspacePayload(localData, safeAgentId) }
      }

      const result = await wrapGatewayCall('workspace.load', { agentId: safeAgentId }, { silent: true })
      if (!result.success) {
        return result
      }
      return { success: true, data: normalizeWorkspacePayload(result.data, safeAgentId) }
    },
    save: (agentId, files) => wrapGatewayCall('workspace.save', { agentId, files }),
    listFiles: async (agentId) => {
      const safeAgentId = String(agentId || 'main')
      const localData = await loadLocalWorkspaceFromTauri(safeAgentId)
      if (localData && Array.isArray(localData.files)) {
        return { success: true, data: localData.files }
      }

      return wrapGatewayCall('workspace.listFiles', { agentId: safeAgentId }, { silent: true })
    },
    readFile: async (agentId, fileName) => {
      const safeAgentId = String(agentId || 'main')
      const safeFileName = String(fileName || '')
      const localContent = await readLocalWorkspaceFileFromTauri(safeAgentId, safeFileName)
      if (localContent !== null) {
        return { success: true, data: localContent }
      }

      const result = await wrapGatewayCall(
        'workspace.readFile',
        { agentId: safeAgentId, fileName: safeFileName },
        { silent: true },
      )
      if (!result.success) {
        return result
      }
      return { success: true, data: extractWorkspaceFileContent(result.data) }
    },
    saveFile: async (agentId, fileName, content) => {
      const safeAgentId = String(agentId || 'main')
      const safeFileName = String(fileName || '')
      const safeContent = String(content ?? '')

      const savedLocal = await saveLocalWorkspaceFileFromTauri(safeAgentId, safeFileName, safeContent)
      if (savedLocal) {
        // 最佳努力同步 Gateway（失败不影响本地编辑）
        const syncResult = await wrapGatewayCall(
          'workspace.saveFile',
          { agentId: safeAgentId, fileName: safeFileName, content: safeContent },
          { silent: true },
        )
        if (syncResult.success) return syncResult
        return { success: true, data: { ok: true, localOnly: true } }
      }

      return wrapGatewayCall('workspace.saveFile', { agentId: safeAgentId, fileName: safeFileName, content: safeContent })
    },
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
    getHistory: async () => {
      const result = await wrapGatewayCall('reflection.getHistory', {})
      if (result.success) {
        const reflections = normalizeArray(result.data, ['reflections', 'items', 'history', 'list'])
        result.data = { ...(result.data || {}), reflections }
      }
      return result
    },
    getPatterns: (category, patternType) => wrapGatewayCall('reflection.getPatterns', { category, patternType }),
    addPattern: (pattern) => wrapGatewayCall('reflection.addPattern', { pattern }),
  },

  // ========== Failover 相关 ==========
  // 注意：Gateway 不支持 failover 方法，返回 mock 数据
  failover: {
    status: () => Promise.resolve({ success: true, data: { enabled: false, status: 'mock' } }),
    history: () => Promise.resolve({ success: true, data: [] }),
    reset: () => {
      console.warn('[API] failover.reset 方法在 Gateway 中不存在')
      return Promise.resolve({ success: false, error: '方法不存在' })
    },
    configure: (_config) => {
      console.warn('[API] failover.configure 方法在 Gateway 中不存在')
      return Promise.resolve({ success: false, error: '方法不存在' })
    },
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

  // ========== Talk 相关 ==========
  talk: {
    config: () => wrapGatewayCall('talk.config', {}),
    mode: (mode) => wrapGatewayCall('talk.mode', { mode }),
  },

  // ========== Voice Wake 相关 ==========
  voicewake: {
    get: () => wrapGatewayCall('voicewake.get', {}),
    set: (config) => wrapGatewayCall('voicewake.set', config || {}),
  },

  // ========== 执行审批相关 ==========
  execApprovals: {
    get: () => wrapGatewayCall('exec.approvals.get', {}),
    set: (config) => wrapGatewayCall('exec.approvals.set', config || {}),
    nodeSet: (config) => wrapGatewayCall('exec.approvals.node.set', config || {}),
  },

  // ========== 自动回复相关 ==========
  autoReply: {
    list: async () => {
      const result = await wrapGatewayCall('autoReply.list', {})
      if (result.success) {
        const rules = normalizeArray(result.data, ['rules', 'items', 'list'])
        result.data = { ...(result.data || {}), rules }
      }
      return result
    },
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
    runProviderConnectivityTest(provider, model, apiKey, baseUrl),

  // ========== 系统相关 ==========
  // 注意：Gateway 没有 system.info 方法，使用 status 替代
  system: {
    info: () => wrapGatewayCall('status', {}),  // 使用 status 获取系统信息
    logs: () => wrapGatewayCall('logs.tail', {}),  // Gateway 支持 logs.tail
    openLogsFolder: async () => {
      if (!isTauriRuntime()) {
        return { success: false, error: '仅桌面版支持打开日志目录' }
      }
      try {
        await invokeTauri('open_logs_folder')
        return { success: true, data: { ok: true } }
      } catch (error) {
        return handleError(error, { method: 'open_logs_folder' })
      }
    },
    openUrl: async (url) => {
      if (!isTauriRuntime()) {
        return { success: false, error: '仅桌面版支持打开系统链接' }
      }
      try {
        await invokeTauri('open_url', { url: String(url || '') })
        return { success: true, data: { ok: true } }
      } catch (error) {
        return handleError(error, { method: 'open_url' })
      }
    },
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
  // 注意：Gateway 方法名是 device.pair.xxx，不是 devicePair.xxx
  devicePair: {
    list: () => wrapGatewayCall('device.pair.list', {}),
    approve: (pairId) => wrapGatewayCall('device.pair.approve', { requestId: pairId }),
    reject: (pairId) => wrapGatewayCall('device.pair.reject', { requestId: pairId }),
    remove: (deviceId) => wrapGatewayCall('device.pair.remove', { deviceId }),
  },

  // ========== Presence 相关 ==========
  presence: {
    get: () => wrapGatewayCall('presence.get', {}),
    update: (status) => wrapGatewayCall('presence.update', { status }),
  },

  // ========== 心跳相关 ==========
  // 注意：Gateway 使用 last-heartbeat 方法，不是 heartbeat.status
  heartbeat: {
    status: () => wrapGatewayCall('last-heartbeat', {}),
    start: () => wrapGatewayCall('set-heartbeats', { enabled: true }),
    stop: () => wrapGatewayCall('set-heartbeats', { enabled: false }),
    configure: (params) => {
      console.warn('[API] heartbeat.configure 方法在 Gateway 中不存在')
      return { success: false, error: '方法不存在' }
    },
    runOnce: () => {
      console.warn('[API] heartbeat.runOnce 方法在 Gateway 中不存在')
      return { success: false, error: '方法不存在' }
    },
  },

  // ========== 审计日志相关 ==========
  audit: {
    query: (limit = 100, offset = 0) => wrapGatewayCall('audit.query', { limit, offset }),
    export: (format = 'json') => wrapGatewayCall('audit.export', { format }),
  },

  // ========== 模式库相关 ==========
  patterns: {
    list: async (params = {}) => {
      const result = await wrapGatewayCall('patterns.list', params)
      if (result.success) {
        const patterns = normalizeArray(result.data, ['patterns', 'items', 'list'])
        result.data = { ...(result.data || {}), patterns }
      }
      return result
    },
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

  // ========== 微信监控相关 ==========
  wechat: {
    checkPermission: async () => ({
      success: true,
      data: { has_permission: false, error: '当前版本未启用微信监控能力' },
    }),
    getStatus: async () => ({
      success: true,
      data: {
        is_monitoring: false,
        auto_reply_enabled: false,
        connected: false,
        uptime_seconds: 0,
      },
    }),
    getMessages: async () => ({ success: true, data: [] }),
    startMonitoring: async () => ({ success: false, error: '当前版本未启用微信监控能力' }),
    stopMonitoring: async () => ({ success: true, data: { is_monitoring: false } }),
    clearMessages: async () => ({ success: true, data: { cleared: true } }),
    sendMessage: async () => ({ success: false, error: '当前版本未启用微信消息发送能力' }),
    setAutoReply: async () => ({ success: false, error: '当前版本未启用微信自动回复能力' }),
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
    get: (agentId) => wrapGatewayCall('agent.identity.get', { agentId }),
    update: async (agentId, params, emoji, avatar, _description) => {
      let payload = {}
      if (params && typeof params === 'object' && !Array.isArray(params)) {
        payload = { ...params }
      } else {
        payload = {
          ...(typeof params === 'string' && params.trim() ? { name: params.trim() } : {}),
          ...(typeof emoji === 'string' && emoji.trim() ? { emoji: emoji.trim() } : {}),
          ...(typeof avatar === 'string' && avatar.trim() ? { avatar: avatar.trim() } : {}),
        }
      }

      const updatePayload = {
        agentId: String(agentId || 'main'),
        ...(typeof payload?.name === 'string' && payload.name.trim() ? { name: payload.name.trim() } : {}),
        ...(typeof payload?.workspace === 'string' && payload.workspace.trim() ? { workspace: payload.workspace.trim() } : {}),
        ...(typeof payload?.model === 'string' && payload.model.trim() ? { model: payload.model.trim() } : {}),
        ...(typeof payload?.avatar === 'string' && payload.avatar.trim() ? { avatar: payload.avatar.trim() } : {}),
      }

      if (Object.keys(updatePayload).length > 1) {
        return wrapGatewayCall('agents.update', updatePayload)
      }

      return { success: true, data: { ok: true } }
    },
  },

  // ========== 子智能体相关 ==========
  subagents: {
    list: async () => {
      const result = await wrapGatewayCall('subagents.list', {})
      if (result.success) {
        result.data = normalizeArray(result.data, ['subagents', 'agents', 'items', 'list'])
      }
      return result
    },
    spawn: (config) => wrapGatewayCall('subagents.spawn', { config }),
    terminate: (agentId) => wrapGatewayCall('subagents.terminate', { agentId }),
    stats: () => wrapGatewayCall('subagents.stats', {}),
    presets: async () => {
      const result = await wrapGatewayCall('subagents.presets', {})
      if (result.success) {
        result.data = normalizeArray(result.data, ['presets', 'items', 'list'])
      }
      return result
    },
    cleanup: () => wrapGatewayCall('subagents.cleanup', {}),
  },

  // ========== A2A 通信相关 ==========
  a2a: {
    list: async (filterStatus) => {
      const result = await wrapGatewayCall('a2a.list', filterStatus ? { filterStatus } : {})
      if (result.success) {
        result.data = normalizeArray(result.data, ['agents', 'items', 'list'])
      }
      return result
    },
    call: (agentId, message) => wrapGatewayCall('a2a.call', { agentId, message }),
    broadcast: (message, excludeSelf) => wrapGatewayCall('a2a.broadcast', { message, excludeSelf }),
    register: (info) => wrapGatewayCall('a2a.register', { info }),
    unregister: (agentId) => wrapGatewayCall('a2a.unregister', { agentId }),
    stats: () => wrapGatewayCall('a2a.stats', {}),
  },

  // ========== Discovery 相关 ==========
  // 注意：Gateway 不支持 discovery 方法，返回 mock 数据
  discovery: {
    status: () => Promise.resolve({ success: true, data: { enabled: false, status: 'mock' } }),
    peers: () => Promise.resolve({ success: true, data: [] }),
    tailscaleStatus: () => {
      warnOnce('unknown-method:discovery.tailscaleStatus', '[API] discovery.tailscaleStatus 方法在 Gateway 中不存在')
      return Promise.resolve({ success: false, error: '方法不存在' })
    },
    scan: () => {
      warnOnce('unknown-method:discovery.scan', '[API] discovery.scan 方法在 Gateway 中不存在')
      return Promise.resolve({ success: false, error: '方法不存在' })
    },
    start: () => {
      warnOnce('unknown-method:discovery.start', '[API] discovery.start 方法在 Gateway 中不存在')
      return Promise.resolve({ success: false, error: '方法不存在' })
    },
    stop: () => {
      warnOnce('unknown-method:discovery.stop', '[API] discovery.stop 方法在 Gateway 中不存在')
      return Promise.resolve({ success: false, error: '方法不存在' })
    },
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
        const result = await invokeTauri('check_install_status')
        return { success: true, data: result }
      } catch (error) {
        return handleError(error, { method: 'check_install_status' })
      }
    },
    // 触发自动安装
    install: async () => {
      try {
        const result = await invokeTauri('install_openclaw')
        return { success: true, data: result }
      } catch (error) {
        return handleError(error, { method: 'install_openclaw' })
      }
    },
    // 检查更新
    checkUpdate: async () => {
      try {
        const result = await invokeTauri('check_openclaw_update')
        return { success: true, data: result }
      } catch (error) {
        return handleError(error, { method: 'check_openclaw_update' })
      }
    },
    // 执行更新
    update: async () => {
      try {
        const result = await invokeTauri('update_openclaw')
        return { success: true, data: result }
      } catch (error) {
        return handleError(error, { method: 'update_openclaw' })
      }
    },
    // 获取 OpenClaw 路径
    getPath: async () => {
      try {
        const result = await invokeTauri('get_openclaw_path')
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
        const result = await invokeTauri('start_bundled_gateway')
        return { success: true, data: result }
      } catch (error) {
        return handleError(error, { method: 'start_bundled_gateway' })
      }
    },
    // 停止打包的 Gateway
    stop: async () => {
      try {
        const result = await invokeTauri('stop_bundled_gateway')
        return { success: true, data: result }
      } catch (error) {
        return handleError(error, { method: 'stop_bundled_gateway' })
      }
    },
    // 获取 Gateway 状态
    status: async () => {
      try {
        const result = await invokeTauri('bundled_gateway_status')
        return { success: true, data: result }
      } catch (error) {
        return handleError(error, { method: 'bundled_gateway_status' })
      }
    },
    // 重启 Gateway
    restart: async () => {
      try {
        const result = await invokeTauri('restart_bundled_gateway')
        return { success: true, data: result }
      } catch (error) {
        return handleError(error, { method: 'restart_bundled_gateway' })
      }
    },
    // 健康检查
    healthCheck: async () => {
      try {
        const result = await invokeTauri('bundled_gateway_health_check')
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
        const result = await invokeTauri('get_app_version')
        return { success: true, data: result }
      } catch (error) {
        return handleError(error, { method: 'get_app_version' })
      }
    },
    // 检查更新
    check: async () => {
      try {
        const result = await invokeTauri('check_for_updates')
        return { success: true, data: result }
      } catch (error) {
        const message = extractErrorMessage(error)
        if (message.includes('自动更新功能已在 CN 版本中禁用')) {
          return {
            success: true,
            data: null,
            disabled: true,
            reason: message,
          }
        }
        return handleError(error, { method: 'check_for_updates' })
      }
    },
    // 下载更新
    download: async () => {
      try {
        const result = await invokeTauri('download_update')
        return { success: true, data: result }
      } catch (error) {
        return handleError(error, { method: 'download_update' })
      }
    },
    // 安装更新
    install: async () => {
      try {
        const result = await invokeTauri('install_update')
        return { success: true, data: result }
      } catch (error) {
        return handleError(error, { method: 'install_update' })
      }
    },
    // 重启应用（用于更新安装后）
    restart: async () => {
      try {
        const result = await invokeTauri('restart_app')
        return { success: true, data: result }
      } catch (error) {
        return handleError(error, { method: 'restart_app' })
      }
    },
  },
}

export default api
export { wrapGatewayCall, wrapGatewayStreamCall, ConnectionState }
