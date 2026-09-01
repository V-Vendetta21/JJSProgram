import { describe, expect, it } from 'vitest'
import { decodeCharacterCode, encodeCharacterJson } from './codec'
import { SAMPLE_CHARACTER_CODE } from '../test/fixtures'

const expectedKinds = ['SKILL', 'SPECIAL', 'AWAKENING']

describe('JJS character codec', () => {
  it('decodes a published libjjs sample through Base64, Zstandard, UTF-8, and JSON', async () => {
    const decoded = await decodeCharacterCode(SAMPLE_CHARACTER_CODE)

    expect(decoded.value).toHaveLength(3)
    expect(decoded.value.map((slot) => slot.K_NAME)).toEqual(expectedKinds)
    expect(decoded.data[0].Line.map((node) => node.K_NAME)).toContain('HITBOX')
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

  it('reports an actionable stage when compressed data is invalid', async () => {
    await expect(decodeCharacterCode(btoa('not-zstandard'))).rejects.toMatchObject({
      stage: 'zstandard',
    })
  })
})
