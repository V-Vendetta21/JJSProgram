import type { JJSSlot } from '../codec/codec'
import { Icon } from '../ui/Icon'

interface ExplorerProps {
  slots: JJSSlot[]
  selected: number
  onSelect: (index: number) => void
}

const kindLabel: Record<string, string> = {
  SKILL: 'Skills',
  MELEE: 'Melee / M1',
  SPECIAL: 'Specials',
  CHASE: 'Chase / Dash',
  AWAKENING: 'Awakening',
}

export function Explorer({ slots, selected, onSelect }: ExplorerProps) {
  const groups = slots.reduce<Record<string, Array<{ slot: JJSSlot; index: number }>>>((result, slot, index) => {
    const kind = typeof slot.K_NAME === 'string' ? slot.K_NAME : 'UNKNOWN'
    ;(result[kind] ??= []).push({ slot, index })
    return result
  }, {})

  return <aside className="panel explorer" aria-label="Moveset explorer">
    <div className="panel-heading"><span>MOVESET EXPLORER</span><span className="count">{slots.length} slots</span></div>
    <div className="explorer-tree">
      {slots.length === 0 && <div className="empty-note">Import a JJS code or open a project.</div>}
      {Object.entries(groups).map(([kind, entries]) => <section className="tree-group" key={kind}>
        <div className="tree-label"><Icon name="chevronDown" className="chevron" />{kindLabel[kind] ?? kind}<span className="tree-count">{entries.length}</span></div>
        {entries.map(({ slot, index }) => <button className={`tree-item ${selected === index ? 'selected' : ''}`} key={index} onClick={() => onSelect(index)}>
          <span className={`kind-dot kind-${kind.toLowerCase()}`} />
          <span>{typeof slot.NAME === 'string' && slot.NAME ? slot.NAME : `${kind} ${index + 1}`}</span>
          {typeof slot.KEY === 'number' && <kbd>{slot.KEY}</kbd>}
        </button>)}
      </section>)}
    </div>
  </aside>
}
