import { describe, expect, it } from 'vitest'
import { generateCharacter, generateMove, generateMoveVariants, parseGeneratedMovePlan } from './generation'

const valid = (result: Awaited<ReturnType<typeof generateMove>>) => {
  expect(result.compiledMove.Line.length).toBeGreaterThan(0)
  expect(result.validation.filter((message) => message.severity === 'error')).toEqual([])
  expect(result.validationLevels.structure).toBe('PASS')
  expect(result.validationLevels.schema).toBe('PASS')
  expect(result.validationLevels.codec).toBe('NOT_TESTED')
  expect(result.validationLevels.inGame).toBe('UNVERIFIED')
}

describe('AI move generation pipeline', () => {
  it('constructs a basic punch as an actual validated timeline', async () => {
    const result = await generateMove({ description: 'Create a simple punch.' })
    valid(result)
    expect(result.plan.timeline.some((step) => step.type === 'hitbox')).toBe(true)
    expect(result.compiledMove.Line.some((node) => node.K_NAME === 'HITBOX')).toBe(true)
  })

  it('constructs an uppercut launcher with upward launch intent', async () => {
    const result = await generateMove({ description: 'Create an uppercut that launches the opponent.' })
    valid(result)
    expect(result.plan.role).toBe('combo-extender')
    expect(result.compiledMove.Line.some((node) => node.K_NAME === 'VELO' && String(node.FORCE).includes('12'))).toBe(true)
  })

  it('constructs sequential hit sections for a three-hit combo', async () => {
    const result = await generateMove({ description: 'Create a three-hit combo.' })
    valid(result)
    expect(result.compiledMove.Line.filter((node) => node.K_NAME === 'HITBOX')).toHaveLength(3)
    expect(result.compiledMove.Line.filter((node) => node.K_NAME === 'WAIT').length).toBeGreaterThanOrEqual(3)
  })

  it('creates a unique hit-success branch whose reference resolves', async () => {
    const result = await generateMove({ description: 'If this hits, perform a follow-up.' })
    valid(result)
    const hit = result.compiledMove.Line.find((node) => node.K_NAME === 'HITBOX' && typeof node.BRANCH === 'string')
    expect(hit?.BRANCH).toBeTruthy()
    expect(result.compiledMove.Branch).toHaveProperty(String(hit?.BRANCH))
    expect(result.validationLevels.branches).toBe('PASS')
  })

  it('keeps the move usable when a requested visual reference is missing', async () => {
    const result = await generateMove({ description: 'Create a punch with an unknowable galaxy-zebra visual.' })
    valid(result)
    expect(result.unresolvedReferences).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'effect', status: 'MISSING_REFERENCE' }),
    ]))
    expect(result.compiledMove.Line.some((node) => node.K_NAME === 'HITBOX')).toBe(true)
  })

  it('generates four independently validated base abilities with role diversity', async () => {
    const result = await generateCharacter({ concept: 'Voidborn, black holes and mass manipulation', playstyle: 'slow strategic area control', baseMoveCount: 4, awakeningMoveCount: 0 })
    expect(result.moves).toHaveLength(4)
    expect(new Set(result.moves.map((move) => move.plan.role)).size).toBeGreaterThanOrEqual(3)
    result.moves.forEach(valid)
  })

  it('generates three structural variants and complete character scaffolding', async () => {
    const variants = await generateMoveVariants({ description: 'Create a move called Void Strike.', slot: { K_NAME: 'SKILL', KEY: 1 } })
    expect(variants).toHaveLength(3)
    expect(variants.every((result) => result.compiledMove.Line.some((node) => node.K_NAME === 'HITBOX'))).toBe(true)

    const character = await generateCharacter({ concept: 'Voidborn', playstyle: 'strategic', baseMoveCount: 2, awakeningMoveCount: 2, includeSpecialAndAwakening: true })
    expect(character.moves.map((move) => move.slot.K_NAME)).toEqual(['SPECIAL', 'SKILL', 'SKILL', 'AWAKENING', 'SKILL', 'SKILL'])
    character.moves.forEach(valid)
  })

  it('constructs the Singularity Hattrick acceptance move rather than describing it', async () => {
    const result = await generateMove({ description: `Create a move called Singularity Hattrick.
The player launches upward and charges a small black-hole projectile.
After a short delay, they strike the projectile forward.
When it reaches the attack point, create a large impact hitbox.
The move should be slow, highly telegraphed, and powerful.
If possible, use a separate hit-success branch for the impact sequence.
Make it suitable as a base moveset finisher rather than an ultimate.` })
    valid(result)
    expect(result.plan.name).toBe('Singularity Hattrick')
    expect(result.plan.role).toBe('finisher')
    expect(result.compiledMove.Line.some((node) => node.K_NAME === 'VELO')).toBe(true)
    expect(result.compiledMove.Line.some((node) => node.K_NAME === 'HITBOX')).toBe(true)
    expect(Object.keys(result.compiledMove.Branch ?? {})).not.toHaveLength(0)
  })

  it('rejects invented raw node types in an AI-authored plan', () => {
    expect(() => parseGeneratedMovePlan({ name: 'Bad', description: 'bad', role: 'other', design: { startup: 'fast', damage: 'low', range: 'close', commitment: 'low' }, timeline: [{ type: 'raw', node: { K_NAME: 'FAKE' } }], branches: [], requirements: [], references: [] })).toThrow(/unsupported generated step/i)
  })

  it('preserves duplicate branch content under unique deterministic names', async () => {
    const plan = { name: 'Branch Test', description: 'test', role: 'combo-starter', design: { startup: 'fast', damage: 'medium', range: 'close', commitment: 'medium' }, timeline: [{ type: 'hitbox', intent: 'punch', size: 'medium', placement: 'forward', damage: 'medium', branchOnHit: 'Followup' }], branches: [{ name: 'Followup', trigger: 'hit-success', timeline: [{ type: 'wait', duration: 0.1 }] }, { name: 'Followup', trigger: 'hit-success', timeline: [{ type: 'wait', duration: 0.2 }] }], requirements: [], references: [] }
    const result = await generateMove({ description: 'Create a branch test', planner: async () => plan })
    expect(Object.keys(result.compiledMove.Branch ?? {})).toEqual(['Followup', 'Followup 2'])
    expect(result.compiledMove.Line[0].BRANCH).toBe('Followup')
  })
})
