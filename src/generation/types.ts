import type { JJSData, JJSSlot, JsonObject } from '../codec/codec'
import type { ValidationMessage } from '../moveset/validator'
import type { Confidence, NodeDefinition } from '../registry/nodes'

export type MoveRole = 'combo-starter' | 'combo-extender' | 'finisher' | 'mobility' | 'counter' | 'area-control' | 'utility' | 'awakening' | 'other'
export type StartupIntent = 'very-fast' | 'fast' | 'medium' | 'slow' | 'very-slow' | 'cinematic'
export type DamageIntent = 'low' | 'medium' | 'high' | 'very-high'
export type RangeIntent = 'close' | 'medium' | 'long' | 'area'
export type Complexity = 'simple' | 'medium' | 'complex' | 'insane'
export type MoveLength = 'short' | 'medium' | 'long'
export type BalanceProfile = 'conservative' | 'normal' | 'powerful' | 'custom'
export type ReferenceStatus = 'RESOLVED' | 'MISSING_REFERENCE'

export interface GeneratedReference {
  kind: 'animation' | 'effect' | 'sound' | 'built-in-skill' | 'condition' | 'state'
  intent: string
  reference: string | number | number[] | null
  confidence?: Confidence
  status: ReferenceStatus
  source?: string
}

export type GeneratedStep =
  | { type: 'animation'; intent: string; reference: number[] | null; speed?: number; status?: ReferenceStatus }
  | { type: 'wait'; duration: number; intent?: string }
  | { type: 'movement'; intent: 'dash-forward' | 'dash-backward' | 'rise-upward' | 'slam-downward' | 'lunge' | 'recoil'; strength?: 'small' | 'medium' | 'large'; duration?: number; target?: 'user' | 'last-hit' }
  | { type: 'hitbox'; intent: string; size: 'tiny' | 'small' | 'medium' | 'large' | 'huge'; placement: 'close' | 'forward' | 'above' | 'below' | 'area'; damage: DamageIntent; stun?: number; blockable?: boolean; launch?: 'up' | 'away' | 'down'; branchOnHit?: string }
  | { type: 'effect'; intent: string; reference: string | null; status?: ReferenceStatus }
  | { type: 'sound'; intent: string; reference: number | null; status?: ReferenceStatus }
  | { type: 'built-in-skill'; intent: string; reference: string | null; status?: ReferenceStatus }
  | { type: 'state'; intent: string; reference: string | null; status?: ReferenceStatus }

export interface GeneratedBranch { name: string; trigger: 'hit-success'; timeline: GeneratedStep[] }
export interface GeneratedRequirement { intent: string; reference: string | null; status: ReferenceStatus }

export interface GeneratedMovePlan {
  name: string
  description: string
  role: MoveRole
  design: { startup: StartupIntent; damage: DamageIntent; range: RangeIntent; commitment: 'low' | 'medium' | 'high' }
  timeline: GeneratedStep[]
  branches: GeneratedBranch[]
  requirements: GeneratedRequirement[]
  references: GeneratedReference[]
  cooldownIntent?: number
}

export interface GenerationPreferences {
  complexity: Complexity
  moveLength: MoveLength
  balance: BalanceProfile
  customDamageMultiplier?: number
  preferExistingAnimations: boolean
  allowObservedReferences: boolean
  allowLikelyReferences: boolean
  automaticallyRepair: boolean
  automaticallyInsert: boolean
  creative: boolean
  strict: boolean
}

export interface GenerationPattern { name: string; roles: MoveRole[]; keywords: string[]; confidence: Confidence; source: string; steps: string[] }
export interface GenerationContext {
  query: string
  nodes: NodeDefinition[]
  patterns: GenerationPattern[]
  references: GeneratedReference[]
  examples: Array<{ name: string; source: string; structure: string[] }>
  currentKit: Array<{ name: string; kind: string; nodeTypes: string[] }>
  currentMove?: { name: string; kind: string; nodeTypes: string[]; data: JJSData }
  trace: string[]
}

export interface ValidationLevels {
  structure: 'PASS' | 'FAIL'
  references: 'PASS' | 'WARN' | 'FAIL'
  branches: 'PASS' | 'FAIL'
  schema: 'PASS' | 'FAIL'
  codec: 'NOT_TESTED' | 'PASS' | 'FAIL'
  inGame: 'UNVERIFIED' | 'VERIFIED'
}

export interface GenerationMetadata {
  generatedByAI: true
  prompt: string
  generationDate: string
  model: string
  warnings: string[]
  unresolvedReferences: GeneratedReference[]
  plan: GeneratedMovePlan
}

export interface GeneratedMoveResult {
  plan: GeneratedMovePlan
  compiledMove: JJSData & { Line: JsonObject[]; Req: unknown[]; Prop: unknown[]; Branch?: Record<string, { Line: JsonObject[]; Req: unknown[] }> }
  slot: JJSSlot
  validation: ValidationMessage[]
  validationLevels: ValidationLevels
  unresolvedReferences: GeneratedReference[]
  warnings: string[]
  trace: string[]
  metadata: GenerationMetadata
}

export interface GenerateMoveRequest {
  description: string
  slot?: Partial<JJSSlot>
  context?: { slots?: JJSSlot[]; data?: JJSData[]; selectedMove?: JJSData }
  preferences?: Partial<GenerationPreferences>
  model?: string
  planner?: (prompt: string, context: GenerationContext) => Promise<unknown>
}

export interface GenerateCharacterRequest {
  concept: string
  playstyle: string
  baseMoveCount: number
  awakeningMoveCount: number
  includeSpecialAndAwakening?: boolean
  preferences?: Partial<GenerationPreferences>
  planner?: GenerateMoveRequest['planner']
  model?: string
}
