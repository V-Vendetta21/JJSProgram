import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getProviderSecret, loadProviderConfig, saveProviderConfig, setProviderSecret, testProviderConnection, type AIProviderConfig } from './provider'

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
})
