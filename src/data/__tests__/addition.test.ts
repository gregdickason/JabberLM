import { describe, it, expect } from 'vitest'
import {
  allColumns, colLine, colPrompt, columnOracle, parseColumn, addOracle, sumLine, sumPrompt,
  columnsOf, traceLine, parseTrace, digitsFromSteps, buildAdditionCorpus, additionHeldOut, longHeldOut,
} from '../addition'

describe('column primitive (the model\'s atom)', () => {
  it('covers exactly 10 x 10 x 2 = 200 distinct columns', () => {
    const cols = allColumns()
    expect(cols.length).toBe(200)
    expect(new Set(cols.map((c) => `${c.a},${c.b},${c.cin}`)).size).toBe(200)
  })

  it('columnOracle agrees with plain arithmetic on every column', () => {
    for (const { a, b, cin } of allColumns()) {
      const { digit, carry } = columnOracle(a, b, cin)
      expect(digit + 10 * carry).toBe(a + b + cin)
      expect(carry === 0 || carry === 1).toBe(true)
    }
  })

  it('parseColumn round-trips every colLine', () => {
    for (const { a, b, cin } of allColumns()) {
      const line = colLine(a, b, cin)
      const completion = line.slice(colPrompt(a, b, cin).length)
      expect(parseColumn(completion)).toEqual(columnOracle(a, b, cin))
    }
  })

  it('parseColumn tolerates trailing junk and rejects nonsense', () => {
    expect(parseColumn('9 0')).toEqual({ digit: 9, carry: 0 })
    expect(parseColumn('  3 1 xyz')).toEqual({ digit: 3, carry: 1 })
    expect(parseColumn('3 7')).toBe(null) // carry can only be 0 or 1
    expect(parseColumn('nope')).toBe(null)
    expect(parseColumn('')).toBe(null)
  })
})

describe('whole-sum oracle and formats', () => {
  it('addOracle is exact on long operands (BigInt, not float)', () => {
    expect(addOracle('8172', '5166')).toBe('13338')
    expect(addOracle('999', '1')).toBe('1000')
    // 20 digits — well past what Number can represent exactly
    expect(addOracle('99999999999999999999', '1')).toBe('100000000000000000000')
  })

  it('sumLine is the prompt plus the true answer', () => {
    expect(sumLine('8172', '5166')).toBe('sum 8172 5166 => 13338')
    expect(sumPrompt('12', '3')).toBe('sum 12 3 => ')
  })

  it('columnsOf pairs digits right-to-left and zero-pads the shorter operand', () => {
    expect(columnsOf('8172', '5166')).toEqual([[2, 6], [7, 6], [1, 1], [8, 5]])
    expect(columnsOf('12', '3')).toEqual([[2, 3], [1, 0]])
    expect(columnsOf('5', '7')).toEqual([[5, 7]])
  })
})

describe('self-trace', () => {
  it('produces one step per column, carrying correctly', () => {
    expect(traceLine('8172', '5166')).toBe(
      'sum 8172 5166 => 2+6+0=8,0 | 7+6+0=3,1 | 1+1+1=3,0 | 8+5+0=3,1 => 13338',
    )
  })

  it('trace intermediates reconstruct the final answer, on many random pairs', () => {
    for (const [a, b] of additionHeldOut(200, 5)) {
      const line = traceLine(a, b)
      const completion = line.slice(sumPrompt(a, b).length)
      const { steps, answer } = parseTrace(completion)
      expect(steps.length).toBe(columnsOf(a, b).length)
      expect(answer).toBe(addOracle(a, b))
      // the working alone must imply the answer — not just sit next to it
      expect(digitsFromSteps(steps)).toBe(addOracle(a, b))
    }
  })
})

describe('corpus', () => {
  it('mixes all three formats so one model runs all three modes', () => {
    const corpus = buildAdditionCorpus({ columnRepeats: 1, wholeExamples: 50 })
    const lines = corpus.trim().split('\n')
    expect(lines.filter((l) => l.startsWith('add ')).length).toBe(200)
    expect(lines.filter((l) => l.startsWith('sum ') && !l.includes('|') && !l.includes('+')).length).toBe(50)
    expect(lines.filter((l) => l.includes('|') || /\d\+\d\+\d=/.test(l)).length).toBe(50)
  })

  it('caps whole-sum operands so long sums are genuinely out of distribution', () => {
    const corpus = buildAdditionCorpus({ columnRepeats: 1, wholeExamples: 400, maxDigits: 4 })
    for (const l of corpus.trim().split('\n')) {
      const m = l.match(/^sum (\d+) (\d+) /)
      if (m) {
        expect(m[1].length).toBeLessThanOrEqual(4)
        expect(m[2].length).toBeLessThanOrEqual(4)
      }
    }
  })

  it('held-out sets are deterministic and long pairs are the stated width', () => {
    expect(additionHeldOut(5)).toEqual(additionHeldOut(5))
    for (const [a, b] of longHeldOut(10, 15)) {
      expect(a.length).toBe(15)
      expect(b.length).toBe(15)
      expect(a[0]).not.toBe('0')
    }
  })
})
