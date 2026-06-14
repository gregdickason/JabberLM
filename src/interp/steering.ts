import { Model } from '../engine/model'
import { CharTokenizer } from '../engine/tokenizer'
import { RNG } from '../engine/random'
import { DEFAULT_FEATURE_FLAGS, type SampleConfig } from '../engine/config'
import { lastRowLogits, sampleFromLogits } from '../engine/generate'

// Causal feature steering: clamp a direction into the residual stream during
// generation and watch the output change. This is the "Golden Gate Claude"
// demonstration — a feature you can read AND turn, which is what makes the
// interpretation mechanistic rather than merely observational.

export interface Steer {
  layer: number
  vec: Float32Array // unit direction in residual space
  strength: number
}

export function generateSteered(
  model: Model,
  tok: CharTokenizer,
  prompt: string,
  cfg: SampleConfig,
  rng: RNG,
  steer?: Steer,
): string {
  const ctx = model.cfg.contextLen
  let ids = tok.encode(prompt)
  if (ids.length === 0) ids = [0]
  const out: number[] = []
  for (let s = 0; s < cfg.maxNewTokens; s++) {
    const window = ids.slice(Math.max(0, ids.length - ctx))
    const { logits } = model.forward(window, DEFAULT_FEATURE_FLAGS, undefined, false, undefined, steer)
    const last = lastRowLogits(logits.data, logits.rows, logits.cols)
    const { chosen } = sampleFromLogits(last, cfg, rng)
    out.push(chosen)
    ids.push(chosen)
  }
  return tok.decode(out)
}

/** Typical L2 norm of the residual stream after a layer — used to scale steering
 *  so a single "strength" number is a multiple of the activation's own size
 *  (otherwise a unit direction is negligible against a large residual). */
export function residualScale(model: Model, ids: number[], layer: number): number {
  const L = Math.min(model.cfg.contextLen, Math.max(1, ids.length))
  const window = ids.slice(0, L)
  const { trace } = model.forward(window, DEFAULT_FEATURE_FLAGS, undefined, true)
  const m = trace!.layers[layer].afterMLPResid
  let sum = 0
  for (let r = 0; r < m.rows; r++) {
    let n = 0
    for (let i = 0; i < m.cols; i++) {
      const x = m.data[r * m.cols + i]
      n += x * x
    }
    sum += Math.sqrt(n)
  }
  return sum / m.rows
}

/** A single MLP neuron's write direction into the residual stream (row of W2). */
export function neuronWriteDirection(model: Model, layer: number, neuron: number): Float32Array {
  const W2 = model.layers[layer].W2 // dFF × dModel
  const d = W2.cols
  const v = new Float32Array(d)
  let n = 0
  for (let i = 0; i < d; i++) {
    const x = W2.data[neuron * d + i]
    v[i] = x
    n += x * x
  }
  n = Math.sqrt(n) || 1
  for (let i = 0; i < d; i++) v[i] /= n
  return v
}
