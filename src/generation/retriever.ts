import animations from '../../jjs_knowledge/animations/animations.json'
import effects from '../../jjs_knowledge/effects/effects.json'
import skills from '../../jjs_knowledge/skills/built-in-skills.json'
import sounds from '../../jjs_knowledge/sounds/sounds.json'
import areaAttack from '../../jjs_knowledge/patterns/area-attack.json'
import awakening from '../../jjs_knowledge/patterns/awakening.json'
import comboExtender from '../../jjs_knowledge/patterns/combo-extender.json'
import comboFinisher from '../../jjs_knowledge/patterns/combo-finisher.json'
import counter from '../../jjs_knowledge/patterns/counter.json'
import dashAttack from '../../jjs_knowledge/patterns/dash-attack.json'
import groundSlam from '../../jjs_knowledge/patterns/ground-slam.json'
import launcher from '../../jjs_knowledge/patterns/launcher.json'
import mobility from '../../jjs_knowledge/patterns/mobility.json'
import multiHit from '../../jjs_knowledge/patterns/multi-hit.json'
import type { JJSData, JJSSlot, JsonObject } from '../codec/codec'
import { nodeDefinitions } from '../registry/nodes'
import type { Confidence } from '../registry/nodes'
import type { GeneratedReference, GenerationContext, GenerationPattern, GenerationPreferences } from './types'

const patterns = [dashAttack, launcher, groundSlam, multiHit, counter, comboExtender, comboFinisher, mobility, areaAttack, awakening] as GenerationPattern[]
const examples = [
  { name: 'Kashimo M1', source: 'public:kashimo', keywords: ['punch', 'melee', 'combo'], structure: ['ANIM', 'WAIT', 'HITBOX', 'VISUAL', 'WAIT'] },
  { name: 'Kashimo M4 launcher', source: 'public:kashimo', keywords: ['uppercut', 'launch', 'finisher'], structure: ['ANIM', 'WAIT', 'HITBOX', 'VELO', 'VISUAL', 'WAIT'] },
  { name: 'Void awakening movement', source: 'public:void', keywords: ['rise', 'slam', 'awakening', 'upward', 'downward'], structure: ['ANIM', 'VELO', 'WAIT', 'VELO', 'ANIM'] },
  { name: 'Void area impact', source: 'public:void', keywords: ['large', 'area', 'impact', 'explosion'], structure: ['HITBOX', 'ANIM', 'WAIT', 'HITBOX', 'VISUAL'] },
]

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

function referenceRows(kind: GeneratedReference['kind'], rows: unknown[], preferences: GenerationPreferences): GeneratedReference[] {
  return rows.flatMap((row) => {
    if (!isObject(row)) return []
    const confidence = String(row.confidence ?? 'UNKNOWN') as Confidence
    if (confidence === 'OBSERVED' && !preferences.allowObservedReferences) return []
    if (confidence === 'LIKELY' && !preferences.allowLikelyReferences) return []
    if (!['VERIFIED', 'OBSERVED', 'LIKELY'].includes(confidence)) return []
    const reference = row.reference ?? row.id ?? row.name
    if (typeof reference !== 'string' && typeof reference !== 'number' && !Array.isArray(reference)) return []
    return [{ kind, intent: String(row.description ?? row.intent ?? row.name ?? reference), reference, confidence, status: 'RESOLVED' as const, source: String(row.source ?? row.sources ?? 'jjs_knowledge') }]
  })
}

function nodeTypes(data: JJSData): string[] {
  if (!Array.isArray(data.Line)) return []
  return data.Line.flatMap((node) => isObject(node) && typeof node.K_NAME === 'string' ? [node.K_NAME] : [])
}

export function getGenerationContext(query: string, preferences: GenerationPreferences, project?: { slots?: JJSSlot[]; data?: JJSData[] }): GenerationContext {
  const lower = query.toLowerCase()
  const terms = new Set(lower.split(/[^a-z0-9]+/).filter((term) => term.length > 2))
  const relevantPatterns = patterns
    .map((pattern) => ({ pattern, score: pattern.keywords.reduce((score, keyword) => score + (lower.includes(keyword) ? 3 : terms.has(keyword) ? 1 : 0), 0) }))
    .filter(({ score, pattern }) => score > 0 || pattern.name === 'Combo Extender')
    .sort((a, b) => b.score - a.score)
    .slice(0, preferences.complexity === 'simple' ? 2 : 5)
    .map(({ pattern }) => pattern)
  const patternNodeNames = new Set(relevantPatterns.flatMap((pattern) => pattern.steps))
  const nodes = nodeDefinitions.filter((definition) => patternNodeNames.has(definition.type) || ['WAIT', 'HITBOX', 'VELO'].includes(definition.type))
  const references = [
    ...referenceRows('animation', animations as unknown[], preferences),
    ...referenceRows('effect', effects as unknown[], preferences),
    ...referenceRows('sound', sounds as unknown[], preferences),
    ...referenceRows('built-in-skill', skills as unknown[], preferences),
  ].filter((reference) => lower.split(/\s+/).some((term) => reference.intent.toLowerCase().includes(term)))
  const relevantExamples = examples.filter((example) => example.keywords.some((keyword) => lower.includes(keyword))).slice(0, 4).map(({ name, source, structure }) => ({ name, source, structure }))
  const slots = project?.slots ?? []
  const data = project?.data ?? []
  const currentKit = slots.map((slot, index) => ({ name: String(slot.NAME ?? `Slot ${index + 1}`), kind: String(slot.K_NAME ?? 'UNKNOWN'), nodeTypes: nodeTypes(data[index] ?? {}) }))
  return {
    query,
    nodes,
    patterns: relevantPatterns,
    references,
    examples: relevantExamples,
    currentKit,
    trace: [
      `Parsed retrieval query: ${query.slice(0, 100)}`,
      `Retrieved ${nodes.length} observed node definitions`,
      `Selected ${relevantPatterns.length} structural patterns`,
      `Retrieved ${relevantExamples.length} similar observed examples`,
      `Resolved ${references.length} confidence-eligible references`,
      `Inspected ${currentKit.length} existing project slots`,
    ],
  }
}

export function findReference(context: GenerationContext, kind: GeneratedReference['kind'], intent: string): GeneratedReference | undefined {
  const terms = intent.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 2)
  return context.references
    .filter((candidate) => candidate.kind === kind)
    .map((candidate) => ({ candidate, score: terms.reduce((score, term) => score + (candidate.intent.toLowerCase().includes(term) ? 1 : 0), 0) }))
    .sort((a, b) => b.score - a.score)
    .find(({ score }) => score > 0)?.candidate
}

export function lineObjects(data: JJSData): JsonObject[] {
  return Array.isArray(data.Line) ? data.Line.filter((node): node is JsonObject => isObject(node)) : []
}
