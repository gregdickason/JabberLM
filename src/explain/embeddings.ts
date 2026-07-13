// Real, precomputed word embeddings (a curated GloVe subset shipped as
// public/word-vectors.json). These power two explain-page demos:
//   - EmbeddingsDemo: nearest-neighbour search + word analogies + a 2-D map
//   - RagDemo:        semantic retrieval (embed a query → find the nearest passage)
// Everything here is framework-agnostic (no React) so both demos and any test can use it.

export type WordVectors = { dims: number; vectors: Record<string, number[]> }

let cache: WordVectors | null = null

/** Fetch the bundled vectors once (mirrors the model-fetch pattern). */
export async function loadWordVectors(): Promise<WordVectors | null> {
  if (cache) return cache
  try {
    const res = await fetch(import.meta.env.BASE_URL + 'word-vectors.json')
    if (!res.ok) return null
    cache = (await res.json()) as WordVectors
    return cache
  } catch {
    return null
  }
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1)
}

export type Sim = { word: string; sim: number }

/** Top-k words most similar to `word` by cosine (excludes the word itself). */
export function nearest(wv: WordVectors, word: string, k = 8): Sim[] {
  const v = wv.vectors[word]
  if (!v) return []
  const out: Sim[] = []
  for (const w in wv.vectors) {
    if (w === word) continue
    out.push({ word: w, sim: cosine(v, wv.vectors[w]) })
  }
  out.sort((a, b) => b.sim - a.sim)
  return out.slice(0, k)
}

/** The classic analogy: a − b + c → nearest words (e.g. king − man + woman ≈ queen). */
export function analogy(wv: WordVectors, a: string, b: string, c: string, k = 5): Sim[] {
  const va = wv.vectors[a]
  const vb = wv.vectors[b]
  const vc = wv.vectors[c]
  if (!va || !vb || !vc) return []
  const target = va.map((x, i) => x - vb[i] + vc[i])
  const ban = new Set([a, b, c])
  const out: Sim[] = []
  for (const w in wv.vectors) {
    if (ban.has(w)) continue
    out.push({ word: w, sim: cosine(target, wv.vectors[w]) })
  }
  out.sort((x, y) => y.sim - x.sim)
  return out.slice(0, k)
}

// Common function words carry little topical meaning and (being high-frequency)
// would dominate a naive average — drop them before embedding a sentence.
const STOP = new Set(
  ('the a an and or but of to in on at for with from by as is are was were be been being this ' +
    'that these those it its he she they them his her their our your my we you i me us do does did ' +
    'have has had will would can could into over under up down out about only very great many much ' +
    'made make one two some all who what where when how why not no yes if then than so')
    .split(' '),
)

export type Embedded = { vec: number[] | null; used: string[]; skipped: string[] }

/**
 * Turn free text into one "meaning" vector: average the **unit-normalized** vectors
 * of its known content words. Unit-normalizing first is the standard fix for the
 * norm-domination collapse (a few high-magnitude words otherwise swamp the average).
 * Reports which words were used vs skipped (out-of-vocabulary) — honest about coverage.
 */
export function embedText(wv: WordVectors, text: string): Embedded {
  const toks = text.toLowerCase().match(/[a-z]+/g) || []
  const used: string[] = []
  const skipped: string[] = []
  const v = new Array(wv.dims).fill(0)
  for (const t of toks) {
    if (STOP.has(t)) continue
    const wvec = wv.vectors[t]
    if (!wvec) {
      skipped.push(t)
      continue
    }
    used.push(t)
    let n = 0
    for (const x of wvec) n += x * x
    n = Math.sqrt(n) || 1
    for (let i = 0; i < wv.dims; i++) v[i] += wvec[i] / n
  }
  if (!used.length) return { vec: null, used, skipped }
  for (let i = 0; i < wv.dims; i++) v[i] /= used.length
  return { vec: v, used, skipped }
}
