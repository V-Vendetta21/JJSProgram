import { useEffect, useState } from 'react'
import { DEFAULT_PROVIDER_CONFIG, getProviderSecret, GROQ_PRESET, loadProviderConfig, saveProviderConfig, setProviderSecret, testProviderConnection, type AIProviderConfig, type ConnectionResult } from './provider'

interface AISettingsDialogProps { onClose: () => void; onSaved: (config: AIProviderConfig) => void }

export function AISettingsDialog({ onClose, onSaved }: AISettingsDialogProps) {
  const [config, setConfig] = useState(() => loadProviderConfig())
  const [secret, setSecret] = useState(() => getProviderSecret())
  const [result, setResult] = useState<ConnectionResult | null>(null)
  const [testing, setTesting] = useState(false)
  useEffect(() => setResult(null), [config, secret])
  const save = () => { saveProviderConfig(config); setProviderSecret(secret); onSaved(config); onClose() }
  const test = async () => { setTesting(true); setResult(await testProviderConnection(config, secret)); setTesting(false) }
  return <div className="modal-backdrop"><section className="modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="ai-settings-title">
    <div className="modal-header"><div><small>EXPLICIT NETWORK FUNCTION</small><h2 id="ai-settings-title">AI Provider Settings</h2></div><button aria-label="Close AI settings" onClick={onClose}>×</button></div>
    <div className="settings-warning"><strong>Privacy boundary</strong><span>Moveset data leaves this device only when you explicitly run an AI action. The API key is held in session storage and is removed when the browser session ends.</span></div>
    <div className="settings-grid">
      <label>Provider<select value={config.provider} onChange={(event) => {
        const provider = event.target.value as AIProviderConfig['provider']
        if (provider === 'groq') setConfig(GROQ_PRESET)
        else if (provider === 'none') setConfig(DEFAULT_PROVIDER_CONFIG)
        else setConfig({ provider, endpoint: provider === 'local' ? 'http://127.0.0.1:11434/v1' : '', model: '' })
      }}><option value="none">None</option><option value="groq">Groq (OpenAI-compatible)</option><option value="openai-compatible">OpenAI-compatible</option><option value="local">Local model</option><option value="custom">Custom endpoint</option></select></label>
      <label>Endpoint<input value={config.endpoint} onChange={(event) => setConfig({ ...config, endpoint: event.target.value })} placeholder="https://…/v1" /></label>
      <label>Model<input list="provider-models" value={config.model} onChange={(event) => setConfig({ ...config, model: event.target.value })} placeholder="Exact model identifier" /></label>
      <datalist id="provider-models">{result?.models?.map((model) => <option value={model} key={model} />)}</datalist>
      <label>API key<input type="password" autoComplete="off" value={secret} onChange={(event) => setSecret(event.target.value)} placeholder={config.provider === 'local' ? 'Optional for local endpoints' : 'Stored for this session only'} /></label>
    </div>
    {result && <div className={`callout ${result.ok ? 'success' : 'error'}`}>{result.ok ? `Connected. ${result.models?.length ?? 0} models reported.` : result.error}</div>}
    <div className="modal-note">Groq preset uses the officially documented OpenAI-compatible base URL. The model remains editable. The previously posted credential was not imported because it was exposed and must be rotated.</div>
    <div className="modal-actions"><button onClick={onClose}>Cancel</button><button onClick={() => void test()} disabled={testing || config.provider === 'none'}>{testing ? 'Testing…' : 'Test Connection'}</button><button className="primary" onClick={save}>Save Settings</button></div>
  </section></div>
}
