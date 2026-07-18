// Deterministic generators for the two "skill" training tasks — sorting and
// single-variable algebra — plus their example prompts and held-out sets. Pure
// (no engine import) so it ships in the app: it's the single source of truth for
// the dataset dropdown AND the live grokking eval. Deterministic (fixed-seed
// mulberry32) so a given size always yields the same corpus.
//
// The teaching contrast: a tiny model trained on SORTING learns a real procedure
// and *generalises* to vectors it never saw (it "groks"); trained on ALGEBRA it
// memorises the format and produces confident, WRONG working (it never groks).

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

// ---- sorting ---------------------------------------------------------------
// digits 1..9, length 3 (repeats allowed) -> 729 vectors; hold out 20%.
function allSortVecs(rnd: () => number): SortVec[] {
  const v: SortVec[] = []
  for (let a = 1; a <= 9; a++) for (let b = 1; b <= 9; b++) for (let c = 1; c <= 9; c++) v.push([a, b, c])
  for (let i = v.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[v[i], v[j]] = [v[j], v[i]]
  }
  return v
}
export const sortLine = (v: SortVec): string => `sort ${v.join(' ')} => ${[...v].sort((x, y) => x - y).join(' ')}`

/** A held-out set of sort vectors (unseen during training) for measuring generalisation. */
export function sortHeldOut(): SortVec[] {
  const vecs = allSortVecs(mulberry32(20250626))
  return vecs.slice(0, Math.floor(vecs.length * 0.2))
}

/** A sorting corpus (~targetChars) built only from the training split. */
export function buildSortCorpus(targetChars = 40000): string {
  const rnd = mulberry32(20250626)
  const vecs = allSortVecs(rnd)
  const train = vecs.slice(Math.floor(vecs.length * 0.2))
  const lines: string[] = []
  let chars = 0
  while (chars < targetChars) {
    const l = sortLine(train[Math.floor(rnd() * train.length)])
    lines.push(l)
    chars += l.length + 1
  }
  return lines.join('\n') + '\n'
}

// ---- descending sort (the LoRA re-task target) -----------------------------
// SAME prompt as ascending ("sort a b c => "), but the answer is high→low. A LoRA
// adapter on the frozen ascending base learns to flip the output; toggling the
// overlay switches "2 6 9" <-> "9 6 2". Reuses the ascending train/held-out split
// (seed 20250626), so `sortHeldOut()` stays disjoint from this corpus too.
export const descendingSortLine = (v: SortVec): string =>
  `sort ${v.join(' ')} => ${[...v].sort((x, y) => y - x).join(' ')}`

/** A descending-sort corpus (~targetChars) from the same training split as the ascending one. */
export function buildDescendingSortCorpus(targetChars = 40000): string {
  const rnd = mulberry32(20250626)
  const vecs = allSortVecs(rnd)
  const train = vecs.slice(Math.floor(vecs.length * 0.2))
  const lines: string[] = []
  let chars = 0
  while (chars < targetChars) {
    const l = descendingSortLine(train[Math.floor(rnd() * train.length)])
    lines.push(l)
    chars += l.length + 1
  }
  return lines.join('\n') + '\n'
}

// ---- "tros" = a NEW, prompt-DISTINGUISHABLE task (the forgetting demo) ------
// "tros" is "sort" spelled backwards, and it sorts backwards (descending) — but under
// a DIFFERENT verb, so one model can hold BOTH `sort → ascending` and `tros → descending`
// (unlike the LoRA demo's same-"sort" prompt, where a single weight set can't do both).
// Uses only in-vocab letters (s,o,r,t), so the ascending sort model tokenizes it unchanged.
// This is the substrate for catastrophic forgetting: fine-tune hard on `tros` and watch
// `sort` degrade — unless you replay/self-distil the old skill.
export const trosLine = (v: SortVec): string =>
  `tros ${v.join(' ')} => ${[...v].sort((x, y) => y - x).join(' ')}`

/** A `tros` (reverse-sort) corpus from the same training split as ascending sort. */
export function buildTrosCorpus(targetChars = 40000): string {
  const rnd = mulberry32(20250626)
  const vecs = allSortVecs(rnd)
  const train = vecs.slice(Math.floor(vecs.length * 0.2))
  const lines: string[] = []
  let chars = 0
  while (chars < targetChars) {
    const l = trosLine(train[Math.floor(rnd() * train.length)])
    lines.push(l)
    chars += l.length + 1
  }
  return lines.join('\n') + '\n'
}

// ---- algebra (single-variable, correct working — the model still can't learn it) ----
export const algebraLine = (rnd: () => number): string => {
  const a = 2 + Math.floor(rnd() * 8) // 2..9
  const x = Math.floor(rnd() * 10) // 0..9
  const b = Math.floor(rnd() * 10) // 0..9
  const c = a * x + b
  return `${a}x + ${b} = ${c} => ${a}x = ${c - b} => x = ${x}`
}

/** An algebra corpus (~targetChars) of correctly-worked single-variable equations. */
export function buildEquationCorpus(targetChars = 40000): string {
  const rnd = mulberry32(424242)
  const lines: string[] = []
  let chars = 0
  while (chars < targetChars) {
    const l = algebraLine(rnd)
    lines.push(l)
    chars += l.length + 1
  }
  return lines.join('\n') + '\n'
}

// ---- extra algorithmic tasks (for the Mixture-of-Experts demo) --------------
// Same 3-digit inputs as sorting, three different operations. All are things a
// tiny model can actually learn, so a MoE trained on the mix has something real
// for its experts to specialise on.
export const maxLine = (v: SortVec): string => `max ${v.join(' ')} => ${Math.max(...v)}`
export const reverseLine = (v: SortVec): string => `rev ${v.join(' ')} => ${[...v].reverse().join(' ')}`

/** One 80/20 train/test split of the 729 vectors, shared by every op so "unseen"
 *  means unseen for all tasks (matches `sortHeldOut`'s seed). */
function sharedSplit(): { train: SortVec[]; test: SortVec[] } {
  const vecs = allSortVecs(mulberry32(20250626))
  const n = Math.floor(vecs.length * 0.2)
  return { test: vecs.slice(0, n), train: vecs.slice(n) }
}
export const maxHeldOut = (): SortVec[] => sharedSplit().test
export const reverseHeldOut = (): SortVec[] => sharedSplit().test
/** The training-split vectors (the 80% the MoE/grok corpus is built from) — used to
 *  measure TRAIN accuracy against held-out accuracy (the memorise→generalise gap). */
export const moeTrainVectors = (): SortVec[] => sharedSplit().train

/** The multi-task corpus for the MoE model: sort + max + reverse, interleaved so
 *  every training window is a mix of tasks, drawn only from the shared train split. */
export function buildMoeCorpus(targetCharsPerTask = 40000): string {
  const rnd = mulberry32(31415926)
  const { train } = sharedSplit()
  const gens: ((v: SortVec) => string)[] = [sortLine, maxLine, reverseLine]
  const pick = () => train[Math.floor(rnd() * train.length)]
  const lines: string[] = []
  const chars = gens.map(() => 0)
  let done = false
  while (!done) {
    done = true
    for (let g = 0; g < gens.length; g++) {
      if (chars[g] < targetCharsPerTask) {
        const l = gens[g](pick())
        lines.push(l)
        chars[g] += l.length + 1
        done = false
      }
    }
  }
  return lines.join('\n') + '\n'
}

// ---- example prompts (for chips / demos) -----------------------------------
export const TASK_EXAMPLES = {
  sort: 'sort 6 9 2 => ',
  algebra: '7x + 2 = 16 => ',
  max: 'max 6 9 2 => ',
  reverse: 'rev 6 9 2 => ',
}
