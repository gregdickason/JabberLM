// Deterministic builder for the "three-skill" training corpus: Jabber poems +
// single-variable algebra (with worked steps) + sorting. One tiny model trained
// on this shows three things at once — text generation (poems), confident-but-
// WRONG arithmetic (the hallucination lesson; the model can't learn the maths),
// and genuinely-learned sorting (generalises to unseen vectors — "real" reasoning,
// with a visible grokking jump). Lives in scripts/ (not shipped); the corpus ends
// up inside the bundled model JSON's `text` field, so the app bundle stays lean.
//
// Deterministic (fixed-seed mulberry32) so the corpus is identical every run — the
// bundled model was trained on exactly this text, which rebuilds its tokenizer.

import { JABBER_POEMS } from '../src/data/jabberPoems'

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type SortVec = [number, number, number]

export interface MultitaskData {
  corpus: string
  sortHeldOut: SortVec[] // unseen vectors, for measuring sort generalisation
}

export function buildMultitaskCorpus(): MultitaskData {
  const rnd = mulberry32(1234567)
  const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)]

  // --- SORTING: digits 1..9, length 3 (repeats allowed) -> 729 vectors. Hold out
  //     20% so accuracy measures generalisation, not memorisation. -------------
  const vecs: SortVec[] = []
  for (let a = 1; a <= 9; a++) for (let b = 1; b <= 9; b++) for (let c = 1; c <= 9; c++) vecs.push([a, b, c])
  for (let i = vecs.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[vecs[i], vecs[j]] = [vecs[j], vecs[i]]
  }
  const nTest = Math.floor(vecs.length * 0.2)
  const sortHeldOut = vecs.slice(0, nTest)
  const sortTrain = vecs.slice(nTest)
  const sortLine = (v: SortVec) => `sort ${v.join(' ')} => ${[...v].sort((x, y) => x - y).join(' ')}`

  // --- ALGEBRA: single-variable with correct worked steps. The data is correct;
  //     the model just can't learn the arithmetic, so it hallucinates at run time.
  const algebraLine = () => {
    const a = 2 + Math.floor(rnd() * 8) // 2..9
    const x = Math.floor(rnd() * 10) // 0..9
    const b = Math.floor(rnd() * 10) // 0..9
    const c = a * x + b
    return `${a}x + ${b} = ${c} => ${a}x = ${c - b} => x = ${x}`
  }

  // Sizes (chars): sorting ~= poems, algebra ~= half poems, so all three are
  // well represented (validated ratio).
  const poemChars = JABBER_POEMS.length
  const fill = (target: number, gen: () => string) => {
    const lines: string[] = []
    let chars = 0
    while (chars < target) {
      const l = gen()
      lines.push(l)
      chars += l.length + 1
    }
    return lines.join('\n')
  }

  const sortText = fill(poemChars, () => sortLine(pick(sortTrain)))
  const algebraText = fill(poemChars * 0.5, algebraLine)
  const corpus = `${JABBER_POEMS}\n\n${sortText}\n\n${algebraText}\n`
  return { corpus, sortHeldOut }
}
