import type { JJSData, JsonObject } from '../codec/codec'

interface TimelineProps {
  data?: JJSData
  selectedNode: number
  onSelectNode: (index: number) => void
}

const durationFor = (node: JsonObject) => {
  if (node.K_NAME === 'WAIT' && typeof node.TIME === 'number') return node.TIME
  if (node.K_NAME === 'ANIM' && Array.isArray(node.PREVIEW) && node.PREVIEW.every((value) => typeof value === 'number')) return Math.max(0, Number(node.PREVIEW[1]) - Number(node.PREVIEW[0]))
  if (typeof node.TIME === 'number') return node.TIME
  return 0
}

export function Timeline({ data, selectedNode, onSelectNode }: TimelineProps) {
  const nodes = Array.isArray(data?.Line) ? data.Line.filter((node): node is JsonObject => Boolean(node) && typeof node === 'object' && !Array.isArray(node)) : []
  const entries = nodes.reduce<Array<{ node: JsonObject; index: number; start: number }>>((result, node, index) => {
    const previous = result.at(-1)
    const previousEnd = previous ? previous.start + (previous.node.K_NAME === 'WAIT' ? durationFor(previous.node) : 0) : 0
    result.push({ node, index, start: previousEnd })
    return result
  }, [])
  return <section className="timeline-view">
    <div className="timeline-ruler"><span>0.0s</span><span>1.0s</span><span>2.0s</span><span>3.0s+</span></div>
    <div className="timeline-list">
      {nodes.length === 0 && <div className="workspace-empty">No timeline nodes in this slot.</div>}
      {entries.map(({ node, index, start }) => {
        const kind = typeof node.K_NAME === 'string' ? node.K_NAME : 'UNKNOWN'
        return <button className={`timeline-node node-${kind.toLowerCase()} ${selectedNode === index ? 'selected' : ''}`} key={index} onClick={() => onSelectNode(index)}>
          <span className="node-index">{String(index + 1).padStart(2, '0')}</span>
          <span className="node-kind">{kind}</span>
          <span className="node-summary">{summary(node)}</span>
          <span className="node-time">{start.toFixed(2)}s</span>
        </button>
      })}
    </div>
  </section>
}

function summary(node: JsonObject): string {
  if (node.K_NAME === 'WAIT') return `${String(node.TIME ?? '?')} seconds`
  if (node.K_NAME === 'HITBOX') return `${String(node.DAMAGE ?? '?')} damage · ${String(node.SIZE ?? 'size unknown')}`
  if (node.K_NAME === 'ANIM') return `Animation ${JSON.stringify(node.ANIM_USE ?? 'UNKNOWN')}`
  if (node.K_NAME === 'VISUAL') return String(node.EFFECT ?? 'UNKNOWN effect')
  if (node.K_NAME === 'SFX') return `Sound ${String(node.ID ?? 'UNKNOWN')}`
  if (node.K_NAME === 'SKILL') return String(node.MOVE ?? 'UNKNOWN skill')
  if (node.K_NAME === 'SPECIAL') return String(node.SPEC ?? 'UNKNOWN special')
  return Object.keys(node).filter((key) => key !== 'K_NAME').slice(0, 3).join(' · ') || 'No fields'
}
