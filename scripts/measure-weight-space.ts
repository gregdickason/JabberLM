// Weight-space programming vs LoRA SFT vs RLVR, on the bundled sort model (ascending -> descending).
// Findings: docs/WEIGHT-SPACE-proposal.md. Run: node node_modules/vitest/node_modules/vite-node/vite-node.mjs scripts/measure-weight-space.ts [prog|lora|rl|all]
import { readFileSync } from 'node:fs'
import { deserialize, type SavedModel } from '../src/engine/persist'
import { DEFAULT_FEATURE_FLAGS, DEFAULT_TRAIN_CONFIG } from '../src/engine/config'
import { sortAccuracyDir } from '../src/interp/ablation'
import { sortHeldOut, sortTrainVecs, buildDescendingSortCorpus } from '../src/data/tasks'
import { ConvergenceGate } from '../src/lab/converged'
const raw = JSON.parse(readFileSync('public/sort-model.json', 'utf8')) as SavedModel
const load = () => deserialize(raw)
const heldAll = sortHeldOut(), held40 = heldAll.slice(0, 40)
const OFF = { ...DEFAULT_FEATURE_FLAGS, lora: false }, ON = { ...DEFAULT_FEATURE_FLAGS, lora: true }
const MODE = process.argv[2] ?? 'all'

if (MODE === 'all' || MODE === 'prog') {
  const t = load()
  console.log('vocab', JSON.stringify(t.tok.itos))
  console.log('base asc  held145', sortAccuracyDir(t.model, t.tok, heldAll, { descending: false }), ' held40', sortAccuracyDir(t.model, t.tok, held40, { descending: false }))
  console.log('base desc held145', sortAccuracyDir(t.model, t.tok, heldAll, { descending: true }))
  const t0 = performance.now()
  const E = t.model.tokenEmbed.data, d = t.model.cfg.dModel
  let changed = 0
  // vocab has digits 1-9 (no 0), so the mirror is d <-> 10-d; 5 maps to itself
  for (let k = 1; k <= 4; k++) {
    const a = t.tok.itos.indexOf(String(k)), b = t.tok.itos.indexOf(String(10 - k))
    if (a < 0 || b < 0) throw new Error('digit missing from vocab')
    for (let j = 0; j < d; j++) { const x = E[a * d + j]; E[a * d + j] = E[b * d + j]; E[b * d + j] = x; changed += 2 }
  }
  const ms = performance.now() - t0
  const total = t.model.params.reduce((s: number, p: any) => s + p.data.length, 0)
  console.log(`PROGRAMMED edit: ${ms.toFixed(3)} ms, ${changed} of ${total} weights (${(100 * changed / total).toFixed(2)}%)`)
  console.log('prog desc held145', sortAccuracyDir(t.model, t.tok, heldAll, { descending: true }), ' held40', sortAccuracyDir(t.model, t.tok, held40, { descending: true }))
  console.log('prog asc  held145 (should collapse)', sortAccuracyDir(t.model, t.tok, heldAll, { descending: false }))
}

if (MODE === 'all' || MODE === 'lora') {
  const t = load()
  const trainCfg = { ...DEFAULT_TRAIN_CONFIG, batchSize: 16, learningRate: 0.01 }
  t.startFineTune({ rank: 8, alpha: 16, targets: ['attn', 'mlp'], text: buildDescendingSortCorpus(), seed: 42 })
  console.log('lora trainable', JSON.stringify(t.paramCounts()))
  const gate = new ConvergenceGate({ window: 5, threshold: 90 })
  const iv = (s: number) => (s < 100 ? 20 : s < 600 ? 100 : 200)
  let trainMs = 0, last = 0, s = 0, first90 = -1
  const wall0 = performance.now()
  while (s < 4000) {
    const a = performance.now(); t.stepBatch(trainCfg, DEFAULT_FEATURE_FLAGS); trainMs += performance.now() - a; s++
    if (s - last >= iv(s)) {
      last = s
      const y = sortAccuracyDir(t.model, t.tok, held40, { descending: true, flags: ON })
      gate.record('desc', y)
      if (y >= 90 && first90 < 0) first90 = s
      console.log(`  lora step ${s} desc40 ${y}  train ${(trainMs / 1000).toFixed(1)}s`)
      if (gate.converged()) break
    }
  }
  console.log(`LORA: first>=90 at step ${first90}, gate at ${s}; train-only ${(trainMs / 1000).toFixed(1)}s, wall incl evals ${((performance.now() - wall0) / 1000).toFixed(1)}s`)
  console.log('lora desc held145', sortAccuracyDir(t.model, t.tok, heldAll, { descending: true, flags: ON }), ' asc off', sortAccuracyDir(t.model, t.tok, heldAll, { descending: false, flags: OFF }))
}

if (MODE === 'all' || MODE === 'rl') {
  const t = load()
  const trainCfg = { ...DEFAULT_TRAIN_CONFIG, batchSize: 16, learningRate: 5e-4 }
  const prompts = sortTrainVecs().slice(0, 150).map((v: number[]) => `sort ${v.join(' ')} => `)
  const descReward = (p: string, c: string) => {
    const m = p.match(/sort\s+(\d)\s+(\d)\s+(\d)/); if (!m) return 0
    const want = [m[1], m[2], m[3]].map(Number).sort((a, b) => b - a).join(' ')
    return ((c.split('\n')[0].match(/\d(?: \d)*/) || [''])[0].trim()) === want ? 1 : 0
  }
  let trainMs = 0
  for (let s = 1; s <= 600; s++) {
    const a = performance.now()
    const r = t.rlvrStep(trainCfg, DEFAULT_FEATURE_FLAGS, { prompts, groupSize: 6, temperature: 0.5, maxNew: 8, reward: descReward, promptsPerStep: 4 })
    trainMs += performance.now() - a
    if (s % 50 === 0) console.log(`  rl step ${s} meanReward ${r.meanReward.toFixed(3)} desc40 ${sortAccuracyDir(t.model, t.tok, held40, { descending: true })} train ${(trainMs / 1000).toFixed(1)}s`)
  }
}
