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

// ---- example prompts (for chips / demos) -----------------------------------
export const TASK_EXAMPLES = {
  sort: 'sort 6 9 2 => ',
  algebra: '7x + 2 = 16 => ',
}
