import type { JJSData, JJSSlot } from '../codec/codec'
import type { GenerationMetadata } from '../generation/types'
import type { ProjectSnapshot, ProjectState } from './store'
import { parseNestedData } from './store'

export interface JJSProjectFile {
  projectVersion: 1
  projectId: string
  projectName: string
  createdAt: string
  modifiedAt: string
  source: { format: 'JJS_CHARACTER_CODE' | 'LOCAL_PROJECT'; importedCode?: string }
  moveset: JJSSlot[]
  baselineMoveset: JJSSlot[]
  snapshots: ProjectSnapshot[]
  notes: Record<string, string>
  tags: string[]
  generationMetadata: Record<string, GenerationMetadata>
}

export interface ParsedProject extends JJSProjectFile {
  slots: JJSSlot[]
  data: JJSData[]
  baselineSlots: JJSSlot[]
  baselineData: JJSData[]
}

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export function serializeProjectFile(state: ProjectState): string {
  const project: JJSProjectFile = {
    projectVersion: 1,
    projectId: state.projectId,
    projectName: state.projectName,
    createdAt: state.createdAt,
    modifiedAt: state.modifiedAt,
    source: { format: 'LOCAL_PROJECT' },
    moveset: structuredClone(state.slots),
    baselineMoveset: structuredClone(state.baselineSlots),
    snapshots: structuredClone(state.snapshots),
    notes: structuredClone(state.notes),
    tags: structuredClone(state.tags),
    generationMetadata: structuredClone(state.generationMetadata),
  }
  return JSON.stringify(project, null, 2)
}

export function parseProjectFile(text: string): ParsedProject {
  const parsed: unknown = JSON.parse(text)
  if (!isObject(parsed)) throw new Error('Project file must contain a JSON object.')
  if (parsed.projectVersion !== 1) throw new Error(`Unsupported project version: ${String(parsed.projectVersion)}`)
  if (!Array.isArray(parsed.moveset)) throw new Error('Project moveset must be an array.')
  if (parsed.moveset.some((slot) => !isObject(slot))) throw new Error('Every project moveset slot must be an object.')

  const slots = parsed.moveset as JJSSlot[]
  const baselineSlots = Array.isArray(parsed.baselineMoveset) ? parsed.baselineMoveset as JJSSlot[] : structuredClone(slots)
  const snapshots = Array.isArray(parsed.snapshots) ? parsed.snapshots.filter(isObject) as unknown as ProjectSnapshot[] : []
  const source = isObject(parsed.source) && (parsed.source.format === 'JJS_CHARACTER_CODE' || parsed.source.format === 'LOCAL_PROJECT')
    ? parsed.source as JJSProjectFile['source']
    : { format: 'LOCAL_PROJECT' as const }

  return {
    projectVersion: 1,
    projectId: typeof parsed.projectId === 'string' ? parsed.projectId : globalThis.crypto?.randomUUID?.() ?? String(Date.now()),
    projectName: typeof parsed.projectName === 'string' ? parsed.projectName : 'Opened Project',
    createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : new Date().toISOString(),
    modifiedAt: typeof parsed.modifiedAt === 'string' ? parsed.modifiedAt : new Date().toISOString(),
    source,
    moveset: slots,
    baselineMoveset: baselineSlots,
    snapshots,
    notes: isObject(parsed.notes) ? parsed.notes as Record<string, string> : {},
    tags: Array.isArray(parsed.tags) ? parsed.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    generationMetadata: isObject(parsed.generationMetadata) ? parsed.generationMetadata as unknown as Record<string, GenerationMetadata> : {},
    slots,
    data: parseNestedData(slots),
    baselineSlots,
    baselineData: parseNestedData(baselineSlots),
  }
}

export const AUTOSAVE_KEY = 'jjs-studio-autosave-v1'

export function writeAutosave(state: ProjectState, storage: Pick<Storage, 'setItem'> = localStorage): void {
  storage.setItem(AUTOSAVE_KEY, serializeProjectFile(state))
}

export function readAutosave(storage: Pick<Storage, 'getItem'> = localStorage): ParsedProject | null {
  const text = storage.getItem(AUTOSAVE_KEY)
  if (!text) return null
  try { return parseProjectFile(text) } catch { return null }
}

export function clearAutosave(storage: Pick<Storage, 'removeItem'> = localStorage): void {
  storage.removeItem(AUTOSAVE_KEY)
}
