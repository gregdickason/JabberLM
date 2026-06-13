import { Tensor } from './tensor'
import { concatCols, matmul, rowSoftmax, scale, sliceCols, transpose, addMaskConst } from './ops'
import { applyRope } from './rope'
import type { FeatureFlags, ModelConfig } from './config'
import { HEAD_DIM } from './config'
import { snapshot, type HeadTrace } from './trace'

const MASK_NEG = -1e9

export interface AttnParams {
  Wq: Tensor
  Wk: Tensor
  Wv: Tensor
  Wo: Tensor
}

/**
 * Build the additive attention mask (seq×seq). Entry [i][j] is 0 if query i may
 * attend to key j, else a large negative number (so softmax drives it to ~0).
 * Honours the causal flag and the optional sliding window.
 */
export function buildMask(positions: number[], flags: FeatureFlags): Float32Array {
  const seq = positions.length
  const mask = new Float32Array(seq * seq)
  for (let i = 0; i < seq; i++) {
    for (let j = 0; j < seq; j++) {
      const pi = positions[i]
      const pj = positions[j]
      let blocked = false
      if (flags.causalMask && pj > pi) blocked = true
      if (flags.slidingWindow != null && pi - pj >= flags.slidingWindow) blocked = true
      mask[i * seq + j] = blocked ? MASK_NEG : 0
    }
  }
  return mask
}

/** Live (graph-attached) tensors for one head, used by the step-through
 *  walkthrough so it can read gradients after a backward pass. */
export interface Head0Refs {
  q: Tensor
  k: Tensor
  v: Tensor
  scores: Tensor
  attn: Tensor
  headOut: Tensor
}

export interface AttnResult {
  out: Tensor // (seq × dModel)
  heads?: HeadTrace[] // populated when `collect` is true
  head0Refs?: Head0Refs // populated when `captureHead0` is true
}

/**
 * Multi-head causal self-attention. Q/K/V are computed for the full residual
 * width, then split per head; each head attends independently and the outputs
 * are concatenated and projected by Wo.
 */
export function multiHeadAttention(
  x: Tensor,
  p: AttnParams,
  cfg: ModelConfig,
  flags: FeatureFlags,
  positions: number[],
  mask: Float32Array,
  collect = false,
  captureHead0 = false,
): AttnResult {
  const hd = HEAD_DIM(cfg)
  const Q = matmul(x, p.Wq)
  const K = matmul(x, p.Wk)
  const V = matmul(x, p.Wv)
  const invSqrt = 1 / Math.sqrt(hd)

  const headOuts: Tensor[] = []
  const heads: HeadTrace[] = []
  let head0Refs: Head0Refs | undefined
  for (let h = 0; h < cfg.nHeads; h++) {
    let qh = sliceCols(Q, h * hd, hd)
    let kh = sliceCols(K, h * hd, hd)
    const vh = sliceCols(V, h * hd, hd)
    if (flags.positional === 'rope') {
      qh = applyRope(qh, positions, flags.ropeBase)
      kh = applyRope(kh, positions, flags.ropeBase)
    }
    const scores = scale(matmul(qh, transpose(kh)), invSqrt)
    const masked = addMaskConst(scores, mask)
    const attn = rowSoftmax(masked)
    const headOut = matmul(attn, vh)
    headOuts.push(headOut)
    if (collect) {
      heads.push({
        q: snapshot(qh),
        k: snapshot(kh),
        v: snapshot(vh),
        scores: snapshot(scores), // pre-mask, pre-softmax
        attn: snapshot(attn),
        headOut: snapshot(headOut),
      })
    }
    if (captureHead0 && h === 0) {
      head0Refs = { q: qh, k: kh, v: vh, scores, attn, headOut }
    }
  }
  const concat = concatCols(headOuts)
  const out = matmul(concat, p.Wo)
  const result: AttnResult = { out }
  if (collect) result.heads = heads
  if (captureHead0) result.head0Refs = head0Refs
  return result
}
