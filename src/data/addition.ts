// Multi-digit addition, decomposed by column — the REASONING-LOOP task.
//
// The teaching point is not "a tiny model can't add" (it can: ~90K params reach 95% on
// 4-digit sums, given ~4x the training of 3-digit). The point is the three ways of USING
// a model, all runnable on one set of weights:
//
//   single pass   `sum 8172 5166 => 13338`                     model does it in one forward
//   reasoning loop `sum 8172 5166 => 2+6+0=8,0 | ... => 13338`  model writes its own working
//   harness loop  harness feeds ONE column at a time            harness remembers, model adds
//
// The harness form is the one that scales: the model never sees more than three digits, so
// arbitrarily long sums work with a FIXED context. Bounded context, unbounded problem.
//
// INVARIANT: the harness may remember and route, but must never compute. Every arithmetic
// fact comes from the model. This file provides the digit slicing and the oracle; it does
// NOT let the harness shortcut the addition (see `src/harness/runAdder.ts`).

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SEED = 20260814

// ---- the single-column primitive -------------------------------------------
// The model's atom: digit + digit + carry-in => digit, carry-out. Exactly 10*10*2 = 200
// cases, so the shipped model is trained on ALL of them. That is deliberate and worth
// saying plainly: we teach it the addition table, the same way a child memorises it. The
// REASONING is the loop, not the table.

export interface Column {
  a: number
  b: number
  cin: number
}
export interface ColumnResult {
  digit: number
  carry: number
}

/** Ground truth for one column. The only place a column sum is computed in this file. */
export function columnOracle(a: number, b: number, cin: number): ColumnResult {
  const s = a + b + cin
  return { digit: s % 10, carry: s >= 10 ? 1 : 0 }
}

/** The prompt the model conditions on for one column. */
export const colPrompt = (a: number, b: number, cin: number): string => `add ${a} ${b} ${cin} => `

/** One training line for the column primitive: `add 8 1 0 => 9 0`. */
export function colLine(a: number, b: number, cin: number): string {
  const { digit, carry } = columnOracle(a, b, cin)
  return `${colPrompt(a, b, cin)}${digit} ${carry}`
}

/** Every reachable column: 10 x 10 x 2 = 200. */
export function allColumns(): Column[] {
  const out: Column[] = []
  for (let a = 0; a <= 9; a++) for (let b = 0; b <= 9; b++) for (let cin = 0; cin <= 1; cin++) out.push({ a, b, cin })
  return out
}

/** Read the model's reply to a column prompt. Tolerates trailing junk; rejects carry > 1. */
export function parseColumn(text: string): ColumnResult | null {
  const m = text.trim().match(/^(\d)\s+(\d)/)
  if (!m) return null
  const carry = Number(m[2])
  if (carry > 1) return null
  return { digit: Number(m[1]), carry }
}

// ---- whole-sum formats (single pass and self-trace) -------------------------

/** Ground truth for the whole sum. BigInt so arbitrarily long operands stay exact. */
export const addOracle = (a: string, b: string): string => (BigInt(a) + BigInt(b)).toString()

export const sumPrompt = (a: string, b: string): string => `sum ${a} ${b} => `

/** Single pass: `sum 8172 5166 => 13338`. */
export const sumLine = (a: string, b: string): string => `${sumPrompt(a, b)}${addOracle(a, b)}`

/**
 * Right-to-left column pairs, as digits. Pure string slicing — no arithmetic. This is what
 * the harness uses to build each prompt, and it is why the harness never adds anything.
 */
export function columnsOf(a: string, b: string): [number, number][] {
  const n = Math.max(a.length, b.length)
  const pa = a.padStart(n, '0')
  const pb = b.padStart(n, '0')
  const out: [number, number][] = []
  for (let i = n - 1; i >= 0; i--) out.push([Number(pa[i]), Number(pb[i])])
  return out
}

/**
 * The model writing its own working:
 *   `sum 8172 5166 => 2+6+0=8,0 | 7+6+0=3,1 | 1+1+1=3,0 | 8+5+0=3,1 => 13338`
 * Each step is one column, right to left, carrying into the next. The final answer follows.
 */
export function traceLine(a: string, b: string): string {
  const steps: string[] = []
  let carry = 0
  for (const [da, db] of columnsOf(a, b)) {
    const r = columnOracle(da, db, carry)
    steps.push(`${da}+${db}+${carry}=${r.digit},${r.carry}`)
    carry = r.carry
  }
  return `${sumPrompt(a, b)}${steps.join(' | ')} => ${addOracle(a, b)}`
}

/** Pull the per-column results back out of a trace — lets us score the working, not just
 *  the answer, and check that a trace actually reconstructs its own final sum. */
export function parseTrace(completion: string): { steps: ColumnResult[]; answer: string | null } {
  const [work, tail] = completion.split('=>')
  const steps: ColumnResult[] = []
  for (const seg of (work ?? '').split('|')) {
    const m = seg.trim().match(/^\d\+\d\+\d=(\d),(\d)$/)
    if (m) steps.push({ digit: Number(m[1]), carry: Number(m[2]) })
  }
  const ans = (tail ?? '').trim().match(/^\d+/)
  return { steps, answer: ans ? ans[0] : null }
}

/** Digits of the sum implied by a list of column results (least-significant first), plus a
 *  final carry if there is one. Used to verify a trace is internally consistent. */
export function digitsFromSteps(steps: ColumnResult[]): string {
  const digits = steps.map((s) => s.digit).reverse()
  const last = steps[steps.length - 1]
  const lead = last && last.carry ? '1' : ''
  return (lead + digits.join('')).replace(/^0+(?=\d)/, '')
}

// ---- corpus -----------------------------------------------------------------

const randInt = (rnd: () => number, lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1))

/** A random operand with 1..maxDigits digits, no leading zero. */
function randOperand(rnd: () => number, maxDigits: number): string {
  const n = randInt(rnd, 1, maxDigits)
  let s = String(randInt(rnd, 1, 9))
  for (let i = 1; i < n; i++) s += String(randInt(rnd, 0, 9))
  return s
}

export interface AdditionCorpusOpts {
  /** repeats of the exhaustive 200-column set (the primitive the harness loop depends on) */
  columnRepeats?: number
  /** whole-sum examples in each of the single-pass and self-trace formats */
  wholeExamples?: number
  /** operands are capped at this many digits — the harness loop is what exceeds it */
  maxDigits?: number
}

/**
 * One corpus, three formats, so ONE set of weights runs all three modes and the comparison
 * is fair. Whole-sum examples are capped at `maxDigits`; that cap is exactly why the single
 * pass fails on long sums while the harness loop does not.
 */
export function buildAdditionCorpus(opts: AdditionCorpusOpts = {}): string {
  const { columnRepeats = 40, wholeExamples = 6000, maxDigits = 4 } = opts
  const rnd = mulberry32(SEED)
  const lines: string[] = []
  const cols = allColumns()
  for (let r = 0; r < columnRepeats; r++) for (const c of cols) lines.push(colLine(c.a, c.b, c.cin))
  for (let i = 0; i < wholeExamples; i++) {
    const a = randOperand(rnd, maxDigits)
    const b = randOperand(rnd, maxDigits)
    lines.push(sumLine(a, b))
    lines.push(traceLine(a, b))
  }
  for (let i = lines.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[lines[i], lines[j]] = [lines[j], lines[i]]
  }
  return lines.join('\n') + '\n'
}

/** Held-out operand pairs for end-to-end scoring, disjoint from the corpus seed. */
export function additionHeldOut(count = 60, digits = 4): [string, string][] {
  const rnd = mulberry32(SEED ^ 0x5eed)
  return Array.from({ length: count }, () => [randOperand(rnd, digits), randOperand(rnd, digits)] as [string, string])
}

/** Long pairs — beyond anything in the corpus. Only the harness loop should get these right. */
export function longHeldOut(count = 30, digits = 15): [string, string][] {
  const rnd = mulberry32(SEED ^ 0x10c9)
  const exact = (r: () => number) => {
    let s = String(randInt(r, 1, 9))
    for (let i = 1; i < digits; i++) s += String(randInt(r, 0, 9))
    return s
  }
  return Array.from({ length: count }, () => [exact(rnd), exact(rnd)] as [string, string])
}
