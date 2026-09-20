/**
 * Re-derive the structural half of `src/data/modelStats.ts` (params, dims, vocab)
 * straight from the bundled JSON files, and rewrite the GENERATED block in place.
 *
 * Run after any `gen:*` retrain:  npm run stats
 *
 * Measured figures (accuracy %) are NOT touched — they come from the eval scripts
 * and are updated by hand, because only a human can say what was measured on what.
 *
 * Plain .mjs (like build-guide.mjs) so it runs on node with no vite-node fetch.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const FILES = [
  ['multitask', 'multitask-model.json'],
  ['multitaskDraft', 'multitask-draft.json'],
  ['moe', 'moe-model.json'],
  ['sort', 'sort-model.json'],
  ['harness', 'harness-model.json'],
  ['adder', 'adder-model.json'],
  ['warehouse', 'warehouse-model.json'],
  ['tictactoe', 'tictactoe-model.json'],
  ['tictactoeStrong', 'tictactoe-strong-model.json'],
  ['classifier', 'classifier-model.json'],
]

const u = (n) => n.toLocaleString('en-US').replace(/,/g, '_')

const rows = FILES.map(([id, file]) => {
  const j = JSON.parse(readFileSync(`public/${file}`, 'utf8'))
  const params = (j.params ?? []).reduce((n, p) => n + (p.data ?? p.values ?? []).length, 0)
  const c = j.config ?? j.cfg
  const experts = c.nExperts && c.nExperts > 1 ? `, nExperts: ${c.nExperts}` : ''
  return (
    `  ${id}: { params: ${u(params)}, dModel: ${c.dModel}, nHeads: ${c.nHeads}, ` +
    `nLayers: ${c.nLayers}, contextLen: ${c.contextLen}, dFF: ${c.dFF}, vocab: ${c.vocabSize}${experts} },`
  )
})

const path = 'src/data/modelStats.ts'
const src = readFileSync(path, 'utf8')
const head =
  `const STRUCT: Record<BundleId, Pick<Bundle, 'params' | 'dModel' | 'nHeads' | 'nLayers' | ` +
  `'contextLen' | 'dFF' | 'vocab'> & { nExperts?: number }> = {`
const block = `// --- BEGIN GENERATED (npm run stats) ---\n${head}\n${rows.join('\n')}\n}\n// --- END GENERATED ---`
const marker = /\/\/ --- BEGIN GENERATED[\s\S]*?\/\/ --- END GENERATED ---/
if (!marker.test(src)) throw new Error('generated block not found in ' + path)
const out = src.replace(marker, block)
writeFileSync(path, out)
if (out === src) console.log('(no change — bundles match what was already there)')
console.log(`${path} updated from ${FILES.length} bundles:`)
for (const r of rows) console.log(r.trim())
