import type { JJSData, JJSSlot, JsonObject } from '../codec/codec'
import { validateMoveset, type ValidationMessage } from '../moveset/validator'
import { nodeDefinitionMap } from '../registry/nodes'
import { compileGeneratedMove } from './compiler'
import { designMoveLocally, parseGeneratedMovePlan } from './designer'
import { DEFAULT_GENERATION_PREFERENCES } from './preferences'
import { getGenerationContext } from './retriever'
import type { GenerateCharacterRequest, GeneratedMovePlan, GeneratedMoveResult, GenerateMoveRequest, GenerationContext, GenerationPreferences, ValidationLevels } from './types'

export const MOVE_GENERATION_SYSTEM_PROMPT = `You are the move-construction agent inside JJS Moveset Studio. Convert the user's gameplay concept into a complete GeneratedMovePlan JSON object, not advice and never Base64. Actively use only the scoped node, pattern, example, project, and reference context supplied to you. You may independently design move sequences, timing intent, damage intent, conceptual hitboxes, movement, branches, gameplay flow, and identity. Never invent JJS node types, fields, animation/effect/sound/skill/state identifiers, conditions, or unsupported mechanics. Prefer VERIFIED, then OBSERVED, then allowed LIKELY references. Use null plus status MISSING_REFERENCE when a reference cannot be resolved and continue the rest of the move. Allowed timeline step types: animation, wait, movement, hitbox, effect, sound, built-in-skill, state. Before finalizing verify node support, branch resolution, references, and requested behavior. Return a single GeneratedMovePlan JSON object.`

function mergePreferences(input?: Partial<GenerationPreferences>): GenerationPreferences {
  return { ...DEFAULT_GENERATION_PREFERENCES, ...input }
}

function isObject(value: unknown): value is JsonObject { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) }

function groundPlanReferences(plan: GeneratedMovePlan, context: GenerationContext): GeneratedMovePlan {
  const allowed = (kind: string, reference: unknown) => context.references.some((candidate) => candidate.kind === kind && JSON.stringify(candidate.reference) === JSON.stringify(reference))
  const groundStep = (step: GeneratedMovePlan['timeline'][number]): GeneratedMovePlan['timeline'][number] => {
    if (step.type === 'animation' && step.reference && !allowed('animation', step.reference)) return { ...step, reference: null, status: 'MISSING_REFERENCE' as const }
    if (step.type === 'effect' && step.reference && !allowed('effect', step.reference)) return { ...step, reference: null, status: 'MISSING_REFERENCE' as const }
    if (step.type === 'sound' && step.reference !== null && !allowed('sound', step.reference)) return { ...step, reference: null, status: 'MISSING_REFERENCE' as const }
    if (step.type === 'built-in-skill' && step.reference && !allowed('built-in-skill', step.reference)) return { ...step, reference: null, status: 'MISSING_REFERENCE' as const }
    if (step.type === 'state' && step.reference && !allowed('state', step.reference)) return { ...step, reference: null, status: 'MISSING_REFERENCE' as const }
    return step
  }
  return { ...plan, timeline: plan.timeline.map(groundStep), branches: plan.branches.map((branch) => ({ ...branch, timeline: branch.timeline.map(groundStep) })) }
}

function generatedSchemaMessages(move: JJSData): ValidationMessage[] {
  const messages: ValidationMessage[] = []
  const visit = (nodes: unknown, path: string) => {
    if (!Array.isArray(nodes)) return
    nodes.forEach((candidate, index) => {
      if (!isObject(candidate) || typeof candidate.K_NAME !== 'string') {
        messages.push({ severity: 'error', code: 'GEN_INVALID_NODE', message: `Node ${index + 1}: expected an object with K_NAME.`, slotIndex: 0, path: `${path}[${index}]` }); return
      }
      const definition = nodeDefinitionMap.get(candidate.K_NAME)
      if (!definition) messages.push({ severity: 'error', code: 'GEN_UNKNOWN_NODE', message: `Node ${index + 1}: ${candidate.K_NAME} is not in the provided registry.`, slotIndex: 0, path: `${path}[${index}].K_NAME` })
      else Object.keys(candidate).forEach((field) => { if (!definition.fields.includes(field)) messages.push({ severity: 'error', code: 'GEN_UNKNOWN_FIELD', message: `Node ${index + 1} (${candidate.K_NAME}): ${field} is not an observed field.`, slotIndex: 0, path: `${path}[${index}].${field}` }) })
      if (candidate.K_NAME === 'WAIT' && (typeof candidate.TIME !== 'number' || !Number.isFinite(candidate.TIME))) messages.push({ severity: 'error', code: 'GEN_INVALID_WAIT', message: `Node ${index + 1} (WAIT): TIME expected a finite number.`, slotIndex: 0, path: `${path}[${index}].TIME` })
      if (candidate.K_NAME === 'VELO' && typeof candidate.FORCE !== 'string') messages.push({ severity: 'error', code: 'GEN_INVALID_VECTOR', message: `Node ${index + 1} (VELO): FORCE expected vector-string "x, y, z".`, slotIndex: 0, path: `${path}[${index}].FORCE` })
      if (candidate.K_NAME === 'HITBOX' && typeof candidate.SIZE !== 'string') messages.push({ severity: 'error', code: 'GEN_INVALID_VECTOR', message: `Node ${index + 1} (HITBOX): SIZE expected vector-string "x, y, z".`, slotIndex: 0, path: `${path}[${index}].SIZE` })
    })
  }
  visit(move.Line, 'DATA.Line')
  if (isObject(move.Branch)) Object.entries(move.Branch).forEach(([name, branch]) => { if (isObject(branch)) visit(branch.Line, `DATA.Branch.${name}.Line`) })
  return messages
}

function validateGenerated(move: GeneratedMoveResult['compiledMove'], slot: JJSSlot): ValidationMessage[] {
  return [...generatedSchemaMessages(move), ...validateMoveset([slot], [move])]
}

function safeRepair(move: GeneratedMoveResult['compiledMove']): { move: GeneratedMoveResult['compiledMove']; repairs: string[] } {
  const next = structuredClone(move)
  const repairs: string[] = []
  const branches = isObject(next.Branch) ? next.Branch as Record<string, { Line: JsonObject[]; Req: unknown[] }> : {}
  const repairLine = (nodes: JsonObject[]) => nodes.forEach((node, index) => {
    if (node.K_NAME === 'WAIT' && typeof node.TIME !== 'number') { node.TIME = 0.2; repairs.push(`Node ${index + 1}: repaired WAIT.TIME to 0.2`) }
    if (node.K_NAME === 'VELO' && typeof node.FORCE !== 'string') { node.FORCE = '0, 0, 0'; repairs.push(`Node ${index + 1}: repaired VELO.FORCE vector string`) }
    if (node.K_NAME === 'HITBOX' && typeof node.SIZE !== 'string') { node.SIZE = '5, 5, 6'; repairs.push(`Node ${index + 1}: repaired HITBOX.SIZE vector string`) }

  })
  repairLine(next.Line)
  Object.values(branches).forEach((branch) => repairLine(branch.Line))
  if (Object.keys(branches).length) next.Branch = branches
  return { move: next, repairs }
}

function levels(messages: ValidationMessage[], unresolvedCount: number): ValidationLevels {
  const errors = messages.filter((message) => message.severity === 'error')
  return {
    structure: errors.some((message) => ['INVALID_LINE', 'GEN_INVALID_NODE'].includes(message.code)) ? 'FAIL' : 'PASS',
    references: unresolvedCount ? 'WARN' : errors.some((message) => message.code.includes('REFERENCE')) ? 'FAIL' : 'PASS',
    branches: errors.some((message) => message.code === 'BROKEN_BRANCH') ? 'FAIL' : 'PASS',
    schema: errors.some((message) => message.code.startsWith('GEN_')) ? 'FAIL' : 'PASS',
    codec: 'NOT_TESTED',
    inGame: 'UNVERIFIED',
  }
}

function applyGenerationPreferences(plan: GeneratedMovePlan, preferences: GenerationPreferences): GeneratedMovePlan {
  const maxSteps = preferences.complexity === 'simple' ? 6 : preferences.complexity === 'medium' ? 12 : preferences.complexity === 'complex' ? 25 : Number.POSITIVE_INFINITY
  const durationScale = preferences.moveLength === 'short' ? 0.75 : preferences.moveLength === 'long' ? 1.35 : 1
  const scale = (step: GeneratedMovePlan['timeline'][number]) => 'duration' in step && typeof step.duration === 'number' ? { ...step, duration: Math.round(step.duration * durationScale * 1000) / 1000 } : step
  const branches = plan.branches.slice(0, preferences.complexity === 'simple' ? 1 : undefined).map((branch) => ({ ...branch, timeline: branch.timeline.slice(0, maxSteps).map(scale) }))
  const branchNames = new Set(branches.map((branch) => branch.name))
  const timeline = plan.timeline.slice(0, maxSteps).map(scale).map((step) => step.type === 'hitbox' && step.branchOnHit && !branchNames.has(step.branchOnHit) ? { ...step, branchOnHit: undefined } : step)
  return { ...plan, timeline, branches }
}

export async function generateMove(request: GenerateMoveRequest): Promise<GeneratedMoveResult> {
  if (!request.description.trim()) throw new Error('Describe the move to generate.')
  const preferences = mergePreferences(request.preferences)
  const context = getGenerationContext(request.description, preferences, request.context)
  const trace = ['Parsed gameplay intent from natural language', ...context.trace]
  let plan: GeneratedMovePlan
  if (request.planner) {
    let lastError: unknown
    let parsed: GeneratedMovePlan | undefined
    for (let attempt = 0; attempt < 4 && !parsed; attempt += 1) {
      try {
        const repair = attempt ? `\n\nRepair attempt ${attempt}/3. The prior plan failed with specific feedback: ${lastError instanceof Error ? lastError.message : String(lastError)}. Return a corrected complete GeneratedMovePlan.` : ''
        const raw = await request.planner(`${MOVE_GENERATION_SYSTEM_PROMPT}\n\nGeneration preferences:\n${JSON.stringify(preferences)}\n\nUser request:\n${request.description}${repair}`, context)
        parsed = groundPlanReferences(parseGeneratedMovePlan(raw), context)
      } catch (cause) { lastError = cause; trace.push(`AI plan validation failed on attempt ${attempt + 1}: ${cause instanceof Error ? cause.message : String(cause)}`) }
    }
    if (!parsed) throw lastError instanceof Error ? lastError : new Error('AI could not produce a valid GeneratedMovePlan after 3 repairs.')
    plan = applyGenerationPreferences(parsed, preferences)
    trace.push('AI planner returned a structured GeneratedMovePlan')
  } else {
    plan = applyGenerationPreferences(designMoveLocally(request.description, context, preferences), preferences)
    trace.push('Deterministic intent designer returned a structured GeneratedMovePlan')
  }
  const compiled = compileGeneratedMove(plan, preferences)
  let move = compiled.move
  const slotKind = String(request.slot?.K_NAME ?? 'SKILL')
  let slot: JJSSlot = { ADD: false, NAME: plan.name, K_NAME: slotKind, ...((slotKind === 'SKILL' || slotKind === 'MELEE') ? { KEY: request.slot?.KEY ?? 1 } : {}), ...((slotKind === 'SKILL' || slotKind === 'SPECIAL') ? { COOLDOWN: plan.cooldownIntent ?? 10 } : {}), ...request.slot, DATA: JSON.stringify(move) }
  let validation = validateGenerated(move, slot)
  trace.push(...compiled.trace, `Validation returned ${validation.filter((message) => message.severity === 'error').length} structural errors`)
  if (preferences.automaticallyRepair && validation.some((message) => message.severity === 'error')) {
    const repaired = safeRepair(move)
    move = repaired.move
    slot = { ...slot, DATA: JSON.stringify(move) }
    validation = validateGenerated(move, slot)
    trace.push(...repaired.repairs.map((repair) => `Auto-repair: ${repair}`), `Revalidation returned ${validation.filter((message) => message.severity === 'error').length} errors`)
  }
  const unresolved = compiled.unresolved
  const warnings = [...compiled.warnings]
  if (plan.requirements.some((requirement) => !requirement.reference)) warnings.push('One or more requested conditions are not implementable with the current verified/observed registry.')
  return {
    plan,
    compiledMove: move,
    slot,
    validation,
    validationLevels: levels(validation, unresolved.length),
    unresolvedReferences: unresolved,
    warnings,
    trace,
    metadata: { generatedByAI: true, prompt: request.description, generationDate: new Date().toISOString(), model: request.model ?? (request.planner ? 'configured-provider' : 'deterministic-local-designer'), warnings, unresolvedReferences: unresolved, plan },
  }
}

const variantPrompts = [
  ['Combo', 'Prioritize combo continuation, low commitment, and controlled launch.'],
  ['Damage', 'Prioritize a powerful high-commitment finisher.'],
  ['Mobility', 'Prioritize movement, positioning, and low commitment.'],
] as const

export async function generateMoveVariants(request: GenerateMoveRequest): Promise<GeneratedMoveResult[]> {
  const originalName = /(?:called|named)\s+([^.!?\n]+)/i.exec(request.description)?.[1]?.trim() ?? 'Generated Move'
  const variants: GeneratedMoveResult[] = []
  for (const [label, direction] of variantPrompts) {
    variants.push(await generateMove({ ...request, description: `Create a move called ${originalName} — ${label} Version. ${direction} Original request: ${request.description}` }))
  }
  return variants
}

export async function generateFromMove(request: GenerateMoveRequest, selectedMove: JJSData, instruction: string): Promise<GeneratedMoveResult> {
  return generateMove({ ...request, description: `${instruction}\nGenerate from the selected move while preserving unknown raw structures only as inspiration; do not invent references.`, context: { ...request.context, selectedMove } })
}

const rolePrompts = [
  ['combo-starter', 'a fast close-range starter that opens a combo'],
  ['mobility', 'a movement punish that quickly closes distance'],
  ['area-control', 'an area-control attack that controls nearby space'],
  ['finisher', 'a slow powerful finisher that launches enemies away'],
] as const

export async function generateCharacter(request: GenerateCharacterRequest): Promise<{ concept: string; moves: GeneratedMoveResult[]; warnings: string[]; trace: string[] }> {
  const abilitySpecifications = Array.from({ length: request.baseMoveCount + request.awakeningMoveCount }, (_, index) => {
    const awakening = index >= request.baseMoveCount
    const [role, brief] = rolePrompts[index % rolePrompts.length]
    return `${request.concept}. Playstyle: ${request.playstyle}. Create ${awakening ? 'an awakening' : 'a base'} move called ${awakening ? 'Awakened' : 'Base'} ${index + 1}: ${brief}. Required kit role: ${role}.`
  })
  const specifications = request.includeSpecialAndAwakening ? [
    `${request.concept}. Create a technically conservative utility Special matching this character identity. Required kit role: utility.`,
    ...abilitySpecifications.slice(0, request.baseMoveCount),
    `${request.concept}. Create an awakening activation sequence using only supported structures. Required kit role: awakening.`,
    ...abilitySpecifications.slice(request.baseMoveCount),
  ] : abilitySpecifications
  const moves: GeneratedMoveResult[] = []
  for (let index = 0; index < specifications.length; index += 1) {
    const specialIndex = request.includeSpecialAndAwakening ? 0 : -1
    const awakeningIndex = request.includeSpecialAndAwakening ? request.baseMoveCount + 1 : -1
    const awakeningMoveStart = request.includeSpecialAndAwakening ? awakeningIndex + 1 : request.baseMoveCount
    const kind = index === specialIndex ? 'SPECIAL' : index === awakeningIndex ? 'AWAKENING' : 'SKILL'
    const key = request.includeSpecialAndAwakening ? (index > awakeningIndex ? index - awakeningMoveStart + 1 : index) : (index < request.baseMoveCount ? index + 1 : index - request.baseMoveCount + 1)
    moves.push(await generateMove({ description: specifications[index], slot: { K_NAME: kind, ...(kind === 'SKILL' ? { KEY: Math.max(1, key) } : {}), ...(kind === 'AWAKENING' ? { DURATION: 60, DELAY: 0 } : {}) }, preferences: request.preferences, planner: request.planner, model: request.model, context: { slots: moves.map((move) => move.slot), data: moves.map((move) => move.compiledMove) } }))
  }
  return { concept: request.concept, moves, warnings: moves.flatMap((move) => move.warnings), trace: [`Designed ${specifications.length} diverse ability specifications`, ...moves.flatMap((move, index) => move.trace.map((entry) => `Move ${index + 1}: ${entry}`))] }
}

export { compileGeneratedMove } from './compiler'
export { parseGeneratedMovePlan } from './designer'
export { getGenerationContext } from './retriever'
export type * from './types'
