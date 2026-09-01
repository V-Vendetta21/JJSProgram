import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { Zstd } from '@hpcc-js/wasm-zstd'

const [inputPath, outputPath] = process.argv.slice(2)
if (!inputPath || !outputPath) {
  console.error('usage: node tools/decode-sample.mjs INPUT_CODE OUTPUT_JSON')
  process.exit(2)
}

const code = (await readFile(inputPath, 'utf8')).replace(/\s+/g, '')
const compressed = Uint8Array.from(Buffer.from(code, 'base64'))
const raw = new TextDecoder('utf-8', { fatal: true }).decode((await Zstd.load()).decompress(compressed))
const parsed = JSON.parse(raw)
await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, JSON.stringify(parsed, null, 2) + '\n', 'utf8')

const kinds = {}
const nodes = {}
let nestedDataErrors = 0
for (const slot of parsed) {
  kinds[slot.K_NAME ?? '<missing>'] = (kinds[slot.K_NAME ?? '<missing>'] ?? 0) + 1
  try {
    const data = JSON.parse(slot.DATA)
    for (const node of data.Line ?? []) nodes[node.K_NAME ?? '<missing>'] = (nodes[node.K_NAME ?? '<missing>'] ?? 0) + 1
    for (const branch of Object.values(data.Branch ?? {})) {
      for (const node of branch.Line ?? []) nodes[node.K_NAME ?? '<missing>'] = (nodes[node.K_NAME ?? '<missing>'] ?? 0) + 1
    }
  } catch {
    nestedDataErrors += 1
  }
}
console.log(JSON.stringify({ slots: parsed.length, kinds, nodes, nestedDataErrors }, null, 2))
