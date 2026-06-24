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
   * Index that splits train `[0, trainEnd)` from held-out validation
   * `[trainEnd, len)`. `fraction = 0` ⇒ the whole text is training data. We never
   * shrink the train region below one window, so validation degrades gracefully
   * if the fraction is set too high for the text + context length.
   */
  private trainEnd(L: number, fraction: number): number {
    const len = this.activeIds().length
    if (fraction <= 0) return len
    const cut = Math.floor(len * (1 - fraction))
    return Math.max(L + 1, cut)
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

    const trainEnd = this.trainEnd(L, trainCfg.validationFraction)
    let total: ReturnType<typeof crossEntropy>['loss'] | null = null
    const batch = Math.max(1, trainCfg.batchSize)
    for (let b = 0; b < batch; b++) {
      // sample only from the train region: windows span [start, start+L] < trainEnd
      const maxStart = trainEnd - 1 - L
      const start = maxStart <= 0 ? 0 : Math.floor(this.rng.next() * (maxStart + 1))
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
    const len = ids.length
    const L = this.windowLen()
    if (L < 1) return null
    const trainEnd = this.trainEnd(L, fraction)
    const valLen = len - trainEnd
    if (valLen < 2) return null // not even a 1-step window of held-out data

    // If the held-out region is shorter than the training context, evaluate on a
    // proportionally shorter window so validation still works (loss is a
    // per-position mean, so it stays comparable to the training curve).
    const Lval = Math.min(L, valLen - 1)
    const maxStart = len - 1 - Lval
    if (maxStart < trainEnd) return null

    const span = maxStart - trainEnd
    const count = Math.min(24, span + 1)
    let sum = 0
    for (let i = 0; i < count; i++) {
      const start = count === 1 ? trainEnd : trainEnd + Math.round((span * i) / (count - 1))
      const window = ids.slice(start, start + Lval + 1)
      const input = window.slice(0, Lval)
      const target = window.slice(1, Lval + 1)
      const { logits } = this.model.forward(input, useFlags)
      sum += crossEntropy(logits, target).loss.data[0]
    }
    return sum / count
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
