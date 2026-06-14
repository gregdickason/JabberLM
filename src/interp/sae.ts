import { Tensor } from '../engine/tensor'
import { RNG } from '../engine/random'
import { Optimizer } from '../engine/optimizer'
import { abs, add, addRow, matmul, mulElem, relu, scale, sub, sum } from '../engine/ops'
import type { TrainConfig } from '../engine/config'

// A small sparse autoencoder (dictionary learning), built from the same
// inspectable autograd engine as the model. It learns to reconstruct a layer's
// activations from a sparse combination of `nFeatures` learned directions —
// usually many more directions than the activation has dimensions. With an L1
// sparsity penalty, the features come out cleaner (more single-meaning) than raw
// neurons. This is the core technique behind Anthropic's monosemanticity work.

export interface SAEConfig {
  dAct: number
  nFeatures: number
  l1: number // sparsity penalty weight
  lr: number
}

export interface SAEStep {
  loss: number
  mse: number
  l0: number // average number of active features per token
}

const trainCfg = (lr: number): TrainConfig => ({
  optimizer: 'adamw',
  learningRate: lr,
  batchSize: 0,
  gradClip: 1,
  weightDecay: 0,
  sampleEverySteps: 0,
  validationFraction: 0,
  validationEverySteps: 0,
})

export class SAE {
  readonly cfg: SAEConfig
  private Wenc: Tensor // dAct × F
  private benc: Tensor // 1 × F
  private Wdec: Tensor // F × dAct
  private bdec: Tensor // 1 × dAct
  private opt: Optimizer
  private rng: RNG

  constructor(cfg: SAEConfig, seed = 7) {
    this.cfg = cfg
    this.rng = new RNG(seed)
    const { dAct, nFeatures } = cfg
    this.Wenc = Tensor.param(dAct, nFeatures, 1 / Math.sqrt(dAct), this.rng, 'Wenc')
    this.Wdec = Tensor.param(nFeatures, dAct, 1 / Math.sqrt(nFeatures), this.rng, 'Wdec')
    const benc = Tensor.zeros(1, nFeatures, 'benc')
    const bdec = Tensor.zeros(1, dAct, 'bdec')
    benc.requiresGrad = true
    bdec.requiresGrad = true
    this.benc = benc
    this.bdec = bdec
    this.opt = new Optimizer([this.Wenc, this.benc, this.Wdec, this.bdec])
  }

  /** One training step on a random batch of activation rows (acts is N × dAct). */
  trainStep(acts: Float32Array, N: number, batchSize: number): SAEStep {
    const { dAct } = this.cfg
    const B = Math.min(batchSize, N)
    const X = new Float32Array(B * dAct)
    for (let b = 0; b < B; b++) {
      const r = Math.floor(this.rng.next() * N)
      X.set(acts.subarray(r * dAct, r * dAct + dAct), b * dAct)
    }
    const Xt = new Tensor(X, B, dAct, 'X')

    const h = relu(addRow(matmul(Xt, this.Wenc), this.benc))
    const recon = addRow(matmul(h, this.Wdec), this.bdec)
    const diff = sub(recon, Xt)
    const mse = scale(sum(mulElem(diff, diff)), 1 / (B * dAct))
    const l1 = scale(sum(abs(h)), this.cfg.l1 / B)
    const loss = add(mse, l1)

    this.opt.zeroGrad()
    loss.backward()
    this.opt.step(trainCfg(this.cfg.lr))

    let active = 0
    for (let i = 0; i < h.size; i++) if (h.data[i] > 1e-6) active++
    return { loss: loss.data[0], mse: mse.data[0], l0: active / B }
  }

  /** Feature activations for every row of acts → (N × F), no grad. */
  encodeAll(acts: Float32Array, N: number): Float32Array {
    const { dAct, nFeatures: F } = this.cfg
    const out = new Float32Array(N * F)
    for (let r = 0; r < N; r++) {
      for (let f = 0; f < F; f++) {
        let s = this.benc.data[f]
        const base = r * dAct
        for (let i = 0; i < dAct; i++) s += acts[base + i] * this.Wenc.data[i * F + f]
        out[r * F + f] = s > 0 ? s : 0
      }
    }
    return out
  }

  /** Unit-norm decoder direction for a feature (its vector in activation space). */
  decoderDirection(feature: number): Float32Array {
    const { dAct } = this.cfg
    const v = new Float32Array(dAct)
    let norm = 0
    for (let i = 0; i < dAct; i++) {
      const x = this.Wdec.data[feature * dAct + i]
      v[i] = x
      norm += x * x
    }
    norm = Math.sqrt(norm) || 1
    for (let i = 0; i < dAct; i++) v[i] /= norm
    return v
  }
}
