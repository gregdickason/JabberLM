import { Model } from './model'
import { Optimizer, type GradNorm } from './optimizer'
import { CharTokenizer } from './tokenizer'
import { RNG } from './random'
import { add, crossEntropy, scale } from './ops'
import { generate } from './generate'
import type { FeatureFlags, FineTuneConfig, ModelConfig, SampleConfig, TrainConfig } from './config'

// The training engine. Holds the model, tokenizer and optimizer, and runs one
// mini-batch per `stepBatch` call. The React layer drives the cooperative loop
// (a handful of these per animation frame) so the UI stays responsive and
// hyperparameters can change live.

export interface StepResult {
  loss: number
  gradNorm: number // global pre-clip gradient norm
  gradNorms: GradNorm[] // per-parameter, for the "watch it learn" bars
}

// A half-open `[start, end)` token range, and a train/validation partition of the
// corpus into such ranges (see Trainer.buildSplit).
type Interval = [number, number]
interface Split {
  train: Interval[]
  val: Interval[]
}

/** Coalesce touching/overlapping intervals (assumes input roughly ordered). */
function mergeAdjacent(ivs: Interval[]): Interval[] {
  if (ivs.length <= 1) return ivs
  const sorted = [...ivs].sort((a, b) => a[0] - b[0])
  const out: Interval[] = [sorted[0]]
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1]
    if (sorted[i][0] <= last[1]) last[1] = Math.max(last[1], sorted[i][1])
    else out.push(sorted[i])
  }
  return out
}

export class Trainer {
  readonly model: Model
  readonly tok: CharTokenizer
  readonly cfg: ModelConfig
  readonly text: string // the training corpus (used by the interpretability lab)
  private opt: Optimizer
  private ids: number[]
  private rng: RNG

  // LoRA fine-tuning: when active, training samples from `ftIds` (the fine-tune
  // text encoded with the base vocab), trains only the adapter optimizer `ftOpt`,
  // and forces the `lora` flag on so the overlay is in the graph.
  private ftOpt: Optimizer | null = null
  private ftIds: number[] | null = null
  fineTuneText: string | null = null

  // Cached train/validation split (see `splits`), keyed by corpus length · window · fraction.
  private splitCache: { key: string; split: Split } | null = null

  constructor(text: string, cfg: ModelConfig, seed = 1337) {
    this.text = text
    this.tok = new CharTokenizer(text)
    this.cfg = { ...cfg, vocabSize: this.tok.vocabSize }
    this.model = new Model(this.cfg, seed)
    this.opt = new Optimizer(this.model.params)
    this.ids = this.tok.encode(text)
    this.rng = new RNG(seed ^ 0x55aa)
  }

  get fineTuning(): boolean {
    return this.ftOpt != null
  }

  /** The token stream training currently samples from (fine-tune text or base corpus). */
  private activeIds(): number[] {
    return this.ftIds ?? this.ids
  }

  /**
   * Begin LoRA fine-tuning on `text` (encoded with the base vocabulary; out-of-vocab
   * chars are dropped). Attaches adapters, freezes the base, and builds an optimizer
   * over the adapters only. Throws if the fine-tune text is too short for one window.
   */
  startFineTune(opts: FineTuneConfig & { text: string; seed?: number }): void {
    const ids = this.tok.encode(opts.text)
    if (ids.length < 2) throw new Error('fine-tune text is too short (or all out-of-vocabulary)')
    this.model.enableLora({ rank: opts.rank, alpha: opts.alpha, targets: opts.targets, seed: opts.seed })
    this.ftIds = ids
    this.fineTuneText = opts.text
    this.ftOpt = new Optimizer(this.model.loraParams)
  }

  /** Stop fine-tuning: detach adapters and unfreeze the base model. */
  stopFineTune(): void {
    this.model.disableLora()
    this.ftOpt = null
    this.ftIds = null
    this.fineTuneText = null
  }

  /** Trainable vs total parameter counts (for the "training N of M weights" label). */
  paramCounts(): { trainable: number; total: number } {
    const base = this.model.params.reduce((n, p) => n + p.size, 0)
    const lora = this.model.loraParams.reduce((n, p) => n + p.size, 0)
    return { trainable: this.fineTuning ? lora : base, total: base + lora }
  }

  private windowLen(): number {
    return Math.min(this.cfg.contextLen, this.activeIds().length - 1)
  }

  /**
   * Train/validation split as sets of `[start, end)` intervals. Instead of holding
   * out a single tail (which, for a multi-section corpus, would be entirely the last
   * section), we cut the corpus into ~20 blocks and hand every M-th block to
   * validation — so held-out is a representative sample spread across ALL sections.
   * Training windows are sampled to lie ENTIRELY within a train interval, so there's
   * no leakage across a val block. Tiny corpora fall back to the old single-tail cut.
   * `fraction = 0` ⇒ the whole text is training data.
   */
  private buildSplit(L: number, fraction: number): Split {
    const len = this.activeIds().length
    if (fraction <= 0) return { train: [[0, len]], val: [] }
    const minBlock = Math.max(L + 2, 8) // each block must fit at least one window
    const nBlocks = Math.min(20, Math.floor(len / minBlock))
    if (nBlocks < 2) {
      // too small to interleave — single tail cut (previous behaviour)
      const cut = Math.max(L + 1, Math.floor(len * (1 - fraction)))
      return { train: [[0, cut]], val: cut < len ? [[cut, len]] : [] }
    }
    const M = Math.min(nBlocks, Math.max(2, Math.round(1 / fraction))) // every M-th block → val
    const blockLen = len / nBlocks
    const train: Interval[] = []
    const val: Interval[] = []
    for (let b = 0; b < nBlocks; b++) {
      const s = Math.round(b * blockLen)
      const e = b === nBlocks - 1 ? len : Math.round((b + 1) * blockLen)
      ;(b % M === M - 1 ? val : train).push([s, e])
    }
    if (val.length === 0) val.push(train.pop()!) // guarantee at least one of each
    if (train.length === 0) train.push(val.pop()!)
    return { train: mergeAdjacent(train), val: mergeAdjacent(val) }
  }

  private splits(L: number, fraction: number): Split {
    const key = `${this.activeIds().length}|${L}|${fraction}|${this.fineTuning ? 1 : 0}`
    if (this.splitCache?.key === key) return this.splitCache.split
    const split = this.buildSplit(L, fraction)
    this.splitCache = { key, split }
    return split
  }

  /** Train on one mini-batch of random windows; returns loss + grad norms. When
   *  fine-tuning, samples the fine-tune text, forces the LoRA overlay on, and steps
   *  only the adapter optimizer (the frozen base never moves). */
  stepBatch(trainCfg: TrainConfig, flags: FeatureFlags): StepResult {
    const ft = this.fineTuning
    const ids = this.activeIds()
    const useFlags = ft ? { ...flags, lora: true } : flags
    const opt = ft ? this.ftOpt! : this.opt
    const L = this.windowLen()
    if (L < 1) throw new Error('training text too short for the context length')

    const { train } = this.splits(L, trainCfg.validationFraction)
    // number of valid window starts per train interval (windows must fit inside one)
    const weights = train.map(([s, e]) => Math.max(0, e - s - L))
    const totalW = weights.reduce((a, b) => a + b, 0)
    let total: ReturnType<typeof crossEntropy>['loss'] | null = null
    const batch = Math.max(1, trainCfg.batchSize)
    for (let b = 0; b < batch; b++) {
      // pick a train interval (weighted by how many windows fit), then a start in it,
      // so every window lies entirely within the train region (no held-out leakage)
      let start = 0
      if (totalW > 0) {
        let r = this.rng.next() * totalW
        let iv = train[0]
        for (let k = 0; k < train.length; k++) {
          if (r < weights[k]) { iv = train[k]; break }
          r -= weights[k]
        }
        const [s, e] = iv
        const maxStart = e - L - 1
        start = maxStart <= s ? s : s + Math.floor(this.rng.next() * (maxStart - s + 1))
      }
      const window = ids.slice(start, start + L + 1)
      const input = window.slice(0, L)
      const target = window.slice(1, L + 1)
      const { logits } = this.model.forward(input, useFlags)
      const { loss } = crossEntropy(logits, target)
      total = total ? add(total, loss) : loss
    }
    const meanLoss = scale(total!, 1 / batch)

    // Backward fills grads on the frozen base too (the graph runs through it), so
    // clear both — but only the adapter optimizer steps.
    if (ft) this.opt.zeroGrad()
    opt.zeroGrad()
    meanLoss.backward()
    const gradNorm = opt.step(trainCfg)

    return { loss: meanLoss.data[0], gradNorm, gradNorms: opt.gradNorms() }
  }

  /**
   * Mean cross-entropy over the held-out validation region — forward only, so no
   * gradients are touched and weights are never updated. Uses a fixed set of
   * evenly-spaced windows so the curve is smooth and comparable across steps.
   * Returns null if the val region can't fit a single window.
   */
  evalValidation(flags: FeatureFlags, fraction: number): number | null {
    if (fraction <= 0) return null
    const ids = this.activeIds()
    const useFlags = this.fineTuning ? { ...flags, lora: true } : flags
    const L = this.windowLen()
    if (L < 1) return null
    const { val } = this.splits(L, fraction)
    if (val.length === 0) return null

    // Shrink the window if the largest val block is shorter than the context (loss
    // is a per-position mean, so it stays comparable to the training curve).
    const maxValLen = Math.max(...val.map(([s, e]) => e - s))
    const Lval = Math.min(L, maxValLen - 1)
    if (Lval < 1) return null

    // Evenly-spaced windows drawn from EVERY val block, so the metric reflects all
    // sections of the corpus rather than only its tail.
    const perBlock = Math.max(1, Math.ceil(24 / val.length))
    const starts: number[] = []
    for (const [s, e] of val) {
      const maxStart = e - Lval - 1
      if (maxStart < s) continue
      const span = maxStart - s
      const c = Math.min(perBlock, span + 1)
      for (let i = 0; i < c; i++) starts.push(c === 1 ? s : s + Math.round((span * i) / (c - 1)))
    }
    if (starts.length === 0) return null
    // cap to ~24 evenly-spaced windows for a stable, cheap curve
    const use =
      starts.length <= 24
        ? starts
        : Array.from({ length: 24 }, (_, i) => starts[Math.round(((starts.length - 1) * i) / 23)])

    let sum = 0
    for (const start of use) {
      const window = ids.slice(start, start + Lval + 1)
      const input = window.slice(0, Lval)
      const target = window.slice(1, Lval + 1)
      const { logits } = this.model.forward(input, useFlags)
      sum += crossEntropy(logits, target).loss.data[0]
    }
    return sum / use.length
  }

  /** The held-out `[start, end)` token ranges for a given fraction — spread across
   *  the corpus (see buildSplit). Empty when validation is off or won't fit. */
  heldOutRegions(fraction: number): [number, number][] {
    const L = this.windowLen()
    if (L < 1) return []
    return this.splits(L, fraction).val.map(([s, e]) => [s, e])
  }

  /** Generate a short preview continuation from a prompt. */
  sample(flags: FeatureFlags, sampleCfg: SampleConfig, prompt: string, maxNewTokens: number): string {
    return generate(this.model, flags, this.tok, prompt, { ...sampleCfg, maxNewTokens }, this.rng)
  }
}

// --- shared singleton: both panels operate on the same trained model ---------

let current: Trainer | null = null

export function rebuildTrainer(text: string, cfg: ModelConfig, seed = 1337): Trainer {
  current = new Trainer(text, cfg, seed)
  return current
}

export function getTrainer(): Trainer | null {
  return current
}

export function setTrainer(t: Trainer): void {
  current = t
}
