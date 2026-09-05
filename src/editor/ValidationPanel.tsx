import type { MovesetStats, ValidationMessage } from '../moveset/validator'
import { Icon } from '../ui/Icon'

interface ValidationPanelProps {
  messages: ValidationMessage[]
  stats: MovesetStats
}

export function ValidationPanel({ messages, stats }: ValidationPanelProps) {
  const errors = messages.filter((message) => message.severity === 'error').length
  const warnings = messages.filter((message) => message.severity === 'warning').length
  return <section className="console-panel">
    <div className="console-tabs"><button className="active">VALIDATION <span>{messages.length}</span></button><button>STATS</button><div className="console-summary"><span className={errors ? 'bad' : 'good'}>{errors} errors</span><span className={warnings ? 'warn' : 'good'}>{warnings} warnings</span></div></div>
    <div className="console-body">
      <div className="stats-row"><span>Nodes <strong>{stats.nodes}</strong></span><span>Hitboxes <strong>{stats.hitboxes}</strong></span><span>Defined damage <strong>{stats.definedDamage}</strong></span><span>Wait time <strong>{stats.waitTime.toFixed(2)}s</strong></span><span>Branches <strong>{stats.branches}</strong></span></div>
      {messages.length === 0 ? <div className="validation-ok"><Icon name="check" /> No structural issues detected by the current permissive registry.</div> : messages.slice(0, 50).map((message, index) => <div className={`message ${message.severity}`} key={`${message.path}-${index}`}><span>{message.severity.toUpperCase()}</span><code>slot[{message.slotIndex}].{message.path}</code><p>{message.message}</p></div>)}
    </div>
  </section>
}
