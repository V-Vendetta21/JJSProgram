import { describe, expect, it } from 'vitest'
import { structuralDiff } from './diff'

describe('structural diff', () => {
  it('reports exact JSON paths and before/after values', () => {
    const before = [{ DATA: { Line: [{ K_NAME: 'HITBOX', DAMAGE: 5 }] } }]
    const after = [{ DATA: { Line: [{ K_NAME: 'HITBOX', DAMAGE: 10, STUN: 1 }] } }]

    expect(structuralDiff(before, after)).toEqual([
      { path: '[0].DATA.Line[0].DAMAGE', before: 5, after: 10, kind: 'changed' },
      { path: '[0].DATA.Line[0].STUN', before: undefined, after: 1, kind: 'added' },
    ])
  })
})
