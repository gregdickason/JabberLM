import { Model } from '../engine/model'
import { CharTokenizer } from '../engine/tokenizer'
import { generate } from '../engine/generate'
import { crossEntropy } from '../engine/ops'
import { RNG } from '../engine/random'
import { DEFAULT_FEATURE_FLAGS, DEFAULT_SAMPLE_CONFIG } from '../engine/config'

// Head ablation: knock out attention heads (zero their output) and measure how
// much each skill of the bundled three-skill model degrades. Shows which heads
// matter for sorting vs poems — sorting lives mostly in the middle layer, poems
// lean on the output layer, and layer 0 is a shared (polysemantic) foundation.

export type SortVec = [number, number, number]
export type Ablation = ReadonlySet<string> // keys "layer.head"

/** Greedy generation of one line, honouring an optional head ablation. */
export function genLine(
  model: Model,
  tok: CharTokenizer,
  prompt: string,
  maxNew: number,
  ablate?: Ablation,
): string {
  const out = generate(
    model,
    DEFAULT_FEATURE_FLAGS,
    tok,
    prompt,
    { ...DEFAULT_SAMPLE_CONFIG, temperature: 0, maxNewTokens: maxNew },
    new RNG(1),
    ablate,
  )
  return out.split('\n')[0]
}

/** Exact-match sort accuracy over a set of vectors (greedy), with ablation. */
export function sortAccuracy(model: Model, tok: CharTokenizer, vectors: SortVec[], ablate?: Ablation): number {
  let ok = 0
  for (const v of vectors) {
    const want = [...v].sort((a, b) => a - b).join(' ')
    const got = (genLine(model, tok, `sort ${v.join(' ')} => `, 8, ablate).match(/\d(?: \d)*/) || [''])[0].trim()
    if (got === want) ok++
  }
  return vectors.length ? Math.round((100 * ok) / vectors.length) : 0
}

/** Mean next-char cross-entropy on a text snippet (forward only), with ablation. */
export function poemLoss(model: Model, tok: CharTokenizer, text: string, ablate?: Ablation): number {
  const ids = tok.encode(text)
  const L = Math.min(model.cfg.contextLen, 32)
  let s = 0
  let n = 0
  for (let st = 0; st + L + 1 < ids.length; st += Math.max(1, Math.floor(L * 1.25))) {
    const w = ids.slice(st, st + L + 1)
    const { logits } = model.forward(w.slice(0, L), DEFAULT_FEATURE_FLAGS, undefined, false, undefined, undefined, ablate)
    s += crossEntropy(logits, w.slice(1, L + 1)).loss.data[0]
    n++
  }
  return n ? s / n : 0
}

// ---- Mixture-of-Experts: task accuracy with optional EXPERT ablation --------
export type MoeOp = 'sort' | 'max' | 'reverse'
export type ExpertAblation = ReadonlySet<string> // keys "layer.expert"

const opPrompt = (op: MoeOp, v: SortVec): string =>
  `${op === 'reverse' ? 'rev' : op} ${v.join(' ')} => `
const opExpected = (op: MoeOp, v: SortVec): string =>
  op === 'sort'
    ? [...v].sort((a, b) => a - b).join(' ')
    : op === 'max'
      ? String(Math.max(...v))
      : [...v].reverse().join(' ')

/** Greedy answer for one MoE-task prompt. `moeAblate` removes experts; `topK`
 *  switches inference to sparse top-k routing (undefined/null = dense). */
export function moeAnswer(
  model: Model,
  tok: CharTokenizer,
  prompt: string,
  maxNew: number,
  moeAblate?: ExpertAblation,
  topK?: number | null,
): string {
  const flags = { ...DEFAULT_FEATURE_FLAGS, moeTopK: topK ?? null }
  const ctx = model.cfg.contextLen
  const ids = tok.encode(prompt)
  const out: number[] = []
  const nl = tok.stoi.get('\n')
  for (let s = 0; s < maxNew; s++) {
    const window = ids.slice(Math.max(0, ids.length - ctx))
    const { logits } = model.forward(window, flags, undefined, false, undefined, undefined, undefined, moeAblate)
    const V = logits.cols
    const base = (logits.rows - 1) * V
    let best = 0
    for (let j = 1; j < V; j++) if (logits.data[base + j] > logits.data[base + best]) best = j
    if (best === nl) break
    out.push(best)
    ids.push(best)
  }
  return tok.decode(out)
}

/** Exact-match accuracy on a MoE task (sort/max/reverse) over held-out vectors,
 *  with optional expert ablation and top-k sparse routing. */
export function taskAccuracy(
  model: Model,
  tok: CharTokenizer,
  op: MoeOp,
  vectors: SortVec[],
  moeAblate?: ExpertAblation,
  topK?: number | null,
): number {
  let ok = 0
  for (const v of vectors) {
    const want = opExpected(op, v)
    const got = moeAnswer(model, tok, opPrompt(op, v), want.length + 2, moeAblate, topK).split('\n')[0].trim()
    if (got === want) ok++
  }
  return vectors.length ? Math.round((100 * ok) / vectors.length) : 0
}

/** The prompt stem for a MoE task, e.g. sort → "sort 6 9 2 => ". */
export function moePrompt(op: MoeOp, v: SortVec): string {
  return opPrompt(op, v)
}

export function randomSortVectors(n: number, rng: RNG): SortVec[] {
  const v = (): SortVec => [1 + Math.floor(rng.next() * 9), 1 + Math.floor(rng.next() * 9), 1 + Math.floor(rng.next() * 9)]
  return Array.from({ length: n }, v)
}
