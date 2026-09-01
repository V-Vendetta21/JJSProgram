import { describe, expect, it } from 'vitest'
import { applyChangeSet, validateChangeSet } from './changesets'

const move = { Line: [{ K_NAME: 'WAIT', TIME: 0.2 }, { K_NAME: 'HITBOX', DAMAGE: 5 }], Req: [], Prop: [] }

describe('AI changesets', () => {
  it('validates and applies bounded operations without mutating the source move', () => {
    const raw = {
      explanation: 'Slower startup and stronger final hit.',
      operations: [
        { type: 'SET_FIELD', nodeIndex: 0, field: 'TIME', value: 0.4 },
        { type: 'SET_FIELD', nodeIndex: 1, field: 'DAMAGE', value: 8 },
      ],
    }
    const validated = validateChangeSet(raw, move)
    const next = applyChangeSet(move, validated.operations)

    expect(next.Line).toEqual([{ K_NAME: 'WAIT', TIME: 0.4 }, { K_NAME: 'HITBOX', DAMAGE: 8 }])
    expect(move.Line[0].TIME).toBe(0.2)
  })

  it('rejects inserted node types that are absent from the observed registry', () => {
    expect(() => validateChangeSet({ explanation: 'Invent', operations: [{ type: 'INSERT_NODE', index: 0, node: { K_NAME: 'FAKE_NODE' } }] }, move)).toThrow(/missing_reference/i)
  })

  it('rejects out-of-range destructive operations', () => {
    expect(() => validateChangeSet({ explanation: 'Delete', operations: [{ type: 'DELETE_NODE', index: 99 }] }, move)).toThrow(/out of range/i)
  })
})
