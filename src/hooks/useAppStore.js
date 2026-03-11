/**
 * OpenClaw 全局状态管理 Store
 *
 * 使用模块级状态管理模式（类似 useToast），无需 Provider 包装
 * 提供跨组件状态共享能力
 *
 * 主要管理：
 * - 智能体列表和元数据
 * - 当前会话状态
 * - 配置信息
 * - 网关状态
 */

import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api'

// ============================================================================
// 模块级状态存储
// ============================================================================

// 初始状态
const initialState = {
  // 智能体相关
  agents: [],
  agentNames: {},        // { agentId: name }
  agentMetadata: {},     // { agentId: { name, description, ... } }

  // 当前状态
  currentAgentId: 'main',
  currentSessionKey: 'main',

  // 配置
  config: null,

  // 网关状态
  gatewayStatus: null,

  // 加载状态
  isLoading: {
    agents: false,
    config: false,
    gateway: false,
  },

  // 错误状态
  errors: {},
}

// 状态和监听器
let memoryState = initialState
const listeners = new Set()

// ============================================================================
// Reducer
// ============================================================================

function reducer(state, action) {
  switch (action.type) {
    // 智能体相关
    case 'SET_AGENTS':
      return {
        ...state,
        agents: action.agents,
        agentNames: buildAgentNames(action.agents, state.agentMetadata),
      }

    case 'SET_AGENT_METADATA':
      return {
        ...state,
        agentMetadata: { ...state.agentMetadata, ...action.metadata },
        agentNames: buildAgentNames(state.agents, { ...state.agentMetadata, ...action.metadata }),
      }

    case 'ADD_AGENT': {
      const newAgents = [...state.agents, action.agent]
      return {
        ...state,
        agents: newAgents,
        agentNames: buildAgentNames(newAgents, state.agentMetadata),
      }
    }

    case 'REMOVE_AGENT': {
      const filteredAgents = state.agents.filter(a => a.id !== action.agentId)
      const newMetadata = { ...state.agentMetadata }
      delete newMetadata[action.agentId]
      return {
        ...state,
        agents: filteredAgents,
        agentMetadata: newMetadata,
        agentNames: buildAgentNames(filteredAgents, newMetadata),
      }
    }

    // 当前状态
    case 'SET_CURRENT_AGENT':
      return {
        ...state,
        currentAgentId: action.agentId,
      }

    case 'SET_CURRENT_SESSION':
      return {
        ...state,
        currentSessionKey: action.sessionKey,
      }

    // 配置
    case 'SET_CONFIG':
      return {
        ...state,
        config: action.config,
      }

    // 网关
    case 'SET_GATEWAY_STATUS':
      return {
        ...state,
        gatewayStatus: action.status,
      }

    // 加载状态
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: { ...state.isLoading, [action.key]: action.value },
      }

    // 错误
    case 'SET_ERROR':
      return {
        ...state,
        errors: { ...state.errors, [action.key]: action.error },
      }

    case 'CLEAR_ERROR':
      const newErrors = { ...state.errors }
      delete newErrors[action.key]
      return {
        ...state,
        errors: newErrors,
      }

    // 重置
    case 'RESET':
      return initialState

    default:
      return state
  }
}

// 构建智能体名称映射
function buildAgentNames(agents, metadata) {
  const names = { main: '默认助手' }
  agents.forEach(agent => {
    if (agent.id && agent.id !== 'main') {
      names[agent.id] = metadata[agent.id]?.name || agent.name || `智能体-${agent.id}`
    }
  })
  return names
}

// ============================================================================
// Dispatch
// ============================================================================

function dispatch(action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach(listener => listener(memoryState))
}

// ============================================================================
// Actions（异步操作）
// ============================================================================

const actions = {
  // 加载智能体列表
  async loadAgents(silent = false) {
    dispatch({ type: 'SET_LOADING', key: 'agents', value: true })
    if (!silent) dispatch({ type: 'CLEAR_ERROR', key: 'agents' })

    const result = await api.agents.list()

    dispatch({ type: 'SET_LOADING', key: 'agents', value: false })

    if (result.success) {
      dispatch({ type: 'SET_AGENTS', agents: result.data || [] })
    } else {
      dispatch({ type: 'SET_ERROR', key: 'agents', error: result.error })
    }

    return result
  },

  // 加载配置
  async loadConfig(silent = false) {
    dispatch({ type: 'SET_LOADING', key: 'config', value: true })
    if (!silent) dispatch({ type: 'CLEAR_ERROR', key: 'config' })

    const result = await api.config.get()

    dispatch({ type: 'SET_LOADING', key: 'config', value: false })

    if (result.success) {
      dispatch({ type: 'SET_CONFIG', config: result.data })
    } else {
      dispatch({ type: 'SET_ERROR', key: 'config', error: result.error })
    }

    return result
  },

  // 加载网关状态
  async loadGatewayStatus(silent = false) {
    dispatch({ type: 'SET_LOADING', key: 'gateway', value: true })
    if (!silent) dispatch({ type: 'CLEAR_ERROR', key: 'gateway' })

    const result = await api.gateway.status()

    dispatch({ type: 'SET_LOADING', key: 'gateway', value: false })

    if (result.success) {
      dispatch({ type: 'SET_GATEWAY_STATUS', status: result.data })
    } else {
      dispatch({ type: 'SET_ERROR', key: 'gateway', error: result.error })
    }

    return result
  },

  // 创建智能体
  async createAgent(params) {
    const result = await api.agents.create(params)
    if (result.success) {
      dispatch({ type: 'ADD_AGENT', agent: result.data })
    }
    return result
  },

  // 删除智能体
  async deleteAgent(agentId) {
    const result = await api.agents.delete(agentId)
    if (result.success) {
      dispatch({ type: 'REMOVE_AGENT', agentId })
    }
    return result
  },

  // 设置当前智能体
  setCurrentAgent(agentId) {
    dispatch({ type: 'SET_CURRENT_AGENT', agentId })
    // 持久化到 localStorage
    try {
      localStorage.setItem('openclaw_current_agent', agentId)
    } catch (e) {
      // ignore
    }
  },

  // 设置当前会话
  setCurrentSession(sessionKey) {
    dispatch({ type: 'SET_CURRENT_SESSION', sessionKey })
    // 持久化到 localStorage
    try {
      localStorage.setItem('openclaw_current_session', sessionKey)
    } catch (e) {
      // ignore
    }
  },

  // 更新智能体元数据
  updateAgentMetadata(agentId, metadata) {
    dispatch({
      type: 'SET_AGENT_METADATA',
      metadata: { [agentId]: metadata }
    })
  },

  // 重置状态
  reset() {
    dispatch({ type: 'RESET' })
  },

  // 初始化加载（从 localStorage 恢复 + 加载数据）
  async initialize() {
    // 从 localStorage 恢复上次状态
    try {
      const savedAgent = localStorage.getItem('openclaw_current_agent')
      const savedSession = localStorage.getItem('openclaw_current_session')

      if (savedAgent) {
        dispatch({ type: 'SET_CURRENT_AGENT', agentId: savedAgent })
      }
      if (savedSession) {
        dispatch({ type: 'SET_CURRENT_SESSION', sessionKey: savedSession })
      }
    } catch (e) {
      // ignore
    }

    // 并行加载数据
    const [agentsResult, configResult, gatewayResult] = await Promise.all([
      this.loadAgents(true),
      this.loadConfig(true),
      this.loadGatewayStatus(true),
    ])

    return {
      agents: agentsResult,
      config: configResult,
      gateway: gatewayResult,
    }
  },
}

// ============================================================================
// Hook
// ============================================================================

/**
 * 使用全局状态 Hook
 *
 * @example
 * const { agents, currentAgentId, actions } = useAppStore()
 *
 * // 加载数据
 * useEffect(() => {
 *   actions.initialize()
 * }, [])
 *
 * // 获取智能体名称
 * const agentName = getAgentName(agentId)
 */
export function useAppStore() {
  const [state, setState] = useState(memoryState)

  useEffect(() => {
    listeners.add(setState)
    return () => {
      listeners.delete(setState)
    }
  }, [])

  // 获取智能体名称
  const getAgentName = useCallback((agentId) => {
    if (!agentId || agentId === 'main') return '默认助手'
    return state.agentNames[agentId] || `智能体-${agentId}`
  }, [state.agentNames])

  // 获取智能体信息
  const getAgentInfo = useCallback((agentId) => {
    return state.agents.find(a => a.id === agentId) || null
  }, [state.agents])

  // 检查是否正在加载
  const isLoading = useCallback((key) => {
    return state.isLoading[key] || false
  }, [state.isLoading])

  // 获取错误
  const getError = useCallback((key) => {
    return state.errors[key] || null
  }, [state.errors])

  return {
    // 状态
    ...state,

    // 便捷方法
    getAgentName,
    getAgentInfo,
    isLoading,
    getError,

    // Actions
    actions,
  }
}

// 导出单独的 actions 供非 React 环境使用
export { actions }

// 导出获取当前状态的函数（供特殊场景使用）
export function getAppState() {
  return memoryState
}

export default useAppStore
