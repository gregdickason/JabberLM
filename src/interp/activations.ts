import { Model } from '../engine/model'
import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from '../engine/config'

// Run the model over its whole training corpus and collect internal activations.
// We use non-overlapping windows of the context length (a handful of forward
// passes), recording every position's MLP hidden activations and post-block
// residual vectors. Concatenated in order, position p corresponds exactly to
// token id p in the original stream.

export interface ActivationSweep {
  ids: number[]
  N: number
  dFF: number
  dModel: number
  nLayers: number
  mlp: Float32Array[] // [layer] -> (N × dFF) row-major
  resid: Float32Array[] // [layer] -> (N × dModel) row-major (residual after the block)
}

export function sweepActivations(
  model: Model,
  ids: number[],
  flags: FeatureFlags = DEFAULT_FEATURE_FLAGS,
): ActivationSweep {
  const L = Math.min(model.cfg.contextLen, Math.max(1, ids.length))
  const nLayers = model.cfg.nLayers
  const dFF = model.cfg.dFF
  const dModel = model.cfg.dModel
  const N = ids.length

  const mlp = Array.from({ length: nLayers }, () => new Float32Array(N * dFF))
  const resid = Array.from({ length: nLayers }, () => new Float32Array(N * dModel))

  let written = 0
  for (let start = 0; start < N; start += L) {
    const window = ids.slice(start, Math.min(start + L, N))
    const { trace } = model.forward(window, flags, undefined, true)
    const w = window.length
    for (let l = 0; l < nLayers; l++) {
      mlp[l].set(trace!.layers[l].mlpHidden.data.subarray(0, w * dFF), written * dFF)
      resid[l].set(trace!.layers[l].afterMLPResid.data.subarray(0, w * dModel), written * dModel)
    }
    written += w
  }

  return { ids, N, dFF, dModel, nLayers, mlp, resid }
}

/** Pull one neuron's activation across all positions: column `unit` of layer `l`. */
export function neuronColumn(sweep: ActivationSweep, layer: number, unit: number): Float32Array {
  const out = new Float32Array(sweep.N)
  const d = sweep.dFF
  const m = sweep.mlp[layer]
  for (let p = 0; p < sweep.N; p++) out[p] = m[p * d + unit]
  return out
}
