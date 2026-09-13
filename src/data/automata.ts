/**
 * Elementary cellular automata, and a matched stream of true random bits.
 *
 * These exist for one demo: three corpora of exactly the same length, over exactly the same
 * alphabet, two of them produced by a deterministic three-line rule and one of them genuinely
 * random. On the classical account of information they are interchangeable — same number of
 * bits, and a deterministic generator adds nothing. Train the same tiny model on each and the
 * loss curves separate completely.
 *
 * That separation is the point. What a learner can extract from data depends on how much
 * computation it can spend looking, so "structure" and "noise" are facts about the observer as
 * much as about the data. Rule 30 is the specimen that makes it uncomfortable: it is fully
 * deterministic, its centre column passes randomness tests, and to a model this size it is
 * indistinguishable from the random stream sitting next to it.
 *
 * An elementary CA is a row of cells, each 0 or 1, updated in lockstep. A cell's next value
 * depends only on itself and its two neighbours — eight possible neighbourhoods, so a rule is
 * eight bits, and the rule number IS those bits. Rule 30 is 00011110; rule 110 is 01101110.
 *
 * Pure (no DOM, no React, no Tensor) so it tests under vitest's node environment.
 */

import { RNG } from '../engine/random'

/** The alphabet every corpus here shares: two cell states plus the row separator. */
export const CELL_ON = '1'
export const CELL_OFF = '0'
export const ROW_SEP = '\n'

/**
 * One step of an elementary CA. `prev` is a row of 0/1 numbers; the row wraps at both ends,
 * so the lattice is a ring and no cell is a special case.
 *
 * The neighbourhood (left, self, right) reads as a 3-bit number 0-7, and the rule's bit at
 * that position is the new value: `(rule >> n) & 1`. That one line is the whole of an
 * elementary CA.
 */
export function ruleRow(rule: number, prev: readonly number[]): number[] {
  const n = prev.length
  const out = new Array<number>(n)
  for (let i = 0; i < n; i++) {
    const l = prev[(i - 1 + n) % n]
    const c = prev[i]
    const r = prev[(i + 1) % n]
    const idx = (l << 2) | (c << 1) | r
    out[i] = (rule >> idx) & 1
  }
  return out
}

/** The canonical starting row: a single live cell in the middle of a dead lattice. */
export function singleCellSeed(width: number): number[] {
  const row = new Array<number>(width).fill(0)
  row[width >> 1] = 1
  return row
}

/** A random starting row, for when a single cell would take many rows to fill the lattice. */
export function randomSeed(width: number, seed: number): number[] {
  const rng = new RNG(seed)
  return Array.from({ length: width }, () => (rng.next() < 0.5 ? 0 : 1))
}

/** Successive rows of the automaton, as arrays. */
export function evolve(rule: number, rows: number, width: number, start?: readonly number[]): number[][] {
  let row = start ? [...start] : singleCellSeed(width)
  const out: number[][] = [row]
  for (let r = 1; r < rows; r++) {
    row = ruleRow(rule, row)
    out.push(row)
  }
  return out
}

const render = (rows: readonly (readonly number[])[]): string =>
  rows.map((r) => r.map((c) => (c ? CELL_ON : CELL_OFF)).join('')).join(ROW_SEP) + ROW_SEP

export interface CorpusOpts {
  /** Cells per row. */
  width?: number
  /** Total characters to emit, including row separators — so corpora can be matched exactly. */
  chars?: number
  /** Seed for the starting row. Omit for the canonical single live cell. */
  seed?: number
}

/**
 * A corpus of automaton rows, cut to exactly `chars` characters.
 *
 * Cutting to a character count rather than a row count is what lets three different sources be
 * compared honestly: the model sees the same number of characters of each, so any difference in
 * the loss curve is a difference in what the data affords, not in how much of it there was.
 *
 * Rule 30 from a single live cell is seeded randomly instead, because a single cell leaves the
 * first rows nearly empty and a short corpus would then be mostly zeros — which would flatter
 * the model for reasons that have nothing to do with the rule.
 */
export function buildAutomatonCorpus(rule: number, opts: CorpusOpts = {}): string {
  const { width = 64, chars = 12_000, seed } = opts
  const start = seed === undefined ? singleCellSeed(width) : randomSeed(width, seed)
  const rowsNeeded = Math.ceil(chars / (width + ROW_SEP.length)) + 1
  return render(evolve(rule, rowsNeeded, width, start)).slice(0, chars)
}

/**
 * True random bits in the same row layout, so it is character-for-character comparable with an
 * automaton corpus. This is the control: a bounded learner cannot compress it, and neither can
 * an unbounded one.
 */
export function buildRandomBits(opts: CorpusOpts = {}): string {
  const { width = 64, chars = 12_000, seed = 1337 } = opts
  const rng = new RNG(seed)
  const rows = Math.ceil(chars / (width + ROW_SEP.length)) + 1
  const out: number[][] = Array.from({ length: rows }, () =>
    Array.from({ length: width }, () => (rng.next() < 0.5 ? 0 : 1)),
  )
  return render(out).slice(0, chars)
}

/** Rule 110 is Turing-complete; rule 30 is Wolfram's standard chaotic specimen. */
export const RULE_110 = 110
export const RULE_30 = 30

/**
 * The three matched corpora the demo trains on, plus a held-out continuation of each that the
 * model never sees. The continuation is what makes the comparison honest: a model can memorise
 * the training characters of anything given enough steps, so only held-out loss says whether it
 * found the rule.
 */
export interface MatchedCorpora {
  label: string
  train: string
  held: string
}

export function matchedCorpora(chars = 12_000, width = 64, heldChars = 3_000): MatchedCorpora[] {
  // The held-out slice is a LATER stretch of the same process, taken by generating a longer run
  // and cutting past the training portion — a genuine continuation, not a reshuffle.
  const longer = (rule: number, seed?: number) =>
    buildAutomatonCorpus(rule, { width, chars: chars + heldChars, seed })

  const r110 = longer(RULE_110)
  const r30 = longer(RULE_30, 0xc0ffee)
  const rnd = buildRandomBits({ width, chars: chars + heldChars, seed: 1337 })

  return [
    { label: 'rule 110 (structured)', train: r110.slice(0, chars), held: r110.slice(chars) },
    { label: 'rule 30 (chaotic)', train: r30.slice(0, chars), held: r30.slice(chars) },
    { label: 'random bits', train: rnd.slice(0, chars), held: rnd.slice(chars) },
  ]
}
