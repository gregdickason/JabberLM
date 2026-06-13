import { Tensor } from './tensor'
import { RNG } from './random'
import { add, addRow, embeddingLookup, gelu, layerNorm, matmul, relu, transpose } from './ops'
import { buildMask, multiHeadAttention, type AttnParams, type Head0Refs } from './attention'
import type { FeatureFlags, ModelConfig } from './config'
import { snapshot, type LayerTrace, type Trace } from './trace'

// Live (graph-attached) tensors captured during a forward pass so the
// step-through walkthrough can read both values and gradients (after backward).
export interface WalkLayerCapture {
  normedAttn: Tensor
  head0?: Head0Refs
  attnOut: Tensor
  afterAttn: Tensor
  normedMLP: Tensor
  mlpHidden: Tensor
  mlpOut: Tensor
  afterMLP: Tensor
}

export interface WalkCapture {
  emb?: Tensor
  posContribution?: Tensor | null
  layers: WalkLayerCapture[]
  finalNorm?: Tensor
  logits?: Tensor
}

interface LayerParams {
  ln1g: Tensor
  ln1b: Tensor
  attn: AttnParams
  ln2g: Tensor
  ln2b: Tensor
  W1: Tensor
  b1: Tensor
  W2: Tensor
  b2: Tensor
}

export interface ForwardResult {
  logits: Tensor // (seq × vocab)
  trace?: Trace
}

/**
 * A decoder-only transformer built entirely from the inspectable ops. All
 * parameters are plain Tensors collected in `params` for the optimizer. The
 * structural config is fixed at construction; feature flags (positional mode,
 * masking, window) are supplied per-forward so they can change live.
 */
export class Model {
  readonly cfg: ModelConfig
  readonly params: Tensor[] = []

  tokenEmbed: Tensor
  posEmbed: Tensor
  layers: LayerParams[] = []
  lnfg: Tensor
  lnfb: Tensor
  unembed: Tensor | null // null when weights are tied to the token embedding

  constructor(cfg: ModelConfig, seed = 1337) {
    this.cfg = cfg
    const rng = new RNG(seed)
    const { dModel, dFF, nLayers, vocabSize, contextLen } = cfg
    const std = 0.02
    const residStd = 0.02 / Math.sqrt(2 * nLayers) // GPT-2-style residual scaling

    const param = (rows: number, cols: number, s: number, label: string) => {
      const t = Tensor.param(rows, cols, s, rng, label)
      this.params.push(t)
      return t
    }
    const ones = (cols: number, label: string) => {
      const t = new Tensor(new Float32Array(cols).fill(1), 1, cols, label)
      t.requiresGrad = true
      this.params.push(t)
      return t
    }
    const zeros = (cols: number, label: string) => {
      const t = Tensor.zeros(1, cols, label)
      t.requiresGrad = true
      this.params.push(t)
      return t
    }

    this.tokenEmbed = param(vocabSize, dModel, std, 'tokenEmbed')
    this.posEmbed = param(contextLen, dModel, std, 'posEmbed')

    for (let l = 0; l < nLayers; l++) {
      this.layers.push({
        ln1g: ones(dModel, `L${l}.ln1g`),
        ln1b: zeros(dModel, `L${l}.ln1b`),
        attn: {
          Wq: param(dModel, dModel, std, `L${l}.Wq`),
          Wk: param(dModel, dModel, std, `L${l}.Wk`),
          Wv: param(dModel, dModel, std, `L${l}.Wv`),
          Wo: param(dModel, dModel, residStd, `L${l}.Wo`),
        },
        ln2g: ones(dModel, `L${l}.ln2g`),
        ln2b: zeros(dModel, `L${l}.ln2b`),
        W1: param(dModel, dFF, std, `L${l}.W1`),
        b1: zeros(dFF, `L${l}.b1`),
        W2: param(dFF, dModel, residStd, `L${l}.W2`),
        b2: zeros(dModel, `L${l}.b2`),
      })
    }

    this.lnfg = ones(dModel, 'lnfg')
    this.lnfb = zeros(dModel, 'lnfb')
    this.unembed = cfg.weightTying ? null : param(dModel, vocabSize, std, 'unembed')
  }

  private activate(x: Tensor): Tensor {
    return this.cfg.activation === 'relu' ? relu(x) : gelu(x)
  }

  /**
   * Run the model over a token sequence. `positions` defaults to 0..seq-1 but
   * can be supplied (e.g. for KV-cache offsets). When `collect` is true a full
   * Trace of every intermediate is returned for the inspector.
   */
  forward(
    ids: number[],
    flags: FeatureFlags,
    positions: number[] = ids.map((_, i) => i),
    collect = false,
    capture?: WalkCapture,
  ): ForwardResult {
    const mask = buildMask(positions, flags)

    const emb = embeddingLookup(this.tokenEmbed, ids)
    let posContribution: Tensor | null = null
    let x = emb
    if (flags.positional === 'learned') {
      posContribution = embeddingLookup(this.posEmbed, positions)
      x = add(emb, posContribution)
    }
    if (capture) {
      capture.emb = emb
      capture.posContribution = posContribution
    }

    const inputResidual = x
    const layerTraces: LayerTrace[] = []

    for (const lp of this.layers) {
      const preLNAttn = x
      const normedAttn = layerNorm(x, lp.ln1g, lp.ln1b)
      const attnRes = multiHeadAttention(
        normedAttn,
        lp.attn,
        this.cfg,
        flags,
        positions,
        mask,
        collect,
        !!capture,
      )
      const afterAttn = add(preLNAttn, attnRes.out)

      const normedMLP = layerNorm(afterAttn, lp.ln2g, lp.ln2b)
      const hidden = this.activate(addRow(matmul(normedMLP, lp.W1), lp.b1))
      const mlpOut = addRow(matmul(hidden, lp.W2), lp.b2)
      const afterMLP = add(afterAttn, mlpOut)
      x = afterMLP

      if (capture) {
        capture.layers.push({
          normedAttn,
          head0: attnRes.head0Refs,
          attnOut: attnRes.out,
          afterAttn,
          normedMLP,
          mlpHidden: hidden,
          mlpOut,
          afterMLP,
        })
      }

      if (collect) {
        layerTraces.push({
          preLNAttn: snapshot(preLNAttn),
          normedAttn: snapshot(normedAttn),
          heads: attnRes.heads!,
          attnOut: snapshot(attnRes.out),
          afterAttnResid: snapshot(afterAttn),
          normedMLP: snapshot(normedMLP),
          mlpHidden: snapshot(hidden),
          mlpOut: snapshot(mlpOut),
          afterMLPResid: snapshot(afterMLP),
        })
      }
    }

    const normed = layerNorm(x, this.lnfg, this.lnfb)
    const unembedW = this.unembed ?? transpose(this.tokenEmbed)
    const logits = matmul(normed, unembedW)

    if (capture) {
      capture.finalNorm = normed
      capture.logits = logits
    }

    if (!collect) return { logits }

    // build the probs snapshot (row-wise softmax) for the inspector
    const seq = ids.length
    const vocab = this.cfg.vocabSize
    const probs = new Float32Array(seq * vocab)
    for (let i = 0; i < seq; i++) {
      let max = -Infinity
      for (let j = 0; j < vocab; j++) max = Math.max(max, logits.data[i * vocab + j])
      let sumE = 0
      for (let j = 0; j < vocab; j++) {
        const e = Math.exp(logits.data[i * vocab + j] - max)
        probs[i * vocab + j] = e
        sumE += e
      }
      for (let j = 0; j < vocab; j++) probs[i * vocab + j] /= sumE
    }

    const trace: Trace = {
      tokenIds: ids.slice(),
      positions: positions.slice(),
      mask: { rows: seq, cols: seq, data: mask.slice() },
      embeddings: snapshot(emb),
      positional: posContribution ? snapshot(posContribution) : null,
      inputResidual: snapshot(inputResidual),
      layers: layerTraces,
      finalNorm: snapshot(normed),
      logits: snapshot(logits),
      probs: { rows: seq, cols: vocab, data: probs },
    }
    return { logits, trace }
  }
}
