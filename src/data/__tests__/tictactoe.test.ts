import { describe, it, expect } from 'vitest'
import { Trainer } from '../../engine/trainer'
import { generate } from '../../engine/generate'
import { RNG } from '../../engine/random'
import { DEFAULT_FEATURE_FLAGS, DEFAULT_SAMPLE_CONFIG, DEFAULT_TRAIN_CONFIG, type ModelConfig } from '../../engine/config'
import {
  EMPTY, legalMoves, applyMove, winner, isDraw, isTerminal, toMove, negamax, optimalMoves,
  allDecisionStates, tacticalStates, sampleTrainState, moveTarget, buildTicTacToeCorpus, ticPrompt, parseMove, winningCells,
  type Board, type Mark,
} from '../tictactoe'

// ---- pure rules + minimax ---------------------------------------------------

describe('tic-tac-toe (pure)', () => {
  it('detects wins, draws and turns', () => {
    expect(winner('XXX......')).toBe('X')
    expect(winner('O..O..O..')).toBe('O')
    expect(winner(EMPTY)).toBe(null)
    expect(toMove(EMPTY)).toBe('X') // X first
    expect(toMove('X........')).toBe('O')
    expect(isDraw('XOXXOOOXX')).toBe(true) // full, no line
    expect(isTerminal('XXX.O.O..')).toBe(true)
  })

  it('minimax finds an immediate win and the block', () => {
    // X to move (2 vs 2), can complete the top row at cell 2
    const b: Board = 'XX.OO....'
    expect(toMove(b)).toBe('X')
    const nm = negamax(b)
    expect(nm.value).toBe(1) // winnable
    expect(nm.best).toContain(2)
    // O to move must block X's two-in-a-row
    const b2: Board = 'XX...O...'
    expect(toMove(b2)).toBe('O')
    expect(optimalMoves(b2)).toContain(2) // block the win
  })

  it('tic-tac-toe is a draw under optimal play (never loses)', () => {
    expect(negamax(EMPTY).value).toBe(0)
    // play a full game with both sides optimal → a draw
    let b: Board = EMPTY
    while (!isTerminal(b)) b = applyMove(b, optimalMoves(b)[0], toMove(b))
    expect(winner(b)).toBe(null)
    expect(isDraw(b)).toBe(true)
  })

  it('enumerates the reachable non-terminal decision states', () => {
    const all = allDecisionStates()
    expect(all.length).toBeGreaterThan(2000) // ~4500 reachable non-terminal states
    all.forEach((b) => expect(isTerminal(b)).toBe(false))
    expect(new Set(all).size).toBe(all.length) // no duplicates
  })

  it('parseMove reads the first cell digit', () => {
    expect(parseMove('4')).toBe(4)
    expect(parseMove('play 7 ...')).toBe(7)
    expect(parseMove('nope')).toBe(null)
  })
})

// ---- feasibility: does a tiny model learn to play? (heavy — skipped) --------

const CFG: ModelConfig = { vocabSize: 0, dModel: 64, nHeads: 4, nLayers: 3, contextLen: 32, dFF: 192, activation: 'gelu', weightTying: true }

function agentMove(t: Trainer, b: Board, harnessCheck = true): number {
  const out = generate(t.model, DEFAULT_FEATURE_FLAGS, t.tok, ticPrompt(b), { ...DEFAULT_SAMPLE_CONFIG, temperature: 0, maxNewTokens: 2 }, new RNG(1))
  let mv = parseMove(out.split('\n')[0])
  const legal = legalMoves(b)
  if (harnessCheck && (mv == null || !legal.includes(mv))) mv = legal[0] // the harness check-layer fallback
  return mv == null ? legal[0] : mv
}
function playVs(t: Trainer, agent: Mark, opponent: (b: Board) => number): 'win' | 'draw' | 'loss' {
  let b: Board = EMPTY
  while (!isTerminal(b)) {
    const mk = toMove(b)
    b = applyMove(b, mk === agent ? agentMove(t, b) : opponent(b), mk)
  }
  const w = winner(b)
  return w === agent ? 'win' : w === null ? 'draw' : 'loss'
}

describe('tic-tac-toe SFT feasibility', () => {
  it.skip('learns to play a good game (rarely loses)', { timeout: 600000 }, () => {
    const t = new Trainer(buildTicTacToeCorpus(150000), CFG, 1337)
    const cfg = { ...DEFAULT_TRAIN_CONFIG, batchSize: 16, learningRate: 0.01 }
    const states = allDecisionStates()
    const tactical = tacticalStates()
    const brng = new RNG(999)
    // SOFT-TARGET DISTILLATION of minimax's per-cell value policy (illegal→0, win→high,
    // block-preferred), tactical states oversampled. Denser + better-ranked than one-hot SFT,
    // and it teaches "never an occupied cell" — fixing the near-uniform output of plain SFT.
    const makeBatch = (bs: number) => Array.from({ length: bs }, () => {
      const b = sampleTrainState(states, tactical, brng.next(), brng.next())
      return { promptIds: t.tok.encode(ticPrompt(b)), digitTargets: moveTarget(b) }
    })
    for (let i = 0; i < 4000; i++) t.distillMoveStep(cfg, DEFAULT_FEATURE_FLAGS, makeBatch(16))

    // policy quality over a sample of ALL reachable states (the agent trained on all of them)
    const sample = states.filter((_, i) => i % 12 === 0)
    let legal = 0, optimal = 0
    for (const b of sample) {
      const raw = parseMove(generate(t.model, DEFAULT_FEATURE_FLAGS, t.tok, ticPrompt(b), { ...DEFAULT_SAMPLE_CONFIG, temperature: 0, maxNewTokens: 2 }, new RNG(1)).split('\n')[0])
      if (raw != null && legalMoves(b).includes(raw)) legal++
      if (raw != null && optimalMoves(b).includes(raw)) optimal++
    }
    // TACTICAL accuracy — on game-deciding states, does it take the win / block the threat?
    let tac = 0, tacN = 0
    for (const b of tactical.filter((_, i) => i % 4 === 0)) {
      const mk = toMove(b)
      const wins = winningCells(b, mk), threats = winningCells(b, mk === 'X' ? 'O' : 'X')
      const mv = parseMove(generate(t.model, DEFAULT_FEATURE_FLAGS, t.tok, ticPrompt(b), { ...DEFAULT_SAMPLE_CONFIG, temperature: 0, maxNewTokens: 2 }, new RNG(1)).split('\n')[0])
      tacN++
      if (mv != null && (wins.length ? wins.includes(mv) : threats.includes(mv))) tac++
    }
    // game outcomes — the real "is it a decent opponent?" test (harness check makes moves legal)
    const rng = new RNG(7)
    const randOpp = (b: Board) => { const l = legalMoves(b); return l[Math.floor(rng.next() * l.length)] }
    const optOpp = (b: Board) => optimalMoves(b)[0]
    let lossesVsRandom = 0
    for (let g = 0; g < 60; g++) if (playVs(t, g % 2 ? 'O' : 'X', randOpp) === 'loss') lossesVsRandom++
    const vsOptX = playVs(t, 'X', optOpp), vsOptO = playVs(t, 'O', optOpp)

    // eslint-disable-next-line no-console
    console.log(`[ttt] params=${t.model.params.reduce((n, p) => n + p.size, 0)} states=${states.length} | ` +
      `raw legal ${Math.round(100 * legal / sample.length)}% · optimal ${Math.round(100 * optimal / sample.length)}% · ` +
      `TACTICAL (win/block) ${Math.round(100 * tac / tacN)}% | losses vs random ${lossesVsRandom}/60 · vs optimal X=${vsOptX} O=${vsOptO}`)

    expect(lossesVsRandom).toBeLessThan(6) // a decent opponent rarely loses even to random play
  })
})
