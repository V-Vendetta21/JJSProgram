import { describe, expect, it } from 'vitest'
import { decodeCharacterCode, encodeCharacterJson } from './codec'
import { SAMPLE_CHARACTER_CODE } from '../test/fixtures'

const expectedKinds = ['SKILL', 'SPECIAL', 'AWAKENING']

describe('JJS character codec', () => {
  it('decodes a published libjjs sample through Base64, Zstandard, UTF-8, and JSON', async () => {
    const decoded = await decodeCharacterCode(SAMPLE_CHARACTER_CODE)

    expect(decoded.value).toHaveLength(3)
    expect(decoded.value.map((slot) => slot.K_NAME)).toEqual(expectedKinds)
    const line = decoded.data[0].Line
    expect(Array.isArray(line) && line.some((node) => Boolean(node) && typeof node === 'object' && !Array.isArray(node) && node && 'K_NAME' in node && node.K_NAME === 'HITBOX')).toBe(true)
  })

  it('round-trips decoded structure without losing nested unknown fields', async () => {
    const decoded = await decodeCharacterCode(SAMPLE_CHARACTER_CODE)
    decoded.value[0].MYSTERY_FIELD = { preserve: true }
    decoded.data[0].MYSTERY_DATA = 'preserve-me'

    const encoded = await encodeCharacterJson(decoded.value, decoded.data)
    const roundTrip = await decodeCharacterCode(encoded.code)

    expect(roundTrip.value[0].MYSTERY_FIELD).toEqual({ preserve: true })
    expect(roundTrip.data[0].MYSTERY_DATA).toBe('preserve-me')
    expect(roundTrip.value).toEqual(encoded.serializedSlots)
  })

  it('round-trips each preserved public sample structurally', async () => {
    const { readFile } = await import('node:fs/promises')
    const paths = [
      'jjs_knowledge/examples/source-code/void.code.txt',
      'jjs_knowledge/examples/source-code/kashimo.code.txt',
      'jjs_knowledge/examples/source-code/particle-template.code.txt',
    ]
    for (const path of paths) {
      const decoded = await decodeCharacterCode(await readFile(path, 'utf8'))
      const encoded = await encodeCharacterJson(decoded.value, decoded.data)
      const roundTrip = await decodeCharacterCode(encoded.code)
      expect(roundTrip.value, path).toEqual(encoded.serializedSlots)
    }
  })

  it('reports an actionable stage when compressed data is invalid', async () => {
    await expect(decodeCharacterCode(btoa('not-zstandard'))).rejects.toMatchObject({
      stage: 'zstandard',
    })
  })
})
