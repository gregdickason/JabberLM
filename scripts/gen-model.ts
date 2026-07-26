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
import { buildMoeCorpus, buildSortCorpus, sortHeldOut } from '../src/data/tasks'
import { buildHarnessCorpusFull } from '../src/data/harnessTasks'
import { buildWarehouseCorpus, heldOutBaskets, warePrompt, warehouseReward } from '../src/data/warehouse'
import {
  buildTicTacToeCorpus, allDecisionStates, tacticalStates, sampleTrainState, trainingDeck, moveTarget, ticPrompt,
  parseMove, legalMoves, applyMove, winner, isTerminal, toMove, EMPTY, type Board, type Mark,
} from '../src/data/tictactoe'
import { evalExhaustive } from '../src/capstone/tictactoe-agent'
import { RNG } from '../src/engine/random'
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
// A small, fast DRAFT model for the speculative-decoding demo — same contextLen as the
// default target (so verification needs no window cropping) but far fewer params.
const DRAFTP: ModelConfig = { ...DEFAULT_MODEL_CONFIG, dModel: 24, nHeads: 2, nLayers: 2, contextLen: 48, dFF: 96 }
// Warehouse-agent capstone: tiny relational tool-using agent. ctx 96 (not 72) — the
// shorter context can't reliably copy the basket multiset into the plan (quantity errors);
// 96 is the proven config (held-out ~90%). Still a genuinely small ~25K model.
const WAREHOUSE: ModelConfig = { ...DEFAULT_MODEL_CONFIG, dModel: 32, nHeads: 2, nLayers: 2, contextLen: 96, dFF: 96 }
// Tic-tac-toe capstone agent: trained by MASKED SFT (loss on the move token only) on minimax
// games. Board is index-labelled ("0X1O2.…") so emitting a move is a copy, not a positional count.
const TICTAC: ModelConfig = { ...DEFAULT_MODEL_CONFIG, dModel: 64, nHeads: 4, nLayers: 3, contextLen: 32, dFF: 192 }
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
  evalAcc?: () => number // generic held-out accuracy readout (e.g. warehouse)
  evalLabel?: string
  sftBatch?: (bs: number) => { ids: number[]; start: number }[] // present ⇒ train with masked SFT
  distillBatch?: (bs: number) => { promptIds: number[]; digitTargets: number[] }[] // ⇒ soft-target distillation (tic-tac-toe)
}

// Tic-tac-toe DS — soft-target distillation of minimax's per-cell policy.
//  • WEAK (default): sample states with replacement, tactical-oversampled. Undersamples openings
//    (every game starts there) → the undertrained interpretability specimen.
//  • STRONG (`strong: true`): draw from the COVERAGE-BALANCED `trainingDeck` — every state each
//    pass + opening/ply oversampling + tactical. Same ~130K params; the difference is the DATA.
//    Eval switches to the exhaustive report over all ~4,520 states.
function tttDS(config: ModelConfig, file: string, strong = false): DS {
  const states = allDecisionStates()
  const tactical = tacticalStates() // game-deciding positions (win-now / block-now) — oversampled
  const brng = new RNG(999)
  // STRONG: a shuffled deck iterated sequentially (reshuffled each pass) ⇒ guaranteed exhaustive
  // coverage with the deck's built-in opening/tactical multiplicities.
  const deck = strong ? trainingDeck() : []
  const drng = new RNG(4242)
  const shuffleDeck = () => { for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(drng.next() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]] } }
  if (strong) shuffleDeck()
  let idx = 0
  const nextDeck = (): Board => { if (idx >= deck.length) { shuffleDeck(); idx = 0 } return deck[idx++] }
  const pickState = strong ? nextDeck : () => sampleTrainState(states, tactical, brng.next(), brng.next())
  return {
    corpus: buildTicTacToeCorpus(150000), // only builds the tokenizer vocab; training uses distillBatch
    file,
    seed: ticPrompt(EMPTY),
    config,
    evalLabel: 'TICTACTOE',
    // soft-target distillation of minimax's per-cell value policy
    distillBatch: (bs) =>
      Array.from({ length: bs }, () => {
        const b = pickState()
        return { promptIds: trainer.tok.encode(ticPrompt(b)), digitTargets: moveTarget(b) }
      }),
    // STRONG uses the exhaustive report (all states, by ply, vs random + vs perfect); the headline
    // number returned is notLost-vs-random, the full breakdown is logged as a side-line.
    evalAcc: strong
      ? () => { const e = evalExhaustive(trainer.model, trainer.tok, 60); console.log('  TICTACTOE ' + e.summary); return Math.round(e.notLostVsRandom) }
      : () => {
      const rng = new RNG(7)
      const agentMv = (b: Board): number => {
        const legal = legalMoves(b)
        // mirror the in-game harness: greedy, then re-sample on an illegal move, then fall back
        for (let k = 0; k < 5; k++) {
          const out = trainer.sample(DEFAULT_FEATURE_FLAGS, { ...DEFAULT_SAMPLE_CONFIG, temperature: k === 0 ? 0 : 0.9 }, ticPrompt(b), 2).split('\n')[0]
          const mv = parseMove(out)
          if (mv != null && legal.includes(mv)) return mv
        }
        return legal[0]
      }
      const randMv = (b: Board): number => { const l = legalMoves(b); return l[Math.floor(rng.next() * l.length)] }
      const N = 50
      let notLost = 0
      for (let g = 0; g < N; g++) {
        const agent: Mark = g % 2 ? 'O' : 'X'
        const opp: Mark = agent === 'X' ? 'O' : 'X'
        let b: Board = EMPTY
        while (!isTerminal(b)) { const mk = toMove(b); b = applyMove(b, mk === agent ? agentMv(b) : randMv(b), mk) }
        if (winner(b) !== opp) notLost++
      }
      return Math.round((100 * notLost) / N)
    },
  }
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
    case 'multitask-draft': {
      // tiny DRAFT trained on the SAME corpus as multitask-model.json → identical vocab
      // (CharTokenizer sorts unique chars), so it can be the speculative-decoding draft.
      const m = buildMultitaskCorpus()
      return { corpus: m.corpus, file: 'multitask-draft.json', seed: "'Twas ", config: DRAFTP, sortHeldOut: m.sortHeldOut }
    }
    case 'moe':
      return { corpus: buildMoeCorpus(30000), file: 'moe-model.json', seed: 'sort 6 9 2 => ', config: MOE, sortHeldOut: sortHeldOut() }
    case 'harness':
      return { corpus: buildHarnessCorpusFull(), file: 'harness-model.json', seed: 'sort 6 9 2 then reverse it => ', config: DEFAULTP }
    case 'sort':
      return { corpus: buildSortCorpus(), file: 'sort-model.json', seed: 'sort 6 9 2 => ', config: DEFAULTP, sortHeldOut: sortHeldOut() }
    case 'warehouse':
      return {
        corpus: buildWarehouseCorpus(60000),
        file: 'warehouse-model.json',
        seed: 'order: A C F => ',
        config: WAREHOUSE,
        evalLabel: 'WAREHOUSE',
        // held-out exact-match on baskets never trained on → the rule-generalisation signal
        evalAcc: () => {
          const baskets = heldOutBaskets()
          let ok = 0
          for (const b of baskets) {
            const prompt = warePrompt(b)
            const out = trainer.sample(DEFAULT_FEATURE_FLAGS, { ...DEFAULT_SAMPLE_CONFIG, temperature: 0 }, prompt, 64).split('\n')[0]
            if (warehouseReward(prompt, out) === 1) ok++
          }
          return Math.round((100 * ok) / baskets.length)
        },
      }
    case 'tictactoe':
      return tttDS(TICTAC, 'tictactoe-model.json')
    case 'tictactoe-strong':
      return tttDS(TICTAC, 'tictactoe-strong-model.json', true)
    default:
      throw new Error(`unknown DATASET '${name}' (expected: jabber, sonnets, multitask, moe, harness, sort, warehouse, tictactoe, tictactoe-strong)`)
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
  if (ds.evalAcc) {
    const plan = trainer.sample(DEFAULT_FEATURE_FLAGS, { ...DEFAULT_SAMPLE_CONFIG, temperature: 0 }, ds.seed, 64).split('\n')[0]
    extra = `\n  ${ds.evalLabel} held-out acc: ${ds.evalAcc()}%` + `\n  ${ds.seed}${plan}` + extra
  }
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
  last = ds.distillBatch
    ? trainer.distillMoveStep(TRAIN_CONFIG, DEFAULT_FEATURE_FLAGS, ds.distillBatch(TRAIN_CONFIG.batchSize)).loss
    : ds.sftBatch
      ? trainer.sftMaskedStep(TRAIN_CONFIG, DEFAULT_FEATURE_FLAGS, ds.sftBatch(TRAIN_CONFIG.batchSize)).loss
      : trainer.stepBatch(TRAIN_CONFIG, DEFAULT_FEATURE_FLAGS).loss
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
