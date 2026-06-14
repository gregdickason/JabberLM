// Generates public/demo-model.json — a small Jabberwocky model trained once so
// the "Explained" page works even when a visitor hasn't trained anything. Run
// with `npm run gen:demo` (vite-node resolves the TS engine imports).
//
// Weights are rounded to 4 dp to keep the bundled file small; that's plenty for
// the qualitative demos (next-token probabilities, temperature, attention).

import { writeFileSync, mkdirSync } from 'node:fs'
import { Trainer } from '../src/engine/trainer'
import { serialize } from '../src/engine/persist'
import { JABBERWOCKY } from '../src/data/jabberwocky'
import {
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_MODEL_CONFIG,
  DEFAULT_TRAIN_CONFIG,
} from '../src/engine/config'

const STEPS = 900

const trainer = new Trainer(JABBERWOCKY, DEFAULT_MODEL_CONFIG, 1337)
let last = 0
for (let i = 0; i < STEPS; i++) {
  last = trainer.stepBatch(DEFAULT_TRAIN_CONFIG, DEFAULT_FEATURE_FLAGS).loss
}
console.log(`[gen-demo] trained ${STEPS} steps, final loss ${last.toFixed(3)}`)

const saved = serialize(trainer, JABBERWOCKY)
// shrink: round each weight to 4 decimal places
for (const p of saved.params) p.data = p.data.map((x) => Math.round(x * 1e4) / 1e4)

mkdirSync(new URL('../public/', import.meta.url), { recursive: true })
const out = new URL('../public/demo-model.json', import.meta.url)
writeFileSync(out, JSON.stringify(saved))
console.log(`[gen-demo] wrote public/demo-model.json (${saved.params.length} params)`)
