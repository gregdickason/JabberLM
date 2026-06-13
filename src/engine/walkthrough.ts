import { Model, type WalkCapture } from './model'
import { CharTokenizer } from './tokenizer'
import { buildMask } from './attention'
import { crossEntropy } from './ops'
import type { Tensor } from './tensor'
import type { Matrix } from './trace'
import type { FeatureFlags } from './config'

// Builds an ordered, click-through narration of ONE forward pass and ONE
// backward pass over a short input, using the REAL model computation (so the
// numbers and gradients are exactly what training sees). To keep it legible we
// show one representative item per stage — head 0 of each layer, one weight
// matrix — rather than every head and matrix.

export interface WalkMatrix {
  label: string
  matrix: Matrix
  scale?: 'diverging' | 'sequential'
  rowLabels?: string[]
  colLabels?: string[]
}

export interface WalkStep {
  phase: 'forward' | 'backward'
  stage: string
  title: string
  explanation: string
  kind: 'tokens' | 'matrices' | 'bars' | 'scalar'
  matrices?: WalkMatrix[]
  tokens?: { labels: string[]; ids: number[] }
  bars?: { values: number[]; labels: string[]; highlight?: number; max?: number }
  scalar?: { value: number; label: string }
}

const dat = (t: Tensor): Matrix => ({ rows: t.rows, cols: t.cols, data: t.data.slice() })
const grd = (t: Tensor): Matrix => ({ rows: t.rows, cols: t.cols, data: t.grad.slice() })
const lastRow = (m: Matrix): number[] =>
  Array.from(m.data.subarray((m.rows - 1) * m.cols, m.rows * m.cols))

/**
 * Run forward + backward on (inputIds → targetIds) and produce the walkthrough
 * steps. Gradients are real: we zero the parameter grads, run a true backward
 * from the cross-entropy loss, and read `.grad` off the captured tensors.
 */
export function buildWalkSteps(
  model: Model,
  tok: CharTokenizer,
  inputIds: number[],
  targetIds: number[],
  flags: FeatureFlags,
  learningRate: number,
  optimizer: string,
): WalkStep[] {
  const capture: WalkCapture = { layers: [] }
  const { logits } = model.forward(inputIds, flags, undefined, false, capture)

  for (const p of model.params) p.zeroGrad()
  const { loss, probs } = crossEntropy(logits, targetIds)
  loss.backward()

  const inLabels = inputIds.map((id) => tok.label(id))
  const tgtLabels = targetIds.map((id) => tok.label(id))
  const vocabLabels = tok.itos.map((_, id) => tok.label(id))
  const positions = inputIds.map((_, i) => i)
  const mask: Matrix = {
    rows: inputIds.length,
    cols: inputIds.length,
    data: buildMask(positions, flags),
  }
  const seq = inputIds.length
  const vocab = tok.vocabSize

  const steps: WalkStep[] = []

  // ----------------------------- FORWARD ------------------------------------

  steps.push({
    phase: 'forward',
    stage: 'Input',
    title: 'Tokenize the input',
    explanation:
      `The model reads ${seq} characters. Each character is a token — its id is the row it ` +
      `occupies in the vocabulary. Everything downstream operates on these integers.`,
    kind: 'tokens',
    tokens: { labels: inLabels, ids: inputIds },
  })

  steps.push({
    phase: 'forward',
    stage: 'Target',
    title: 'The targets are the next characters',
    explanation:
      `At every position the model must predict the FOLLOWING character. The targets are simply ` +
      `the input shifted left by one. Training pushes the predicted distribution toward these.`,
    kind: 'tokens',
    tokens: { labels: tgtLabels, ids: targetIds },
  })

  steps.push({
    phase: 'forward',
    stage: 'Embeddings',
    title: 'Look up a vector per token',
    explanation:
      `Each token id selects a learned row of the embedding matrix — a d_model-dimensional vector. ` +
      `This (seq × d_model) matrix is the start of the "residual stream" that flows through the model.`,
    kind: 'matrices',
    matrices: [{ label: 'token embeddings (seq × d_model)', matrix: dat(capture.emb!), rowLabels: inLabels }],
  })

  if (capture.posContribution) {
    steps.push({
      phase: 'forward',
      stage: 'Positions',
      title: 'Add position information',
      explanation:
        `Attention alone is order-blind, so a learned position vector is ADDED to each token's ` +
        `embedding. Now the same character at different positions has a different vector.`,
      kind: 'matrices',
      matrices: [
        { label: 'positional vectors (seq × d_model)', matrix: dat(capture.posContribution), rowLabels: inLabels },
      ],
    })
  }

  steps.push({
    phase: 'forward',
    stage: 'Mask',
    title: 'Causal mask',
    explanation:
      `A decoder may only look backwards. The mask blocks (blue) every position from attending to ` +
      `later ones, so prediction at each step can't "cheat" by seeing the future.`,
    kind: 'matrices',
    matrices: [{ label: 'attention mask (query rows × key cols)', matrix: mask, scale: 'diverging', rowLabels: inLabels, colLabels: inLabels }],
  })

  capture.layers.forEach((lc, l) => {
    const h0 = lc.head0
    if (h0) {
      steps.push({
        phase: 'forward',
        stage: `Layer ${l} · attention`,
        title: `Layer ${l}: project to Query, Key, Value (head 0)`,
        explanation:
          `The residual stream is LayerNorm'd, then each head multiplies it by learned weights ` +
          `Wq, Wk, Wv to get Queries, Keys and Values. We follow head 0; the other heads run in ` +
          `parallel on different slices of the vector.`,
        kind: 'matrices',
        matrices: [
          { label: 'Q', matrix: dat(h0.q), rowLabels: inLabels },
          { label: 'K', matrix: dat(h0.k), rowLabels: inLabels },
          { label: 'V', matrix: dat(h0.v), rowLabels: inLabels },
        ],
      })

      steps.push({
        phase: 'forward',
        stage: `Layer ${l} · attention`,
        title: `Layer ${l}: scores → attention weights (head 0)`,
        explanation:
          `Each query is compared with every key: scores = Q·Kᵀ / √d. After masking and a row-wise ` +
          `softmax these become attention weights — each row sums to 1 and says how much this ` +
          `position reads from each earlier position.`,
        kind: 'matrices',
        matrices: [
          { label: 'scores Q·Kᵀ/√d', matrix: dat(h0.scores), scale: 'diverging', rowLabels: inLabels, colLabels: inLabels },
          { label: 'attention weights (softmax)', matrix: dat(h0.attn), scale: 'sequential', rowLabels: inLabels, colLabels: inLabels },
        ],
      })

      steps.push({
        phase: 'forward',
        stage: `Layer ${l} · attention`,
        title: `Layer ${l}: mix values, combine heads, add back`,
        explanation:
          `Each head outputs a weighted sum of its Values (head 0 shown). All heads are concatenated ` +
          `and projected by Wo, then ADDED back into the residual stream — attention's job is to move ` +
          `information between positions.`,
        kind: 'matrices',
        matrices: [
          { label: 'head 0 output (attn · V)', matrix: dat(h0.headOut), rowLabels: inLabels },
          { label: 'attention output (all heads · Wo)', matrix: dat(lc.attnOut), rowLabels: inLabels },
        ],
      })
    }

    steps.push({
      phase: 'forward',
      stage: `Layer ${l} · MLP`,
      title: `Layer ${l}: feed-forward network`,
      explanation:
        `After a second LayerNorm, a 2-layer MLP processes each position independently: expand to ` +
        `d_ff, apply the activation, contract back to d_model. The expansion plus the non-linear ` +
        `activation let it learn non-linear COMBINATIONS of features — think of the wide hidden layer ` +
        `as a bank of learned pattern detectors (key→value lookups) that fire on specific inputs. The ` +
        `contraction writes their result back into the residual stream. So if attention moves ` +
        `information between positions, the MLP transforms each position's features in place.`,
      kind: 'matrices',
      matrices: [
        { label: 'MLP hidden (seq × d_ff)', matrix: dat(lc.mlpHidden), rowLabels: inLabels },
        { label: 'MLP output → residual', matrix: dat(lc.mlpOut), rowLabels: inLabels },
      ],
    })
  })

  steps.push({
    phase: 'forward',
    stage: 'Output',
    title: 'Final LayerNorm → logits',
    explanation:
      `A final LayerNorm, then the residual is multiplied by the unembedding (the tied token-embedding ` +
      `transposed) to produce one logit per vocabulary character at every position.`,
    kind: 'matrices',
    matrices: [{ label: 'final normed (seq × d_model)', matrix: dat(capture.finalNorm!), rowLabels: inLabels }],
  })

  const probsM: Matrix = { rows: seq, cols: vocab, data: probs }
  const lastTarget = targetIds[seq - 1]
  steps.push({
    phase: 'forward',
    stage: 'Output',
    title: 'Softmax → next-character probabilities',
    explanation:
      `Softmax turns the last position's logits into a probability distribution over the vocabulary. ` +
      `The true next character "${tok.label(lastTarget)}" is highlighted — training wants this bar tall.`,
    kind: 'bars',
    bars: { values: lastRow(probsM), labels: vocabLabels, highlight: lastTarget, max: 1 },
  })

  steps.push({
    phase: 'forward',
    stage: 'Loss',
    title: 'Cross-entropy loss',
    explanation:
      `The loss is the mean of −log(probability of the true next character) over all positions. ` +
      `A confident, correct model has low loss; this single number is what we minimise.`,
    kind: 'scalar',
    scalar: { value: loss.data[0], label: 'cross-entropy loss' },
  })

  // ---------------------------- BACKWARD ------------------------------------

  steps.push({
    phase: 'backward',
    stage: 'Gradient of loss',
    title: 'Backprop starts at the logits',
    explanation:
      `Backpropagation computes ∂loss/∂(everything), working backwards. The very first gradient is ` +
      `∂loss/∂logits = softmax − one-hot(target). It's positive where the model put too much mass ` +
      `and negative on the true character (a signal to push that logit up). Every gradient after this ` +
      `is found by the chain rule: multiply the gradient coming from the stage above by this stage's ` +
      `own local derivative — repeated all the way back to the weights.`,
    kind: 'matrices',
    matrices: [{ label: '∂loss/∂logits (seq × vocab)', matrix: grd(capture.logits!), scale: 'diverging', rowLabels: inLabels, colLabels: vocabLabels }],
  })

  steps.push({
    phase: 'backward',
    stage: 'Gradient through output',
    title: 'Flow back into the residual stream',
    explanation:
      `The gradient passes back through the unembedding and the final LayerNorm, giving ∂loss/∂(final ` +
      `residual). From here it threads back through every layer in reverse.`,
    kind: 'matrices',
    matrices: [{ label: '∂loss/∂(final normed)', matrix: grd(capture.finalNorm!), scale: 'diverging', rowLabels: inLabels }],
  })

  for (let l = capture.layers.length - 1; l >= 0; l--) {
    const lc = capture.layers[l]
    const Wq = model.layers[l].attn.Wq
    const mats: WalkMatrix[] = []
    if (lc.head0) {
      mats.push({
        label: `∂loss/∂(attention weights, head 0)`,
        matrix: grd(lc.head0.attn),
        scale: 'diverging',
        rowLabels: inLabels,
        colLabels: inLabels,
      })
    }
    mats.push({ label: `∂loss/∂(L${l}.Wq) — a weight gradient`, matrix: grd(Wq), scale: 'diverging' })
    steps.push({
      phase: 'backward',
      stage: `Layer ${l} · gradients`,
      title: `Layer ${l}: gradient flows back through the block`,
      explanation:
        `Reversing the block: the gradient goes back through the MLP and the attention, and every ` +
        `weight in this layer accumulates a gradient. Shown: how the loss changes with head 0's ` +
        `attention weights, and the gradient of the query weight matrix Wq (what the optimizer uses).`,
      kind: 'matrices',
      matrices: mats,
    })
  }

  steps.push({
    phase: 'backward',
    stage: 'Gradient at embeddings',
    title: 'The gradient reaches the embeddings',
    explanation:
      `Finally the gradient arrives at the token embeddings: each character that appeared in the ` +
      `input gets a gradient telling its vector which way to move.`,
    kind: 'matrices',
    matrices: [{ label: '∂loss/∂(token embeddings, used rows)', matrix: grd(capture.emb!), scale: 'diverging', rowLabels: inLabels }],
  })

  // The actual weight update — show one weight matrix change. We display the
  // simplified SGD rule (W − lr·grad) because it's legible; the real optimizer
  // may be AdamW (noted in the text). This is display-only; the model is not
  // mutated by the walkthrough.
  const W = model.layers[0].attn.Wq
  const before = dat(W)
  const updated = new Float32Array(W.size)
  for (let i = 0; i < W.size; i++) updated[i] = W.data[i] - learningRate * W.grad[i]
  const after: Matrix = { rows: W.rows, cols: W.cols, data: updated }
  // pick the most-changed weight so the numbers are concrete
  let mi = 0
  for (let i = 1; i < W.size; i++) if (Math.abs(W.grad[i]) > Math.abs(W.grad[mi])) mi = i
  const r = Math.floor(mi / W.cols)
  const c = mi % W.cols
  const optNote =
    optimizer === 'adamw'
      ? `You're using AdamW, which also tracks momentum and a per-weight scale, so its real step differs ` +
        `slightly — but the core idea, "move opposite the gradient," is identical.`
      : `You're using plain SGD, which is exactly this rule.`

  steps.push({
    phase: 'backward',
    stage: 'One learning step',
    title: 'The weights actually change — this is "learning"',
    explanation:
      `Now the update. For every weight: W_after = W_before − learning_rate × gradient. Below is one ` +
      `weight matrix (L0.Wq) before, its gradient, and after. Most-changed cell [${r},${c}]: ` +
      `${before.data[mi].toFixed(4)} − ${learningRate} × ${W.grad[mi].toFixed(4)} = ` +
      `${after.data[mi].toFixed(4)}. Every parameter shifts a tiny step toward predicting THIS ` +
      `example better; repeat over the whole text and the model learns it. ${optNote} (And real ` +
      `training first averages these gradients over a batch of examples — the "Batch size" slider — ` +
      `to reduce noise before each update.)`,
    kind: 'matrices',
    matrices: [
      { label: 'L0.Wq — before', matrix: before, scale: 'diverging' },
      { label: 'gradient ∂loss/∂(L0.Wq)', matrix: grd(W), scale: 'diverging' },
      { label: 'after = before − lr·grad', matrix: after, scale: 'diverging' },
    ],
  })

  return steps
}
