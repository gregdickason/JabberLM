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

export function randomSortVectors(n: number, rng: RNG): SortVec[] {
  const v = (): SortVec => [1 + Math.floor(rng.next() * 9), 1 + Math.floor(rng.next() * 9), 1 + Math.floor(rng.next() * 9)]
  return Array.from({ length: n }, v)
}
