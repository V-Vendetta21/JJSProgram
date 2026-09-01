import { useEffect, useMemo, useRef, useState } from 'react'
import { AIPanel } from '../ai/AIPanel'
import { AISettingsDialog } from '../ai/AISettingsDialog'
import { loadProviderConfig, type AIProviderConfig } from '../ai/provider'
import { decodeCharacterCode, encodeCharacterJson, type DecodedCharacter, type JJSData, type JsonObject } from '../codec/codec'
import { Explorer } from '../editor/Explorer'
import { Inspector } from '../editor/Inspector'
import { RawEditor } from '../editor/RawEditor'
import { Timeline } from '../editor/Timeline'
import { ValidationPanel } from '../editor/ValidationPanel'
import { SnapshotsDialog } from '../history/SnapshotsDialog'
import { structuralDiff } from '../moveset/diff'
import { analyzeMoveset, findNodeDependencies, validateMoveset } from '../moveset/validator'
import { parseProjectFile, readAutosave, serializeProjectFile, writeAutosave } from '../project/project'
import { useProjectStore } from '../project/store'
import './AppShell.css'

type WorkspaceTab = 'timeline' | 'raw'
interface ExportResult { code: string; verified: boolean; error?: string; warnings: number }

export function AppShell() {
  const store = useProjectStore()
  const [tab, setTab] = useState<WorkspaceTab>('timeline')
  const [selectedNode, setSelectedNode] = useState(0)
  const [importOpen, setImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [snapshotsOpen, setSnapshotsOpen] = useState(false)
  const [importCode, setImportCode] = useState('')
  const [importError, setImportError] = useState('')
  const [pendingImport, setPendingImport] = useState<DecodedCharacter | null>(null)
  const [busy, setBusy] = useState(false)
  const [exportResult, setExportResult] = useState<ExportResult | null>(null)
  const [aiConfig, setAIConfig] = useState<AIProviderConfig>(() => loadProviderConfig())
  const [autosave, setAutosave] = useState(() => readAutosave())
  const fileInput = useRef<HTMLInputElement>(null)

  const messages = useMemo(() => validateMoveset(store.slots, store.data), [store.slots, store.data])
  const stats = useMemo(() => analyzeMoveset(store.slots, store.data), [store.slots, store.data])
  const selectedData = store.data[store.selectedSlot]
  const nodes = useMemo(() => Array.isArray(selectedData?.Line) ? selectedData.Line.filter((node): node is JsonObject => Boolean(node) && typeof node === 'object' && !Array.isArray(node)) : [], [selectedData])
  const node = nodes[selectedNode]
  const rawJson = JSON.stringify(store.slots, null, 2)
  const errors = messages.filter((message) => message.severity === 'error')
  const warnings = messages.filter((message) => message.severity === 'warning')
  const pendingDiff = pendingImport ? structuralDiff(expanded(store.slots, store.data), expanded(pendingImport.value, pendingImport.data)) : []

  useEffect(() => {
    if (store.slots.length) { writeAutosave(store); setAutosave(readAutosave()) }
  }, [store.projectId, store.projectName, store.createdAt, store.modifiedAt, store.slots, store.data, store.baselineSlots, store.baselineData, store.snapshots, store.notes, store.tags])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) store.redo(); else store.undo() }
      if (event.ctrlKey && event.key.toLowerCase() === 's' && store.slots.length) { event.preventDefault(); saveProject() }
      if (event.ctrlKey && event.key.toLowerCase() === 'k') { event.preventDefault(); setAiOpen(Boolean(selectedData)) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const importMoveset = async () => {
    setBusy(true); setImportError(''); setPendingImport(null)
    try {
      const decoded = await decodeCharacterCode(importCode)
      if (store.slots.length) setPendingImport(decoded)
      else { store.loadMoveset(decoded.value, decoded.data, 'Imported Character'); closeImport() }
    } catch (error) { setImportError(error instanceof Error ? error.message : 'Could not decode the code.') }
    finally { setBusy(false) }
  }
  const closeImport = () => { setImportOpen(false); setImportCode(''); setPendingImport(null); setImportError('') }
  const replaceWithPending = () => { if (!pendingImport) return; store.loadMoveset(pendingImport.value, pendingImport.data, 'Imported Character'); closeImport() }

  const exportMoveset = async () => {
    setBusy(true); setExportResult(null)
    if (errors.length) { setExportResult({ code: '', verified: false, error: `${errors.length} structural error(s) must be fixed before export.`, warnings: warnings.length }); setBusy(false); return }
    try {
      const encoded = await encodeCharacterJson(store.slots, store.data)
      const roundTrip = await decodeCharacterCode(encoded.code)
      const verified = JSON.stringify(roundTrip.value) === JSON.stringify(encoded.serializedSlots)
      setExportResult({ code: encoded.code, verified, error: verified ? undefined : 'Decoded output differs from encoded structure.', warnings: warnings.length })
    } catch (error) { setExportResult({ code: '', verified: false, error: error instanceof Error ? error.message : 'Export failed.', warnings: warnings.length }) }
    finally { setBusy(false) }
  }
  const openExport = () => { setExportOpen(true); void exportMoveset() }

  const updateNode = (field: string, value: unknown) => {
    if (!selectedData || !Array.isArray(selectedData.Line)) return
    const next = structuredClone(selectedData) as JJSData
    const line = next.Line as JsonObject[]
    line[selectedNode] = { ...line[selectedNode], [field]: value }
    store.updateNestedData(store.selectedSlot, next, `Edit ${String(node?.K_NAME ?? 'node')}.${field}`)
  }
  const insertWait = () => { const index = nodes.length ? selectedNode + 1 : 0; store.insertNode(store.selectedSlot, index, { K_NAME: 'WAIT', TIME: 1 }); setSelectedNode(index) }
  const duplicateNode = () => { store.duplicateNode(store.selectedSlot, selectedNode); setSelectedNode(Math.min(selectedNode + 1, nodes.length)) }
  const moveNode = (direction: -1 | 1) => { const target = selectedNode + direction; store.moveNode(store.selectedSlot, selectedNode, target); setSelectedNode(target) }
  const deleteNode = () => {
    const dependencies = findNodeDependencies(nodes, selectedNode)
    const warning = dependencies.length ? `This node has ${dependencies.length} detected tag reference(s):\n${dependencies.map((item) => `Node ${item.nodeIndex + 1} · ${item.field}=${item.value}`).join('\n')}\n\nDelete anyway?` : `Delete ${String(node?.K_NAME ?? 'this node')}?`
    if (!window.confirm(warning)) return
    store.deleteNode(store.selectedSlot, selectedNode)
    setSelectedNode(Math.max(0, selectedNode - 1))
  }

  function saveProject() {
    download(`${safeName(store.projectName)}.jjsproject.json`, serializeProjectFile(store), 'application/json')
    store.markSaved()
  }
  const openProject = async (file: File) => {
    try { const project = parseProjectFile(await file.text()); store.loadProject(project); setSelectedNode(0) }
    catch (error) { setImportError(error instanceof Error ? error.message : 'Could not open project.'); setImportOpen(true) }
  }
  const restoreAutosave = () => { if (autosave) { store.loadProject(autosave); setSelectedNode(0) } }

  return <div className="studio">
    <header className="titlebar">
      <div className="brand"><span className="brand-mark">J</span><div><strong>JJS MOVESET STUDIO</strong><button className="project-name" onClick={() => { const name = window.prompt('Project name', store.projectName); if (name) store.renameProject(name) }}>{store.projectName}{store.dirty ? ' •' : ''}</button></div></div>
      <nav className="menu">
        <button onClick={() => store.reset()}>New</button><button aria-label="Import JJS Code" onClick={() => setImportOpen(true)}>Import</button><button onClick={() => fileInput.current?.click()}>Open</button><button onClick={saveProject} disabled={!store.slots.length}>Save</button>
        <span className="menu-divider" /><button onClick={() => setSnapshotsOpen(true)} disabled={!store.slots.length}>Changes</button><button onClick={() => setAiOpen(true)} disabled={!selectedData}>AI Copilot</button><button className="export-button" onClick={openExport} disabled={!store.slots.length}>Export</button>
      </nav>
      <div className="title-actions"><button aria-label="Undo" onClick={store.undo} disabled={!store.history.length}>↶</button><button aria-label="Redo" onClick={store.redo} disabled={!store.future.length}>↷</button><button className={`ai-status ${aiConfig.provider !== 'none' ? 'connected' : ''}`} onClick={() => setSettingsOpen(true)}><i />{aiConfig.provider === 'none' ? 'AI NOT CONFIGURED' : `AI · ${aiConfig.provider.toUpperCase()}`}</button></div>
      <input ref={fileInput} hidden type="file" accept=".json,.jjsproject.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void openProject(file) }} />
    </header>
    <div className="healthbar"><span className={errors.length ? 'status error' : 'status valid'}>{errors.length ? 'STRUCTURE ERRORS' : 'PARSE VALID'}</span><span className="status observed">REGISTRY: OBSERVED</span><span className="status muted">GAME UNVERIFIED</span><span className="health-spacer" /><span>{stats.nodes} nodes</span><span>{stats.unknownNodes} unknown</span><span>{store.snapshots.length} snapshots</span></div>
    <main className="workbench">
      <Explorer slots={store.slots} selected={store.selectedSlot} onSelect={(index) => { store.selectSlot(index); setSelectedNode(0) }} />
      <section className="workspace">
        {!store.slots.length ? <WelcomePanel aiConfigured={aiConfig.provider !== 'none'} hasAutosave={Boolean(autosave)} onImport={() => setImportOpen(true)} onOpen={() => fileInput.current?.click()} onRestore={restoreAutosave} onAI={() => setSettingsOpen(true)} /> : <>
          <div className="workspace-header"><div><small>{String(store.slots[store.selectedSlot]?.K_NAME ?? 'NO SLOT')}</small><strong>{String(store.slots[store.selectedSlot]?.NAME ?? 'Unnamed slot')}</strong></div><div className="view-tabs"><button className={tab === 'timeline' ? 'active' : ''} onClick={() => setTab('timeline')}>Timeline</button><button className={tab === 'raw' ? 'active' : ''} onClick={() => setTab('raw')}>Raw JSON</button></div></div>
          {tab === 'timeline' ? <Timeline data={selectedData} selectedNode={selectedNode} onSelectNode={setSelectedNode} onInsertWait={insertWait} onDuplicate={duplicateNode} onDelete={deleteNode} onMove={moveNode} /> : <RawEditor key={rawJson} value={rawJson} onApply={store.replaceRawJson} />}
        </>}
      </section>
      <Inspector node={node} onChange={updateNode} />
    </main>
    <ValidationPanel messages={messages} stats={stats} />

    {importOpen && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="import-title"><div className="modal-header"><div><small>LOCAL FUNCTION</small><h2 id="import-title">Import JJS Character Code</h2></div><button aria-label="Close import" onClick={closeImport}>×</button></div>
      {!pendingImport ? <><label htmlFor="import-code">Paste JJS character code</label><textarea id="import-code" value={importCode} onChange={(event) => setImportCode(event.target.value)} placeholder="KLUv/…" spellCheck={false} />{importError && <div className="callout error">{importError}</div>}<div className="modal-note">Processed locally: Base64 → Zstandard → UTF-8 → JSON. Imported content is never executed.</div><div className="modal-actions"><button onClick={closeImport}>Cancel</button><button className="primary" disabled={busy || !importCode.trim()} onClick={() => void importMoveset()}>{busy ? 'Decoding…' : 'Decode & Open'}</button></div></> : <><div className="import-summary"><strong>Import decoded successfully</strong><span>{pendingImport.value.length} slots · {pendingImport.data.reduce((count, data) => count + (Array.isArray(data.Line) ? data.Line.length : 0), 0)} main-line nodes</span><span>{pendingDiff.length} differences from the current project</span></div><div className="callout warning">Replacing starts a new project. Save or snapshot the current project first if you need it.</div><div className="modal-actions"><button onClick={() => setPendingImport(null)}>Back</button><button onClick={closeImport}>Cancel</button><button className="primary" onClick={replaceWithPending}>Replace Project</button></div></>}
    </section></div>}

    {exportOpen && <div className="modal-backdrop"><section className="modal export-modal" role="dialog" aria-modal="true" aria-labelledby="export-title"><div className="modal-header"><div><small>SAFE EXPORT</small><h2 id="export-title">Export Verification</h2></div><button aria-label="Close export" onClick={() => setExportOpen(false)}>×</button></div>{busy && <div className="export-loading">Encoding and decoding again…</div>}{exportResult && <><div className={`verification ${exportResult.verified ? 'pass' : 'fail'}`}><strong>{exportResult.verified ? 'ROUND-TRIP PASS' : 'EXPORT BLOCKED'}</strong><span>{exportResult.verified ? `CODEC VALID · ${exportResult.warnings} warning(s) preserved · GAME UNVERIFIED` : exportResult.error}</span></div>{exportResult.verified && <textarea aria-label="Generated JJS code" readOnly value={exportResult.code} />}</>}<div className="modal-actions"><button onClick={() => setExportOpen(false)}>Close</button>{exportResult?.verified && <><button onClick={() => download(`${safeName(store.projectName)}.jjs.txt`, exportResult.code)}>Save Code</button><button className="primary" onClick={() => void navigator.clipboard?.writeText(exportResult.code)}>Copy Code</button></>}</div></section></div>}
    {settingsOpen && <AISettingsDialog onClose={() => setSettingsOpen(false)} onSaved={setAIConfig} />}
    {aiOpen && selectedData && <AIPanel move={selectedData} moveName={String(store.slots[store.selectedSlot]?.NAME ?? 'Selected Move')} config={aiConfig} onOpenSettings={() => { setAiOpen(false); setSettingsOpen(true) }} onApply={(next, label) => store.updateNestedData(store.selectedSlot, next, label)} onClose={() => setAiOpen(false)} />}
    {snapshotsOpen && <SnapshotsDialog slots={store.slots} data={store.data} baselineSlots={store.baselineSlots} baselineData={store.baselineData} snapshots={store.snapshots} onCreate={(label) => store.createSnapshot(label)} onRestore={(id) => store.restoreSnapshot(id)} onRemove={(id) => store.removeSnapshot(id)} onClose={() => setSnapshotsOpen(false)} />}
  </div>
}

function WelcomePanel({ aiConfigured, hasAutosave, onImport, onOpen, onRestore, onAI }: { aiConfigured: boolean; hasAutosave: boolean; onImport: () => void; onOpen: () => void; onRestore: () => void; onAI: () => void }) {
  return <section className="welcome"><div className="welcome-eyebrow">PRIVATE · LOCAL-FIRST · LOSSLESS</div><h1>JJS Moveset Studio</h1><p>Inspect, edit, validate, compare, and safely re-encode legitimate Skill Builder exports.</p><div className="welcome-actions"><button className="welcome-primary" onClick={onImport}><span>⇩</span><strong>Import JJS Code</strong><small>Decode locally and open every slot</small></button><button onClick={onOpen}><span>◇</span><strong>Open Project</strong><small>Resume a .jjsproject.json file</small></button>{hasAutosave && <button onClick={onRestore}><span>↺</span><strong>Restore Autosave</strong><small>Recover the last local workspace</small></button>}</div><div className="welcome-grid"><article><strong>Deterministic codec</strong><span>Base64 · Zstandard · UTF-8 · JSON</span></article><article><strong>Unknown-safe</strong><span>Unrecognized fields remain untouched</span></article><article><strong>AI boundary</strong><span>{aiConfigured ? 'Provider configured; runs only on demand' : 'Optional and not configured'}</span><button onClick={onAI}>Configure</button></article></div></section>
}

const expanded = (slots: Array<Record<string, unknown>>, data: JJSData[]) => slots.map((slot, index) => ({ ...slot, DATA: data[index] }))
function safeName(name: string) { return name.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '') || 'moveset' }
function download(name: string, content: string, type = 'text/plain;charset=utf-8') { const anchor = document.createElement('a'); anchor.href = URL.createObjectURL(new Blob([content], { type })); anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(anchor.href), 0) }
