import type { JJSData, JJSSlot, JsonObject } from '../codec/codec'
import { nodeDefinitionMap } from '../registry/nodes'

export type ValidationSeverity = 'error' | 'warning' | 'info'

export interface ValidationMessage {
  severity: ValidationSeverity
  code: string
  message: string
  slotIndex: number
  path: string
}

export interface MovesetStats {
  slots: number
  nodes: number
  hitboxes: number
  definedDamage: number
  waitTime: number
  movementNodes: number
  branches: number
  unknownNodes: number
}

const branchFields = ['BRANCH', 'BRANCH TARGET', 'BRANCH FINISHER', 'BRANCH COLLIDED'] as const
const isObject = (value: unknown): value is JsonObject => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const isReference = (value: unknown): value is string => typeof value === 'string' && value !== '' && value.toLowerCase() !== 'nil'

function linesFor(data: JJSData): Array<{ path: string; nodes: JsonObject[] }> {
  const result: Array<{ path: string; nodes: JsonObject[] }> = []
  if (Array.isArray(data.Line)) result.push({ path: 'Line', nodes: data.Line.filter(isObject) })
  if (isObject(data.Branch)) {
    for (const [name, branch] of Object.entries(data.Branch)) {
      if (isObject(branch) && Array.isArray(branch.Line)) result.push({ path: `Branch.${name}.Line`, nodes: branch.Line.filter(isObject) })
    }
  }
  return result
}

export function validateMoveset(slots: JJSSlot[], data: JJSData[]): ValidationMessage[] {
  const messages: ValidationMessage[] = []
  slots.forEach((slot, slotIndex) => {
    const nested = data[slotIndex] ?? {}
    if (typeof slot.K_NAME !== 'string') messages.push({ severity: 'error', code: 'MISSING_SLOT_KIND', message: 'Slot K_NAME is missing or not a string.', slotIndex, path: 'K_NAME' })
    if (typeof slot.DATA !== 'string') messages.push({ severity: 'error', code: 'INVALID_DATA', message: 'Slot DATA is not a serialized JSON string.', slotIndex, path: 'DATA' })
    if (!Array.isArray(nested.Line)) messages.push({ severity: 'error', code: 'INVALID_LINE', message: 'DATA.Line is not an array.', slotIndex, path: 'DATA.Line' })

    const branches = isObject(nested.Branch) ? nested.Branch : {}
    const references = new Set<string>()
    for (const line of linesFor(nested)) {
      line.nodes.forEach((node, nodeIndex) => {
        const type = typeof node.K_NAME === 'string' ? node.K_NAME : '<missing>'
        const definition = nodeDefinitionMap.get(type)
        const nodePath = `DATA.${line.path}[${nodeIndex}]`
        if (!definition) {
          messages.push({ severity: 'warning', code: 'UNKNOWN_NODE', message: `Unknown node type ${type}; it will be preserved.`, slotIndex, path: nodePath })
        } else {
          for (const field of Object.keys(node)) {
            if (!definition.fields.includes(field)) messages.push({ severity: 'info', code: 'UNKNOWN_FIELD', message: `${type}.${field} is not in the local observed registry; it will be preserved.`, slotIndex, path: `${nodePath}.${field}` })
          }
        }
        for (const field of branchFields) {
          const reference = node[field]
          if (isReference(reference)) {
            references.add(reference)
            if (!(reference in branches)) messages.push({ severity: 'error', code: 'BROKEN_BRANCH', message: `Branch ${reference} is referenced but not defined.`, slotIndex, path: `${nodePath}.${field}` })
          }
        }
      })
    }
    for (const branchName of Object.keys(branches)) {
      if (!references.has(branchName)) messages.push({ severity: 'warning', code: 'ORPHAN_BRANCH', message: `Branch ${branchName} is defined but not referenced by a known branch field.`, slotIndex, path: `DATA.Branch.${branchName}` })
    }
  })
  return messages
}

export interface NodeDependency {
  nodeIndex: number
  field: string
  value: string
}

const producerFields = ['PROJECTILE TAG', 'VISUAL TAG', 'TAG'] as const

export function findNodeDependencies(nodes: JsonObject[], sourceIndex: number): NodeDependency[] {
  const source = nodes[sourceIndex]
  if (!source) return []
  const produced = new Set(producerFields.flatMap((field) => isReference(source[field]) ? [source[field]] : []))
  if (!produced.size) return []
  const dependencies: NodeDependency[] = []
  nodes.forEach((node, nodeIndex) => {
    if (nodeIndex === sourceIndex) return
    for (const [field, value] of Object.entries(node)) {
      if (typeof value === 'string' && produced.has(value)) dependencies.push({ nodeIndex, field, value })
    }
  })
  return dependencies
}

export function analyzeMoveset(slots: JJSSlot[], data: JJSData[]): MovesetStats {
  const stats: MovesetStats = { slots: slots.length, nodes: 0, hitboxes: 0, definedDamage: 0, waitTime: 0, movementNodes: 0, branches: 0, unknownNodes: 0 }
  for (const nested of data) {
    stats.branches += isObject(nested.Branch) ? Object.keys(nested.Branch).length : 0
    for (const line of linesFor(nested)) {
      for (const node of line.nodes) {
        stats.nodes += 1
        const type = typeof node.K_NAME === 'string' ? node.K_NAME : '<missing>'
        if (!nodeDefinitionMap.has(type)) stats.unknownNodes += 1
        if (type === 'HITBOX') {
          stats.hitboxes += 1
          if (typeof node.DAMAGE === 'number' && Number.isFinite(node.DAMAGE)) stats.definedDamage += node.DAMAGE
        }
        if (type === 'WAIT' && typeof node.TIME === 'number' && Number.isFinite(node.TIME)) stats.waitTime += node.TIME
        if (type === 'VELO' || type === 'TELEPORT') stats.movementNodes += 1
      }
    }
  }
  return stats
}
