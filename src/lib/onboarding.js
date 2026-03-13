/**
 * 引导流程工具函数
 * 从 EnhancedOnboardingGuide.jsx 分离，避免 HMR Fast Refresh 警告
 */

// localStorage key
const ONBOARDING_KEY = 'openclaw_onboarding_completed'

/**
 * 检查是否已完成引导
 */
export function isOnboardingCompleted() {
  return localStorage.getItem(ONBOARDING_KEY) === 'true'
}

/**
 * 标记引导完成
 */
export function completeOnboarding() {
  localStorage.setItem(ONBOARDING_KEY, 'true')
}

/**
 * 重置引导状态
 */
export async function resetOnboarding() {
  localStorage.removeItem(ONBOARDING_KEY)
  localStorage.removeItem('openclaw_user_settings')
}
