import { describe, it, expect } from 'vitest'
import { runAdderWith, type ColumnSolver } from '../runAdder'
import { addOracle, columnOracle, columnsOf, longHeldOut } from '../../data/addition'

// A "model" that always answers its column correctly.
const perfect: ColumnSolver = (a, b, cin) => {
  const r = columnOracle(a, b, cin)
  return `${r.digit} ${r.carry}`
}

describe('runAdder — the loop', () => {
  it('is exact on 15-digit sums, far beyond anything the corpus contains', () => {
    for (const [a, b] of longHeldOut(20, 15)) {
      const t = runAdderWith(perfect, a, b)
      expect(t.answer).toBe(addOracle(a, b))
      expect(t.correct).toBe(true)
    }
  })

  it('handles 40 digits — the loop has no length limit at all', () => {
    const a = '9'.repeat(40)
    const b = '1' + '0'.repeat(39)
    expect(runAdderWith(perfect, a, b).answer).toBe(addOracle(a, b))
  })

  it('consults the solver exactly once per column', () => {
    let calls = 0
    const counting: ColumnSolver = (a, b, c) => { calls++; return perfect(a, b, c) }
    runAdderWith(counting, '123456', '7890')
    expect(calls).toBe(columnsOf('123456', '7890').length)
  })

  it('keeps the prompt a CONSTANT size however long the sum — bounded context', () => {
    const short = runAdderWith(perfect, '12', '34')
    const long = runAdderWith(perfect, '9'.repeat(30), '8'.repeat(30))
    expect(long.maxPromptChars).toBe(short.maxPromptChars)
    expect(long.maxPromptChars).toBeLessThan(16) // "add 9 8 1 => "
  })

  it('carries correctly across a long ripple (999…9 + 1)', () => {
    const t = runAdderWith(perfect, '9999999999', '1')
    expect(t.answer).toBe('10000000000')
  })

  it('zero-pads the shorter operand rather than mis-aligning', () => {
    expect(runAdderWith(perfect, '5', '12345').answer).toBe(addOracle('5', '12345'))
  })
})

// The invariant: the harness must never compute. If it were secretly doing the arithmetic,
// a deliberately wrong solver would still produce the right sum. These tests fail loudly
// if anyone ever "helpfully" adds a fallback that computes the column in JS.
describe('runAdder — the harness never computes (invariant)', () => {
  it('a solver that is wrong on ONE column makes the answer wrong in exactly that place', () => {
    const badCol = 2
    const sabotage: ColumnSolver = (a, b, cin) => {
      const r = columnOracle(a, b, cin)
      return calls++ === badCol ? `${(r.digit + 1) % 10} ${r.carry}` : `${r.digit} ${r.carry}`
    }
    let calls = 0
    const t = runAdderWith(sabotage, '111111', '111111')
    expect(t.correct).toBe(false)
    // digits are emitted least-significant first; index from the right
    const got = t.answer.split('').reverse()
    const want = addOracle('111111', '111111').split('').reverse()
    got.forEach((d, i) => {
      if (i === badCol) expect(d).not.toBe(want[i])
      else expect(d).toBe(want[i])
    })
  })

  it('a solver that always answers "0 0" yields all zeros — the harness supplies nothing', () => {
    const t = runAdderWith(() => '0 0', '4821', '9137')
    expect(t.answer).toBe('0')
    expect(t.correct).toBe(false)
  })

  it('an unparseable reply is recorded as a failed step, not silently repaired', () => {
    const t = runAdderWith((a, b, cin) => (a === 1 ? 'garbage' : perfect(a, b, cin)), '1', '1')
    expect(t.steps[0].ok).toBe(false)
    expect(t.steps[0].digit).toBe(null)
    expect(t.answer).toContain('?')
    expect(t.correct).toBe(false)
  })

  it('records the model\'s raw reply for every step so the UI can show the loop', () => {
    const t = runAdderWith(perfect, '81', '19')
    expect(t.steps.map((s) => s.prompt)).toEqual(['add 1 9 0 => ', 'add 8 1 1 => '])
    expect(t.steps.map((s) => s.raw)).toEqual(['0 1', '0 1'])
    expect(t.answer).toBe('100')
  })
})
