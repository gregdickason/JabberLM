import { useEffect, useMemo, useRef, useState } from 'react'
import SiteNav from '../components/SiteNav'
import LineChart from '../viz/LineChart'
import { ConvergenceGate } from '../lab/converged'
import { Trainer } from '../engine/trainer'
import { DEFAULT_FEATURE_FLAGS, DEFAULT_TRAIN_CONFIG } from '../engine/config'
import {
  buildWarehouseCorpus, trainBaskets, heldOutBaskets, warePrompt, warehouseReward,
  ATTR,
} from '../data/warehouse'
import { CAPSTONE_CFG, heldOutStats, loadWarehouseModel, runBasket, type AgentRun } from './agent'
import WarehouseDemo from './WarehouseDemo'
import ConceptMap from './ConceptMap'
import TicTacToe from './TicTacToe'
import Inspector from './Inspector'
import { type Board } from '../data/tictactoe'

// ---- live two-phase trainer knobs (from the offline Phase-0 sweep) ----------
const WARM_TARGET = 70 // % held-out accuracy to hand SFT → RL (or WARM_CAP steps, whichever first)
const WARM_CAP = 2500
const RL_CAP = 1200
// First eval at ~step 20 (so it's clear something's happening early), then only every 60 —
// each eval runs a batch of held-out inferences (a visible pause), so keep it infrequent.
const evalInterval = (s: number) => (s < 40 ? 20 : 60)
const HELD = heldOutBaskets().slice(0, 16)
const RL_PROMPTS = trainBaskets().map(warePrompt)
const SFT = '#f59e0b', RL = '#34d399', REW = '#38bdf8'

// RL reward = the verifier's correctness (1/0). RL samples its own attempts on unseen orders
// and reinforces the correct ones, so it can push accuracy ABOVE the SFT plateau from the
// reward alone — no new labels (the same idea as the lab's RLVR tab, on a multi-step agent).
const rlReward = (prompt: string, completion: string): number => warehouseReward(prompt, completion)

type Pt = { x: number; y: number }
type View = 'bundled' | 'live'

export default function CapstoneApp() {
  const [bundled, setBundled] = useState<Trainer | null>(null)
  const [bundledStatus, setBundledStatus] = useState('loading the trained agent…')
  const [view, setView] = useState<View>('bundled')

  const [inspectBoard, setInspectBoard] = useState<Board>('XX....O..') // the position the interpretability inspector shows

  // live trainer
  const [running, setRunning] = useState(false)
  const [phase, setPhase] = useState<'warmup' | 'rl'>('warmup')
  const [step, setStep] = useState(0)
  const [accSft, setAccSft] = useState<Pt[]>([])
  const [accRl, setAccRl] = useState<Pt[]>([])
  const [reward, setReward] = useState<Pt[]>([])
  const [attempts, setAttempts] = useState<AgentRun[]>([])
  const [autoPaused, setAutoPaused] = useState<'converged' | 'cap' | null>(null)
  const [liveReady, setLiveReady] = useState(false)

  const live = useRef<Trainer | null>(null)
  const runningRef = useRef(false)
  const phaseRef = useRef<'warmup' | 'rl'>('warmup')
  const stepsRef = useRef(2)
  const rafRef = useRef(0)
  const stepCountRef = useRef(0)
  const lastEvalRef = useRef(0)
  const gateRef = useRef(new ConvergenceGate({ mode: 'plateau', window: 5, epsilon: 4 })) // pause when RL accuracy plateaus

  const warmCfg = useMemo(() => ({ ...DEFAULT_TRAIN_CONFIG, batchSize: 16, learningRate: 0.01 }), [])
  const rlCfg = useMemo(() => ({ ...DEFAULT_TRAIN_CONFIG, batchSize: 1, learningRate: 0.0005 }), [])

  // active model that drives the grid + concept map
  const activeTrainer = view === 'live' ? live.current : bundled
  const activeReady = view === 'live' ? liveReady : !!bundled

  // load the bundled trained agent + build the live (untrained) model once
  useEffect(() => {
    let cancelled = false
    live.current = new Trainer(buildWarehouseCorpus(60000), CAPSTONE_CFG, 7)
    setLiveReady(true)
    void (async () => {
      const t = await loadWarehouseModel()
      if (cancelled) return
      if (t) { setBundled(t); setBundledStatus(`trained agent loaded · ${t.model.params.reduce((n, p) => n + p.size, 0).toLocaleString()} params`) }
      else { setBundledStatus('no bundled agent found — switch to "your live model" and train one'); setView('live') }
    })()
    return () => { cancelled = true; runningRef.current = false; cancelAnimationFrame(rafRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function evalNow(s: number) {
    const t = live.current
    if (!t) return
    const { acc } = heldOutStats(t.model, t.tok, HELD)
    if (phaseRef.current === 'warmup') {
      setAccSft((c) => [...c, { x: s, y: acc }].slice(-300))
      // hand SFT → RL once competent (or at the cap) — folded in here so we don't run a second eval
      if (acc >= WARM_TARGET || s >= WARM_CAP) {
        phaseRef.current = 'rl'; setPhase('rl')
        setAccRl((c) => [...c, { x: s, y: acc }].slice(-300)) // seed the RL curve at the hand-over
        gateRef.current.record('acc', acc)
      }
    } else {
      setAccRl((c) => [...c, { x: s, y: acc }].slice(-300))
      gateRef.current.record('acc', acc)
    }
    // reshuffle which held-out orders we show each eval, so it's visibly recomputing
    const pick = [...HELD].sort(() => Math.random() - 0.5).slice(0, 6)
    setAttempts(pick.map((b) => runBasket(t.model, t.tok, b)))
    lastEvalRef.current = s
  }

  function loop() {
    const t = live.current
    if (!runningRef.current || !t) return
    const n = stepsRef.current
    for (let i = 0; i < n; i++) {
      if (phaseRef.current === 'warmup') {
        t.stepBatch(warmCfg, DEFAULT_FEATURE_FLAGS)
        stepCountRef.current += 1
      } else {
        const r = t.rlvrStep(rlCfg, DEFAULT_FEATURE_FLAGS, { prompts: RL_PROMPTS, groupSize: 4, temperature: 0.5, maxNew: 64, reward: rlReward, promptsPerStep: 2 })
        stepCountRef.current += 1
        setReward((c) => [...c, { x: stepCountRef.current, y: Math.round(r.meanReward * 100) }].slice(-300))
        if (stepCountRef.current >= WARM_CAP + RL_CAP) { runningRef.current = false; setRunning(false); setAutoPaused('cap') }
      }
      if (stepCountRef.current - lastEvalRef.current >= evalInterval(stepCountRef.current)) evalNow(stepCountRef.current)
      if (phaseRef.current === 'rl' && runningRef.current && gateRef.current.converged()) { runningRef.current = false; setRunning(false); setAutoPaused('converged') }
      if (!runningRef.current) break
    }
    setStep(stepCountRef.current)
    // (the grid isn't refreshed per-frame — that would restart its animation; the live
    //  held-out attempts panel below is the moving view. Click a basket to probe the
    //  current live model on the grid.)
    if (runningRef.current) rafRef.current = requestAnimationFrame(loop)
  }
  function play() {
    setView('live'); setAutoPaused(null); gateRef.current.reset()
    runningRef.current = true; setRunning(true); rafRef.current = requestAnimationFrame(loop)
  }
  function pause() { runningRef.current = false; setRunning(false); cancelAnimationFrame(rafRef.current) }
  function reset() {
    pause(); live.current = new Trainer(buildWarehouseCorpus(60000), CAPSTONE_CFG, 7)
    phaseRef.current = 'warmup'; setPhase('warmup'); stepCountRef.current = 0; lastEvalRef.current = 0
    setStep(0); setAccSft([]); setAccRl([]); setReward([]); setAttempts([])
    gateRef.current.reset(); setAutoPaused(null)
  }

  const accSeries = [
    { label: 'SFT — held-out accuracy', color: SFT, points: accSft },
    { label: 'RL — held-out accuracy', color: RL, points: accRl },
  ]
  const rewardSeries = [{ label: 'RL — mean reward (verifier)', color: REW, points: reward }]
  const btn = 'rounded border px-3 py-1.5 text-xs'

  return (
    <div className="min-h-screen font-mono text-sm text-slate-200">
      <SiteNav current="capstone">
        <span className="hidden text-xs text-slate-400 sm:inline">Capstone — a warehouse agent</span>
      </SiteNav>

      <div className="mx-auto max-w-5xl space-y-6 p-4">
        {/* play-first hook: a tic-tac-toe agent in a closed loop, with the harness check layer */}
        <section className="space-y-3">
          <h1 className="text-lg font-bold text-sky-200">Play a tiny transformer — then look inside it</h1>
          <p className="max-w-3xl text-[13px] leading-relaxed text-slate-300">
            The opponent is a ~130K-parameter transformer trained to play tic-tac-toe. Each turn is a closed{' '}
            <b>agent loop</b>: you move, the harness sends it the new board, it <b>reads the board and
            responds</b>. A <b>harness</b> around it <b>checks every move is legal</b> — a deterministic guard
            over a probabilistic model. Switch that check off and an illegal move stands. Switch the opponent
            between the <b>undertrained</b> and <b>well-trained</b> agent: <b>same size, same architecture</b>,
            different training budget.
          </p>
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <TicTacToe onLookInside={setInspectBoard} />
          </div>
        </section>

        {/* look inside the agent — the interpretability payoff (Part III tools on the Part IV agent) */}
        <section className="space-y-3 rounded-lg border border-fuchsia-900/40 bg-slate-900/40 p-4">
          <h2 className="text-base font-bold text-fuchsia-200">Now look inside the agent you just played</h2>
          <p className="max-w-3xl text-[13px] leading-relaxed text-slate-300">
            The same interpretability tools the{' '}
            <a className="text-fuchsia-300 hover:underline" href="./lab.html">lab</a> uses, projected onto the
            board. Read each head's <b>attention</b> at the moment it chose a move, <b>ablate a head</b> and
            watch the play break, and decompose its activations with a <b>dictionary (SAE)</b>. Switch between
            the <b>undertrained</b> and <b>well-trained</b> model on a board where you threaten to win: the
            well-trained model's heads <b>land on the cell you are about to win on</b>. That difference in
            attention is the mechanism behind the difference in blocking.
          </p>
          <Inspector board={inspectBoard} onBoard={setInspectBoard} />
        </section>

        {/* ---- the warehouse demo: relational reasoning + generalisation + interpretability ---- */}
        <section className="space-y-2 border-t border-slate-800 pt-6">
          <h2 className="text-base font-bold text-sky-200">A second agent: relational reasoning in a warehouse</h2>
          <p className="max-w-3xl text-[13px] leading-relaxed text-slate-300">
            The tic-tac-toe agent shows the <em>loop</em>. This one shows the <em>reasoning</em>: a
            ~24K-parameter agent packs orders where the right action depends on the whole basket.</p>
        </section>
        {/* intro */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-300">The warehouse task</h2>
          <p className="max-w-3xl text-[13px] leading-relaxed text-slate-300">
            An order is a basket of items (SKUs <span className="font-mono">A–F</span>). The agent walks the
            warehouse, picks each item and packs it. Packing is <b>relational</b>: whether an item needs
            padding, and which box it goes in, depends on <em>what else is in the basket</em>. A{' '}
            <span style={{ color: '#f472b6' }}>fragile</span> item needs <b>padding</b> only if something{' '}
            <span style={{ color: '#60a5fa' }}>heavy</span> is in the same order; a{' '}
            <span style={{ color: '#fbbf24' }}>chemical</span> item goes in <b>box 2</b> only if there's{' '}
            <span style={{ color: '#34d399' }}>food</span> in the order. Deciding one item's action requires
            reading the others, so the model must <b>attend across the basket</b>. No SKU's attribute is ever
            a token: the model <b>infers the attributes</b> from the packing decisions.
          </p>
        </section>

        {/* live demo grid — shared with embed.html?demo=warehouse (WarehouseDemo) */}
        <section className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <WarehouseDemo
            trainer={activeTrainer}
            ready={activeReady}
            status={bundledStatus}
            controls={
              <span className="ml-auto flex items-center gap-1">
                <span className="text-slate-400">model:</span>
                <button className={'rounded px-2 py-0.5 text-[11px] ' + (view === 'bundled' ? 'bg-fuchsia-700 text-white' : 'bg-slate-800 text-slate-300')} onClick={() => setView('bundled')} disabled={!bundled}>trained agent</button>
                <button className={'rounded px-2 py-0.5 text-[11px] ' + (view === 'live' ? 'bg-fuchsia-700 text-white' : 'bg-slate-800 text-slate-300')} onClick={() => setView('live')}>your live model</button>
              </span>
            }
            caption={
              <p className="max-w-3xl text-[11px] leading-relaxed text-slate-400">
                {view === 'bundled'
                  ? `The ${bundled ? '' : '(loading) '}trained agent packs even baskets it never saw in training — proof it learned the rule, not a lookup table. Try a 🎲 random held-out order.`
                  : 'This is your from-scratch model below — untrained it packs nonsense; train it and watch these orders come right.'}
              </p>
            }
          />
        </section>

        {/* train it yourself */}
        <section className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <h2 className="text-sm font-semibold text-slate-200">Train one from scratch — SFT teaches the job, RL makes it better at it</h2>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {!running ? (
              <button className={btn + ' border-emerald-600 bg-emerald-900/40 text-emerald-200'} onClick={play}>▶ {step > 0 ? 'Resume' : 'Train the agent'}</button>
            ) : (
              <button className={btn + ' border-amber-600 bg-amber-900/40 text-amber-200'} onClick={pause}>⏸ Pause</button>
            )}
            <button className={btn + ' border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'} onClick={reset}>↺ Reset</button>
            <span className="text-slate-400">step {step} · phase <span style={{ color: phase === 'warmup' ? SFT : RL }}>{phase === 'warmup' ? 'SFT (imitate the expert)' : 'RL (reward only)'}</span></span>
            {autoPaused && <span className="text-emerald-300">{autoPaused === 'converged' ? '✓ converged — auto-paused (Reset to run again)' : 'reached step cap — paused'}</span>}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <div className="mb-1 text-[11px] text-slate-400">held-out accuracy — <span style={{ color: SFT }}>SFT</span> learns the rule &amp; generalises, then <span style={{ color: RL }}>RL</span> pushes it higher</div>
              <LineChart series={accSeries} width={440} height={180} yLabel="%" />
            </div>
            <div>
              <div className="mb-1 text-[11px] text-slate-400"><span style={{ color: REW }}>RL mean reward</span> — the fraction of its own sampled attempts the verifier accepts</div>
              <LineChart series={rewardSeries} width={440} height={180} yLabel="%" />
            </div>
          </div>
          <div>
            <div className="mb-1 text-[11px] text-slate-400">its attempts on a fresh sample of unseen orders each eval — <span style={{ color: RL }}>correct</span> / <span style={{ color: '#f87171' }}>wrong</span></div>
            <div className="space-y-0.5 font-mono text-[12px]">
              {attempts.length === 0 ? (
                <div className="text-[11px] text-slate-400">press Train — held-out attempts appear as it learns</div>
              ) : attempts.map((a, i) => (
                <div key={i} className="flex flex-wrap items-center gap-x-1">
                  <span className="text-slate-400">order {a.basket.join(' ')} =&gt;</span>
                  <span style={{ color: a.correct ? RL : '#f87171' }}>{a.planText || '…'} {a.correct ? '✓' : '✗'}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="max-w-3xl text-[11px] leading-relaxed text-slate-400">
            <b>SFT</b> imitates a scripted expert until it packs unseen orders correctly (the accuracy climb —
            that generalisation is the proof it learned the <em>rule</em>, not a lookup). Then <b>RL</b> takes
            over: it samples its <em>own</em> attempts on unseen orders, a verifier says right/wrong, and it
            reinforces the correct ones — pushing accuracy above the SFT plateau <b>from the reward alone, no new
            labels</b> (the lab's RLVR idea, now on a multi-step agent). Honest caveats: it needs a verifiable
            task and a competent base (that's the SFT warm-up — the cold-start problem); the RL gain is a modest
            polish here, and naïve policy gradient is finicky (settings tuned offline). Give it a minute or two.
          </p>
        </section>

        {/* discovered concepts */}
        {activeTrainer && (
          <section className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-slate-200">It discovered the concepts nobody labelled</h2>
            <div className="flex flex-wrap items-start gap-6">
              <ConceptMap model={activeTrainer.model} tok={activeTrainer.tok} />
              <p className="max-w-sm text-[12px] leading-relaxed text-slate-400">
                The model only ever saw SKU letters and the packing decisions — never the words
                "fragile / heavy / food / chemical". Yet projecting its learned SKU embeddings to 2-D, they
                <b> cluster by that hidden attribute</b>: to pack correctly it had to build an internal notion of
                each SKU's nature, and it did. (Same trick as the digit "number line" on the{' '}
                <a className="text-fuchsia-300 hover:underline" href="./learn.html">How-it-works</a> page.)
                {view === 'live' && ' Train the model above and watch these clusters sharpen.'}
              </p>
            </div>
            <div className="text-[11px] text-slate-400">hidden attribute key (for reference — not shown to the model): {Object.entries(ATTR).map(([s, a]) => `${s}=${a}`).join(' · ')}</div>
          </section>
        )}

        {/* output → input: the other half of the harness */}
        <section className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <h2 className="text-sm font-semibold text-slate-200">Output now, input next — the two halves of a harness</h2>
          <p className="max-w-3xl text-[12px] leading-relaxed text-slate-400">
            Both agents use the harness for <b>output</b>: the model emits a tool call — a packing action, a
            move — and the harness runs it and <b>validates</b> it. The other half is <b>input</b>: an agent{' '}
            <b>reads a tool's result back</b> into its context and chooses the next action. The tic-tac-toe
            agent does this every turn when it reads the new board. A warehouse agent could call a{' '}
            <span className="font-mono">scan</span> tool and read an item's nature instead of inferring it.
            Read-back carries the risk: the loop writes a result into the context with no boundary between
            data and instructions, so whoever controls a result can plant the next command —{' '}
            <b>prompt injection</b>. Both are live on the{' '}
            <a className="text-fuchsia-300 hover:underline" href="./harness.html#loop-it-and-its-an-agent">agent loop</a>{' '}
            and the{' '}
            <a className="text-fuchsia-300 hover:underline" href="./harness.html#the-catch-prompt-injection">injection demo</a>.
          </p>
        </section>

        {/* the whole book in one page */}
        <section className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <h2 className="text-sm font-semibold text-slate-200">The whole book, in one page</h2>
          <p className="max-w-3xl text-[12px] leading-relaxed text-slate-400">These two agents touch every idea in the site:</p>
          <ul className="max-w-3xl space-y-1 text-[12px] text-slate-400">
            <li>• <b>Attention</b> — packing depends on the whole order; the move on the whole board → <a className="text-fuchsia-300 hover:underline" href="./learn.html">How it works</a></li>
            <li>• <b>Generalisation</b> — the warehouse packs orders it never trained on (a learned rule, not a lookup) → <a className="text-fuchsia-300 hover:underline" href="./lab.html?tab=advanced-grokking">grokking</a></li>
            <li>• <b>Tools &amp; agents</b> — emitting tool calls, reading results back, the injection risk → <a className="text-fuchsia-300 hover:underline" href="./harness.html">Tools &amp; agents</a></li>
            <li>• <b>SFT → RL</b> — imitate an expert, then improve from a verifier alone → <a className="text-fuchsia-300 hover:underline" href="./lab.html?tab=reward-learning-rlvr">reward learning</a></li>
            <li>• <b>Interpretability</b> — the model discovered the hidden attributes; you can read its move confidence → <a className="text-fuchsia-300 hover:underline" href="./lab.html?tab=dictionary-sae">the lab</a></li>
          </ul>
          <p className="max-w-3xl text-[11px] leading-relaxed text-slate-400">
            Attention, generalisation, agents, SFT→RL and interpretability, in ~130K parameters. All of it is
            next-token prediction at a size you can see through.
          </p>
        </section>
      </div>
    </div>
  )
}
