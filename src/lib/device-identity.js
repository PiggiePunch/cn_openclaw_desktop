/**
 * 设备身份管理模块
 *
 * 使用 Ed25519 密钥对为客户端生成设备身份
 * 存储在 localStorage 中用于持久化
 */
import { getPublicKeyAsync, signAsync, utils } from '@noble/ed25519'

const STORAGE_KEY = 'openclaw-device-identity-v1'

/**
 * @typedef {Object} DeviceIdentity
 * @property {string} deviceId - 设备 ID (公钥指纹)
 * @property {string} publicKey - Base64URL 编码的公钥
 * @property {string} privateKey - Base64URL 编码的私钥
 */

/**
 * Base64URL 编码
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function base64UrlEncode(bytes) {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '')
}

/**
 * Base64URL 解码
 * @param {string} input
 * @returns {Uint8Array}
 */
function base64UrlDecode(input) {
  const normalized = input.replaceAll('-', '+').replaceAll('_', '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i)
  }
  return out
}

/**
 * 字节数组转十六进制
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * 计算公钥指纹（SHA-256）
 * @param {Uint8Array} publicKey
 * @returns {Promise<string>}
 */
async function fingerprintPublicKey(publicKey) {
  const hash = await crypto.subtle.digest('SHA-256', publicKey.slice().buffer)
  return bytesToHex(new Uint8Array(hash))
}

/**
 * 生成新的设备身份
 * @returns {Promise<DeviceIdentity>}
 */
async function generateIdentity() {
  const privateKey = utils.randomSecretKey()
  const publicKey = await getPublicKeyAsync(privateKey)
  const deviceId = await fingerprintPublicKey(publicKey)
  return {
    deviceId,
    publicKey: base64UrlEncode(publicKey),
    privateKey: base64UrlEncode(privateKey),
  }
}

/**
 * 加载或创建设备身份
 * 如果 localStorage 中有存储的身份则加载，否则创建新的
 * @returns {Promise<DeviceIdentity>}
 */
// Token 存储 key
const TOKEN_STORAGE_KEY = 'openclaw-device-token-v1'

/**
 * 保存 Gateway 分配的 token
 * @param {string} token
 */
export function saveDeviceToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token)
    console.log('[DeviceIdentity] 已保存设备 token')
  }
}

/**
 * 加载保存的 token
 * @returns {string|null}
 */
export function loadDeviceToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

/**
 * 清除保存的 token
 */
export function clearDeviceToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
}

export async function loadOrCreateDeviceIdentity() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (
        parsed?.version === 1 &&
        typeof parsed.deviceId === 'string' &&
        typeof parsed.publicKey === 'string' &&
        typeof parsed.privateKey === 'string'
      ) {
        const derivedId = await fingerprintPublicKey(base64UrlDecode(parsed.publicKey))
        if (derivedId !== parsed.deviceId) {
          const updated = {
            ...parsed,
            deviceId: derivedId,
          }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
          return {
            deviceId: derivedId,
            publicKey: parsed.publicKey,
            privateKey: parsed.privateKey,
          }
        }
        return {
          deviceId: parsed.deviceId,
          publicKey: parsed.publicKey,
          privateKey: parsed.privateKey,
        }
      }
    }
  } catch (e) {
    console.warn('[DeviceIdentity] 加载失败，将重新生成:', e)
  }

  const identity = await generateIdentity()
  const stored = {
    version: 1,
    deviceId: identity.deviceId,
    publicKey: identity.publicKey,
    privateKey: identity.privateKey,
    createdAtMs: Date.now(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  return identity
}

/**
 * 使用私钥签名 payload
 * @param {string} privateKeyBase64Url - Base64URL 编码的私钥
 * @param {string} payload - 要签名的 payload
 * @returns {Promise<string>} - Base64URL 编码的签名
 */
export async function signDevicePayload(privateKeyBase64Url, payload) {
  const key = base64UrlDecode(privateKeyBase64Url)
  const data = new TextEncoder().encode(payload)
  const sig = await signAsync(data, key)
  return base64UrlEncode(sig)
}

/**
 * 构建设备认证 payload
 * 格式: v2|deviceId|clientId|clientMode|role|scopes|signedAtMs|token|nonce
 * @param {Object} params
 * @returns {string}
 */
export function buildDeviceAuthPayload(params) {
  const scopes = params.scopes.join(',')
  const token = params.token ?? ''
  return [
    'v2',
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(params.signedAtMs),
    token,
    params.nonce,
  ].join('|')
}

export default {
  loadOrCreateDeviceIdentity,
  signDevicePayload,
  buildDeviceAuthPayload,
}
