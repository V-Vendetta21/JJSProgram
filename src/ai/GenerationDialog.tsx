import { useState } from 'react'
import type { JJSData, JJSSlot } from '../codec/codec'
import { generateCharacter, generateMove, generateMoveVariants, MOVE_GENERATION_SYSTEM_PROMPT } from '../generation/generation'
import { DEFAULT_GENERATION_PREFERENCES, loadGenerationPreferences, saveGenerationPreferences } from '../generation/preferences'
import type { GeneratedMoveResult, GenerationPreferences } from '../generation/types'
import { analyzeMoveset } from '../moveset/validator'
import { getProviderSecret, requestToolAssistedGeneration, type AIProviderConfig } from './provider'
import { Icon } from '../ui/Icon'

interface GenerationDialogProps {
  initialPrompt?: string
  initialMode?: 'move' | 'character'
  config: AIProviderConfig
  slots: JJSSlot[]
  data: JJSData[]
  selectedSlot: number
  onInsert: (result: GeneratedMoveResult) => void
  onReplace: (result: GeneratedMoveResult) => void
  onClose: () => void
}

type Mode = 'move' | 'character'

export function GenerationDialog({ initialPrompt = '', initialMode = 'move', config, slots, data, selectedSlot, onInsert, onReplace, onClose }: GenerationDialogProps) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [prompt, setPrompt] = useState(initialPrompt)
  const [playstyle, setPlaystyle] = useState('')
  const [preferences, setPreferences] = useState<GenerationPreferences>(() => loadGenerationPreferences())
  const [results, setResults] = useState<GeneratedMoveResult[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showTrace, setShowTrace] = useState(false)
  const [useSelected, setUseSelected] = useState(Boolean(data[selectedSlot]))
  const [slotKind, setSlotKind] = useState(() => String(slots[selectedSlot]?.K_NAME ?? 'SKILL'))
  const [slotKey, setSlotKey] = useState(() => Number(slots[selectedSlot]?.KEY ?? slots.length + 1))
  const selectedMove = data[selectedSlot]
  const selectedName = String(slots[selectedSlot]?.NAME ?? 'selected move')

  const planner = config.provider === 'none' ? undefined : async (instruction: string, context: Parameters<typeof requestToolAssistedGeneration>[4]) => requestToolAssistedGeneration(config, getProviderSecret(), MOVE_GENERATION_SYSTEM_PROMPT, instruction, context)
  const run = async (override?: string) => {
    const description = override ?? prompt
    if (!description.trim()) return
    setBusy(true); setError(''); setResults([])
    try {
      saveGenerationPreferences(preferences)
      if (mode === 'character') {
        const character = await generateCharacter({ concept: description, playstyle: playstyle || 'balanced', baseMoveCount: 4, awakeningMoveCount: 4, includeSpecialAndAwakening: true, preferences, planner, model: config.model || undefined })
        setResults(character.moves)
        if (preferences.automaticallyInsert && character.moves.every(isValid)) character.moves.forEach(onInsert)
      } else {
        const contextualDescription = useSelected && selectedMove ? `${description}\nUse this selected move as structural inspiration without copying unknown references: ${JSON.stringify(selectedMove)}` : description
        const result = await generateMove({ description: contextualDescription, slot: { K_NAME: slotKind, ...(slotKind === 'SKILL' || slotKind === 'MELEE' ? { KEY: slotKey } : {}), ...(slotKind === 'AWAKENING' ? { DURATION: 60, DELAY: 0 } : {}) }, context: { slots, data, selectedMove }, preferences, planner, model: config.model || undefined })
        setResults([result])
        if (preferences.automaticallyInsert && isValid(result)) onInsert(result)
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Generation failed.') }
    finally { setBusy(false) }
  }

  const runAllVariants = async () => {
    if (!prompt.trim()) return
    setBusy(true); setError(''); setResults([])
    try {
      const variants = await generateMoveVariants({ description: prompt.trim(), slot: { K_NAME: slotKind, ...(slotKind === 'SKILL' || slotKind === 'MELEE' ? { KEY: slotKey } : {}) }, context: { slots, data, selectedMove }, preferences, planner, model: config.model || undefined })
      setResults(variants)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Variant generation failed.') }
    finally { setBusy(false) }
  }

  const updatePreference = <K extends keyof GenerationPreferences>(key: K, value: GenerationPreferences[K]) => setPreferences((current) => ({ ...current, [key]: value }))
  return <div className="modal-backdrop"><section className="modal generation-modal" role="dialog" aria-modal="true" aria-labelledby="generation-title">
    <div className="modal-header"><div><small>RESEARCH / DESIGN / COMPILE / VALIDATE</small><h2 id="generation-title"><Icon name="spark" /> True Move Generation</h2></div><button aria-label="Close generation" onClick={onClose}><Icon name="close" /></button></div>
    <div className="generation-tabs"><button className={mode === 'move' ? 'active' : ''} onClick={() => setMode('move')}>Generate Move</button><button className={mode === 'character' ? 'active' : ''} onClick={() => setMode('character')}>Generate Character</button><span>{config.provider === 'none' ? 'Deterministic local designer' : `Tool-assisted · ${config.model}`}</span></div>
    {!results.length && <div className="generation-compose">
      <label>{mode === 'move' ? 'Describe your move' : 'Character concept'}<textarea aria-label={mode === 'move' ? 'Describe your move' : 'Character concept'} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={mode === 'move' ? 'Make a fast dash punch that launches the enemy upward, then lets me continue the combo.' : 'Voidborn — black holes, mass manipulation, slow strategic attacks…'} /></label>
      {mode === 'character' && <label>Playstyle<input value={playstyle} onChange={(event) => setPlaystyle(event.target.value)} placeholder="Slow, strategic, huge attacks" /></label>}
      <div className="generation-options">
        <label>Slot type<select value={slotKind} onChange={(event) => setSlotKind(event.target.value)}><option value="SKILL">Base / Awakening move</option><option value="SPECIAL">Special</option><option value="AWAKENING">Awakening activation</option><option value="MELEE">M1 / Melee</option></select></label>
        {(slotKind === 'SKILL' || slotKind === 'MELEE') && <label>Slot number<input type="number" min="1" max="20" value={slotKey} onChange={(event) => setSlotKey(Math.max(1, Number(event.target.value) || 1))} /></label>}
        <label>Complexity<select value={preferences.complexity} onChange={(event) => updatePreference('complexity', event.target.value as GenerationPreferences['complexity'])}><option value="simple">Simple</option><option value="medium">Medium</option><option value="complex">Complex</option><option value="insane">Insane</option></select></label>
        <label>Move length<select value={preferences.moveLength} onChange={(event) => updatePreference('moveLength', event.target.value as GenerationPreferences['moveLength'])}><option value="short">Short</option><option value="medium">Medium</option><option value="long">Long</option></select></label>
        <label>Balance<select value={preferences.balance} onChange={(event) => updatePreference('balance', event.target.value as GenerationPreferences['balance'])}><option value="conservative">Conservative</option><option value="normal">Normal</option><option value="powerful">Powerful</option><option value="custom">Custom</option></select></label>
        {preferences.balance === 'custom' && <label>Damage multiplier<input type="number" min="0.1" max="3" step="0.1" value={preferences.customDamageMultiplier ?? 1} onChange={(event) => updatePreference('customDamageMultiplier', Number(event.target.value) || 1)} /></label>}
      </div>
      <div className="generation-toggles">
        <label><input type="checkbox" checked={preferences.preferExistingAnimations} onChange={(event) => updatePreference('preferExistingAnimations', event.target.checked)} /> Prefer existing animations</label>
        <label><input type="checkbox" checked={preferences.allowObservedReferences} onChange={(event) => updatePreference('allowObservedReferences', event.target.checked)} /> Allow OBSERVED references</label>
        <label><input type="checkbox" checked={preferences.allowLikelyReferences} onChange={(event) => updatePreference('allowLikelyReferences', event.target.checked)} /> Allow LIKELY references</label>
        <label><input type="checkbox" checked={preferences.automaticallyRepair} onChange={(event) => updatePreference('automaticallyRepair', event.target.checked)} /> Automatically repair</label>
        <label><input type="checkbox" checked={preferences.automaticallyInsert} onChange={(event) => updatePreference('automaticallyInsert', event.target.checked)} /> Automatically insert valid generations</label>
        <label><input type="checkbox" checked={preferences.creative} onChange={(event) => updatePreference('creative', event.target.checked)} /> Creative AI</label>
        <label><input type="checkbox" checked={preferences.strict} onChange={(event) => updatePreference('strict', event.target.checked)} /> Strict AI</label>
        {selectedMove && mode === 'move' && <label><input type="checkbox" checked={useSelected} onChange={(event) => setUseSelected(event.target.checked)} /> Generate from {selectedName}</label>}
      </div>
      {config.provider === 'none' && <div className="callout info">No provider is configured. The grounded deterministic designer still constructs real moves; configure a provider for tool-assisted creative planning.</div>}
      <button className="generation-run" disabled={busy || !prompt.trim()} onClick={() => void run()}>{busy ? 'RESEARCHING & BUILDING…' : 'GENERATE'}</button>
    </div>}
    {error && <div className="callout error">{error}</div>}
    {results.length > 0 && <div className="generation-results">{results.map((result, index) => <GenerationResult key={`${result.plan.name}-${index}`} result={result} onInsert={() => onInsert(result)} onReplace={() => onReplace(result)} canReplace={Boolean(selectedMove)} />)}
      <div className="generation-result-actions"><button onClick={() => setResults([])}>Edit prompt</button><button onClick={() => void run()}>Regenerate</button>{mode === 'move' && <button onClick={() => void runAllVariants()}>Generate 3 Variants</button>}</div>
      <button className="trace-toggle" onClick={() => setShowTrace((value) => !value)}>AI Generation Trace</button>
      {showTrace && <ol className="generation-trace">{results.flatMap((result) => result.trace).map((entry, index) => <li key={index}>{entry}</li>)}</ol>}
    </div>}
    <div className="modal-actions"><button onClick={onClose}>Close</button></div>
  </section></div>
}

function isValid(result: GeneratedMoveResult) { return !result.validation.some((message) => message.severity === 'error') }

function GenerationResult({ result, onInsert, onReplace, canReplace }: { result: GeneratedMoveResult; onInsert: () => void; onReplace: () => void; canReplace: boolean }) {
  const stats = analyzeMoveset([result.slot], [result.compiledMove])
  const estimated = result.compiledMove.Line.reduce((sum, node) => sum + (node.K_NAME === 'WAIT' && typeof node.TIME === 'number' ? node.TIME : 0), 0)
  return <article className="generation-card"><header><div><small>{result.plan.role} · {result.plan.design.commitment} commitment</small><h3>{result.plan.name}</h3></div><span className={isValid(result) ? 'generation-valid' : 'generation-invalid'}>{isValid(result) ? 'READY TO INSERT' : 'DRAFT WITH ERRORS'}</span></header>
    <div className="generation-metrics"><span><strong>{estimated.toFixed(2)}s</strong> estimated timeline</span><span><strong>{stats.nodes}</strong> nodes</span><span><strong>{stats.hitboxes}</strong> hitboxes</span><span><strong>{stats.branches}</strong> branches</span></div>
    <div className="validation-levels">{Object.entries(result.validationLevels).map(([name, status]) => <div key={name}><span>{name.replace(/([A-Z])/g, ' $1')}</span><strong className={status === 'PASS' ? 'good' : status === 'FAIL' ? 'bad' : 'warn'}>{status}</strong></div>)}</div>
    {result.unresolvedReferences.length > 0 && <div className="unresolved-list"><strong>Unresolved references</strong>{result.unresolvedReferences.map((reference, index) => <div key={`${reference.kind}-${index}`}><span><Icon name="warning" /> {reference.kind} needed</span><small>Intent: {reference.intent}</small><div><button disabled>Select {reference.kind}</button><button disabled>Ask AI to Find Similar</button></div></div>)}</div>}
    {result.warnings.map((warning) => <div className="callout warning" key={warning}>{warning}</div>)}
    <div className="generation-card-actions"><button className="primary" disabled={!isValid(result)} onClick={onInsert}>INSERT MOVE</button>{canReplace && <button disabled={!isValid(result)} onClick={onReplace}>Replace selected move</button>}</div>
  </article>
}

export { DEFAULT_GENERATION_PREFERENCES }
