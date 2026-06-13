import { Tensor } from './tensor'

// A Trace is a complete snapshot of one forward pass — every intermediate the
// inspector needs to render. We copy values out of the live Tensors into plain
// Matrix snapshots so a trace can be held and displayed independently of the
// autograd graph (and so generation steps don't mutate what's on screen).

export interface Matrix {
  rows: number
  cols: number
  data: Float32Array
}

export function snapshot(t: Tensor): Matrix {
  return { rows: t.rows, cols: t.cols, data: t.data.slice() }
}

export function mat(rows: number, cols: number, data: Float32Array): Matrix {
  return { rows, cols, data }
}

export interface HeadTrace {
  q: Matrix // (seq × headDim) queries
  k: Matrix // (seq × headDim) keys
  v: Matrix // (seq × headDim) values
  scores: Matrix // (seq × seq) pre-softmax, pre-mask QKᵀ/√d
  attn: Matrix // (seq × seq) post-softmax attention weights
  headOut: Matrix // (seq × headDim) attention output
}

export interface LayerTrace {
  preLNAttn: Matrix // residual stream entering the block
  normedAttn: Matrix // after LayerNorm 1
  heads: HeadTrace[]
  attnOut: Matrix // concat(heads) · Wo
  afterAttnResid: Matrix // residual after adding attnOut
  normedMLP: Matrix // after LayerNorm 2
  mlpHidden: Matrix // MLP hidden activations (seq × dFF)
  mlpOut: Matrix // MLP output (seq × dModel)
  afterMLPResid: Matrix // residual after adding mlpOut
}

export interface Trace {
  tokenIds: number[]
  positions: number[]
  /** Additive attention mask (seq × seq): 0 = visible, large-negative = masked. */
  mask: Matrix
  embeddings: Matrix // token embeddings (seq × dModel)
  positional: Matrix | null // positional contribution, if any
  inputResidual: Matrix // embeddings (+ positional) entering layer 0
  layers: LayerTrace[]
  finalNorm: Matrix // after the final LayerNorm
  logits: Matrix // (seq × vocab)
  probs: Matrix // (seq × vocab) softmax of the last row is the next-token dist
}
