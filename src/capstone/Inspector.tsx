import { useEffect, useMemo, useState } from 'react'
import { Trainer } from '../engine/trainer'
import { deserialize, type SavedModel } from '../engine/persist'
import { toMove, winningCells, type Board } from '../data/tictactoe'
import AttentionBoard, { threatFocus } from './AttentionBoard'
import AblationBoard from './AblationBoard'
import SaeBoard from './SaeBoard'

// "Look inside the agent" — the interpretability payoff. The Part-III lab tools (attention,
// ablation, SAE) applied to the Part-IV agent you just played, projected onto the board. You can
// inspect EITHER bundled model (undertrained / well-trained) and compare: same architecture, same
// size — but the well-trained model's heads attend to your threat far more (the mechanistic
// reason it plays better). That contrast is the whole point.

const PRESETS: { label: string; board: Board }[] = [
  { label: 'you threaten a row', board: 'XX....O..' }, // O to move, must block cell 2
  { label: 'the agent can win', board: 'OO.XX.X..' }, // O to move, wins at cell 2
  { label: 'the opening', board: '.........' },
]
type Tab = 'attention' | 'ablation' | 'dictionary'
type Sel = 'weak' | 'strong'

export default function Inspector({ board, onBoard }: { board: Board; onBoard: (b: Board) => void }) {
  const [weak, setWeak] = useState<Trainer | null>(null)
  const [strong, setStrong] = useState<Trainer | null>(null)
  const [status, setStatus] = useState('loading the agent to inspect…')
  const [tab, setTab] = useState<Tab>('attention')
  const [sel, setSel] = useState<Sel>('strong')

  useEffect(() => {
    void (async () => {
      const load = async (f: string) => { try { const r = await fetch(import.meta.env.BASE_URL + f); return r.ok ? deserialize((await r.json()) as SavedModel) : null } catch { return null } }
      const [wk, st] = await Promise.all([load('tictactoe-model.json'), load('tictactoe-strong-model.json')])
      setWeak(wk); setStrong(st)
      if (!wk && !st) setStatus('could not load the model'); else { setSel(st ? 'strong' : 'weak'); setStatus('') }
    })()
  }, [])

  const mk = toMove(board), threat = winningCells(board, mk === 'X' ? 'O' : 'X'), win = winningCells(board, mk)

  // live threat-focus comparison — the headline contrast, computed from BOTH models on this board
  const focus = useMemo(() => ({
    weak: weak && threat.length ? threatFocus(weak.model, weak.tok, board, threat) : null,
    strong: strong && threat.length ? threatFocus(strong.model, strong.tok, board, threat) : null,
  }), [weak, strong, board, threat.join(',')])

  if (!weak && !strong) return <div className="text-xs text-slate-400">{status}</div>

  const t = sel === 'weak' ? weak : strong
  const note = win.length ? `the agent (${mk}) can win at ${win.join('/')}` : threat.length ? `you threaten to win at ${threat.join('/')} — the agent (${mk}) must block` : `the agent (${mk}) to move`
  const modelBtn = (s: Sel, label: string, ok: boolean) => (
    <button key={s} disabled={!ok} onClick={() => setSel(s)}
      className={'rounded px-2 py-0.5 text-[11px] ' + (sel === s ? 'bg-fuchsia-700 text-white' : 'bg-slate-800 text-slate-300') + (ok ? '' : ' opacity-40')}>{label}</button>
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-400">inspect which model:</span>
        {modelBtn('weak', 'undertrained', !!weak)}
        {modelBtn('strong', 'well-trained', !!strong)}
        <span className="ml-3 text-slate-400">inspect a position:</span>
        {PRESETS.map((p) => (
          <button key={p.label} className={'rounded px-2 py-0.5 text-[11px] ' + (board === p.board ? 'bg-fuchsia-700 text-white' : 'bg-slate-800 text-slate-300')} onClick={() => onBoard(p.board)}>{p.label}</button>
        ))}
        <span className="ml-2 text-slate-400 font-mono">{note}</span>
      </div>

      {/* the headline contrast: how hard each model looks at YOUR threat (same board, same size) */}
      {threat.length > 0 && focus.weak != null && focus.strong != null && (
        <div className="flex flex-wrap items-center gap-3 rounded border border-slate-800 bg-slate-900/40 p-2 text-[11px]">
          <span className="text-slate-400">attention on your threat cell (cell {threat.join('/')}):</span>
          <span className="text-amber-300">undertrained <b>{Math.round(focus.weak * 100)}%</b></span>
          <span className="text-slate-400">vs</span>
          <span className="text-emerald-300">well-trained <b>{Math.round(focus.strong * 100)}%</b></span>
          <span className="text-slate-400">— same 130K model; better training taught the heads to look at the danger.</span>
        </div>
      )}

      <div className="flex flex-wrap gap-1 border-b border-slate-800 pb-2 text-[11px]">
        {(['attention', 'ablation', 'dictionary'] as const).map((x) => (
          <button key={x} onClick={() => setTab(x)} className={'rounded px-2 py-1 ' + (tab === x ? 'bg-fuchsia-700 font-semibold text-white' : 'bg-slate-800 text-slate-300')}>
            {x === 'attention' ? 'attention on the board' : x === 'ablation' ? 'ablate a head' : 'dictionary (SAE)'}
          </button>
        ))}
      </div>
      {t && tab === 'attention' && <AttentionBoard key={sel} model={t.model} tok={t.tok} board={board} />}
      {t && tab === 'ablation' && <AblationBoard key={sel} model={t.model} tok={t.tok} board={board} />}
      {t && tab === 'dictionary' && <SaeBoard key={sel} model={t.model} tok={t.tok} />}
    </div>
  )
}
