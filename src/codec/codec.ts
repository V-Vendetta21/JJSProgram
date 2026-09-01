import { Zstd } from '@hpcc-js/wasm-zstd'

export type JsonObject = Record<string, unknown>

export interface JJSSlot extends JsonObject {
  K_NAME?: unknown
  NAME?: unknown
  DATA?: unknown
}

export interface JJSData extends JsonObject {
  Line?: unknown
  Req?: unknown
  Prop?: unknown
  Branch?: unknown
}

export interface DecodedCharacter {
  value: JJSSlot[]
  data: JJSData[]
  rawJson: string
}

export interface EncodedCharacter {
  code: string
  rawJson: string
  serializedSlots: JJSSlot[]
}

export class CodecError extends Error {
  readonly stage: 'base64' | 'zstandard' | 'utf8' | 'json' | 'structure'

  constructor(stage: CodecError['stage'], message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'CodecError'
    this.stage = stage
  }
}

const MAX_CODE_CHARS = 8_000_000
const MAX_DECOMPRESSED_BYTES = 32_000_000

function normalizeCode(code: string): string {
  const normalized = code.replace(/\s+/g, '')
  if (!normalized || normalized.length > MAX_CODE_CHARS) {
    throw new CodecError('base64', 'The code is empty or exceeds the 8 MB safety limit.')
  }
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 === 1) {
    throw new CodecError('base64', 'The character code is not valid standard Base64.')
  }
  return normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
}

function fromBase64(code: string): Uint8Array {
  try {
    const binary = atob(normalizeCode(code))
    return Uint8Array.from(binary, (char) => char.charCodeAt(0))
  } catch (error) {
    if (error instanceof CodecError) throw error
    throw new CodecError('base64', 'Base64 decoding failed.', { cause: error })
  }
}

function toBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000
  let binary = ''
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

function parseSlots(rawJson: string): JJSSlot[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawJson)
  } catch (error) {
    throw new CodecError('json', 'Decompressed content is not valid JSON.', { cause: error })
  }
  if (!Array.isArray(parsed) || parsed.some((slot) => !slot || typeof slot !== 'object' || Array.isArray(slot))) {
    throw new CodecError('structure', 'The outer JJS character structure must be an array of slot objects.')
  }
  return parsed as JJSSlot[]
}

function parseNestedData(slot: JJSSlot, index: number): JJSData {
  if (typeof slot.DATA !== 'string') return {}
  try {
    const parsed: unknown = JSON.parse(slot.DATA)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new CodecError('structure', `Slot ${index + 1} DATA must decode to an object.`)
    }
    return parsed as JJSData
  } catch (error) {
    if (error instanceof CodecError) throw error
    throw new CodecError('json', `Slot ${index + 1} DATA is not valid serialized JSON.`, { cause: error })
  }
}

async function loadZstd() {
  return Zstd.load()
}

export async function decodeCharacterCode(code: string): Promise<DecodedCharacter> {
  const compressed = fromBase64(code)
  let decompressed: Uint8Array
  try {
    decompressed = (await loadZstd()).decompress(compressed)
  } catch (error) {
    throw new CodecError('zstandard', 'Base64 decoding succeeded, but Zstandard decompression failed.', { cause: error })
  }
  if (decompressed.byteLength > MAX_DECOMPRESSED_BYTES) {
    throw new CodecError('structure', 'Decoded content exceeds the 32 MB safety limit.')
  }

  let rawJson: string
  try {
    rawJson = new TextDecoder('utf-8', { fatal: true }).decode(decompressed)
  } catch (error) {
    throw new CodecError('utf8', 'Decompressed content is not valid UTF-8.', { cause: error })
  }

  const value = parseSlots(rawJson)
  const data = value.map(parseNestedData)
  return { value, data, rawJson }
}

export async function encodeCharacterJson(slots: JJSSlot[], data?: JJSData[]): Promise<EncodedCharacter> {
  if (!Array.isArray(slots)) {
    throw new CodecError('structure', 'The outer JJS character structure must be an array.')
  }
  const serializedSlots = slots.map((slot, index) => {
    const copy = structuredClone(slot)
    if (data && index in data && typeof slot.DATA === 'string') {
      copy.DATA = JSON.stringify(data[index])
    }
    return copy
  })
  const rawJson = JSON.stringify(serializedSlots)
  const bytes = new TextEncoder().encode(rawJson)
  if (bytes.byteLength > MAX_DECOMPRESSED_BYTES) {
    throw new CodecError('structure', 'JSON content exceeds the 32 MB safety limit.')
  }
  const compressed = (await loadZstd()).compress(bytes)
  return { code: toBase64(compressed), rawJson, serializedSlots }
}
