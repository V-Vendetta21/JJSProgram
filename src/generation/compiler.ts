import type { JJSData, JsonObject } from '../codec/codec'
import type { DamageIntent, GeneratedMovePlan, GeneratedReference, GeneratedStep, GenerationPreferences } from './types'

const timingPresets = {
  'very-fast': { startup: [0.05, 0.12], recovery: [0.12, 0.25] },
  fast: { startup: [0.1, 0.22], recovery: [0.2, 0.35] },
  medium: { startup: [0.25, 0.5], recovery: [0.35, 0.6] },
  slow: { startup: [0.6, 1], recovery: [0.65, 1] },
  'very-slow': { startup: [1, 1.8], recovery: [0.9, 1.4] },
  cinematic: { startup: [1.8, 2.5], recovery: [1.1, 1.8] },
} as const

const damageRanges: Record<DamageIntent, [number, number]> = { low: [3, 6], medium: [7, 12], high: [13, 20], 'very-high': [21, 30] }
const hitboxShapes = {
  tiny: '2, 2, 2', small: '3, 3, 4', medium: '5, 5, 6', large: '10, 8, 12', huge: '18, 14, 18',
} as const
const hitboxPositions = { close: '0, 0, 2', forward: '0, 0, 4', above: '0, 3, 2', below: '0, -3, 2', area: '0, 0, 0' } as const
const movementVectors = {
  'dash-forward': { small: '0, 0, 18', medium: '0, 0, 35', large: '0, 0, 55' },
  'dash-backward': { small: '0, 0, -12', medium: '0, 0, -25', large: '0, 0, -40' },
  'rise-upward': { small: '0, 8, 0', medium: '0, 12, 0', large: '0, 20, 0' },
  'slam-downward': { small: '0, -12, 0', medium: '0, -24, 0', large: '0, -40, 0' },
  lunge: { small: '0, 0, 12', medium: '0, 0, 24', large: '0, 0, 38' },
  recoil: { small: '0, 2, -8', medium: '0, 4, -15', large: '0, 6, -24' },
} as const

export interface CompilationResult {
  move: JJSData & { Line: JsonObject[]; Req: unknown[]; Prop: unknown[]; Branch?: Record<string, { Line: JsonObject[]; Req: unknown[] }> }
  unresolved: GeneratedReference[]
  warnings: string[]
  trace: string[]
}

function damageFor(intent: DamageIntent, preferences: GenerationPreferences): number {
  const [minimum, maximum] = damageRanges[intent]
  const base = (minimum + maximum) / 2
  const multiplier = preferences.balance === 'conservative' ? 0.75 : preferences.balance === 'powerful' ? 1.35 : preferences.balance === 'custom' ? Math.max(0.1, Math.min(3, preferences.customDamageMultiplier ?? 1)) : 1
  return Math.round(base * multiplier * 10) / 10
}

function compileStep(step: GeneratedStep, preferences: GenerationPreferences, unresolved: GeneratedReference[]): JsonObject[] {
  switch (step.type) {
    case 'wait': return [{ K_NAME: 'WAIT', TIME: Math.round(Math.max(0, step.duration) * 1000) / 1000 }]
    case 'movement': return [{ K_NAME: 'VELO', FORCE: movementVectors[step.intent][step.strength ?? 'medium'], TIME: step.duration ?? 0.25, ...(step.target === 'last-hit' ? { 'LAST HIT': 1 } : {}) }]
    case 'hitbox': {
      const hitbox: JsonObject = { K_NAME: 'HITBOX', PREVIEW: [0, 15], DAMAGE: damageFor(step.damage, preferences), SIZE: hitboxShapes[step.size], POSITION: hitboxPositions[step.placement], BLOCKABLE: step.blockable !== false }
      if (step.stun) hitbox.STUN = step.stun
      if (step.branchOnHit) hitbox.BRANCH = step.branchOnHit
      const nodes = [hitbox]
      if (step.launch) nodes.push({ K_NAME: 'VELO', FORCE: step.launch === 'up' ? '0, 12, 0' : step.launch === 'down' ? '0, -25, 0' : '0, 5, 24', TIME: 0.35, RAGDOLL: 2, 'LAST HIT': 1 })
      return nodes
    }
    case 'animation':
      if (step.reference) return [{ K_NAME: 'ANIM', ANIM_USE: step.reference, SPEED: step.speed ?? 1 }]
      unresolved.push({ kind: 'animation', intent: step.intent, reference: null, status: 'MISSING_REFERENCE' }); return []
    case 'effect':
      if (step.reference) return [{ K_NAME: 'VISUAL', EFFECT: step.reference }]
      unresolved.push({ kind: 'effect', intent: step.intent, reference: null, status: 'MISSING_REFERENCE' }); return []
    case 'sound':
      if (step.reference !== null) return [{ K_NAME: 'SFX', ID: step.reference, VOLUME: 1 }]
      unresolved.push({ kind: 'sound', intent: step.intent, reference: null, status: 'MISSING_REFERENCE' }); return []
    case 'built-in-skill':
      if (step.reference) return [{ K_NAME: 'SKILL', MOVE: step.reference }]
      unresolved.push({ kind: 'built-in-skill', intent: step.intent, reference: null, status: 'MISSING_REFERENCE' }); return []
    case 'state': unresolved.push({ kind: 'state', intent: step.intent, reference: null, status: 'MISSING_REFERENCE' }); return []
  }
}

function uniqueBranchName(name: string, used: Set<string>): string {
  const base = name.trim() || 'Generated Followup'
  let candidate = base
  let suffix = 2
  while (used.has(candidate)) { candidate = `${base} ${suffix}`; suffix += 1 }
  used.add(candidate)
  return candidate
}

export function compileGeneratedMove(plan: GeneratedMovePlan, preferences: GenerationPreferences): CompilationResult {
  const unresolved: GeneratedReference[] = []
  const warnings: string[] = []
  const trace: string[] = []
  const used = new Set<string>()
  const firstRename = new Map<string, string>()
  const normalizedBranches = plan.branches.map((branch) => {
    const name = uniqueBranchName(branch.name, used)
    if (!firstRename.has(branch.name)) firstRename.set(branch.name, name)
    return { ...branch, name }
  })
  const normalizedTimeline = plan.timeline.map((step) => step.type === 'hitbox' && step.branchOnHit ? { ...step, branchOnHit: firstRename.get(step.branchOnHit) ?? step.branchOnHit } : step)
  const line = normalizedTimeline.flatMap((step) => compileStep(step, preferences, unresolved))
  const Branch = Object.fromEntries(normalizedBranches.map((branch) => [branch.name, { Line: branch.timeline.flatMap((step) => compileStep(step, preferences, unresolved)), Req: [] }]))
  for (const requirement of plan.requirements) if (!requirement.reference) unresolved.push({ kind: 'condition', intent: requirement.intent, reference: null, status: 'MISSING_REFERENCE' })
  if (!line.length) line.push({ K_NAME: 'WAIT', TIME: timingPresets[plan.design.startup].startup[0] })
  if (unresolved.length) warnings.push(`${unresolved.length} reference(s) remain unresolved and were not emitted as invented JJS fields.`)
  trace.push(`Compiled ${plan.timeline.length} planned steps to ${line.length} JJS nodes`)
  trace.push(`Compiled ${Object.keys(Branch).length} uniquely named branches`)
  trace.push(`Kept ${unresolved.length} unresolved references in project-only metadata`)
  return { move: { Line: line, Req: [], Prop: [], ...(Object.keys(Branch).length ? { Branch } : {}) }, unresolved, warnings, trace }
}

export { damageRanges, hitboxPositions, hitboxShapes, movementVectors, timingPresets }
