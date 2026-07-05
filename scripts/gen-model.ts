// Generates a bundled pre-trained character model so the app works out of the box:
// inference / inspection (and the "Explained" page) run immediately without the
// visitor having to train anything.
//
//   DATASET=jabber    (default) -> public/jabber-model.json    (Jabber Poems, "largest")
//   DATASET=sonnets             -> public/sonnets-model.json   (Shakespeare sonnets, "largest")
//   DATASET=multitask           -> public/multitask-model.json (poems+algebra+sorting, "default")
//
// Run with `npm run gen:jabber` / `gen:sonnets` / `gen:multitask`. Trains on the
// corpus, rounds weights to 4 dp to keep the JSON small, and re-writes the model
// every CHECKPOINT_EVERY steps — a long background run is safe to stop at any point
// and always leaves a usable model. For multitask it also reports held-out SORT
// accuracy (the generalisation/grokking signal) at each checkpoint.

import { writeFileSync, mkdirSync } from 'node:fs'
import { Trainer } from '../src/engine/trainer'
import { serialize } from '../src/engine/persist'
import { JABBER_POEMS } from '../src/data/jabberPoems'
import { SHAKESPEARE_SONNETS } from '../src/data/shakespeare'
import { buildMultitaskCorpus, type SortVec } from './multitask-corpus'
import { buildMoeCorpus, sortHeldOut } from '../src/data/tasks'
import { buildHarnessCorpusFull } from '../src/data/harnessTasks'
import {
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_MODEL_CONFIG,
  DEFAULT_SAMPLE_CONFIG,
  DEFAULT_TRAIN_CONFIG,
  type ModelConfig,
  type TrainConfig,
} from '../src/engine/config'

const LARGEST: ModelConfig = { ...DEFAULT_MODEL_CONFIG, dModel: 96, nHeads: 4, nLayers: 4, contextLen: 128, dFF: 384 }
const DEFAULTP: ModelConfig = { ...DEFAULT_MODEL_CONFIG, dModel: 48, nHeads: 3, nLayers: 3, contextLen: 48, dFF: 192 }
// Mixture-of-Experts demo model: each layer's MLP is E expert FFNs + a gate.
const MOE: ModelConfig = {
  ...DEFAULT_MODEL_CONFIG,
  dModel: 48,
  nHeads: 3,
  nLayers: 3,
  contextLen: 48,
  dFF: 96,
  nExperts: Number(process.env.EXPERTS ?? 4),
}

interface DS {
  corpus: string
  file: string
  seed: string
  config: ModelConfig
  sortHeldOut?: SortVec[] // present for multitask -> enables the sort-accuracy eval
}
function makeDS(name: string): DS {
  switch (name) {
    case 'jabber':
      return { corpus: JABBER_POEMS, file: 'jabber-model.json', seed: "'Twas ", config: LARGEST }
    case 'sonnets':
      return { corpus: SHAKESPEARE_SONNETS, file: 'sonnets-model.json', seed: 'From ', config: LARGEST }
    case 'multitask': {
      const m = buildMultitaskCorpus()
      return { corpus: m.corpus, file: 'multitask-model.json', seed: "'Twas ", config: DEFAULTP, sortHeldOut: m.sortHeldOut }
    }
    case 'moe':
      return { corpus: buildMoeCorpus(30000), file: 'moe-model.json', seed: 'sort 6 9 2 => ', config: MOE, sortHeldOut: sortHeldOut() }
    case 'harness':
      return { corpus: buildHarnessCorpusFull(), file: 'harness-model.json', seed: 'sort 6 9 2 then reverse it => ', config: DEFAULTP }
    default:
      throw new Error(`unknown DATASET '${name}' (expected: jabber, sonnets, multitask, moe, harness)`)
  }
}
const DATASET = process.env.DATASET ?? 'jabber'
const ds = makeDS(DATASET)
const MODEL_CONFIG = ds.config

// Larger batch than the interactive default — we're offline and want signal, not
// frame-rate. Tune STEPS to trade wall-clock for quality (loss keeps falling).
const TRAIN_CONFIG: TrainConfig = {
  ...DEFAULT_TRAIN_CONFIG,
  batchSize: Number(process.env.BATCH ?? 32),
  learningRate: Number(process.env.LR ?? 0.005),
}
const STEPS = Number(process.env.STEPS ?? 6000)
const LOG_EVERY = Number(process.env.LOG_EVERY ?? 250)
const CHECKPOINT_EVERY = Number(process.env.CHECKPOINT_EVERY ?? 200)

const trainer = new Trainer(ds.corpus, MODEL_CONFIG, 1337)
const nParams = trainer.model.params.reduce((n, p) => n + p.rows * p.cols, 0)
console.log(
  `[gen-model:${DATASET}] ${nParams.toLocaleString()} params · vocab ${trainer.cfg.vocabSize} · ` +
    `${ds.corpus.length.toLocaleString()} chars · ${STEPS} steps`,
)

mkdirSync(new URL('../public/', import.meta.url), { recursive: true })
const out = new URL(`../public/${ds.file}`, import.meta.url)

// Held-out SORT exact-match accuracy — the generalisation signal for multitask.
function sortAccuracy(): number {
  if (!ds.sortHeldOut) return -1
  const sample = ds.sortHeldOut.slice(0, 80) // subset for speed
  let ok = 0
  for (const v of sample) {
    const want = [...v].sort((a, b) => a - b).join(' ')
    const out = trainer.sample(DEFAULT_FEATURE_FLAGS, { ...DEFAULT_SAMPLE_CONFIG, temperature: 0 }, `sort ${v.join(' ')} => `, 8)
    const got = (out.split('\n')[0].match(/\d(?: \d)*/) || [''])[0].trim()
    if (got === want) ok++
  }
  return Math.round((100 * ok) / sample.length)
}

// Serialize, round weights (keeps the bundled file small), write to disk. Default
// 4 dp; raise via ROUND_DP for precision-sensitive models (e.g. the harness model,
// whose agent loop copies fed-back results and is sensitive to weight rounding).
const ROUND_F = 10 ** Number(process.env.ROUND_DP ?? 4)
function writeModel(step: number, loss: number): void {
  const saved = serialize(trainer, ds.corpus)
  for (const p of saved.params) p.data = p.data.map((x) => Math.round(x * ROUND_F) / ROUND_F)
  const json = JSON.stringify(saved)
  writeFileSync(out, json)
  let extra = `\n--- sample ---\n${trainer.sample(DEFAULT_FEATURE_FLAGS, DEFAULT_SAMPLE_CONFIG, ds.seed, 160)}`
  if (ds.sortHeldOut) {
    const sortPrompt = `sort ${ds.sortHeldOut[0].join(' ')} => `
    const arith = trainer.sample(DEFAULT_FEATURE_FLAGS, { ...DEFAULT_SAMPLE_CONFIG, temperature: 0 }, '7x + 2 = 16 => ', 16).split('\n')[0]
    const sortOut = trainer.sample(DEFAULT_FEATURE_FLAGS, { ...DEFAULT_SAMPLE_CONFIG, temperature: 0 }, sortPrompt, 8).split('\n')[0]
    extra =
      `\n  SORT held-out acc: ${sortAccuracy()}%` +
      `\n  sort: ${sortPrompt}${sortOut}` +
      `\n  algebra (expect wrong): 7x + 2 = 16 => ${arith}` +
      extra
  }
  console.log(
    `[gen-model:${DATASET}] wrote public/${ds.file} @ step ${step} · loss ${loss.toFixed(3)} · ` +
      `${(json.length / 1e6).toFixed(2)} MB${extra}\n--------------`,
  )
}

const t0 = Date.now()
let last = 0
for (let i = 1; i <= STEPS; i++) {
  last = trainer.stepBatch(TRAIN_CONFIG, DEFAULT_FEATURE_FLAGS).loss
  if (i % LOG_EVERY === 0 || i === 1) {
    const secs = (Date.now() - t0) / 1000
    const rate = i / secs
    const eta = (STEPS - i) / rate
    console.log(
      `[gen-model:${DATASET}] step ${i}/${STEPS} · loss ${last.toFixed(3)} · ` +
        `${rate.toFixed(2)} steps/s · eta ${(eta / 60).toFixed(1)} min`,
    )
  }
  if (i % CHECKPOINT_EVERY === 0) writeModel(i, last)
}
writeModel(STEPS, last)
console.log(
  `[gen-model:${DATASET}] done in ${((Date.now() - t0) / 60000).toFixed(1)} min, final loss ${last.toFixed(3)}`,
)
