import { Tensor } from './tensor'
import type { TrainConfig } from './config'

// Optimizers over the model's parameter list. AdamW keeps per-parameter first/
// second moment estimates; SGD is plain gradient descent. Both read their
// hyperparameters from TrainConfig at each step, so the learning rate (etc.) can
// be edited live mid-run.

interface AdamState {
  m: Float32Array
  v: Float32Array
}

export interface GradNorm {
  label: string
  norm: number
}

export class Optimizer {
  private params: Tensor[]
  private states: AdamState[]
  private t = 0
  private readonly beta1 = 0.9
  private readonly beta2 = 0.999
  private readonly eps = 1e-8

  constructor(params: Tensor[]) {
    this.params = params
    this.states = params.map((p) => ({
      m: new Float32Array(p.size),
      v: new Float32Array(p.size),
    }))
  }

  /** Global L2 norm of all gradients (before any clipping). */
  globalGradNorm(): number {
    let sum = 0
    for (const p of this.params) for (let i = 0; i < p.size; i++) sum += p.grad[i] * p.grad[i]
    return Math.sqrt(sum)
  }

  /** Per-parameter gradient norms — drives the "watch it learn" bars. */
  gradNorms(): GradNorm[] {
    return this.params.map((p) => {
      let s = 0
      for (let i = 0; i < p.size; i++) s += p.grad[i] * p.grad[i]
      return { label: p.label, norm: Math.sqrt(s) }
    })
  }

  /** Apply one update using the current gradients. Returns the pre-clip norm. */
  step(cfg: TrainConfig): number {
    const totalNorm = this.globalGradNorm()
    let clipScale = 1
    if (cfg.gradClip != null && totalNorm > cfg.gradClip) clipScale = cfg.gradClip / (totalNorm + 1e-6)

    this.t += 1
    const lr = cfg.learningRate
    if (cfg.optimizer === 'sgd') {
      for (const p of this.params)
        for (let i = 0; i < p.size; i++) p.data[i] -= lr * p.grad[i] * clipScale
      return totalNorm
    }

    // AdamW
    const bc1 = 1 - Math.pow(this.beta1, this.t)
    const bc2 = 1 - Math.pow(this.beta2, this.t)
    for (let pi = 0; pi < this.params.length; pi++) {
      const p = this.params[pi]
      const st = this.states[pi]
      for (let i = 0; i < p.size; i++) {
        const g = p.grad[i] * clipScale
        st.m[i] = this.beta1 * st.m[i] + (1 - this.beta1) * g
        st.v[i] = this.beta2 * st.v[i] + (1 - this.beta2) * g * g
        const mHat = st.m[i] / bc1
        const vHat = st.v[i] / bc2
        // decoupled weight decay
        p.data[i] -= lr * (mHat / (Math.sqrt(vHat) + this.eps) + cfg.weightDecay * p.data[i])
      }
    }
    return totalNorm
  }

  zeroGrad(): void {
    for (const p of this.params) p.zeroGrad()
  }
}
