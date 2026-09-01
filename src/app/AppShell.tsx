import { useEffect, useMemo, useRef, useState } from 'react'
import { decodeCharacterCode, encodeCharacterJson, type JJSData, type JsonObject } from '../codec/codec'
import { Explorer } from '../editor/Explorer'
import { Inspector } from '../editor/Inspector'
import { RawEditor } from '../editor/RawEditor'
import { Timeline } from '../editor/Timeline'
import { ValidationPanel } from '../editor/ValidationPanel'
import { analyzeMoveset, validateMoveset } from '../moveset/validator'
import { useProjectStore } from '../project/store'
import './AppShell.css'

type WorkspaceTab = 'timeline' | 'raw'

export function AppShell() {
  const store = useProjectStore()
  const [tab, setTab] = useState<WorkspaceTab>('timeline')
  const [selectedNode, setSelectedNode] = useState(0)
  const [importOpen, setImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [importCode, setImportCode] = useState('')
  const [importError, setImportError] = useState('')
  const [busy, setBusy] = useState(false)
  const [exportResult, setExportResult] = useState<{ code: string; verified: boolean; error?: string } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const messages = useMemo(() => validateMoveset(store.slots, store.data), [store.slots, store.data])
  const stats = useMemo(() => analyzeMoveset(store.slots, store.data), [store.slots, store.data])
  const selectedData = store.data[store.selectedSlot]
  const nodes = Array.isArray(selectedData?.Line) ? selectedData.Line.filter((node): node is JsonObject => Boolean(node) && typeof node === 'object' && !Array.isArray(node)) : []
  const node = nodes[selectedNode]
  const rawJson = JSON.stringify(store.slots, null, 2)

  useEffect(() => {
    if (store.slots.length) localStorage.setItem('jjs-studio-autosave', JSON.stringify({ projectVersion: 1, name: store.projectName, moveset: store.slots, modified: new Date().toISOString() }))
  }, [store.slots, store.projectName])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) store.redo()
        else store.undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [store])

  const importMoveset = async () => {
    setBusy(true); setImportError('')
    try {
      const decoded = await decodeCharacterCode(importCode)
      store.loadMoveset(decoded.value, decoded.data, 'Imported Character')
      setImportOpen(false); setImportCode('')
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Could not decode the code.')
    } finally { setBusy(false) }
  }

  const exportMoveset = async () => {
    setBusy(true); setExportResult(null)
    try {
      const encoded = await encodeCharacterJson(store.slots, store.data)
      const roundTrip = await decodeCharacterCode(encoded.code)
      const verified = JSON.stringify(roundTrip.value) === JSON.stringify(encoded.serializedSlots)
      setExportResult({ code: encoded.code, verified, error: verified ? undefined : 'Decoded output differs from encoded structure.' })
    } catch (error) {
      setExportResult({ code: '', verified: false, error: error instanceof Error ? error.message : 'Export failed.' })
    } finally { setBusy(false) }
  }

  const openExport = () => { setExportOpen(true); void exportMoveset() }
  const updateNode = (field: string, value: unknown) => {
    if (!selectedData || !Array.isArray(selectedData.Line)) return
    const next = structuredClone(selectedData) as JJSData
    const line = next.Line as JsonObject[]
    line[selectedNode] = { ...line[selectedNode], [field]: value }
    store.updateNestedData(store.selectedSlot, next, `Edit ${String(node?.K_NAME ?? 'node')}.${field}`)
  }

  const saveProject = () => download(`${safeName(store.projectName)}.jjsproject.json`, JSON.stringify({ projectVersion: 1, name: store.projectName, created: new Date().toISOString(), modified: new Date().toISOString(), source: { format: 'JJS_CHARACTER_CODE' }, moveset: store.slots, notes: {}, tags: [], history: [] }, null, 2))
  const openProject = async (file: File) => {
    try {
      const project = JSON.parse(await file.text()) as { name?: string; moveset?: unknown }
      if (!Array.isArray(project.moveset)) throw new Error('Project moveset is not an array.')
      const slots = project.moveset as typeof store.slots
      const data = slots.map((slot) => typeof slot.DATA === 'string' ? JSON.parse(slot.DATA) as JJSData : {})
      store.loadMoveset(slots, data, project.name ?? file.name)
    } catch (error) { setImportError(error instanceof Error ? error.message : 'Could not open project.'); setImportOpen(true) }
  }

  return <div className="studio">
    <header className="titlebar">
      <div className="brand"><span className="brand-mark">J</span><div><strong>JJS MOVESET STUDIO</strong><small>{store.projectName}{store.dirty ? ' •' : ''}</small></div></div>
      <nav className="menu">
        <button onClick={() => store.reset()}>New</button>
        <button onClick={() => setImportOpen(true)}>Import JJS Code</button>
        <button onClick={() => fileInput.current?.click()}>Open Project</button>
        <button onClick={saveProject} disabled={!store.slots.length}>Save Project</button>
        <button className="export-button" onClick={openExport} disabled={!store.slots.length}>Export JJS Code</button>
      </nav>
      <div className="title-actions"><button aria-label="Undo" onClick={store.undo} disabled={!store.history.length}>↶</button><button aria-label="Redo" onClick={store.redo} disabled={!store.future.length}>↷</button><span className="ai-status"><i />AI NOT CONFIGURED</span></div>
      <input ref={fileInput} hidden type="file" accept=".json,.jjsproject.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void openProject(file) }} />
    </header>
    <div className="healthbar"><span className={messages.some((message) => message.severity === 'error') ? 'status error' : 'status valid'}>{messages.some((message) => message.severity === 'error') ? 'STRUCTURE ERRORS' : 'PARSE VALID'}</span><span className="status observed">REGISTRY: OBSERVED</span><span className="status muted">GAME UNVERIFIED</span><span className="health-spacer" /><span>{stats.nodes} nodes</span><span>{stats.unknownNodes} unknown</span></div>
    <main className="workbench">
      <Explorer slots={store.slots} selected={store.selectedSlot} onSelect={(index) => { store.selectSlot(index); setSelectedNode(0) }} />
      <section className="workspace">
        <div className="workspace-header">
          <div><small>{String(store.slots[store.selectedSlot]?.K_NAME ?? 'NO SLOT')}</small><strong>{String(store.slots[store.selectedSlot]?.NAME ?? 'No moveset loaded')}</strong></div>
          <div className="view-tabs"><button className={tab === 'timeline' ? 'active' : ''} onClick={() => setTab('timeline')}>Timeline</button><button className={tab === 'raw' ? 'active' : ''} onClick={() => setTab('raw')}>Raw JSON</button></div>
        </div>
        {tab === 'timeline' ? <Timeline data={selectedData} selectedNode={selectedNode} onSelectNode={setSelectedNode} /> : <RawEditor key={rawJson} value={rawJson} onApply={store.replaceRawJson} />}
      </section>
      <Inspector node={node} onChange={updateNode} />
    </main>
    <ValidationPanel messages={messages} stats={stats} />

    {importOpen && <div className="modal-backdrop" role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="import-title">
      <div className="modal-header"><div><small>LOCAL FUNCTION</small><h2 id="import-title">Import JJS Character Code</h2></div><button aria-label="Close import" onClick={() => setImportOpen(false)}>×</button></div>
      <label htmlFor="import-code">Paste JJS character code</label>
      <textarea id="import-code" value={importCode} onChange={(event) => setImportCode(event.target.value)} placeholder="KLUv/…" spellCheck={false} />
      {importError && <div className="callout error">{importError}</div>}
      <div className="modal-note">Processed locally: Base64 → Zstandard → UTF-8 → JSON. Imported content is never executed.</div>
      <div className="modal-actions"><button onClick={() => setImportOpen(false)}>Cancel</button><button className="primary" disabled={busy || !importCode.trim()} onClick={() => void importMoveset()}>{busy ? 'Decoding…' : 'Decode & Open'}</button></div>
    </section></div>}

    {exportOpen && <div className="modal-backdrop" role="presentation"><section className="modal export-modal" role="dialog" aria-modal="true" aria-labelledby="export-title">
      <div className="modal-header"><div><small>SAFE EXPORT</small><h2 id="export-title">Export Verification</h2></div><button aria-label="Close export" onClick={() => setExportOpen(false)}>×</button></div>
      {busy && <div className="export-loading">Encoding and decoding again…</div>}
      {exportResult && <><div className={`verification ${exportResult.verified ? 'pass' : 'fail'}`}><strong>{exportResult.verified ? 'ROUND-TRIP PASS' : 'EXPORT BLOCKED'}</strong><span>{exportResult.verified ? 'CODEC VALID · JSON STRUCTURE PRESERVED · GAME UNVERIFIED' : exportResult.error}</span></div>{exportResult.verified && <textarea aria-label="Generated JJS code" readOnly value={exportResult.code} />}</>}
      <div className="modal-actions"><button onClick={() => setExportOpen(false)}>Close</button>{exportResult?.verified && <><button onClick={() => download(`${safeName(store.projectName)}.jjs.txt`, exportResult.code)}>Save Code</button><button className="primary" onClick={() => void navigator.clipboard?.writeText(exportResult.code)}>Copy Code</button></>}</div>
    </section></div>}
  </div>
}

function safeName(name: string) { return name.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '') || 'moveset' }
function download(name: string, content: string) { const anchor = document.createElement('a'); anchor.href = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' })); anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(anchor.href), 0) }
