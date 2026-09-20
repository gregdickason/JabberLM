import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { deserialize, type SavedModel } from '../../engine/persist'
import { DEFAULT_FEATURE_FLAGS } from '../../engine/config'
import { allDecisionStates, optimalMoves, ticPrompt, type Board } from '../tictactoe'
import { CALIBRATION, CAL_EXAMPLES, readSpread, type AgentKey } from '../calibration'
import type { Model } from '../../engine/model'
import type { CharTokenizer } from '../../engine/tokenizer'

// The cached sweeps in calibration.ts are quoted on the lab tab and in the blog dispatch, so
// they must not drift silently when a tic-tac-toe bundle is retrained. This recomputes them
// from the shipped weights and fails if they have moved — the same discipline the gradient
// checks apply to the engine.

const load = (f: string) => deserialize(JSON.parse(readFileSync(`public/${f}`, 'utf8')) as SavedModel)
const FILES: Record<AgentKey, string> = {
  weak: 'tictactoe-model.json',
  strong: 'tictactoe-strong-model.json',
}

function cellProbs(model: Model, tok: CharTokenizer, board: Board): number[] {
  const ids = tok.encode(ticPrompt(board))
  const { logits } = model.forward(
    ids.slice(Math.max(0, ids.length - model.cfg.contextLen)),
    DEFAULT_FEATURE_FLAGS,
  )
  const V = logits.cols
  const base = (logits.rows - 1) * V
  const cell = Array.from({ length: 9 }, (_, c) => {
    const id = tok.stoi.get(String(c))
    return id != null ? logits.data[base + id] : -Infinity
  })
  const mx = Math.max(...cell)
  const exps = cell.map((l) => (l === -Infinity ? 0 : Math.exp(l - mx)))
  const sum = exps.reduce((a, b) => a + b, 0) || 1
  return exps.map((e) => (100 * e) / sum)
}

describe('cached calibration data matches the shipped weights', () => {
  for (const key of ['weak', 'strong'] as AgentKey[]) {
    it(`${key}: headline figures are current`, () => {
      const t = load(FILES[key])
      const states = allDecisionStates()
      let min = 100
      let max = 0
      let mean = 0
      let cOpt = 0
      let nOpt = 0
      let cNot = 0
      let nNot = 0
      for (const b of states) {
        const p = cellProbs(t.model, t.tok, b)
        const { top, topPct } = readSpread(p, optimalMoves(b))
        min = Math.min(min, topPct)
        max = Math.max(max, topPct)
        mean += topPct
        if (optimalMoves(b).includes(top)) {
          cOpt += topPct
          nOpt++
        } else {
          cNot += topPct
          nNot++
        }
      }
      const c = CALIBRATION[key]
      expect(states.length).toBe(c.n)
      expect(min).toBeCloseTo(c.min, 2)
      expect(max).toBeCloseTo(c.max, 2)
      expect(mean / states.length).toBeCloseTo(c.mean, 1)
      expect(cOpt / (nOpt || 1)).toBeCloseTo(c.saidOpt, 1)
      expect(cNot / (nNot || 1)).toBeCloseTo(c.saidNot, 1)
    }, 120_000)
  }

  it('the tie rate the whole lesson rests on is current', () => {
    const states = allDecisionStates()
    const ties = states.filter((b) => optimalMoves(b).length > 1).length
    // a property of the game, not of any model, so both sweeps carry the same number
    expect((100 * ties) / states.length).toBeCloseTo(CALIBRATION.weak.tiePct, 1)
    expect(CALIBRATION.strong.tiePct).toBe(CALIBRATION.weak.tiePct)
  })

  it('the worked examples still say what the copy says they say', () => {
    const models = { weak: load(FILES.weak), strong: load(FILES.strong) }
    for (const ex of CAL_EXAMPLES) {
      for (const key of ['weak', 'strong'] as AgentKey[]) {
        const live = cellProbs(models[key].model, models[key].tok, ex.board)
        ex[key].forEach((cached, i) => expect(live[i]).toBeCloseTo(cached, 0))
      }
      expect(optimalMoves(ex.board)).toEqual(ex.optimal)
    }
  }, 60_000)

  it('the undertrained agent returns the SAME distribution on every example board', () => {
    // This is the finding the tab leads on: its confidence cannot vary with the position
    // because it is not reading the position. If a retrain changes that, the copy is wrong.
    const first = CAL_EXAMPLES[0].weak
    for (const ex of CAL_EXAMPLES) expect(ex.weak).toEqual(first)
    expect(CALIBRATION.weak.max - CALIBRATION.weak.min).toBeLessThan(0.05)
  })
})
