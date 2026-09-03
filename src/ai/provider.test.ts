import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getProviderSecret, loadProviderConfig, requestToolAssistedGeneration, saveProviderConfig, setProviderSecret, testProviderConnection, type AIProviderConfig } from './provider'
import { DEFAULT_GENERATION_PREFERENCES } from '../generation/preferences'
import { getGenerationContext } from '../generation/retriever'

const config: AIProviderConfig = { provider: 'groq', endpoint: 'https://api.groq.com/openai/v1/', model: 'openai/gpt-oss-20b' }

describe('AI provider configuration', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks() })

  it('persists provider metadata but keeps API secrets session-only', () => {
    saveProviderConfig(config)
    setProviderSecret('temporary-secret')

    expect(loadProviderConfig()).toEqual({ ...config, endpoint: 'https://api.groq.com/openai/v1' })
    expect(localStorage.getItem('jjs-ai-provider')).not.toContain('temporary-secret')
    expect(getProviderSecret()).toBe('temporary-secret')
  })

  it('tests the OpenAI-compatible models endpoint', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: 'model-a' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    const result = await testProviderConnection(config, 'secret', fetcher)

    expect(result).toEqual({ ok: true, models: ['model-a'] })
    expect(fetcher).toHaveBeenCalledWith('https://api.groq.com/openai/v1/models', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer secret' }) }))
  })

  it('runs a bounded tool-calling loop before returning a move plan', async () => {
    const plan = { name: 'Tool Punch', description: 'Punch', role: 'combo-starter', design: { startup: 'fast', damage: 'medium', range: 'close', commitment: 'low' }, timeline: [{ type: 'wait', duration: 0.1 }, { type: 'hitbox', intent: 'punch', size: 'medium', placement: 'forward', damage: 'medium' }], branches: [], requirements: [], references: [] }
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'searchNodeRegistry', arguments: '{"query":"punch hitbox"}' } }] } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: JSON.stringify(plan) } }] }), { status: 200 }))
    const context = getGenerationContext('Create a punch', DEFAULT_GENERATION_PREFERENCES)

    const result = await requestToolAssistedGeneration(config, 'secret', 'system', 'Create a punch', context, fetcher)

    expect(result).toEqual(plan)
    expect(fetcher).toHaveBeenCalledTimes(2)
    const secondBody = JSON.parse(String(fetcher.mock.calls[1][1]?.body))
    expect(secondBody.messages).toEqual(expect.arrayContaining([expect.objectContaining({ role: 'tool', tool_call_id: 'call-1' })]))
  })
})
