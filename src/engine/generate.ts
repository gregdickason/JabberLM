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

/** Greedy argmax of one row `r` of a (seq × cols) logits buffer. */
function argmaxRow(data: Float32Array, r: number, cols: number): number {
  const base = r * cols
  let best = 0
  for (let i = 1; i < cols; i++) if (data[base + i] > data[base + best]) best = i
  return best
}

// ---- speculative decoding --------------------------------------------------
// A small DRAFT proposes K tokens; the big TARGET verifies all K in ONE forward
// (its logits at every position say what it would have produced there). Accept the
// longest matching prefix; on the first mismatch keep the target's own token; if all
// K match, the target's next-position logits give a free "bonus" token. Greedy, so the
// output is BIT-FOR-BIT identical to running the target alone — just fewer target passes.

export type SpecKind = 'accepted' | 'correction' | 'bonus'
export interface SpecToken {
  id: number
  kind: SpecKind
}
export interface SpecRound {
  proposed: number[] // the draft's K guesses
  accepted: number // how many matched the target (prefix length)
  emitted: SpecToken[] // tokens actually kept this round (accepted + 1 correction/bonus)
}
export interface SpecResult {
  text: string
  tokens: SpecToken[] // the full generated stream, each tagged by how it was produced
  rounds: SpecRound[]
  targetForwards: number // expensive passes actually run (naive would be tokens.length)
  draftForwards: number // cheap passes
}

/**
 * Speculative decoding (greedy). Generates up to `maxNewTokens`, capped so
 * prompt+generated+K never exceeds the context (no window cropping) — which keeps the
 * output provably identical to `generate(target, greedy)`. Returns the token stream
 * tagged accepted/correction/bonus plus forward-pass counts for the demo.
 */
export function speculativeGenerate(
  draft: Model,
  target: Model,
  tok: CharTokenizer,
  prompt: string,
  flags: FeatureFlags,
  maxNewTokens: number,
  K: number,
): SpecResult {
  const ctx = target.cfg.contextLen
  let ids = tok.encode(prompt)
  if (ids.length === 0) ids = [0]
  ids = ids.slice(Math.max(0, ids.length - ctx))
  const tokens: SpecToken[] = []
  const rounds: SpecRound[] = []
  let targetForwards = 0
  let draftForwards = 0

  while (tokens.length < maxNewTokens && ids.length < ctx) {
    const W = ids.length // context length this round (captured before we append)
    const kThis = Math.min(K, maxNewTokens - tokens.length, ctx - W)
    if (kThis <= 0) break

    // 1. draft proposes kThis tokens autoregressively (cheap)
    const proposed: number[] = []
    const dctx = draft.cfg.contextLen
    const dids = ids.slice()
    for (let k = 0; k < kThis; k++) {
      const dwin = dids.slice(Math.max(0, dids.length - dctx))
      const { logits } = draft.forward(dwin, flags)
      draftForwards++
      const t = argmaxRow(logits.data, logits.rows - 1, logits.cols)
      proposed.push(t)
      dids.push(t)
    }

    // 2. target verifies all proposed tokens in ONE forward over [ids, proposed]
    const { logits: tl } = target.forward(ids.concat(proposed), flags)
    targetForwards++

    // 3. accept the longest matching prefix; correct the first mismatch
    const emitted: SpecToken[] = []
    let rejected = false
    for (let k = 0; k < proposed.length; k++) {
      const tChoice = argmaxRow(tl.data, W - 1 + k, tl.cols) // target's own pick at this position
      if (tChoice === proposed[k]) {
        emitted.push({ id: proposed[k], kind: 'accepted' })
        ids.push(proposed[k])
      } else {
        emitted.push({ id: tChoice, kind: 'correction' })
        ids.push(tChoice)
        rejected = true
        break
      }
      if (tokens.length + emitted.length >= maxNewTokens) break
    }
    // 4. all accepted → the target's next-position logits are a free bonus token
    if (!rejected && emitted.length === proposed.length && tokens.length + emitted.length < maxNewTokens && ids.length < ctx) {
      const bonus = argmaxRow(tl.data, W - 1 + proposed.length, tl.cols)
      emitted.push({ id: bonus, kind: 'bonus' })
      ids.push(bonus)
    }

    tokens.push(...emitted)
    rounds.push({ proposed, accepted: emitted.filter((e) => e.kind === 'accepted').length, emitted })
    if (emitted.length === 0) break // safety
  }

  return { text: tok.decode(tokens.map((t) => t.id)), tokens, rounds, targetForwards, draftForwards }
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
  ablate?: ReadonlySet<string>, // optional head ablation (keys "layer.head")
): string {
  const ctx = model.cfg.contextLen
  let ids = tok.encode(prompt)
  if (ids.length === 0) ids = [0] // seed with first vocab char if prompt is empty
  const out: number[] = []
  for (let step = 0; step < cfg.maxNewTokens; step++) {
    const window = ids.slice(Math.max(0, ids.length - ctx))
    const { logits } = model.forward(window, flags, undefined, false, undefined, undefined, ablate)
    const last = lastRowLogits(logits.data, logits.rows, logits.cols)
    const { chosen } = sampleFromLogits(last, cfg, rng)
    out.push(chosen)
    ids.push(chosen)
  }
  return tok.decode(out)
}
