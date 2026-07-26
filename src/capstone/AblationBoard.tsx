import { useMemo, useState } from 'react'
import type { Model } from '../engine/model'
import type { CharTokenizer } from '../engine/tokenizer'
import { DEFAULT_FEATURE_FLAGS } from '../engine/config'
import { ticPrompt, toMove, winningCells, tacticalStates, type Board } from '../data/tictactoe'
import { MiniBoard } from './AttentionBoard'

// Head ablation, on the game: zero an attention head (Model.forward `ablate` set of "l.h" keys)
// and watch the agent's play degrade. Reuses the injury/recovery idea from the lab, but the
// metric is "does it still take wins / block threats?" on the actual game, so you can watch a
// SPECIFIC head turn out to be the one the tactical skill depends on.

// a fixed set of game-deciding boards (win-now / block-now) to score against — small so it's live-cheap
const TESTS: Board[] = tacticalStates().filter((_, i) => i % 20 === 0)

/** The model's move (argmax over cell tokens) on a board, honouring a head ablation. */
function move(model: Model, tok: CharTokenizer, board: Board, ablate?: Set<string>): number {
  const ids = tok.encode(ticPrompt(board))
  const { logits } = model.forward(ids, DEFAULT_FEATURE_FLAGS, undefined, false, undefined, undefined, ablate)
  const V = logits.cols, base = (logits.rows - 1) * V
  let best = 0
  for (let c = 1; c < 9; c++) { const a = tok.stoi.get(String(c)), b = tok.stoi.get(String(best)); if ((a != null ? logits.data[base + a] : -Infinity) > (b != null ? logits.data[base + b] : -Infinity)) best = c }
  return best
}
/** % of the deciding boards where the ablated model still plays the win/block. */
function tacticalRate(model: Model, tok: CharTokenizer, ablate?: Set<string>): number {
  let ok = 0
  for (const b of TESTS) {
    const mk = toMove(b), wins = winningCells(b, mk), threats = winningCells(b, mk === 'X' ? 'O' : 'X')
    const mv = move(model, tok, b, ablate)
    if (wins.length ? wins.includes(mv) : threats.includes(mv)) ok++
  }
  return Math.round((100 * ok) / TESTS.length)
}

export default function AblationBoard({ model, tok, board }: { model: Model; tok: CharTokenizer; board: Board }) {
  const { nLayers, nHeads } = model.cfg
  const [dead, setDead] = useState<Set<string>>(new Set())

  // baseline + per-head importance (drop when each head alone is ablated) — computed once
  const { base, drop } = useMemo(() => {
    const base = tacticalRate(model, tok)
    const drop: Record<string, number> = {}
    for (let l = 0; l < nLayers; l++) for (let h = 0; h < nHeads; h++) drop[`${l}.${h}`] = base - tacticalRate(model, tok, new Set([`${l}.${h}`]))
    return { base, drop }
  }, [model])

  const nowRate = useMemo(() => tacticalRate(model, tok, dead), [model, dead])
  const healthyMove = useMemo(() => move(model, tok, board), [model, board])
  const ablatedMove = useMemo(() => move(model, tok, board, dead), [model, board, dead])
  const mk = toMove(board), threat = winningCells(board, mk === 'X' ? 'O' : 'X'), wins = winningCells(board, mk)
  const correct = (c: number) => (wins.length ? wins.includes(c) : threat.includes(c))
  const maxDrop = Math.max(1, ...Object.values(drop))

  function toggle(k: string) { setDead((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n }) }

  return (
    <div className="space-y-3">
      <p className="max-w-3xl text-[12px] leading-relaxed text-slate-400">
        Knock out an attention head (click it) and the harness plays on with the damaged model. Watch its
        <b> tactical rate</b> — how often it still takes a win or blocks a threat — and its move on this board.
        Redder heads matter more; there's usually <b>one critical head</b> the whole skill leans on.
      </p>
      <div className="flex flex-wrap items-start gap-6">
        {/* head grid, coloured by importance */}
        <div>
          <div className="mb-1 text-[11px] text-slate-400">attention heads — click to ablate (redder = more critical)</div>
          <div className="inline-block rounded border border-slate-800 p-1">
            {Array.from({ length: nLayers }, (_, l) => (
              <div key={l} className="flex items-center gap-1">
                <span className="w-12 shrink-0 text-[10px] text-slate-500">layer {l}</span>
                {Array.from({ length: nHeads }, (_, h) => {
                  const k = `${l}.${h}`, isDead = dead.has(k), imp = drop[k] / maxDrop
                  return (
                    <button key={k} onClick={() => toggle(k)} title={`ablating ${k} drops tactical rate by ${drop[k]}pts`}
                      className={'m-0.5 flex h-9 w-11 items-center justify-center rounded border text-[10px] ' +
                        (isDead ? 'border-red-500 bg-red-900/70 text-red-200 line-through' : 'border-slate-600 text-slate-200')}
                      style={isDead ? undefined : { background: `rgba(239,68,68,${0.12 + 0.6 * imp})` }}>
                      {l}.{h}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          <div className="mt-2 text-[12px]">
            tactical rate: <span className="font-mono text-emerald-300">{base}%</span> healthy →{' '}
            <span className={'font-mono ' + (nowRate < base - 5 ? 'text-red-300' : 'text-slate-200')}>{nowRate}%</span> {dead.size ? 'ablated' : ''}
            {dead.size > 0 && nowRate < base - 5 && <span className="ml-1 text-red-300">— it's forgetting how to block</span>}
          </div>
        </div>

        {/* this board: move healthy vs ablated */}
        <div className="flex gap-4">
          <div>
            <div className="mb-1 text-[11px] text-slate-400">healthy → plays {healthyMove} {correct(healthyMove) ? '✓' : '✗'}</div>
            <MiniBoard board={board} vals={Array(9).fill(0).map((_, c) => (c === healthyMove ? 0.9 : 0))} highlight={threat} size={34} />
          </div>
          <div>
            <div className="mb-1 text-[11px] text-slate-400">ablated → plays {ablatedMove} {correct(ablatedMove) ? '✓' : '✗'}</div>
            <MiniBoard board={board} vals={Array(9).fill(0).map((_, c) => (c === ablatedMove ? 0.9 : 0))} highlight={threat} size={34} />
          </div>
        </div>
      </div>
      <p className="max-w-3xl text-[11px] leading-relaxed text-slate-500">
        This is the lab's <a className="text-fuchsia-300 hover:underline" href="./lab.html#injury-recovery">injury &amp; recovery</a> demo, on the agent you just played: a skill can live mostly
        in one head, and removing it breaks that skill while leaving the rest intact.
      </p>
    </div>
  )
}
