import { describe, expect, it } from 'vitest'
import type { JJSData, JJSSlot } from '../codec/codec'
import { analyzeMoveset, findNodeDependencies, validateMoveset } from './validator'

const slot = (data: JJSData): JJSSlot => ({
  K_NAME: 'SKILL',
  NAME: 'Test',
  KEY: 1,
  COOLDOWN: 0,
  DATA: JSON.stringify(data),
})

describe('moveset validation', () => {
  it('detects missing branch targets without rejecting unknown fields', () => {
    const slots = [slot({
      Line: [{ K_NAME: 'HITBOX', BRANCH: 'HitSuccess', MYSTERY: 42 }],
      Req: [],
      Prop: [],
      Branch: {},
    })]
    const data = [JSON.parse(slots[0].DATA as string)]

    const messages = validateMoveset(slots, data)

    expect(messages).toContainEqual(expect.objectContaining({ code: 'BROKEN_BRANCH', severity: 'error' }))
    expect(messages).toContainEqual(expect.objectContaining({ code: 'UNKNOWN_FIELD', severity: 'info' }))
  })

  it('reports orphan branches and unknown node types as warnings', () => {
    const slots = [slot({
      Line: [{ K_NAME: 'NEW_NODE', VALUE: true }],
      Req: [],
      Prop: {},
      Branch: { Orphan: { Line: [], Req: [] } },
    })]
    const data = [JSON.parse(slots[0].DATA as string)]

    const messages = validateMoveset(slots, data)

    expect(messages).toContainEqual(expect.objectContaining({ code: 'UNKNOWN_NODE', severity: 'warning' }))
    expect(messages).toContainEqual(expect.objectContaining({ code: 'ORPHAN_BRANCH', severity: 'warning' }))
  })

  it('calculates deterministic move statistics without claiming combo validity', () => {
    const slots = [slot({
      Line: [
        { K_NAME: 'WAIT', TIME: 0.25 },
        { K_NAME: 'HITBOX', DAMAGE: 12 },
        { K_NAME: 'HITBOX', DAMAGE: 3 },
      ],
      Req: [],
      Prop: [],
    })]
    const data = [JSON.parse(slots[0].DATA as string)]

    expect(analyzeMoveset(slots, data)).toMatchObject({
      slots: 1,
      nodes: 3,
      hitboxes: 2,
      definedDamage: 15,
      waitTime: 0.25,
    })
  })
})
