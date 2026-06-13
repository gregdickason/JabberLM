import { Model } from './model'
import { RNG } from './random'
import { CharTokenizer } from './tokenizer'
import type { FeatureFlags, SampleConfig } from './config'
import type { Trace } from './trace'

// Autoregressive sampling. Given logits for the last position we apply
// temperature, then optional top-k / top-p truncation, then sample. The
// KV-cache-accelerated variant lives alongside the cache in Phase 6; this is the
// straightforward recompute-every-step path used for training previews and the
// step-through inspector.

export interface SampledDistribution {
  /** Final sampling probabilities after temperature + top-k/top-p truncation. */
  probs: Float32Array
  chosen: number
}

/** Turn a row of logits into a sampled token, honouring the sampling config. */
export function sampleFromLogits(
  logits: Float32Array,
  cfg: SampleConfig,
  rng: RNG,
): SampledDistribution {
  const n = logits.length
  const temp = cfg.temperature

  // greedy when temperature is ~0
  if (temp <= 1e-6) {
    let best = 0
    for (let i = 1; i < n; i++) if (logits[i] > logits[best]) best = i
    const probs = new Float32Array(n)
    probs[best] = 1
    return { probs, chosen: best }
  }

  // softmax with temperature
  let max = -Infinity
  for (let i = 0; i < n; i++) max = Math.max(max, logits[i] / temp)
  const probs = new Float32Array(n)
  let sum = 0
  for (let i = 0; i < n; i++) {
    const e = Math.exp(logits[i] / temp - max)
    probs[i] = e
    sum += e
  }
  for (let i = 0; i < n; i++) probs[i] /= sum

  // rank indices by probability (descending) for top-k / top-p
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => probs[b] - probs[a])
  const keep = new Set<number>()
  if (cfg.topK != null) {
    for (let i = 0; i < Math.min(cfg.topK, n); i++) keep.add(order[i])
  }
  if (cfg.topP != null) {
    let cum = 0
    for (const idx of order) {
      keep.add(idx)
      cum += probs[idx]
      if (cum >= cfg.topP) break
    }
  }
  if (keep.size > 0) {
    let renorm = 0
    for (let i = 0; i < n; i++) {
      if (!keep.has(i)) probs[i] = 0
      renorm += probs[i]
    }
    if (renorm > 0) for (let i = 0; i < n; i++) probs[i] /= renorm
  }

  // sample
  let r = rng.next()
  let chosen = order[0]
  for (let i = 0; i < n; i++) {
    r -= probs[i]
    if (r <= 0) {
      chosen = i
      break
    }
  }
  return { probs, chosen }
}

/** Run a collecting forward over the context-cropped tail of `ids`. */
export function traceOf(
  model: Model,
  flags: FeatureFlags,
  ids: number[],
): { window: number[]; trace: Trace } {
  const ctx = model.cfg.contextLen
  const window = ids.slice(Math.max(0, ids.length - ctx))
  const { trace } = model.forward(window, flags, undefined, true)
  return { window, trace: trace! }
}

/** Take the last row of a (seq × vocab) logits buffer. */
export function lastRowLogits(data: Float32Array, rows: number, cols: number): Float32Array {
  return data.slice((rows - 1) * cols, rows * cols)
}

/**
 * Generate `maxNewTokens` characters from a prompt by recomputing the full
 * (context-cropped) forward each step. Returns the generated continuation only.
 */
export function generate(
  model: Model,
  flags: FeatureFlags,
  tok: CharTokenizer,
  prompt: string,
  cfg: SampleConfig,
  rng: RNG,
): string {
  const ctx = model.cfg.contextLen
  let ids = tok.encode(prompt)
  if (ids.length === 0) ids = [0] // seed with first vocab char if prompt is empty
  const out: number[] = []
  for (let step = 0; step < cfg.maxNewTokens; step++) {
    const window = ids.slice(Math.max(0, ids.length - ctx))
    const { logits } = model.forward(window, flags)
    const last = lastRowLogits(logits.data, logits.rows, logits.cols)
    const { chosen } = sampleFromLogits(last, cfg, rng)
    out.push(chosen)
    ids.push(chosen)
  }
  return tok.decode(out)
}
