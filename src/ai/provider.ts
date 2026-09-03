import type { GenerationContext } from '../generation/types'
import { parseGeneratedMovePlan } from '../generation/designer'
import { compileGeneratedMove } from '../generation/compiler'
import { DEFAULT_GENERATION_PREFERENCES } from '../generation/preferences'
import { validateMoveset } from '../moveset/validator'

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

interface ToolCall { id: string; type: 'function'; function: { name: string; arguments: string } }
type AgentMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string }

const generationTools = [
  'getCurrentProject', 'getCurrentMove', 'getSelectedNode',
  'searchNodeRegistry', 'searchAnimationRegistry', 'searchEffectRegistry', 'searchExamples', 'searchPatterns',
  'createMove', 'insertMove', 'replaceMove', 'createBranch', 'insertNode', 'updateNode', 'validateMove', 'analyzeMove',
].map((name) => ({ type: 'function', function: { name, description: `JJS Moveset Studio generation tool: ${name}`, parameters: { type: 'object', properties: { query: { type: 'string' }, plan: { type: 'object' }, index: { type: 'number' } }, additionalProperties: true } } }))

function parseToolArguments(raw: string): Record<string, unknown> {
  try { const value: unknown = JSON.parse(raw); return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {} } catch { return {} }
}

function searchByQuery<T>(rows: T[], query: unknown): T[] {
  const terms = String(query ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 2)
  if (!terms.length) return rows.slice(0, 20)
  return rows.filter((row) => terms.some((term) => JSON.stringify(row).toLowerCase().includes(term))).slice(0, 20)
}

function runGenerationTool(name: string, args: Record<string, unknown>, context: GenerationContext): unknown {
  switch (name) {
    case 'getCurrentProject': return { slots: context.currentKit }
    case 'getCurrentMove': return context.currentKit[0] ?? null
    case 'getSelectedNode': return { status: 'NO_NODE_SELECTED_IN_GENERATION_DIALOG' }
    case 'searchNodeRegistry': return searchByQuery(context.nodes, args.query)
    case 'searchAnimationRegistry': return searchByQuery(context.references.filter((entry) => entry.kind === 'animation'), args.query)
    case 'searchEffectRegistry': return searchByQuery(context.references.filter((entry) => entry.kind === 'effect'), args.query)
    case 'searchExamples': return searchByQuery(context.examples, args.query)
    case 'searchPatterns': return searchByQuery(context.patterns, args.query)
    case 'createMove': case 'validateMove': {
      if (!args.plan) return { status: 'PLAN_REQUIRED' }
      try {
        const plan = parseGeneratedMovePlan(args.plan)
        const compiled = compileGeneratedMove(plan, DEFAULT_GENERATION_PREFERENCES)
        const slot = { K_NAME: 'SKILL', NAME: plan.name, DATA: JSON.stringify(compiled.move) }
        const validation = validateMoveset([slot], [compiled.move])
        return { status: validation.some((message) => message.severity === 'error') ? 'INVALID' : 'VALID_PREVIEW', validation, unresolvedReferences: compiled.unresolved, instruction: 'Return the complete corrected plan as the final JSON response.' }
      } catch (cause) { return { status: 'INVALID_PLAN', validation: [{ severity: 'error', path: 'plan', message: cause instanceof Error ? cause.message : String(cause) }] }
      }
    }
    case 'analyzeMove': return { knownNodes: context.nodes.map((node) => node.type), availableReferences: context.references.length, patterns: context.patterns.map((pattern) => pattern.name) }
    case 'insertMove': case 'replaceMove': case 'createBranch': case 'insertNode': case 'updateNode': return { status: 'DEFERRED_TO_VERIFIED_EDITOR_TRANSACTION', reason: 'The model cannot claim mutation; insertion occurs only after compilation, validation, and the user preview action.' }
    default: return { error: `Unknown generation tool ${name}` }
  }
}

export async function requestToolAssistedGeneration(config: AIProviderConfig, secret: string, systemPrompt: string, userPrompt: string, context: GenerationContext, fetcher: typeof fetch = fetch): Promise<unknown> {
  assertReady(config, secret)
  const messages: AgentMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `${userPrompt}\n\nInitial scoped generation context:\n${JSON.stringify({ nodes: context.nodes, patterns: context.patterns, examples: context.examples, references: context.references, currentKit: context.currentKit })}` },
  ]
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30_000)
    let response: Response
    try {
      response = await fetcher(`${normalizeEndpoint(config.endpoint)}/chat/completions`, {
        method: 'POST', headers: headers(secret), signal: controller.signal,
        body: JSON.stringify({ model: config.model, messages, tools: generationTools, tool_choice: 'auto', temperature: 0.15, response_format: { type: 'json_object' } }),
      })
    } finally { clearTimeout(timer) }
    if (!response.ok) throw new Error(`AI generation request failed (${response.status}): ${(await response.text()).slice(0, 300)}`)
    const payload: unknown = await response.json()
    if (!payload || typeof payload !== 'object' || !('choices' in payload) || !Array.isArray(payload.choices)) throw new Error('AI generation response is missing choices.')
    const choice = payload.choices[0]
    if (!choice || typeof choice !== 'object' || !('message' in choice) || !choice.message || typeof choice.message !== 'object') throw new Error('AI generation response is missing a message.')
    const message = choice.message as { content?: unknown; tool_calls?: unknown }
    const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls as ToolCall[] : []
    messages.push({ role: 'assistant', content: typeof message.content === 'string' ? message.content : null, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) })
    if (!toolCalls.length) {
      if (typeof message.content !== 'string') throw new Error('AI generation response did not contain a structured move plan.')
      return JSON.parse(message.content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''))
    }
    for (const call of toolCalls) messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(runGenerationTool(call.function.name, parseToolArguments(call.function.arguments), context)) })
  }
  throw new Error('AI generation exceeded the 8-step tool-call limit.')
}
