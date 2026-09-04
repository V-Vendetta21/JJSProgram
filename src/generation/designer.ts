import { findReference } from './retriever'
import type { DamageIntent, GeneratedBranch, GeneratedMovePlan, GeneratedStep, GenerationContext, GenerationPreferences, MoveRole, RangeIntent, StartupIntent } from './types'

const roles: MoveRole[] = ['combo-starter', 'combo-extender', 'finisher', 'mobility', 'counter', 'area-control', 'utility', 'awakening', 'other']
const startups: StartupIntent[] = ['very-fast', 'fast', 'medium', 'slow', 'very-slow', 'cinematic']
const damages: DamageIntent[] = ['low', 'medium', 'high', 'very-high']
const ranges: RangeIntent[] = ['close', 'medium', 'long', 'area']
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const oneOf = <T extends string>(value: unknown, allowed: T[], fallback: T): T => typeof value === 'string' && allowed.includes(value as T) ? value as T : fallback
const number = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback

export function parseGeneratedMovePlan(raw: unknown): GeneratedMovePlan {
  if (!isObject(raw)) throw new Error('Generated move plan must be an object.')
  if (!Array.isArray(raw.timeline)) throw new Error('Generated move plan requires a timeline.')
  if (!raw.timeline.length) throw new Error('Generated move plan requires at least one timeline step.')
  const timeline = raw.timeline.map(parseStep)
  const rawDesign = isObject(raw.design) ? raw.design : {}
  const branches = Array.isArray(raw.branches) ? raw.branches.map((branch, index) => parseBranch(branch, index)) : []
  return {
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 80) : 'Generated Move',
    description: typeof raw.description === 'string' ? raw.description.slice(0, 2000) : '',
    role: oneOf(raw.role, roles, 'other'),
    design: {
      startup: oneOf(rawDesign.startup, startups, 'medium'),
      damage: oneOf(rawDesign.damage, damages, 'medium'),
      range: oneOf(rawDesign.range, ranges, 'close'),
      commitment: oneOf(rawDesign.commitment, ['low', 'medium', 'high'], 'medium'),
    },
    timeline,
    branches,
    requirements: Array.isArray(raw.requirements) ? raw.requirements.flatMap((entry) => isObject(entry) && typeof entry.intent === 'string' ? [{ intent: entry.intent, reference: typeof entry.reference === 'string' ? entry.reference : null, status: entry.reference ? 'RESOLVED' as const : 'MISSING_REFERENCE' as const }] : []) : [],
    references: [],
    cooldownIntent: typeof raw.cooldownIntent === 'number' && Number.isFinite(raw.cooldownIntent) ? Math.max(0, raw.cooldownIntent) : undefined,
  }
}

function parseBranch(raw: unknown, index: number): GeneratedBranch {
  if (!isObject(raw) || !Array.isArray(raw.timeline)) throw new Error(`Generated branch ${index + 1} is malformed.`)
  return { name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : `Followup ${index + 1}`, trigger: 'hit-success', timeline: raw.timeline.map(parseStep) }
}

function parseStep(raw: unknown): GeneratedStep {
  if (!isObject(raw) || typeof raw.type !== 'string') throw new Error('Unsupported generated step: missing type.')
  switch (raw.type) {
    case 'animation': return { type: 'animation', intent: String(raw.intent ?? 'move animation'), reference: Array.isArray(raw.reference) && raw.reference.every((value) => Number.isFinite(value)) ? raw.reference as number[] : null, speed: number(raw.speed, 1), status: Array.isArray(raw.reference) ? 'RESOLVED' : 'MISSING_REFERENCE' }
    case 'wait': return { type: 'wait', duration: Math.max(0, number(raw.duration, 0.2)), intent: typeof raw.intent === 'string' ? raw.intent : undefined }
    case 'movement': return { type: 'movement', intent: oneOf(raw.intent, ['dash-forward', 'dash-backward', 'rise-upward', 'slam-downward', 'lunge', 'recoil'], 'lunge'), strength: oneOf(raw.strength, ['small', 'medium', 'large'], 'medium') as 'small' | 'medium' | 'large', duration: Math.max(0.05, number(raw.duration, 0.25)), target: raw.target === 'last-hit' ? 'last-hit' : 'user' }
    case 'hitbox': return { type: 'hitbox', intent: String(raw.intent ?? 'attack'), size: oneOf(raw.size, ['tiny', 'small', 'medium', 'large', 'huge'], 'medium'), placement: oneOf(raw.placement, ['close', 'forward', 'above', 'below', 'area'], 'forward'), damage: oneOf(raw.damage, damages, 'medium'), stun: Math.max(0, number(raw.stun, 0)), blockable: raw.blockable !== false, launch: oneOf(raw.launch, ['up', 'away', 'down', 'none'], 'none') === 'none' ? undefined : raw.launch as 'up' | 'away' | 'down', branchOnHit: typeof raw.branchOnHit === 'string' ? raw.branchOnHit : undefined }
    case 'effect': return { type: 'effect', intent: String(raw.intent ?? 'visual effect'), reference: typeof raw.reference === 'string' ? raw.reference : null, status: typeof raw.reference === 'string' ? 'RESOLVED' : 'MISSING_REFERENCE' }
    case 'sound': return { type: 'sound', intent: String(raw.intent ?? 'impact sound'), reference: typeof raw.reference === 'number' ? raw.reference : null, status: typeof raw.reference === 'number' ? 'RESOLVED' : 'MISSING_REFERENCE' }
    case 'built-in-skill': return { type: 'built-in-skill', intent: String(raw.intent ?? 'built-in skill'), reference: typeof raw.reference === 'string' ? raw.reference : null, status: typeof raw.reference === 'string' ? 'RESOLVED' : 'MISSING_REFERENCE' }
    case 'state': return { type: 'state', intent: String(raw.intent ?? 'state'), reference: typeof raw.reference === 'string' ? raw.reference : null, status: typeof raw.reference === 'string' ? 'RESOLVED' : 'MISSING_REFERENCE' }
    default: throw new Error(`Unsupported generated step: ${raw.type}`)
  }
}

function nameFrom(prompt: string): string {
  const match = prompt.match(/(?:called|named)\s+["']?([^\n."']{2,80})/i)
  if (match) return match[1].trim()
  if (/uppercut/i.test(prompt)) return 'Generated Uppercut'
  if (/dash.+punch|punch.+dash/i.test(prompt)) return 'Generated Dash Punch'
  if (/three[- ]hit|3[- ]hit/i.test(prompt)) return 'Generated Three-Hit Combo'
  if (/follow-?up/i.test(prompt)) return 'Generated Follow-Up'
  if (/punch/i.test(prompt)) return 'Generated Punch'
  return 'Generated Move'
}

function intent(prompt: string): { role: MoveRole; startup: StartupIntent; damage: DamageIntent; range: RangeIntent; commitment: 'low' | 'medium' | 'high' } {
  const lower = prompt.toLowerCase()
  const requiredRole = lower.match(/required kit role:\s*(combo-starter|combo-extender|finisher|mobility|counter|area-control|utility|awakening|other)/)?.[1] as MoveRole | undefined
  const role: MoveRole = requiredRole ?? (/awakening/.test(lower) ? 'awakening' : /counter/.test(lower) ? 'counter' : /finisher|powerful|slam|ultimate/.test(lower) ? 'finisher' : /area|explod|huge/.test(lower) ? 'area-control' : /dash|mobility|teleport/.test(lower) ? 'mobility' : /uppercut|launch|combo|follow-up/.test(lower) ? 'combo-extender' : 'combo-starter')
  return {
    role,
    startup: /cinematic|two seconds|2 seconds/.test(lower) ? 'cinematic' : /slow|telegraph|charge/.test(lower) ? 'slow' : /fast|quick/.test(lower) ? 'fast' : 'medium',
    damage: /extremely|very powerful|ultimate/.test(lower) ? 'very-high' : /powerful|finisher|heavy|huge/.test(lower) ? 'high' : /weak|low damage/.test(lower) ? 'low' : 'medium',
    range: /area|huge|large impact|explod/.test(lower) ? 'area' : /projectile|long range/.test(lower) ? 'long' : /dash|forward/.test(lower) ? 'medium' : 'close',
    commitment: /finisher|slow|charge|telegraph|cinematic/.test(lower) ? 'high' : /fast|quick|combo/.test(lower) ? 'low' : 'medium',
  }
}

function unresolved(type: 'animation' | 'effect' | 'sound' | 'state', intentText: string, context: GenerationContext): GeneratedStep {
  const found = findReference(context, type, intentText)
  if (type === 'animation') return { type, intent: intentText, reference: Array.isArray(found?.reference) ? found.reference as number[] : null, status: found ? 'RESOLVED' : 'MISSING_REFERENCE' }
  if (type === 'sound') return { type, intent: intentText, reference: typeof found?.reference === 'number' ? found.reference : null, status: found ? 'RESOLVED' : 'MISSING_REFERENCE' }
  const shared = { intent: intentText, reference: typeof found?.reference === 'string' ? found.reference : null, status: found ? 'RESOLVED' as const : 'MISSING_REFERENCE' as const }
  if (type === 'effect') return { type, ...shared }
  return { type: 'state', ...shared }
}

export function designMoveLocally(prompt: string, context: GenerationContext, preferences: GenerationPreferences): GeneratedMovePlan {
  const lower = prompt.toLowerCase()
  const design = intent(prompt)
  const branchWanted = preferences.complexity !== 'simple' && /if (?:this|the|it|possible).*hit|hit[- ]success|when .*connect|follow-?up/.test(lower)
  const multi = /three[- ]hit|3[- ]hit|hit three times/.test(lower) ? 3 : /hit.*twice|two hits/.test(lower) ? 2 : 1
  const timeline: GeneratedStep[] = []
  const branches: GeneratedBranch[] = []
  const requirements: GeneratedMovePlan['requirements'] = []
  timeline.push(unresolved('animation', /uppercut/.test(lower) ? 'uppercut animation' : /slam/.test(lower) ? 'heavy downward slam animation' : /dash/.test(lower) ? 'forward punch animation' : 'punch attack animation', context))
  if (/launches? upward|rise upward|jump after|player launches upward/.test(lower)) timeline.push({ type: 'movement', intent: 'rise-upward', strength: 'medium', duration: 0.35, target: 'user' })
  timeline.push({ type: 'wait', duration: design.startup === 'cinematic' ? 2 : design.startup === 'slow' ? 0.75 : design.startup === 'fast' ? 0.12 : 0.3, intent: 'startup' })
  if (/dash|lunge|strike.*forward|projectile forward/.test(lower)) timeline.push({ type: 'movement', intent: /dash|lunge/.test(lower) ? 'dash-forward' : 'lunge', strength: design.damage === 'high' ? 'large' : 'medium', duration: 0.25, target: 'user' })
  if (/slam|dive|downward/.test(lower)) timeline.push({ type: 'movement', intent: 'slam-downward', strength: 'large', duration: 0.35, target: 'user' })
  const branchName = branchWanted ? 'Impact Followup' : undefined
  for (let index = 0; index < multi; index += 1) {
    timeline.push({ type: 'hitbox', intent: index === multi - 1 ? 'finishing strike' : `combo hit ${index + 1}`, size: design.range === 'area' ? 'large' : 'medium', placement: design.range === 'area' ? 'area' : /uppercut/.test(lower) ? 'above' : 'forward', damage: index === multi - 1 ? design.damage : 'low', stun: design.role === 'combo-extender' ? 0.6 : 0.25, blockable: true, launch: index === multi - 1 && /uppercut|launch.*up/.test(lower) ? 'up' : index === multi - 1 && /launch|finisher|slam/.test(lower) ? 'away' : undefined, branchOnHit: index === multi - 1 ? branchName : undefined })
    timeline.push({ type: 'wait', duration: index === multi - 1 ? (design.commitment === 'high' ? 0.8 : 0.25) : 0.14, intent: index === multi - 1 ? 'recovery' : 'hit cadence' })
  }
  if (/visual|effect|black[- ]hole|fire|galaxy|projectile/.test(lower)) timeline.splice(Math.max(1, timeline.length - 2), 0, unresolved('effect', /black[- ]hole/.test(lower) ? 'small black-hole projectile visual' : /fire/.test(lower) ? 'fire impact visual' : 'galaxy-zebra visual', context))
  if (/sound|roar|music|voice|audio/.test(lower)) timeline.splice(Math.max(1, timeline.length - 1), 0, unresolved('sound', 'requested move sound', context))
  if (/\b(state|mark|stack|resource|charge counter)\b/.test(lower)) timeline.splice(Math.max(1, timeline.length - 1), 0, unresolved('state', 'requested persistent combat state', context))
  if (/\bcounter\b/.test(lower)) requirements.push({ intent: 'incoming-enemy-attack', reference: null, status: 'MISSING_REFERENCE' })
  if (/\bif\b/.test(lower) && /airborne|grounded/.test(lower)) requirements.push({ intent: /airborne/.test(lower) ? 'airborne-condition' : 'grounded-condition', reference: null, status: 'MISSING_REFERENCE' })
  if (branchName) branches.push({ name: branchName, trigger: 'hit-success', timeline: [
    { type: 'wait', duration: 0.12, intent: 'branch impact delay' },
    { type: 'hitbox', intent: 'stronger impact follow-up', size: design.range === 'area' ? 'large' : 'medium', placement: design.range === 'area' ? 'area' : 'forward', damage: design.damage, stun: 0.8, blockable: true, launch: /slam/.test(lower) ? 'down' : 'away' },
    { type: 'wait', duration: 0.45, intent: 'follow-up recovery' },
  ] })
  const references = [...timeline, ...branches.flatMap((branch) => branch.timeline)].flatMap((step) => step.type === 'animation' || step.type === 'effect' || step.type === 'sound' || step.type === 'state' ? [{ kind: step.type, intent: step.intent, reference: step.reference, status: step.status ?? (step.reference ? 'RESOLVED' : 'MISSING_REFERENCE') }] : [])
  return { name: nameFrom(prompt), description: prompt, role: design.role, design, timeline, branches, requirements, references, cooldownIntent: design.commitment === 'high' ? 15 : design.commitment === 'low' ? 7 : 10 }
}
