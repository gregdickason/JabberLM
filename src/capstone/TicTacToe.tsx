import { useEffect, useMemo, useRef, useState } from 'react'
import { Trainer } from '../engine/trainer'
import { deserialize, type SavedModel } from '../engine/persist'
import { RNG } from '../engine/random'
import { generate } from '../engine/generate'
import { DEFAULT_FEATURE_FLAGS, DEFAULT_SAMPLE_CONFIG, DEFAULT_TRAIN_CONFIG } from '../engine/config'
import {
  EMPTY, applyMove, isDraw, toMove, buildTicTacToeCorpus, allDecisionStates, tacticalStates, sampleTrainState,
  optimalMoves, moveTarget, ticPrompt, parseMove, type Board, type Mark,
} from '../data/tictactoe'
import { agentTurn, TTT_CFG, type AgentTurn } from './tictactoe-agent'
import LineChart from '../viz/LineChart'

// The playable capstone centerpiece. Three opponents you can switch between — an UNDERTRAINED
// model (blunders more), a WELL-TRAINED one (same ~130K params, same architecture — it just saw
// better training DATA, so it plays measurably better and, inside, its heads attend to your
// threats), and one YOU train live in the browser. It's a real agent loop, and the harness
// LEGAL-MOVE CHECK is a toggle: with it on, an illegal (hallucinated) move is rejected and the
// model is asked to choose again (shown as a retry); with it off, the illegal move breaks the
// game. The harness also SURFACES the reasoning — did the move take a win, block your threat, or
// miss one — so you see the agent think.

const LINES: [number, number, number][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6],
]
const winLine = (b: Board): number[] | null => LINES.find((l) => b[l[0]] !== '.' && b[l[0]] === b[l[1]] && b[l[1]] === b[l[2]]) ?? null
const other = (m: Mark): Mark => (m === 'X' ? 'O' : 'X')

async function loadModel(file: string): Promise<Trainer | null> {
  try {
    const res = await fetch(import.meta.env.BASE_URL + file)
    if (!res.ok) return null
    return deserialize((await res.json()) as SavedModel)
  } catch {
    return null
  }
}

type Which = 'weak' | 'strong' | 'live'
type Pt = { x: number; y: number }

export default function TicTacToe({
  onLookInside,
  showBlurb = true,
}: {
  onLookInside?: (b: Board) => void
  /** The embeddable copy (embed.html?demo=tictactoe) drops the budget-lesson paragraph — a host
   *  page brings its own framing — but keeps every control. */
  showBlurb?: boolean
}) {
  const [weak, setWeak] = useState<Trainer | null>(null)
  const [strong, setStrong] = useState<Trainer | null>(null)
  const [which, setWhich] = useState<Which>('weak')
  const [status, setStatus] = useState('loading the agent…')

  const [board, setBoard] = useState<Board>(EMPTY)
  const [humanMark, setHumanMark] = useState<Mark>('X')
  const [validate, setValidate] = useState(true)
  const [thinking, setThinking] = useState(false)
  const [turn, setTurn] = useState<AgentTurn | null>(null)
  const rng = useRef(new RNG(12345))
  const timer = useRef<number | undefined>(undefined)

  // in-browser training of "your" model
  const live = useRef<Trainer | null>(null)
  const [liveReady, setLiveReady] = useState(false)
  const [training, setTraining] = useState(false)
  const [liveStep, setLiveStep] = useState(0)
  const [strength, setStrength] = useState<Pt[]>([])
  const trainingRef = useRef(false)
  const rafRef = useRef(0)
  const stepRef = useRef(0)
  const states = useMemo(() => allDecisionStates(), [])
  const tactical = useMemo(() => tacticalStates(), [])
  const evalSample = useMemo(() => states.filter((_, i) => i % 90 === 0), [states])

  const agentMark = other(humanMark)
  const activeModel = which === 'weak' ? weak : which === 'strong' ? strong : live.current

  useEffect(() => {
    void (async () => {
      const [wk, st] = await Promise.all([loadModel('tictactoe-model.json'), loadModel('tictactoe-strong-model.json')])
      setWeak(wk)
      setStrong(st)
      // build an (untrained) live model for the "train it yourself" mode
      live.current = new Trainer(buildTicTacToeCorpus(150000), TTT_CFG, 7)
      setLiveReady(true)
      if (!wk && !st) { setWhich('live'); setStatus('no bundled agent found — train one below') } else { setWhich(wk ? 'weak' : 'strong'); setStatus('') }
    })()
    return () => { trainingRef.current = false; cancelAnimationFrame(rafRef.current); window.clearTimeout(timer.current) }
  }, [])

  const win = winLine(board)
  const result: null | 'human' | 'agent' | 'draw' = win
    ? (board[win[0]] === humanMark ? 'human' : 'agent')
    : isDraw(board) ? 'draw' : null
  const fumbled = turn?.fumbled && !validate

  // the agent's turn: a beat to "read the board", then it moves (through the harness).
  // NB: `thinking` is NOT a dep and `busyRef` guards re-entry — otherwise setThinking(true)
  // would re-run this effect and its cleanup would cancel the pending timeout (the move never
  // fires and it hangs on "choosing a move").
  const busyRef = useRef(false)
  useEffect(() => {
    const m = activeModel
    if (!m || result || fumbled || busyRef.current) return
    if (toMove(board) !== agentMark) return
    busyRef.current = true
    setThinking(true)
    timer.current = window.setTimeout(() => {
      const t = agentTurn(m.model, m.tok, board, { validate }, rng.current)
      busyRef.current = false
      setThinking(false)
      setTurn(t)
      if (t.move != null) setBoard(applyMove(board, t.move, agentMark))
    }, 700)
    return () => { window.clearTimeout(timer.current); busyRef.current = false }
  }, [board, activeModel, result, fumbled, agentMark, validate])

  function clickCell(i: number) {
    if (!activeModel || thinking || fumbled || result) return
    if (toMove(board) !== humanMark || board[i] !== '.') return
    setTurn(null)
    setBoard(applyMove(board, i, humanMark))
  }
  function newGame(mark: Mark = humanMark) {
    window.clearTimeout(timer.current)
    setHumanMark(mark); setBoard(EMPTY); setTurn(null); setThinking(false)
  }

  // ---- in-browser training (masked SFT on a random optimal move) ----
  function evalStrength(): number {
    const t = live.current
    if (!t) return 0
    let ok = 0
    for (const b of evalSample) {
      const mv = parseMove(generate(t.model, DEFAULT_FEATURE_FLAGS, t.tok, ticPrompt(b), { ...DEFAULT_SAMPLE_CONFIG, temperature: 0, maxNewTokens: 2 }, new RNG(1)).split('\n')[0])
      if (mv != null && optimalMoves(b).includes(mv)) ok++
    }
    return Math.round((100 * ok) / evalSample.length)
  }
  function trainLoop() {
    const t = live.current
    if (!trainingRef.current || !t) return
    const cfg = { ...DEFAULT_TRAIN_CONFIG, batchSize: 16, learningRate: 0.003 } // distillation diverges at higher lr
    for (let i = 0; i < 8; i++) {
      const batch = Array.from({ length: 16 }, () => {
        const b = sampleTrainState(states, tactical, rng.current.next(), rng.current.next())
        return { promptIds: t.tok.encode(ticPrompt(b)), digitTargets: moveTarget(b) }
      })
      t.distillMoveStep(cfg, DEFAULT_FEATURE_FLAGS, batch)
      stepRef.current += 1
    }
    setLiveStep(stepRef.current)
    if (stepRef.current % 48 === 0) setStrength((c) => [...c, { x: stepRef.current, y: evalStrength() }].slice(-300))
    if (trainingRef.current) rafRef.current = requestAnimationFrame(trainLoop)
  }
  function toggleTrain() {
    if (training) { trainingRef.current = false; setTraining(false); cancelAnimationFrame(rafRef.current); return }
    setWhich('live'); trainingRef.current = true; setTraining(true); rafRef.current = requestAnimationFrame(trainLoop)
  }
  function resetLive() {
    trainingRef.current = false; setTraining(false); cancelAnimationFrame(rafRef.current)
    live.current = new Trainer(buildTicTacToeCorpus(150000), TTT_CFG, 7)
    stepRef.current = 0; setLiveStep(0); setStrength([])
  }

  // Sizes above are rem-based so the demo scales with the root font size (embed.html's
  // ?scale=). The chart draws to a canvas in real pixels, so give it the same factor.
  const remPx = useMemo(
    () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16,
    [],
  )

  const cellColor = (c: string) => (c === 'X' ? '#38bdf8' : c === 'O' ? '#fbbf24' : 'transparent')
  const a = turn
  const reason = a?.analysis
  if (!weak && !strong && !liveReady) return <div className="text-xs text-slate-500">{status}</div>

  const modelBtn = (w: Which, label: string, ok: boolean) => (
    <button
      className={'rounded px-2 py-0.5 text-[0.6875rem] ' + (which === w ? 'bg-fuchsia-700 text-white' : 'bg-slate-800 text-slate-300') + (ok ? '' : ' opacity-40')}
      onClick={() => setWhich(w)} disabled={!ok}
    >{label}</button>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-500">opponent:</span>
        {modelBtn('weak', 'undertrained', !!weak)}
        {modelBtn('strong', 'well-trained', !!strong)}
        {modelBtn('live', 'your live model', liveReady)}
        <span className="ml-auto text-slate-500">
          {which === 'live' ? `trained ${liveStep} steps` : '~130K params'}
        </span>
      </div>

      {/* the budget lesson: same size, same architecture — the difference is how LONG it trained */}
      {showBlurb && which !== 'live' && (
        <p className="max-w-3xl rounded border border-slate-800 bg-slate-900/40 p-2 text-[0.6875rem] leading-relaxed text-slate-400">
          Both bundled agents are the <b>same ~130K-parameter model, same architecture</b> — the difference is the
          training <b>budget</b>. The <b className="text-slate-200">undertrained</b> one trained for <b>100 steps</b>:
          1,600 positions, about a <b>third of one pass</b> over the game. The <b className="text-emerald-300">well-trained</b>
          one went over every reachable position again and again, with a sharper target. Result, scored over{' '}
          <b>all 4,520</b> positions: optimal moves <b>24% → 98%</b>, blocking <b>18% → 92%</b>, and it now{' '}
          <b>never loses to a random opponent</b>. The ceiling was never the model's size — same brain, longer education.
          And when you <b>look inside</b> (below), its attention heads swing onto your threat far harder
          (<b>0.20 → 0.79</b> on the 1,484 boards where you threaten to win).
          {which === 'weak' && <> The undertrained one is <b>barely a player</b>: in <b>60% of positions its top pick is a
            cell that is already taken</b>. Watch the harness legal-move check catch it, turn after turn — and untick the
            check to see what happens without it.</>}
          {which === 'strong' && <> With the well-trained model, notice the harness legal-move check <b>rarely fires</b> — its
            moves are already legal, so it needs the guard less. A better model leans on the harness less.</>}
        </p>
      )}

      <div className="flex flex-wrap gap-6">
        <div>
          <div className="grid grid-cols-3 gap-1" style={{ width: '12.5rem' }}>
            {Array.from({ length: 9 }, (_, i) => {
              const inWin = win?.includes(i)
              const yours = toMove(board) === humanMark && !result && !fumbled && !!activeModel
              // highlight what the harness flagged (a threat the agent should block / a win to take)
              const flag = reason && !result ? (reason.missedBlock === i ? 'ring-2 ring-red-400' : reason.madeBlock && a?.move === i ? 'ring-2 ring-emerald-400' : '') : ''
              return (
                <button key={i} onClick={() => clickCell(i)} disabled={!yours || board[i] !== '.'}
                  className={'flex h-16 w-16 items-center justify-center rounded border text-3xl font-bold ' +
                    (inWin ? 'border-emerald-400 bg-emerald-900/30 ' : 'border-slate-700 bg-slate-900/60 ') + flag + ' ' +
                    (yours && board[i] === '.' ? 'cursor-pointer hover:bg-slate-800 ' : 'cursor-default ')}
                  style={{ color: cellColor(board[i]) }}>
                  {/* the cell INDEX — big enough to read from the back of a room (it is what the
                      model actually emits, so an audience needs to see it), but still clearly
                      secondary to the text-3xl X/O marks */}
                  {board[i] === '.' ? <span className="text-xl font-normal text-slate-500">{i}</span> : board[i]}
                </button>
              )
            })}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <button className="rounded border border-emerald-600 bg-emerald-900/40 px-2 py-1 text-emerald-200" onClick={() => newGame()}>↺ New game</button>
            <button className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-slate-200" onClick={() => newGame(other(humanMark))}>play as {other(humanMark)}</button>
            {onLookInside && board !== EMPTY && <button className="rounded border border-fuchsia-700 bg-fuchsia-950/40 px-2 py-1 text-fuchsia-200" onClick={() => onLookInside(board)} title="Inspect this exact position below">🔍 look inside this move</button>}
            <span className="text-slate-400">
              {result === 'human' ? '🎉 you win!' : result === 'agent' ? 'the agent wins' : result === 'draw' ? 'a draw' :
                thinking ? <span className="text-sky-300">reading the board…</span> :
                toMove(board) === humanMark ? `your move (${humanMark})` : 'agent to move'}
            </span>
          </div>
        </div>

        <div className="min-w-[17.5rem] flex-1 space-y-3">
          {/* the harness check toggle — the key control */}
          <label className="flex items-start gap-2 rounded border border-slate-700 bg-slate-900/50 p-2 text-[0.75rem]">
            <input type="checkbox" checked={validate} onChange={(e) => { setValidate(e.target.checked); if (fumbled) setTurn(null) }} className="mt-0.5" />
            <span><b>Harness legal-move check</b> <span className="text-slate-500">({validate ? 'on' : 'off'})</span>
              <div className="text-[0.6875rem] text-slate-500">a deterministic guard over the probabilistic model. On: it rejects an illegal move and asks the model to try again. Off: the model can fumble.</div></span>
          </label>

          {/* ALWAYS-ON per-move harness loop: observe → act → check → apply, every turn */}
          <div className="rounded border border-slate-700 bg-slate-900/50 p-2 text-[0.6875rem] leading-relaxed">
            <div className="mb-1 font-semibold text-slate-300">the harness loop — this move</div>
            {thinking ? (
              <div className="text-sky-300">1 · harness → agent: sends the board … the agent is choosing a move</div>
            ) : !a ? (
              <div className="text-slate-500">your move — the agent's turn will trace here (observe → act → check → apply)</div>
            ) : (
              <ol className="space-y-0.5">
                <li><span className="text-slate-500">1 · harness → agent:</span> here's the board <span className="text-slate-500">(observe)</span></li>
                <li><span className="text-slate-500">2 · agent → harness:</span> “play cell <b className="text-sky-300">{a.attempts[0].move}</b>” <span className="text-slate-500">({Math.round((a.cellProbs[a.attempts[0].move] ?? 0) * 100)}% confident, act)</span></li>
                <li>
                  <span className="text-slate-500">3 · harness checks:</span>{' '}
                  {a.attempts.length === 1 && a.attempts[0].legal ? (
                    <span className="text-emerald-300">cell {a.move} is legal ✓</span>
                  ) : fumbled ? (
                    <span className="text-red-300">cell {a.attempts[0].move} is <b>taken ✗</b> — and the check is <b>OFF</b>, so nothing catches it</span>
                  ) : (
                    <span className="font-mono">
                      {a.attempts.map((at, i) => (
                        <span key={i}>{i > 0 && ' → '}<span className={at.legal ? 'text-emerald-300' : 'text-red-300'}>{at.kind === 'fallback' ? `harness plays ${at.move}` : at.kind === 'resample' ? `re-ask ${at.move} ${at.legal ? '✓' : '✗'}` : `cell ${at.move} ${at.legal ? '✓' : '✗ taken'}`}</span></span>
                      ))}
                      {a.caught && <span className="text-amber-300"> — caught it</span>}
                    </span>
                  )}
                </li>
                {!fumbled && reason && (
                  <li>
                    <span className="text-slate-500">4 · harness reads it:</span>{' '}
                    {reason.tookWin ? <span className="text-emerald-300">🏆 took the win at {a.move}</span>
                      : reason.madeBlock ? <span className="text-emerald-300">🛡 blocked your threat at {a.move}</span>
                      : reason.missedBlock != null ? <span className="text-red-300">⚠ missed a block at {reason.missedBlock} — you can win next!</span>
                      : reason.missedWin != null ? <span className="text-amber-300">😴 missed its own win at {reason.missedWin}</span>
                      : <span className="text-slate-300">a positional move</span>}
                  </li>
                )}
                <li>
                  <span className="text-slate-500">{fumbled ? '—' : '5 · harness applies:'}</span>{' '}
                  {fumbled ? (
                    <span className="text-red-300">the game is stuck. <button className="rounded border border-emerald-600 bg-emerald-900/40 px-2 py-0.5 text-emerald-200" onClick={() => { setValidate(true); setTurn(null) }}>turn the check on</button></span>
                  ) : result ? <span className="text-slate-300">placed at {a.move} — game over</span>
                    : <span className="text-slate-300">placed <b className="text-amber-300">{a.move}</b> → back to you</span>}
                </li>
              </ol>
            )}
          </div>

          {/* move-confidence strip */}
          {a && (
            <div>
              <div className="mb-1 text-[0.6875rem] text-slate-400">the model's confidence over the 9 cells (its pick)</div>
              <div className="grid grid-cols-3 gap-0.5" style={{ width: '8.3125rem' }}>
                {a.cellProbs.map((p, i) => (
                  <div key={i} className="relative h-9 w-[2.6875rem] overflow-hidden rounded bg-slate-800" title={`cell ${i}: ${Math.round(p * 100)}%`}>
                    <div className="absolute bottom-0 w-full" style={{ height: `${Math.round(p * 100)}%`, background: i === a.attempts[0].move ? '#38bdf8' : '#475569' }} />
                    <div className="absolute inset-0 flex items-center justify-center text-[0.5625rem] text-slate-300">{i}·{Math.round(p * 100)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* train your own agent in the browser */}
      <div className="rounded border border-slate-800 bg-slate-900/40 p-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-300">Train your own agent, live:</span>
          <button className={'rounded border px-3 py-1 ' + (training ? 'border-amber-600 bg-amber-900/40 text-amber-200' : 'border-emerald-600 bg-emerald-900/40 text-emerald-200')} onClick={toggleTrain}>
            {training ? '⏸ Pause' : liveStep > 0 ? '▶ Resume' : '▶ Train from scratch'}
          </button>
          <button className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-slate-200" onClick={resetLive}>↺ Reset</button>
          <span className="text-slate-500">{liveStep} steps · plays {strength.at(-1)?.y ?? 0}% optimal moves — switch the opponent to "your live model" and play it as it learns</span>
        </div>
        {strength.length > 1 && (
          <div className="mt-2">
            <LineChart series={[{ label: 'optimal-move rate', color: '#34d399', points: strength }]} width={Math.round(27.5 * remPx)} height={Math.round(8.75 * remPx)} yLabel="%" />
          </div>
        )}
      </div>
    </div>
  )
}
