export interface DiffEntry {
  path: string
  before: unknown
  after: unknown
  kind: 'added' | 'removed' | 'changed'
}

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const same = (before: unknown, after: unknown) => Object.is(before, after)

export function structuralDiff(before: unknown, after: unknown, path = ''): DiffEntry[] {
  if (same(before, after)) return []
  if (Array.isArray(before) && Array.isArray(after)) {
    const result: DiffEntry[] = []
    const length = Math.max(before.length, after.length)
    for (let index = 0; index < length; index += 1) {
      const childPath = `${path}[${index}]`
      if (index >= before.length) result.push({ path: childPath, before: undefined, after: after[index], kind: 'added' })
      else if (index >= after.length) result.push({ path: childPath, before: before[index], after: undefined, kind: 'removed' })
      else result.push(...structuralDiff(before[index], after[index], childPath))
    }
    return result
  }
  if (isObject(before) && isObject(after)) {
    const result: DiffEntry[] = []
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()
    for (const key of keys) {
      const childPath = path ? `${path}.${key}` : key
      if (!(key in before)) result.push({ path: childPath, before: undefined, after: after[key], kind: 'added' })
      else if (!(key in after)) result.push({ path: childPath, before: before[key], after: undefined, kind: 'removed' })
      else result.push(...structuralDiff(before[key], after[key], childPath))
    }
    return result
  }
  return [{ path: path || '$', before, after, kind: 'changed' }]
}
