import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

const [inputPath, outputPath] = process.argv.slice(2)
if (!inputPath || !outputPath) {
  console.error('usage: node tools/harvest.mjs INPUT_JSON OUTPUT_OBSERVATIONS_JSON')
  process.exit(2)
}

const slots = JSON.parse(await readFile(inputPath, 'utf8'))
const types = (value) => value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value
const add = (catalog, name, value) => {
  const entry = catalog[name] ??= { occurrences: 0, fields: {} }
  entry.occurrences += 1
  for (const [field, fieldValue] of Object.entries(value)) {
    const fieldEntry = entry.fields[field] ??= { occurrences: 0, types: {}, observedValues: [] }
    fieldEntry.occurrences += 1
    const type = types(fieldValue)
    fieldEntry.types[type] = (fieldEntry.types[type] ?? 0) + 1
    const compact = JSON.stringify(fieldValue)
    if (compact.length <= 120 && !fieldEntry.observedValues.some((seen) => JSON.stringify(seen) === compact) && fieldEntry.observedValues.length < 12) {
      fieldEntry.observedValues.push(fieldValue)
    }
  }
}

const result = {
  source: inputPath,
  slotCount: slots.length,
  slotTypes: {},
  nodeTypes: {},
  conditionTypes: {},
  properties: {},
  dataTopLevelFields: {},
  branchNames: [],
}

for (const slot of slots) {
  add(result.slotTypes, String(slot.K_NAME ?? '<missing>'), slot)
  const data = typeof slot.DATA === 'string' ? JSON.parse(slot.DATA) : {}
  for (const [field, value] of Object.entries(data)) {
    const entry = result.dataTopLevelFields[field] ??= { occurrences: 0, types: {} }
    entry.occurrences += 1
    const type = types(value)
    entry.types[type] = (entry.types[type] ?? 0) + 1
  }
  for (const node of data.Line ?? []) add(result.nodeTypes, String(node.K_NAME ?? '<missing>'), node)
  for (const condition of data.Req ?? []) add(result.conditionTypes, String(condition.K_NAME ?? '<missing>'), condition)
  for (const [property, value] of Object.entries(data.Prop ?? {})) {
    const entry = result.properties[property] ??= { occurrences: 0, types: {}, observedValues: [] }
    entry.occurrences += 1
    const type = types(value)
    entry.types[type] = (entry.types[type] ?? 0) + 1
    if (!entry.observedValues.some((seen) => JSON.stringify(seen) === JSON.stringify(value))) entry.observedValues.push(value)
  }
  for (const [name, branch] of Object.entries(data.Branch ?? {})) {
    result.branchNames.push(name)
    for (const node of branch.Line ?? []) add(result.nodeTypes, String(node.K_NAME ?? '<missing>'), node)
    for (const condition of branch.Req ?? []) add(result.conditionTypes, String(condition.K_NAME ?? '<missing>'), condition)
  }
}
result.branchNames = [...new Set(result.branchNames)]
await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, JSON.stringify(result, null, 2) + '\n', 'utf8')
console.log(`harvested ${Object.keys(result.nodeTypes).length} node types, ${Object.keys(result.slotTypes).length} slot types, and ${result.branchNames.length} branch names`)
