import { create } from 'zustand'
import type { JJSData, JJSSlot, JsonObject } from '../codec/codec'
import type { GeneratedMoveResult, GenerationMetadata } from '../generation/types'

export interface UndoEntry {
  slots: JJSSlot[]
  data: JJSData[]
  generationMetadata: Record<string, GenerationMetadata>
  label: string
}

export interface ProjectSnapshot extends UndoEntry {
  id: string
  createdAt: string
}

interface OperationResult {
  ok: boolean
  error?: string
}

export interface ProjectState {
  projectId: string
  projectName: string
  createdAt: string
  modifiedAt: string
  slots: JJSSlot[]
  data: JJSData[]
  baselineSlots: JJSSlot[]
  baselineData: JJSData[]
  selectedSlot: number
  history: UndoEntry[]
  future: UndoEntry[]
  snapshots: ProjectSnapshot[]
  notes: Record<string, string>
  tags: string[]
  generationMetadata: Record<string, GenerationMetadata>
  dirty: boolean
  loadMoveset: (slots: JJSSlot[], data: JJSData[], name?: string) => void
  loadProject: (project: Partial<Pick<ProjectState, 'projectId' | 'projectName' | 'createdAt' | 'modifiedAt' | 'slots' | 'data' | 'baselineSlots' | 'baselineData' | 'snapshots' | 'notes' | 'tags' | 'generationMetadata'>>) => void
  renameProject: (name: string) => void
  selectSlot: (index: number) => void
  replaceRawJson: (rawJson: string) => OperationResult
  updateNestedData: (slotIndex: number, nextData: JJSData, label?: string) => void
  insertNode: (slotIndex: number, nodeIndex: number, node: JsonObject) => void
  duplicateNode: (slotIndex: number, nodeIndex: number) => void
  deleteNode: (slotIndex: number, nodeIndex: number) => void
  moveNode: (slotIndex: number, fromIndex: number, toIndex: number) => void
  insertGeneratedMove: (result: GeneratedMoveResult) => number
  replaceWithGeneratedMove: (slotIndex: number, result: GeneratedMoveResult) => void
  createSnapshot: (label: string) => string
  restoreSnapshot: (id: string) => void
  removeSnapshot: (id: string) => void
  undo: () => void
  redo: () => void
  markSaved: () => void
  reset: () => void
}

const clone = <T,>(value: T): T => structuredClone(value)
const now = () => new Date().toISOString()
const makeId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`

export function parseNestedData(slots: JJSSlot[]): JJSData[] {
  return slots.map((slot, index) => {
    if (typeof slot.DATA !== 'string') return {}
    const value: unknown = JSON.parse(slot.DATA)
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Slot ${index + 1} DATA must contain an object.`)
    return value as JJSData
  })
}

const makeInitial = () => {
  const timestamp = now()
  return {
    projectId: makeId(),
    projectName: 'Untitled Moveset',
    createdAt: timestamp,
    modifiedAt: timestamp,
    slots: [] as JJSSlot[],
    data: [] as JJSData[],
    baselineSlots: [] as JJSSlot[],
    baselineData: [] as JJSData[],
    selectedSlot: 0,
    history: [] as UndoEntry[],
    future: [] as UndoEntry[],
    snapshots: [] as ProjectSnapshot[],
    notes: {} as Record<string, string>,
    tags: [] as string[],
    generationMetadata: {} as Record<string, GenerationMetadata>,
    dirty: false,
  }
}

const initial = makeInitial()

function withNestedChange(current: ProjectState, slotIndex: number, nextData: JJSData, label: string) {
  if (!current.slots[slotIndex]) return null
  const slots = clone(current.slots)
  const data = clone(current.data)
  data[slotIndex] = clone(nextData)
  slots[slotIndex].DATA = JSON.stringify(nextData)
  return {
    slots,
    data,
    history: [...current.history, { slots: clone(current.slots), data: clone(current.data), generationMetadata: clone(current.generationMetadata), label }],
    future: [] as UndoEntry[],
    modifiedAt: now(),
    dirty: true,
  }
}

function lineFor(current: ProjectState, slotIndex: number): JsonObject[] | null {
  const line = current.data[slotIndex]?.Line
  return Array.isArray(line) ? line.filter((node): node is JsonObject => Boolean(node) && typeof node === 'object' && !Array.isArray(node)) : null
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  ...initial,
  loadMoveset: (slots, data, name = 'Imported Moveset') => {
    const timestamp = now()
    set({
      ...makeInitial(),
      projectName: name,
      createdAt: timestamp,
      modifiedAt: timestamp,
      slots: clone(slots),
      data: clone(data),
      baselineSlots: clone(slots),
      baselineData: clone(data),
    })
  },
  loadProject: (project) => {
    const slots = clone(project.slots ?? [])
    const data = clone(project.data ?? parseNestedData(slots))
    set({
      ...makeInitial(),
      projectId: project.projectId ?? makeId(),
      projectName: project.projectName ?? 'Opened Project',
      createdAt: project.createdAt ?? now(),
      modifiedAt: project.modifiedAt ?? now(),
      slots,
      data,
      baselineSlots: clone(project.baselineSlots ?? slots),
      baselineData: clone(project.baselineData ?? data),
      snapshots: clone(project.snapshots ?? []),
      notes: clone(project.notes ?? {}),
      tags: clone(project.tags ?? []),
      generationMetadata: clone(project.generationMetadata ?? {}),
      dirty: false,
    })
  },
  renameProject: (projectName) => set({ projectName: projectName.trim() || 'Untitled Moveset', modifiedAt: now(), dirty: true }),
  selectSlot: (selectedSlot) => set({ selectedSlot }),
  replaceRawJson: (rawJson) => {
    try {
      const parsed: unknown = JSON.parse(rawJson)
      if (!Array.isArray(parsed) || parsed.some((slot) => !slot || typeof slot !== 'object' || Array.isArray(slot))) throw new Error('Outer JSON must be an array of slot objects.')
      const slots = parsed as JJSSlot[]
      const data = parseNestedData(slots)
      const current = get()
      set({
        slots,
        data,
        history: [...current.history, { slots: clone(current.slots), data: clone(current.data), generationMetadata: clone(current.generationMetadata), label: 'Raw JSON edit' }],
        future: [],
        generationMetadata: {},
        dirty: true,
        modifiedAt: now(),
        selectedSlot: Math.min(current.selectedSlot, Math.max(0, slots.length - 1)),
      })
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Invalid JSON' }
    }
  },
  updateNestedData: (slotIndex, nextData, label = 'Edit move') => {
    const change = withNestedChange(get(), slotIndex, nextData, label)
    if (change) set(change)
  },
  insertNode: (slotIndex, nodeIndex, node) => {
    const current = get()
    const line = lineFor(current, slotIndex)
    if (!line) return
    const nextData = clone(current.data[slotIndex])
    const nextLine = clone(line)
    nextLine.splice(Math.max(0, Math.min(nodeIndex, nextLine.length)), 0, clone(node))
    nextData.Line = nextLine
    const change = withNestedChange(current, slotIndex, nextData, `Insert ${String(node.K_NAME ?? 'node')}`)
    if (change) set(change)
  },
  duplicateNode: (slotIndex, nodeIndex) => {
    const current = get()
    const line = lineFor(current, slotIndex)
    const node = line?.[nodeIndex]
    if (!line || !node) return
    const nextData = clone(current.data[slotIndex])
    const nextLine = clone(line)
    nextLine.splice(nodeIndex + 1, 0, clone(node))
    nextData.Line = nextLine
    const change = withNestedChange(current, slotIndex, nextData, `Duplicate ${String(node.K_NAME ?? 'node')}`)
    if (change) set(change)
  },
  deleteNode: (slotIndex, nodeIndex) => {
    const current = get()
    const line = lineFor(current, slotIndex)
    const node = line?.[nodeIndex]
    if (!line || !node) return
    const nextData = clone(current.data[slotIndex])
    const nextLine = clone(line)
    nextLine.splice(nodeIndex, 1)
    nextData.Line = nextLine
    const change = withNestedChange(current, slotIndex, nextData, `Delete ${String(node.K_NAME ?? 'node')}`)
    if (change) set(change)
  },
  moveNode: (slotIndex, fromIndex, toIndex) => {
    const current = get()
    const line = lineFor(current, slotIndex)
    if (!line || !line[fromIndex] || fromIndex === toIndex) return
    const nextData = clone(current.data[slotIndex])
    const nextLine = clone(line)
    const [node] = nextLine.splice(fromIndex, 1)
    nextLine.splice(Math.max(0, Math.min(toIndex, nextLine.length)), 0, node)
    nextData.Line = nextLine
    const change = withNestedChange(current, slotIndex, nextData, `Move ${String(node.K_NAME ?? 'node')}`)
    if (change) set(change)
  },
  insertGeneratedMove: (result) => {
    const current = get()
    const index = current.slots.length
    set({
      slots: [...clone(current.slots), clone(result.slot)],
      data: [...clone(current.data), clone(result.compiledMove)],
      selectedSlot: index,
      generationMetadata: { ...clone(current.generationMetadata), [String(index)]: clone(result.metadata) },
      history: [...current.history, { slots: clone(current.slots), data: clone(current.data), generationMetadata: clone(current.generationMetadata), label: `Generate ${result.plan.name}` }],
      future: [],
      modifiedAt: now(),
      dirty: true,
    })
    return index
  },
  replaceWithGeneratedMove: (slotIndex, result) => {
    const current = get()
    if (!current.slots[slotIndex]) return
    const slots = clone(current.slots)
    const data = clone(current.data)
    slots[slotIndex] = { ...slots[slotIndex], NAME: result.slot.NAME, DATA: result.slot.DATA }
    data[slotIndex] = clone(result.compiledMove)
    set({
      slots,
      data,
      selectedSlot: slotIndex,
      generationMetadata: { ...clone(current.generationMetadata), [String(slotIndex)]: clone(result.metadata) },
      history: [...current.history, { slots: clone(current.slots), data: clone(current.data), generationMetadata: clone(current.generationMetadata), label: `Replace with ${result.plan.name}` }],
      future: [],
      modifiedAt: now(),
      dirty: true,
    })
  },
  createSnapshot: (label) => {
    const current = get()
    const id = makeId()
    set({ snapshots: [...current.snapshots, { id, label: label.trim() || `Snapshot ${current.snapshots.length + 1}`, createdAt: now(), slots: clone(current.slots), data: clone(current.data), generationMetadata: clone(current.generationMetadata) }] })
    return id
  },
  restoreSnapshot: (id) => {
    const current = get()
    const snapshot = current.snapshots.find((entry) => entry.id === id)
    if (!snapshot) return
    set({
      slots: clone(snapshot.slots),
      data: clone(snapshot.data),
      generationMetadata: clone(snapshot.generationMetadata ?? {}),
      history: [...current.history, { slots: clone(current.slots), data: clone(current.data), generationMetadata: clone(current.generationMetadata), label: `Restore ${snapshot.label}` }],
      future: [],
      modifiedAt: now(),
      dirty: true,
    })
  },
  removeSnapshot: (id) => set((state) => ({ snapshots: state.snapshots.filter((entry) => entry.id !== id), dirty: true })),
  undo: () => {
    const current = get()
    const previous = current.history.at(-1)
    if (!previous) return
    set({
      slots: clone(previous.slots),
      data: clone(previous.data),
      generationMetadata: clone(previous.generationMetadata),
      history: current.history.slice(0, -1),
      future: [{ slots: clone(current.slots), data: clone(current.data), generationMetadata: clone(current.generationMetadata), label: previous.label }, ...current.future],
      modifiedAt: now(),
      dirty: true,
    })
  },
  redo: () => {
    const current = get()
    const next = current.future[0]
    if (!next) return
    set({
      slots: clone(next.slots),
      data: clone(next.data),
      generationMetadata: clone(next.generationMetadata),
      history: [...current.history, { slots: clone(current.slots), data: clone(current.data), generationMetadata: clone(current.generationMetadata), label: next.label }],
      future: current.future.slice(1),
      modifiedAt: now(),
      dirty: true,
    })
  },
  markSaved: () => set({ dirty: false }),
  reset: () => set(makeInitial()),
}))
