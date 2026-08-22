import { useMemo, useState } from 'react'
import type { Model } from '../engine/model'
import type { CharTokenizer } from '../engine/tokenizer'
import { DEFAULT_FEATURE_FLAGS } from '../engine/config'
import { ticPrompt, toMove, winningCells, type Board } from '../data/tictactoe'

// Look inside a MOVE: project each attention head's focus (at the move-decision position)
// back onto the 3×3 board. The tic-tac-toe prompt is "move 0X1O2.… => ", so cell c's tokens
// sit at positions 5+2c (index) and 6+2c (mark) — we sum a head's attention on those to get
// "how much this head looked at cell c" when it chose. Reveals that heads are specialised
// per-cell readers, and (honestly) that they don't dynamically lock onto YOUR threat — which
// is why the tiny model misses blocks.

/** A 3×3 board with each cell tinted by a 0..1 value (the attention overlay). */
export function MiniBoard({ board, vals, highlight, size = 30 }: { board: Board; vals: number[]; highlight?: number[]; size?: number }) {
  return (
    <div className="grid grid-cols-3 gap-px rounded bg-slate-800 p-px" style={{ width: size * 3 + 2 }}>
      {Array.from({ length: 9 }, (_, c) => (
        <div
          key={c}
          className="flex items-center justify-center font-bold"
          style={{
            width: size, height: size, fontSize: size * 0.4,
            background: `rgba(56,189,248,${Math.min(1, vals[c] ?? 0)})`,
            outline: highlight?.includes(c) ? '2px solid #f87171' : undefined,
            outlineOffset: -2,
            color: board[c] === 'X' ? '#0ea5e9' : board[c] === 'O' ? '#f59e0b' : '#475569',
          }}
        >
          {board[c] === '.' ? '·' : board[c]}
        </div>
      ))}
    </div>
  )
}

/** The strongest attention any head (across all layers) places on a threat cell's tokens at the
 *  move-decision position — "how hard did the model look at the danger?" (0..1). The well-trained
 *  model scores markedly higher here than the undertrained one: the mechanistic payoff. */
export function threatFocus(model: Model, tok: CharTokenizer, board: Board, threat: number[]): number {
  if (!threat.length) return 0
  const ids = tok.encode(ticPrompt(board))
  const { trace } = model.forward(ids, DEFAULT_FEATURE_FLAGS, undefined, true)
  const seq = ids.length, last = seq - 1
  let mx = 0
  for (let l = 0; l < model.cfg.nLayers; l++)
    for (let h = 0; h < model.cfg.nHeads; h++) {
      const attn = trace!.layers[l].heads[h].attn
      for (const c of threat) { const v = attn.data[last * seq + (5 + 2 * c)] + attn.data[last * seq + (6 + 2 * c)]; if (v > mx) mx = v }
    }
  return mx
}

export default function AttentionBoard({ model, tok, board }: { model: Model; tok: CharTokenizer; board: Board }) {
  const { nLayers, nHeads } = model.cfg
  const [sel, setSel] = useState<[number, number]>([0, 0])

  // one collecting forward gives every head's attention at once
  const perHead = useMemo(() => {
    const ids = tok.encode(ticPrompt(board))
    const { trace } = model.forward(ids, DEFAULT_FEATURE_FLAGS, undefined, true)
    const seq = ids.length, last = seq - 1
    const out: number[][][] = []
    for (let l = 0; l < nLayers; l++) {
      out[l] = []
      for (let h = 0; h < nHeads; h++) {
        const attn = trace!.layers[l].heads[h].attn
        out[l][h] = Array.from({ length: 9 }, (_, c) => attn.data[last * seq + (5 + 2 * c)] + attn.data[last * seq + (6 + 2 * c)])
      }
    }
    return out
  }, [model, board, nLayers, nHeads])

  // the threat the human made (so we can mark it and ask "did the head look there?")
  const mk = toMove(board)
  const threat = winningCells(board, mk === 'X' ? 'O' : 'X')
  // how hard the strongest head looks at the danger, right now (0..1) — the headline number
  const focus = threat.length ? Math.max(...perHead.flat().map((vals) => Math.max(...threat.map((c) => vals[c])))) : 0
  const looksHard = focus >= 0.5

  return (
    <div className="space-y-3">
      <p className="max-w-3xl text-[12px] leading-relaxed text-slate-400">
        This overlays each attention head's focus, <b>at the moment it chose its move</b>, back onto the board —
        brighter = looked harder. Notice the heads are <b>specialised per-cell readers</b> (each mostly watches
        one square). {threat.length > 0 && <>Your threat is <span className="text-red-300">ringed</span> — see which heads actually look there.
          Strongest focus on your threat cell here: <b className={looksHard ? 'text-emerald-300' : 'text-amber-300'}>{Math.round(focus * 100)}%</b>
          {' '}<span className="text-slate-500">(toggle undertrained ↔ well-trained above to compare).</span></>}
      </p>
      <div className="flex flex-wrap gap-3">
        {perHead.map((layer, l) =>
          layer.map((vals, h) => (
            <button key={`${l}.${h}`} onClick={() => setSel([l, h])} className={'rounded p-1 ' + (sel[0] === l && sel[1] === h ? 'bg-fuchsia-900/50 ring-1 ring-fuchsia-400' : 'hover:bg-slate-800')}>
              <div className="mb-0.5 text-[10px] text-slate-400">head {l}.{h}</div>
              <MiniBoard board={board} vals={vals} highlight={threat} size={24} />
            </button>
          )),
        )}
      </div>
      <div className="flex flex-wrap items-center gap-4 border-t border-slate-800 pt-3">
        <div>
          <div className="mb-1 text-[11px] text-slate-400">head <b>{sel[0]}.{sel[1]}</b> — where it looked</div>
          <MiniBoard board={board} vals={perHead[sel[0]][sel[1]]} highlight={threat} size={44} />
        </div>
        <p className="max-w-sm text-[11px] leading-relaxed text-slate-500">
          Each head reads roughly one square — together they carry the whole board into the residual stream.
          {threat.length === 0 ? (
            <> Put a threat on the board (or pick a "you threaten a row" preset) to see whether the heads track it.</>
          ) : looksHard ? (
            <> Here a head <b>swings onto your threat</b> — its focus is <em>dynamic</em>, tracking the danger, not just
              a fixed square. That's the mechanistic payoff of better training: the well-trained model learned to
              <em> attend to what's at risk</em>, which is why it blocks more.</>
          ) : (
            <> But the focus is <b>positional, not dynamic</b>: the heads barely swing onto <em>your</em> threat when
              you make one. That's the mechanistic reason the undertrained ~130K model misses blocks — it <em>sees</em>
              every cell but doesn't <em>attend to the danger</em>.</>
          )}
          {' '}The next panel proves which head matters by knocking it out. Same technique, deeper, in the
          {' '}<a className="text-fuchsia-300 hover:underline" href="./lab.html?tab=attention-heads">lab's attention-heads tab</a>.
        </p>
      </div>
    </div>
  )
}
