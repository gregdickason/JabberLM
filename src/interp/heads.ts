import { Model } from '../engine/model'
import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from '../engine/config'
import type { Matrix } from '../engine/trace'

// Classify each attention head by what it does, the foundational "circuits"
// result. Two canonical roles:
//  - previous-token head: attends to the immediately preceding token (i → i-1);
//  - induction head: attends to the token that FOLLOWED the last occurrence of
//    the current token (i → j where token[j-1] == token[i]) — the mechanism
//    behind copying/continuation and a lot of in-context learning.

/** Positions j (≤ i) whose preceding token equals the token at i — the targets
 *  an induction head attends to ("after a previous occurrence of this token"). */
export function inductionTargets(window: number[], i: number): number[] {
  const t: number[] = []
  for (let j = 1; j <= i; j++) if (window[j - 1] === window[i]) t.push(j)
  return t
}

export interface HeadStat {
  layer: number
  head: number
  prevToken: number // avg attention to position i-1
  induction: number // avg attention to "after a previous occurrence of current token"
  label: 'induction' | 'previous-token' | 'other'
}

export function computeHeadStats(
  model: Model,
  ids: number[],
  flags: FeatureFlags = DEFAULT_FEATURE_FLAGS,
): HeadStat[] {
  const L = Math.min(model.cfg.contextLen, Math.max(1, ids.length))
  const nLayers = model.cfg.nLayers
  const nHeads = model.cfg.nHeads
  const prev = Array.from({ length: nLayers }, () => new Float64Array(nHeads))
  const ind = Array.from({ length: nLayers }, () => new Float64Array(nHeads))
  let count = 0

  for (let start = 0; start < ids.length; start += L) {
    const window = ids.slice(start, Math.min(start + L, ids.length))
    const w = window.length
    if (w < 2) continue
    const { trace } = model.forward(window, flags, undefined, true)
    for (let i = 1; i < w; i++) count++
    for (let l = 0; l < nLayers; l++) {
      for (let h = 0; h < nHeads; h++) {
        const a = trace!.layers[l].heads[h].attn.data // (w × w)
        for (let i = 1; i < w; i++) {
          prev[l][h] += a[i * w + (i - 1)]
          let s = 0
          for (const j of inductionTargets(window, i)) s += a[i * w + j]
          ind[l][h] += s
        }
      }
    }
  }

  const stats: HeadStat[] = []
  for (let l = 0; l < nLayers; l++) {
    for (let h = 0; h < nHeads; h++) {
      const p = count ? prev[l][h] / count : 0
      const ii = count ? ind[l][h] / count : 0
      let label: HeadStat['label'] = 'other'
      if (ii >= 0.2 && ii >= p) label = 'induction'
      else if (p >= 0.2) label = 'previous-token'
      stats.push({ layer: l, head: h, prevToken: p, induction: ii, label })
    }
  }
  return stats
}

/** Attention matrix of one head on a probe sequence, for visualization. */
export function probeHeadAttention(
  model: Model,
  layer: number,
  head: number,
  window: number[],
  flags: FeatureFlags = DEFAULT_FEATURE_FLAGS,
): Matrix {
  const { trace } = model.forward(window, flags, undefined, true)
  return trace!.layers[layer].heads[head].attn
}
