import { beforeEach, describe, expect, it } from 'vitest'
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
})
