export type AIProviderKind = 'none' | 'groq' | 'openai-compatible' | 'local' | 'custom'

export interface AIProviderConfig {
  provider: AIProviderKind
  endpoint: string
  model: string
}

export interface ConnectionResult {
  ok: boolean
  models?: string[]
  error?: string
}

export const GROQ_PRESET: AIProviderConfig = {
  provider: 'groq',
  endpoint: 'https://api.groq.com/openai/v1',
  model: 'openai/gpt-oss-20b',
}

export const DEFAULT_PROVIDER_CONFIG: AIProviderConfig = { provider: 'none', endpoint: '', model: '' }
const CONFIG_KEY = 'jjs-ai-provider'
const SECRET_KEY = 'jjs-ai-provider-secret'

export function normalizeEndpoint(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/, '')
}

export function saveProviderConfig(config: AIProviderConfig, storage: Pick<Storage, 'setItem'> = localStorage): void {
  storage.setItem(CONFIG_KEY, JSON.stringify({ ...config, endpoint: normalizeEndpoint(config.endpoint) }))
}

export function loadProviderConfig(storage: Pick<Storage, 'getItem'> = localStorage): AIProviderConfig {
  try {
    const raw = storage.getItem(CONFIG_KEY)
    if (!raw) return DEFAULT_PROVIDER_CONFIG
    const parsed = JSON.parse(raw) as Partial<AIProviderConfig>
    const providers: AIProviderKind[] = ['none', 'groq', 'openai-compatible', 'local', 'custom']
    if (!providers.includes(parsed.provider as AIProviderKind)) return DEFAULT_PROVIDER_CONFIG
    return {
      provider: parsed.provider as AIProviderKind,
      endpoint: normalizeEndpoint(typeof parsed.endpoint === 'string' ? parsed.endpoint : ''),
      model: typeof parsed.model === 'string' ? parsed.model : '',
    }
  } catch { return DEFAULT_PROVIDER_CONFIG }
}

export function setProviderSecret(secret: string, storage: Pick<Storage, 'setItem' | 'removeItem'> = sessionStorage): void {
  if (secret) storage.setItem(SECRET_KEY, secret)
  else storage.removeItem(SECRET_KEY)
}

export function getProviderSecret(storage: Pick<Storage, 'getItem'> = sessionStorage): string {
  return storage.getItem(SECRET_KEY) ?? ''
}

function headers(secret: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
  }
}

function assertReady(config: AIProviderConfig, secret: string): void {
  if (config.provider === 'none') throw new Error('AI provider is not configured.')
  if (!normalizeEndpoint(config.endpoint)) throw new Error('AI endpoint is required.')
  if (!config.model.trim()) throw new Error('AI model is required.')
  if (config.provider !== 'local' && !secret) throw new Error('API key is required for this provider.')
}

export async function testProviderConnection(config: AIProviderConfig, secret: string, fetcher: typeof fetch = fetch): Promise<ConnectionResult> {
  try {
    assertReady(config, secret)
    const response = await fetcher(`${normalizeEndpoint(config.endpoint)}/models`, { headers: headers(secret) })
    if (!response.ok) throw new Error(`Connection failed (${response.status} ${response.statusText})`)
    const payload: unknown = await response.json()
    const models = payload && typeof payload === 'object' && 'data' in payload && Array.isArray(payload.data)
      ? payload.data.flatMap((entry) => entry && typeof entry === 'object' && 'id' in entry && typeof entry.id === 'string' ? [entry.id] : [])
      : []
    return { ok: true, models }
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Connection failed.' } }
}

interface ChatMessage { role: 'system' | 'user'; content: string }

export async function requestStructuredChat(config: AIProviderConfig, secret: string, messages: ChatMessage[], fetcher: typeof fetch = fetch): Promise<unknown> {
  assertReady(config, secret)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60_000)
  try {
    const response = await fetcher(`${normalizeEndpoint(config.endpoint)}/chat/completions`, {
      method: 'POST',
      headers: headers(secret),
      signal: controller.signal,
      body: JSON.stringify({ model: config.model, messages, temperature: 0.1, response_format: { type: 'json_object' } }),
    })
    if (!response.ok) {
      const detail = await response.text()
      throw new Error(`AI request failed (${response.status}): ${detail.slice(0, 300)}`)
    }
    const payload: unknown = await response.json()
    if (!payload || typeof payload !== 'object' || !('choices' in payload) || !Array.isArray(payload.choices)) throw new Error('AI response is missing choices.')
    const first = payload.choices[0]
    if (!first || typeof first !== 'object' || !('message' in first) || !first.message || typeof first.message !== 'object' || !('content' in first.message) || typeof first.message.content !== 'string') throw new Error('AI response is missing message content.')
    const content = first.message.content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    return JSON.parse(content)
  } finally { clearTimeout(timer) }
}
