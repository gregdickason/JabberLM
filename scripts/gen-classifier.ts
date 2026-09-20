/**
 * Train the grocery-message classifier that drives the capstone's "embedded intelligence"
 * section, and write it to public/classifier-model.json.
 *
 *   npm run gen:classifier
 *
 * It is a typed decision, not a generator: the model is trained on `note <message> => <digit>`
 * lines, and at runtime the demo reads the logits for the eight category digits at the final
 * position and softmaxes over those alone. Same mechanism as the tic-tac-toe agent's nine cells,
 * and the same mechanism a commercial decision model sells.
 *
 * Reports held-out accuracy and, separately, what the model does on the deliberately ambiguous
 * messages — where the right behaviour is a SPLIT belief rather than a confident answer, because
 * those are the ones that should escalate to a person.
 */
import { writeFileSync } from 'node:fs'
import { Trainer } from '../src/engine/trainer'
import { DEFAULT_FEATURE_FLAGS, DEFAULT_MODEL_CONFIG, DEFAULT_TRAIN_CONFIG } from '../src/engine/config'
import { serialize } from '../src/engine/persist'
import {
  AMBIGUOUS,
  CATEGORIES,
  askPrompt,
  buildPackingCorpus,
  catIndex,
  demoMessages,
  heldOutMessages,
  trainMessages,
  type Message,
} from '../src/data/packing'
import type { Model } from '../src/engine/model'
import type { CharTokenizer } from '../src/engine/tokenizer'

const STEPS = Number(process.env.STEPS ?? 2500)
const LR = Number(process.env.LR ?? 0.006)
const BATCH = Number(process.env.BATCH ?? 24)
const OUT = process.env.FILE ?? 'public/classifier-model.json'

// Wide enough context to hold the longest message plus the prompt scaffolding.
const CFG = { ...DEFAULT_MODEL_CONFIG, dModel: 48, nHeads: 3, nLayers: 3, contextLen: 64, dFF: 192 }

/** The typed read: one forward pass, softmax over the eight category tokens only. */
export function classify(model: Model, tok: CharTokenizer, text: string): number[] {
  const ids = tok.encode(askPrompt(text))
  const { logits } = model.forward(
    ids.slice(Math.max(0, ids.length - model.cfg.contextLen)),
    DEFAULT_FEATURE_FLAGS,
  )
  const V = logits.cols
  const base = (logits.rows - 1) * V
  const raw = CATEGORIES.map((c) => {
    const id = tok.stoi.get(c.code)
    return id != null ? logits.data[base + id] : -Infinity
  })
  const mx = Math.max(...raw)
  const ex = raw.map((l) => (l === -Infinity ? 0 : Math.exp(l - mx)))
  const s = ex.reduce((a, b) => a + b, 0) || 1
  return ex.map((e) => e / s)
}

const top = (p: number[]) => p.reduce((a, _, i) => (p[i] > p[a] ? i : a), 0)

function score(model: Model, tok: CharTokenizer, set: Message[]) {
  let ok = 0
  for (const m of set) if (top(classify(model, tok, m.text)) === catIndex(m.label)) ok++
  return (100 * ok) / set.length
}

const TRAIN = trainMessages()
const HELD_OUT = heldOutMessages()
const text = buildPackingCorpus()
const t = new Trainer(text, CFG, 1337)
console.log(
  `corpus ${text.length} chars · vocab ${t.tok.vocabSize} · ${TRAIN.length} train / ${HELD_OUT.length} held-out / ${AMBIGUOUS.length} ambiguous`,
)

const trainCfg = { ...DEFAULT_TRAIN_CONFIG, learningRate: LR, batchSize: BATCH }
for (let s = 1; s <= STEPS; s++) {
  const { loss } = t.stepBatch(trainCfg, DEFAULT_FEATURE_FLAGS)
  if (s % 250 === 0 || s === STEPS) {
    console.log(
      `step ${String(s).padStart(4)} · loss ${loss.toFixed(4)} · train ${score(t.model, t.tok, TRAIN.slice(0, 120)).toFixed(1)}%` +
        ` · held-out ${score(t.model, t.tok, HELD_OUT).toFixed(1)}% (n=${HELD_OUT.length})`,
    )
  }
}

console.log('\nthe rows the demo shows:')
for (const m of demoMessages()) {
  const p = classify(t.model, t.tok, m.text)
  const i = top(p)
  const sorted = [...p.keys()].sort((a, b) => p[b] - p[a])
  const second = sorted[1]
  const mark = m.ambiguous ? 'AMBIG' : i === catIndex(m.label) ? '  ok ' : ' WRONG'
  console.log(
    `${mark} ${(100 * p[i]).toFixed(0).padStart(3)}% ${CATEGORIES[i].key.padEnd(9)}` +
      ` (then ${CATEGORIES[second].key} ${(100 * p[second]).toFixed(0)}%)  "${m.text}"`,
  )
}

writeFileSync(OUT, JSON.stringify(serialize(t, text)))
console.log(`\nwrote ${OUT}`)
