import { describe, expect, it } from 'vitest'
import { parseProjectFile, serializeProjectFile } from './project'
import { useProjectStore } from './store'

const slots = [{ K_NAME: 'SKILL', NAME: 'Saved', DATA: '{"Line":[],"Req":[],"Prop":[]}' }]

describe('project files', () => {
  it('serializes and parses project metadata, snapshots, and lossless moveset data', () => {
    useProjectStore.getState().reset()
    useProjectStore.getState().loadMoveset(slots, [{ Line: [], Req: [], Prop: [] }], 'Saved Project')
    useProjectStore.getState().createSnapshot('Initial')

    const text = serializeProjectFile(useProjectStore.getState())
    const parsed = parseProjectFile(text)

    expect(parsed.projectVersion).toBe(1)
    expect(parsed.projectName).toBe('Saved Project')
    expect(parsed.slots).toEqual(slots)
    expect(parsed.snapshots[0].label).toBe('Initial')
  })

  it('rejects unsupported project versions', () => {
    expect(() => parseProjectFile('{"projectVersion":99,"moveset":[]}')).toThrow(/unsupported project version/i)
  })

  it('drops malformed untrusted AI metadata instead of crashing a loaded project', () => {
    const parsed = parseProjectFile(JSON.stringify({ projectVersion: 1, moveset: slots, generationMetadata: { 0: { generatedByAI: true, unresolvedReferences: 'broken' } } }))
    expect(parsed.generationMetadata).toEqual({})
  })
})
