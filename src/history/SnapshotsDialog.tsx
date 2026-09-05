import { useMemo, useState } from 'react'
import type { JJSData, JJSSlot } from '../codec/codec'
import { structuralDiff } from '../moveset/diff'
import type { ProjectSnapshot } from '../project/store'
import { Icon } from '../ui/Icon'

interface SnapshotsDialogProps {
  slots: JJSSlot[]
  data: JJSData[]
  baselineSlots: JJSSlot[]
  baselineData: JJSData[]
  snapshots: ProjectSnapshot[]
  onCreate: (label: string) => void
  onRestore: (id: string) => void
  onRemove: (id: string) => void
  onClose: () => void
}

const expanded = (slots: JJSSlot[], data: JJSData[]) => slots.map((slot, index) => ({ ...slot, DATA: data[index] }))

export function SnapshotsDialog(props: SnapshotsDialogProps) {
  const [label, setLabel] = useState('')
  const [reference, setReference] = useState('baseline')
  const source = reference === 'baseline'
    ? expanded(props.baselineSlots, props.baselineData)
    : (() => { const snapshot = props.snapshots.find((entry) => entry.id === reference); return snapshot ? expanded(snapshot.slots, snapshot.data) : [] })()
  const changes = useMemo(() => structuralDiff(source, expanded(props.slots, props.data)), [source, props.slots, props.data])
  return <div className="modal-backdrop"><section className="modal wide-modal" role="dialog" aria-modal="true" aria-labelledby="changes-title">
    <div className="modal-header"><div><small>REVERSIBLE EDITING</small><h2 id="changes-title">Snapshots & What Changed?</h2></div><button aria-label="Close snapshots" onClick={props.onClose}><Icon name="close" /></button></div>
    <div className="snapshot-layout">
      <aside className="snapshot-sidebar">
        <div className="snapshot-create"><input aria-label="Snapshot name" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Before combo rework" /><button className="primary" onClick={() => { props.onCreate(label); setLabel('') }}>Create</button></div>
        <button className={reference === 'baseline' ? 'snapshot-item active' : 'snapshot-item'} onClick={() => setReference('baseline')}><strong>Last import / baseline</strong><small>Original project state</small></button>
        {props.snapshots.map((snapshot) => <div className={reference === snapshot.id ? 'snapshot-item active' : 'snapshot-item'} key={snapshot.id}>
          <button onClick={() => setReference(snapshot.id)}><strong>{snapshot.label}</strong><small>{new Date(snapshot.createdAt).toLocaleString()}</small></button>
          <div><button onClick={() => props.onRestore(snapshot.id)}>Restore</button><button aria-label={`Remove ${snapshot.label}`} onClick={() => props.onRemove(snapshot.id)}><Icon name="close" /></button></div>
        </div>)}
      </aside>
      <div className="diff-panel">
        <div className="diff-header"><strong>{changes.length} structural changes</strong><span>Reference → current project</span></div>
        <div className="diff-list">{changes.length === 0 ? <div className="validation-ok"><Icon name="check" /> No structural changes from this reference.</div> : changes.slice(0, 500).map((change, index) => <article className={`diff-entry ${change.kind}`} key={`${change.path}-${index}`}>
          <code>{change.path}</code><span>{change.kind.toUpperCase()}</span><div><del>{format(change.before)}</del><ins>{format(change.after)}</ins></div>
        </article>)}</div>
      </div>
    </div>
    <div className="modal-actions"><button onClick={props.onClose}>Close</button></div>
  </section></div>
}

function format(value: unknown): string {
  if (value === undefined) return 'MISSING'
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return text.length > 220 ? `${text.slice(0, 220)}…` : text
}
