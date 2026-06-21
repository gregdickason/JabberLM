// Generates a bundled pre-trained character model so the app works out of the box:
// inference / inspection (and the "Explained" page) run immediately without the
// visitor having to train anything.
//
//   DATASET=jabber  (default) -> public/jabber-model.json   (Jabber Poems set)
//   DATASET=sonnets           -> public/sonnets-model.json  (Shakespeare sonnets)
//
// Run with `npm run gen:jabber` or `npm run gen:sonnets` (vite-node resolves the
// TS engine imports). Both use the ~0.46M-param "largest" preset and train on the
// full corpus (no held-out split) to maximise the learned style, then round each
// weight to 4 dp to keep the bundled JSON small. Pure-JS training is slow, so the
// model is re-written every CHECKPOINT_EVERY steps — a long background run is safe
// to stop at any point and always leaves a usable, recently-trained model.

import { writeFileSync, mkdirSync } from 'node:fs'
import { Trainer } from '../src/engine/trainer'
import { serialize } from '../src/engine/persist'
import { JABBER_POEMS } from '../src/data/jabberPoems'
import { SHAKESPEARE_SONNETS } from '../src/data/shakespeare'
import {
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_MODEL_CONFIG,
  DEFAULT_SAMPLE_CONFIG,
  DEFAULT_TRAIN_CONFIG,
  type ModelConfig,
  type TrainConfig,
} from '../src/engine/config'

const DATASETS: Record<string, { corpus: string; file: string; seed: string }> = {
  jabber: { corpus: JABBER_POEMS, file: 'jabber-model.json', seed: "'Twas " },
  sonnets: { corpus: SHAKESPEARE_SONNETS, file: 'sonnets-model.json', seed: 'From ' },
}
const DATASET = process.env.DATASET ?? 'jabber'
const ds = DATASETS[DATASET]
if (!ds) throw new Error(`unknown DATASET '${DATASET}' (expected: ${Object.keys(DATASETS).join(', ')})`)

// Matches the "largest" preset in ConfigSidebar (~0.46M params).
const MODEL_CONFIG: ModelConfig = {
  ...DEFAULT_MODEL_CONFIG,
  dModel: 96,
  nHeads: 4,
  nLayers: 4,
  contextLen: 128,
  dFF: 384,
}

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

// Serialize, round weights to 4 dp (keeps the bundled file small), write to disk.
function writeModel(step: number, loss: number): void {
  const saved = serialize(trainer, ds.corpus)
  for (const p of saved.params) p.data = p.data.map((x) => Math.round(x * 1e4) / 1e4)
  const json = JSON.stringify(saved)
  writeFileSync(out, json)
  const sample = trainer.sample(DEFAULT_FEATURE_FLAGS, DEFAULT_SAMPLE_CONFIG, ds.seed, 160)
  console.log(
    `[gen-model:${DATASET}] wrote public/${ds.file} @ step ${step} · loss ${loss.toFixed(3)} · ` +
      `${(json.length / 1e6).toFixed(2)} MB\n--- sample ---\n${sample}\n--------------`,
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
