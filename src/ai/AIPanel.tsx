import { useMemo, useState } from 'react'
import type { JJSData } from '../codec/codec'
import { structuralDiff } from '../moveset/diff'
import { AI_SYSTEM_PROMPT, applyChangeSet, buildAIContext, validateChangeSet, type AIChangeSet } from './changesets'
import { getProviderSecret, requestStructuredChat, type AIProviderConfig } from './provider'
import { Icon } from '../ui/Icon'

interface AIPanelProps {
  move: JJSData
  moveName: string
  config: AIProviderConfig
  onOpenSettings: () => void
  onApply: (next: JJSData, label: string) => void
  onClose: () => void
}

type Mode = 'EDIT' | 'EXPLAIN' | 'DEBUG'

export function AIPanel({ move, moveName, config, onOpenSettings, onApply, onClose }: AIPanelProps) {
  const [mode, setMode] = useState<Mode>('EDIT')
  const [prompt, setPrompt] = useState('')
  const [changeSet, setChangeSet] = useState<AIChangeSet | null>(null)
  const [enabled, setEnabled] = useState<Set<number>>(new Set())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const selectedOperations = changeSet?.operations.filter((_, index) => enabled.has(index)) ?? []
  const proposed = useMemo(() => applyChangeSet(move, selectedOperations), [move, selectedOperations])
  const changes = useMemo(() => structuralDiff(move, proposed), [move, proposed])

  const generate = async () => {
    setBusy(true); setError(''); setChangeSet(null)
    try {
      const instruction = mode === 'EDIT' ? prompt : `${mode} the selected move. Do not modify it; return an empty operations array. Request: ${prompt}`
      const raw = await requestStructuredChat(config, getProviderSecret(), [
        { role: 'system', content: AI_SYSTEM_PROMPT },
        { role: 'user', content: `${instruction}\n\nScoped context:\n${buildAIContext(move)}` },
      ])
      const validated = validateChangeSet(raw, move)
      setChangeSet(validated)
      setEnabled(new Set(validated.operations.map((_, index) => index)))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'AI request failed.') }
    finally { setBusy(false) }
  }
  return <div className="modal-backdrop"><section className="modal ai-modal" role="dialog" aria-modal="true" aria-labelledby="ai-panel-title">
    <div className="modal-header"><div><small>STRUCTURED COPILOT</small><h2 id="ai-panel-title">AI · {moveName}</h2></div><button aria-label="Close AI panel" onClick={onClose}><Icon name="close" /></button></div>
    <div className="ai-modebar">{(['EDIT', 'EXPLAIN', 'DEBUG'] as Mode[]).map((value) => <button className={mode === value ? 'active' : ''} key={value} onClick={() => setMode(value)}>{value}</button>)}<span>{config.provider === 'none' ? 'Not configured' : `${config.provider} · ${config.model || 'model missing'}`}</span><button onClick={onOpenSettings}>Settings</button></div>
    <div className="ai-compose"><textarea aria-label="AI instruction" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={mode === 'EDIT' ? 'Make this attack slower, reduce its hitbox slightly, and strengthen the final hit.' : `Ask AI to ${mode.toLowerCase()} this move…`} /><button className="primary" disabled={busy || !prompt.trim() || config.provider === 'none'} onClick={() => void generate()}>{busy ? 'Working…' : `${mode} MOVE`}</button></div>
    {config.provider === 'none' && <div className="callout warning">Configure an AI provider first. All deterministic editor features remain available without AI.</div>}
    {error && <div className="callout error">{error}</div>}
    {changeSet && <div className="ai-results"><div className="ai-explanation"><strong>AI explanation</strong><p>{changeSet.explanation}</p></div>
      {changeSet.operations.length > 0 && <div className="operation-list">{changeSet.operations.map((operation, index) => <label key={index}><input type="checkbox" checked={enabled.has(index)} onChange={() => setEnabled((current) => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next })} /><code>{operation.type}</code><span>{describe(operation)}</span></label>)}</div>}
      <div className="ai-diff"><strong>{changes.length} proposed structural changes</strong>{changes.slice(0, 80).map((change) => <div key={change.path}><code>{change.path}</code><del>{short(change.before)}</del><ins>{short(change.after)}</ins></div>)}</div>
    </div>}
    <div className="modal-actions"><button onClick={onClose}>Close</button>{changeSet && changeSet.operations.length > 0 && <button className="primary" disabled={!selectedOperations.length} onClick={() => { onApply(proposed, `AI ${mode}: ${prompt.slice(0, 60)}`); onClose() }}>Apply Selected</button>}</div>
  </section></div>
}

function short(value: unknown) { const text = value === undefined ? 'MISSING' : typeof value === 'string' ? value : JSON.stringify(value); return text.length > 100 ? `${text.slice(0, 100)}…` : text }
function describe(operation: AIChangeSet['operations'][number]) { switch (operation.type) { case 'SET_FIELD': return `Node ${operation.nodeIndex + 1}: ${operation.field} → ${short(operation.value)}`; case 'INSERT_NODE': return `Insert ${String(operation.node.K_NAME)} at ${operation.index + 1}`; case 'DELETE_NODE': return `Delete node ${operation.index + 1}`; case 'MOVE_NODE': return `Move node ${operation.fromIndex + 1} → ${operation.toIndex + 1}`; case 'DUPLICATE_NODE': return `Duplicate node ${operation.index + 1}` } }
