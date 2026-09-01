import type { JJSData, JsonObject } from '../codec/codec'
import { nodeDefinitionMap } from '../registry/nodes'

export type AIChangeOperation =
  | { type: 'SET_FIELD'; nodeIndex: number; field: string; value: unknown }
  | { type: 'INSERT_NODE'; index: number; node: JsonObject }
  | { type: 'DELETE_NODE'; index: number }
  | { type: 'MOVE_NODE'; fromIndex: number; toIndex: number }
  | { type: 'DUPLICATE_NODE'; index: number }

export interface AIChangeSet {
  explanation: string
  operations: AIChangeOperation[]
}

const isObject = (value: unknown): value is JsonObject => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const integer = (value: unknown, name: string): number => {
  if (!Number.isInteger(value)) throw new Error(`${name} must be an integer.`)
  return value as number
}
const lineFrom = (move: JJSData): JsonObject[] => Array.isArray(move.Line) ? move.Line.filter(isObject) : []
const inRange = (index: number, length: number, allowEnd = false) => index >= 0 && index < length + (allowEnd ? 1 : 0)

function validateInsertedNode(node: unknown): JsonObject {
  if (!isObject(node) || typeof node.K_NAME !== 'string') throw new Error('INSERT_NODE requires a node object with K_NAME.')
  const definition = nodeDefinitionMap.get(node.K_NAME)
  if (!definition || (definition.confidence !== 'OBSERVED' && definition.confidence !== 'VERIFIED')) throw new Error(`MISSING_REFERENCE: node type ${node.K_NAME}`)
  for (const field of Object.keys(node)) {
    if (!definition.fields.includes(field)) throw new Error(`MISSING_REFERENCE: ${node.K_NAME}.${field} is not in the observed registry.`)
  }
  return structuredClone(node)
}

export function validateChangeSet(raw: unknown, move: JJSData): AIChangeSet {
  if (!isObject(raw)) throw new Error('AI changeset must be an object.')
  if (typeof raw.explanation !== 'string') throw new Error('AI changeset explanation must be a string.')
  if (!Array.isArray(raw.operations) || raw.operations.length > 100) throw new Error('AI changeset operations must be an array of at most 100 entries.')

  let working = structuredClone(move)
  const operations: AIChangeOperation[] = []
  for (const candidate of raw.operations) {
    if (!isObject(candidate) || typeof candidate.type !== 'string') throw new Error('Every AI operation requires a type.')
    const line = lineFrom(working)
    let operation: AIChangeOperation
    switch (candidate.type) {
      case 'SET_FIELD': {
        const nodeIndex = integer(candidate.nodeIndex, 'nodeIndex')
        if (!inRange(nodeIndex, line.length)) throw new Error(`SET_FIELD nodeIndex ${nodeIndex} is out of range.`)
        if (typeof candidate.field !== 'string' || !candidate.field || candidate.field === 'K_NAME') throw new Error('SET_FIELD field is invalid or protected.')
        const node = line[nodeIndex]
        const type = typeof node.K_NAME === 'string' ? node.K_NAME : ''
        const knownFields = nodeDefinitionMap.get(type)?.fields ?? []
        if (!(candidate.field in node) && !knownFields.includes(candidate.field)) throw new Error(`MISSING_REFERENCE: ${type}.${candidate.field}`)
        operation = { type: 'SET_FIELD', nodeIndex, field: candidate.field, value: structuredClone(candidate.value) }
        break
      }
      case 'INSERT_NODE': {
        const index = integer(candidate.index, 'index')
        if (!inRange(index, line.length, true)) throw new Error(`INSERT_NODE index ${index} is out of range.`)
        operation = { type: 'INSERT_NODE', index, node: validateInsertedNode(candidate.node) }
        break
      }
      case 'DELETE_NODE': {
        const index = integer(candidate.index, 'index')
        if (!inRange(index, line.length)) throw new Error(`DELETE_NODE index ${index} is out of range.`)
        operation = { type: 'DELETE_NODE', index }
        break
      }
      case 'MOVE_NODE': {
        const fromIndex = integer(candidate.fromIndex, 'fromIndex')
        const toIndex = integer(candidate.toIndex, 'toIndex')
        if (!inRange(fromIndex, line.length) || !inRange(toIndex, line.length)) throw new Error('MOVE_NODE index is out of range.')
        operation = { type: 'MOVE_NODE', fromIndex, toIndex }
        break
      }
      case 'DUPLICATE_NODE': {
        const index = integer(candidate.index, 'index')
        if (!inRange(index, line.length)) throw new Error(`DUPLICATE_NODE index ${index} is out of range.`)
        operation = { type: 'DUPLICATE_NODE', index }
        break
      }
      default: throw new Error(`Unsupported AI operation: ${candidate.type}`)
    }
    operations.push(operation)
    working = applyChangeSet(working, [operation])
  }
  return { explanation: raw.explanation, operations }
}

export function applyChangeSet(move: JJSData, operations: AIChangeOperation[]): JJSData {
  const next = structuredClone(move)
  const line = lineFrom(next)
  for (const operation of operations) {
    switch (operation.type) {
      case 'SET_FIELD': line[operation.nodeIndex] = { ...line[operation.nodeIndex], [operation.field]: structuredClone(operation.value) }; break
      case 'INSERT_NODE': line.splice(operation.index, 0, structuredClone(operation.node)); break
      case 'DELETE_NODE': line.splice(operation.index, 1); break
      case 'MOVE_NODE': { const [node] = line.splice(operation.fromIndex, 1); line.splice(operation.toIndex, 0, node); break }
      case 'DUPLICATE_NODE': line.splice(operation.index + 1, 0, structuredClone(line[operation.index])); break
    }
  }
  next.Line = line
  return next
}

export function buildAIContext(move: JJSData): string {
  const line = lineFrom(move)
  const definitions = [...new Set(line.flatMap((node) => typeof node.K_NAME === 'string' ? [node.K_NAME] : []))]
    .flatMap((type) => { const definition = nodeDefinitionMap.get(type); return definition ? [{ type, confidence: definition.confidence, fields: definition.fields }] : [] })
  return JSON.stringify({ selectedMove: move, allowedDefinitions: definitions }, null, 2)
}

export const AI_SYSTEM_PROMPT = `You assist with a structured JJS moveset project. Return JSON only. Never return encoded Base64. Never invent node types, field names, animation references, asset IDs, built-in skill names, states, effects, or specials. Only use values and definitions explicitly supplied in context. If a reference is missing, explain it using MISSING_REFERENCE and return no operation requiring it. Output: {"explanation":"...","operations":[...]}. Allowed operations: SET_FIELD {nodeIndex,field,value}, INSERT_NODE {index,node}, DELETE_NODE {index}, MOVE_NODE {fromIndex,toIndex}, DUPLICATE_NODE {index}.`
