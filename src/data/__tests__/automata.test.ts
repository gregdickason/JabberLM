import { describe, it, expect } from 'vitest'
import {
  ruleRow,
  singleCellSeed,
  evolve,
  buildAutomatonCorpus,
  buildRandomBits,
  matchedCorpora,
  RULE_30,
  RULE_110,
} from '../automata'

// Render a run from a single live cell as strings, so the known opening rows of each rule can
// be checked by eye against any published picture of it.
const rowsAsText = (rule: number, n: number, width: number) =>
  evolve(rule, n, width, singleCellSeed(width)).map((r) => r.join(''))

describe('elementary cellular automata', () => {
  it('reproduces the opening rows of rule 30 from a single live cell', () => {
    // Rule 30's familiar triangle: symmetric for one step, then it breaks to the left.
    expect(rowsAsText(RULE_30, 4, 11)).toEqual([
      '00000100000',
      '00001110000',
      '00011001000',
      '00110111100',
    ])
  })

  it('reproduces the opening rows of rule 110 from a single live cell', () => {
    // Rule 110 grows to the left only — the asymmetry is characteristic.
    expect(rowsAsText(RULE_110, 4, 11)).toEqual([
      '00000100000',
      '00001100000',
      '00011100000',
      '00110100000',
    ])
  })

  it('applies the rule number as the lookup table it is', () => {
    // Rule 0 kills everything; rule 255 fills everything. Both are pure table lookups.
    expect(ruleRow(0, [1, 1, 1, 0, 1])).toEqual([0, 0, 0, 0, 0])
    expect(ruleRow(255, [0, 0, 0, 0, 0])).toEqual([1, 1, 1, 1, 1])
  })

  it('wraps at the lattice edges, so no cell is a special case', () => {
    // Rule 16 is 00010000: the only live neighbourhood is 100, i.e. a cell lives when its LEFT
    // neighbour is live. Put the sole live cell at the far right and the only cell it can bring
    // to life is index 0 — which it can reach solely by the ring wrapping.
    expect(ruleRow(16, [0, 0, 0, 1])).toEqual([1, 0, 0, 0])
    // Rule 2 (neighbourhood 001) reaches leftward instead, and stays inside the row.
    expect(ruleRow(2, [0, 0, 0, 1])).toEqual([0, 0, 1, 0])
  })

  it('is deterministic for a given rule and seed row', () => {
    const a = buildAutomatonCorpus(RULE_110, { width: 32, chars: 500 })
    const b = buildAutomatonCorpus(RULE_110, { width: 32, chars: 500 })
    expect(a).toBe(b)
  })
})

describe('matched corpora', () => {
  const chars = 4_000
  const width = 64
  const sets = matchedCorpora(chars, width, 1_000)

  it('gives every source exactly the same number of characters', () => {
    for (const s of sets) {
      expect(s.train).toHaveLength(chars)
      expect(s.held).toHaveLength(1_000)
    }
  })

  it('gives every source exactly the same alphabet', () => {
    const alphabet = (s: string) => [...new Set(s)].sort().join('')
    const expected = '\n01'
    for (const s of sets) {
      expect(alphabet(s.train)).toBe(expected)
      expect(alphabet(s.held)).toBe(expected)
    }
  })

  it('holds out a genuine continuation, not a reshuffle of the training text', () => {
    for (const s of sets) expect(s.train.includes(s.held.slice(0, 200))).toBe(false)
  })

  it('labels the three sources the demo names', () => {
    expect(sets.map((s) => s.label)).toEqual([
      'rule 110 (structured)',
      'rule 30 (chaotic)',
      'random bits',
    ])
  })

  it('produces different content per source despite the identical shape', () => {
    const [a, b, c] = sets
    expect(a.train).not.toBe(b.train)
    expect(b.train).not.toBe(c.train)
  })
})

describe('random bits', () => {
  it('is reproducible for a seed and different across seeds', () => {
    expect(buildRandomBits({ chars: 300, seed: 7 })).toBe(buildRandomBits({ chars: 300, seed: 7 }))
    expect(buildRandomBits({ chars: 300, seed: 7 })).not.toBe(buildRandomBits({ chars: 300, seed: 8 }))
  })

  it('is close to balanced, so the model cannot win by always guessing one symbol', () => {
    const s = buildRandomBits({ chars: 5_000, seed: 99 })
    const ones = [...s].filter((c) => c === '1').length
    const zeros = [...s].filter((c) => c === '0').length
    expect(Math.abs(ones - zeros) / (ones + zeros)).toBeLessThan(0.05)
  })
})
