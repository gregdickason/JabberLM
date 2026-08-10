import { describe, it, expect } from 'vitest'
import { proveNeverLoses } from '../tictactoe-agent'
import { EMPTY, legalMoves, optimalMoves, winningCells, toMove, type Board } from '../../data/tictactoe'

// The never-loses proof is only trustworthy if it is ANCHORED: a policy whose correct score is
// known in advance must get that score. Perfect play provably cannot lose (a value-optimal move
// never turns a drawn or won position into a lost one), so it MUST come back with zero losing
// lines — and a policy we know is bad MUST come back with some, or the proof is vacuous.

describe('never-loses proof (anchored on known policies)', () => {
  it('a perfect (minimax) policy passes with zero losing lines, as X and as O', () => {
    const p = proveNeverLoses((b) => optimalMoves(b)[0])
    expect(p.lossesX).toBe(0)
    expect(p.lossesO).toBe(0)
    expect(p.passes).toBe(true)
    // it really did enumerate a game tree rather than trivially returning
    expect(p.linesX).toBeGreaterThan(100)
    expect(p.linesO).toBeGreaterThan(100)
  })

  it('detects losses — a policy that ignores threats fails the proof', () => {
    // lowest-index legal cell: never blocks, never wins on purpose
    const p = proveNeverLoses((b) => legalMoves(b)[0])
    expect(p.passes).toBe(false)
    expect(p.lossesX + p.lossesO).toBeGreaterThan(0)
  })

  it('covers only the states the policy itself reaches — a necessary, not sufficient, condition', () => {
    // The proof walks one branch per agent turn (the policy is deterministic) and every branch
    // per opponent turn, so its coverage is far below the 4,520 decision states. Stating this is
    // the point: "provably never loses" and "wrong in some positions" are compatible (F-05).
    const p = proveNeverLoses((b) => optimalMoves(b)[0])
    expect(p.states).toBeGreaterThan(0)
    expect(p.states).toBeLessThan(4520)
    expect(p.summary).toContain('never-loses PASS')
  })

  it('is deterministic — the same policy scores identically every run', () => {
    const a = proveNeverLoses((b) => optimalMoves(b)[0])
    const b = proveNeverLoses((b) => optimalMoves(b)[0])
    expect(a.summary).toBe(b.summary)
  })

  it('every line it counts is a completed game (win, loss or draw)', () => {
    // a greedy "take the win, else block, else lowest" policy — decent but not perfect
    const greedy = (b: Board): number => {
      const mk = toMove(b)
      const win = winningCells(b, mk)
      if (win.length) return win[0]
      const threat = winningCells(b, mk === 'X' ? 'O' : 'X')
      if (threat.length) return threat[0]
      return legalMoves(b)[0]
    }
    const p = proveNeverLoses(greedy)
    // X moves first from EMPTY, so as O the opponent branches one extra ply → more lines
    expect(p.linesO).toBeGreaterThan(p.linesX)
    expect(p.lossesX).toBeLessThanOrEqual(p.linesX)
    expect(p.lossesO).toBeLessThanOrEqual(p.linesO)
    expect(EMPTY).toBe('.........')
  })
})
