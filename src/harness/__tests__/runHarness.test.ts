import { describe, it, expect } from 'vitest'
import { harnessDispatch } from '../runHarness'

// harnessDispatch is the model-independent core of the harness: parse a (possibly
// corrupted) call, validate it, and run the real JS tool — the tool result is
// authoritative, so it fixes whatever the model guessed.
describe('harness dispatch', () => {
  it('runs a valid call and overrides the model\'s (wrong) arithmetic', () => {
    const r = harnessDispatch('sum(6 9 2) = 18') // model guessed 18…
    expect(r.parsed).toEqual({ tool: 'sum', args: [6, 9, 2] })
    expect(r.toolResult).toBe('17') // …harness computes 17
    expect(r.modelGuess).toBe('18')
    expect(r.error).toBeNull()
  })

  it('runs sort/max/reverse correctly regardless of the model guess', () => {
    expect(harnessDispatch('sort(8 2 5) = 9 9 9').toolResult).toBe('2 5 8')
    expect(harnessDispatch('max(4 1 7) = 7').toolResult).toBe('7')
    expect(harnessDispatch('reverse(3 9 1) = ?').toolResult).toBe('1 9 3')
  })

  it('catches malformed / unknown calls instead of crashing (robustness)', () => {
    expect(harnessDispatch('srt(6 9').error).toBeTruthy() // missing paren + typo
    expect(harnessDispatch('sum() = 0').error).toBeTruthy() // no args
    expect(harnessDispatch('nonsense').error).toBeTruthy()
    expect(harnessDispatch('srt(6 9').toolResult).toBeNull()
  })
})
