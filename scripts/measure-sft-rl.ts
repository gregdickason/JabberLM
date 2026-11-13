// SFT is university, RL is the job — measured on the RLVR tab's own recipe (RlvrSection.tsx).
// Arms, all from the same fresh sort model (seed via argv):
//   cold   — RL from scratch, no warm-up: is there any reward to learn from?
//   strict — SFT warm-up to >=55% held-out, then RL on the exact-match sortReward (the tab)
//   loose  — same warm-up, then RL on a reward that only checks "three digits, in order"
//   sft    — same warm-up, then MORE SFT for the same number of steps (the control)
// Run: node node_modules/vitest/node_modules/vite-node/vite-node.mjs scripts/measure-sft-rl.ts [arm] [seed]
import { Trainer } from '../src/engine/trainer'
import { DEFAULT_FEATURE_FLAGS, DEFAULT_TRAIN_CONFIG, type ModelConfig } from '../src/engine/config'
import { sortAccuracy, sortReward } from '../src/interp/ablation'
import { buildSortCorpus, sortHeldOut, sortTrainVecs } from '../src/data/tasks'

const CFG: ModelConfig = { vocabSize: 0, dModel: 32, nHeads: 2, nLayers: 2, contextLen: 32, dFF: 128, activation: 'gelu', weightTying: true }
const ARM = process.argv[2] ?? 'strict'
const SEED = Number(process.argv[3] ?? 3)
const RL_STEPS = 900
const held = sortHeldOut()
const prompts = sortTrainVecs().slice(0, 150).map((v) => `sort ${v.join(' ')} => `)
const warmCfg = { ...DEFAULT_TRAIN_CONFIG, batchSize: 16, learningRate: 0.01 }
const rlCfg = { ...DEFAULT_TRAIN_CONFIG, batchSize: 1, learningRate: 0.0005 }
const firstLine = (c: string) => (c.split('\n')[0].match(/\d(?: \d)*/) || [''])[0].trim()

// The loose verifier: right shape, non-decreasing. Never checks the digits are the prompt's.
const looseReward = (_p: string, c: string) => {
  const d = firstLine(c).split(' ').map(Number)
  return d.length === 3 && d[0] <= d[1] && d[1] <= d[2] ? 1 : 0
}
const t = new Trainer(buildSortCorpus(), CFG, SEED)
const acc = () => sortAccuracy(t.model, t.tok, held)
let step = 0
if (ARM !== 'cold') {
  while (true) {
    t.stepBatch(warmCfg, DEFAULT_FEATURE_FLAGS); step++
    if (step % 100 === 0) {
      const a = acc()
      if (a >= 55 || step >= 3000) { console.log(`warm-up done at step ${step}: held-out ${a}%`); break }
    }
  }
}
console.log(`${ARM} seed ${SEED} start: held-out ${acc()}%`)
const t0 = performance.now()
for (let s = 1; s <= RL_STEPS; s++) {
  let mean = NaN
  if (ARM === 'sft') t.stepBatch(warmCfg, DEFAULT_FEATURE_FLAGS)
  else {
    const r = t.rlvrStep(rlCfg, DEFAULT_FEATURE_FLAGS, {
      prompts, groupSize: 6, temperature: 0.5, maxNew: 8,
      reward: ARM === 'loose' ? looseReward : sortReward, promptsPerStep: 4,
    })
    mean = r.meanReward
    if (s % 150 === 0) {
      const strictMean = r.samples.reduce((n, x) => n + sortReward(x.prompt, x.completion), 0) / r.samples.length
      console.log(`  samples: reward ${mean.toFixed(2)} | actually sorted ${strictMean.toFixed(2)} | e.g. ${r.samples.slice(0, 3).map((x) => JSON.stringify(x.prompt + firstLine(x.completion))).join(' ')}`)
    }
  }
  if (s % 150 === 0) console.log(`${ARM} step ${s}: held-out ${acc()}%  reward ${isNaN(mean) ? '-' : mean.toFixed(2)}  ${((performance.now() - t0) / 1000).toFixed(0)}s`)
}
