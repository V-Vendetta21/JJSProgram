import type { JsonObject } from '../codec/codec'
import { nodeDefinitionMap } from '../registry/nodes'
import { Icon } from '../ui/Icon'

interface InspectorProps {
  node?: JsonObject
  onChange: (field: string, value: unknown) => void
}

export function Inspector({ node, onChange }: InspectorProps) {
  if (!node) return <aside className="panel inspector"><div className="panel-heading">INSPECTOR</div><div className="empty-note">Select a timeline node.</div></aside>
  const type = typeof node.K_NAME === 'string' ? node.K_NAME : 'UNKNOWN'
  const definition = nodeDefinitionMap.get(type)
  return <aside className="panel inspector">
    <div className="panel-heading"><span>INSPECTOR</span><span className={`confidence ${definition?.confidence.toLowerCase() ?? 'unknown'}`}>{definition?.confidence ?? 'UNKNOWN'}</span></div>
    <div className="inspector-title"><Icon name="node" className={`node-glyph node-${type.toLowerCase()}`} /><div><strong>{type}</strong><small>{definition?.category ?? 'Unregistered node'}</small></div></div>
    <div className="field-list">
      {Object.entries(node).map(([field, value]) => <label className="field" key={field}>
        <span>{field}</span>
        {field === 'K_NAME' ? <code>{String(value)}</code> : <input value={display(value)} onChange={(event) => onChange(field, parse(event.target.value, value))} />}
        <small>{typeof value}{definition && !definition.fields.includes(field) ? ' · unknown field preserved' : ''}</small>
      </label>)}
    </div>
  </aside>
}

const display = (value: unknown) => typeof value === 'string' ? value : JSON.stringify(value)
function parse(text: string, previous: unknown): unknown {
  if (typeof previous === 'number') {
    const value = Number(text)
    return Number.isFinite(value) ? value : previous
  }
  if (typeof previous === 'boolean') return text.toLowerCase() === 'true'
  if (Array.isArray(previous) || (previous && typeof previous === 'object')) {
    try { return JSON.parse(text) } catch { return previous }
  }
  return text
}
