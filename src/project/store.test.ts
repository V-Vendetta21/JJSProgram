import { beforeEach, describe, expect, it } from 'vitest'
import { generateMove } from '../generation/generation'
import { useProjectStore } from './store'

const original = [{ K_NAME: 'SKILL', NAME: 'Original', DATA: '{"Line":[],"Req":[],"Prop":[]}' }]

describe('project history', () => {
  beforeEach(() => useProjectStore.getState().reset())

  it('restores the exact prior structure after an edit and undo', () => {
    useProjectStore.getState().loadMoveset(original, [{ Line: [], Req: [], Prop: [] }], 'Fixture')
    useProjectStore.getState().replaceRawJson('[{"K_NAME":"SKILL","NAME":"Changed","DATA":"{\\"Line\\":[],\\"Req\\":[],\\"Prop\\":[]}"}]')

    expect(useProjectStore.getState().slots[0].NAME).toBe('Changed')
    useProjectStore.getState().undo()
    expect(useProjectStore.getState().slots).toEqual(original)
  })

  it('edits nodes with one undoable transaction per operation', () => {
    useProjectStore.getState().loadMoveset(original, [{ Line: [{ K_NAME: 'WAIT', TIME: 0.1 }], Req: [], Prop: [] }], 'Fixture')

    useProjectStore.getState().insertNode(0, 1, { K_NAME: 'HITBOX', DAMAGE: 5 })
    useProjectStore.getState().duplicateNode(0, 1)
    useProjectStore.getState().moveNode(0, 2, 0)
    useProjectStore.getState().deleteNode(0, 1)

    expect(useProjectStore.getState().data[0].Line).toEqual([
      { K_NAME: 'HITBOX', DAMAGE: 5 },
      { K_NAME: 'HITBOX', DAMAGE: 5 },
    ])
    useProjectStore.getState().undo()
    expect(useProjectStore.getState().data[0].Line).toHaveLength(3)
  })

  it('creates and restores named snapshots exactly', () => {
    useProjectStore.getState().loadMoveset(original, [{ Line: [], Req: [], Prop: [] }], 'Fixture')
    const snapshotId = useProjectStore.getState().createSnapshot('Before rework')
    useProjectStore.getState().insertNode(0, 0, { K_NAME: 'WAIT', TIME: 1 })

    useProjectStore.getState().restoreSnapshot(snapshotId)

    expect(useProjectStore.getState().data[0].Line).toEqual([])
    expect(useProjectStore.getState().snapshots[0].label).toBe('Before rework')
  })

  it('rejects invalid raw JSON without mutating project state', () => {
    useProjectStore.getState().loadMoveset(original, [{ Line: [], Req: [], Prop: [] }], 'Fixture')

    const result = useProjectStore.getState().replaceRawJson('{invalid')

    expect(result.ok).toBe(false)
    expect(useProjectStore.getState().slots).toEqual(original)
  })

  it('inserts an actually generated move into an empty project with project-only metadata', async () => {
    const generated = await generateMove({ description: 'Make a fast dash punch that launches the enemy upward, then lets me continue the combo.' })

    const index = useProjectStore.getState().insertGeneratedMove(generated)

    expect(index).toBe(0)
    expect(useProjectStore.getState().slots[0].NAME).toBe('Generated Dash Punch')
    expect(useProjectStore.getState().data[0].Line).toEqual(generated.compiledMove.Line)
    expect(useProjectStore.getState().generationMetadata['0']).toMatchObject({ generatedByAI: true, prompt: expect.stringContaining('dash punch') })
    expect(JSON.parse(String(useProjectStore.getState().slots[0].DATA))).not.toHaveProperty('generatedByAI')
  })

  it('replaces a selected move as one undoable generated transaction', async () => {
    const slotWithObservedFields = [{ ...original[0], ADD: true, 'TOOL TIP': 'Keep this', CUSTOM: 42 }]
    useProjectStore.getState().loadMoveset(slotWithObservedFields, [{ Line: [], Req: [], Prop: [] }], 'Fixture')
    const generated = await generateMove({ description: 'Create a three-hit combo.' })

    useProjectStore.getState().replaceWithGeneratedMove(0, generated)

    expect(useProjectStore.getState().slots).toHaveLength(1)
    expect(useProjectStore.getState().slots[0]).toMatchObject({ ADD: true, 'TOOL TIP': 'Keep this', CUSTOM: 42 })
    expect(useProjectStore.getState().data[0].Line).toHaveLength(generated.compiledMove.Line.length)
    useProjectStore.getState().undo()
    expect(useProjectStore.getState().slots).toEqual(slotWithObservedFields)
  })
})
