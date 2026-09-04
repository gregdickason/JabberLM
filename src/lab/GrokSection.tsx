import { useEffect, useMemo, useRef, useState } from 'react'
import { Trainer } from '../engine/trainer'
import { DEFAULT_FEATURE_FLAGS, DEFAULT_MODEL_CONFIG, DEFAULT_TRAIN_CONFIG } from '../engine/config'
import { moeAnswer, taskAccuracy, type MoeOp } from '../interp/ablation'
import { buildMoeCorpus, sortHeldOut, maxHeldOut, reverseHeldOut, moeTrainVectors, type SortVec } from '../data/tasks'
import LineChart from '../viz/LineChart'
import SectionIntro from './SectionIntro'
import { ConvergenceGate } from './converged'

const CAP = 8000 // hard step backstop — generous, since a grok can be delayed
const COLORS = { sort: '#34d399', max: '#60a5fa', reverse: '#f472b6' }
const TRAIN_COLOR = '#f59e0b' // amber — accuracy on examples the model was TRAINED on
// (held-out on the sort chart reuses COLORS.sort so it matches the left chart's sort line)
const SAMPLE = 12 // held-out examples evaluated per task each cycle (accuracy from these)
const TRAIN_SAMPLE = 10 // training examples evaluated per task (for the memorise→generalise gap)
const KEEP = 5 // how many held-out examples to show as live "is it working?" rows

// Eval cadence: dense early (so the charts fill in seconds), then widen.
const evalInterval = (step: number) => (step < 100 ? 20 : step < 600 ? 100 : 200)

// Caption for the sort train-vs-held chart (finalised from the offline gap study:
// sort memorises-then-generalises; max & reverse generalise directly).
const GAP_CAPTION =
  'Sort is the one that truly groks: accuracy on the lists it is TRAINED on (amber) climbs first — it ' +
  'starts fitting those examples — while accuracy on UNSEEN lists (green) lags behind. Then the held-out ' +
  'line suddenly catches up: that jump is grokking, the model switching from memorising to the real ' +
  'sorting rule. (Max and reverse generalise straight away — their held-out never lags, as the left chart shows.)'

interface Ex {
  v: SortVec
  pred: number[] // the model's parsed answer
  expected: number[] // the correct answer
  correct: boolean
}
interface TaskResult {
  acc: number
  examples: Ex[]
}
interface Snapshot {
  step: number
  sort: TaskResult
  max: TaskResult
  reverse: TaskResult
  // TRAIN accuracy (on seen examples) per task — vs the held-out .acc above. Only
  // sort shows a real gap (memorises first); max/reverse generalise directly.
  train: { sort: number; max: number; reverse: number }
}

function expectedFor(op: MoeOp, v: SortVec): number[] {
  if (op === 'sort') return [...v].sort((a, b) => a - b)
  if (op === 'reverse') return [...v].reverse()
  return [Math.max(...v)]
}

function evalTask(t: Trainer, op: MoeOp, vectors: SortVec[]): TaskResult {
  let ok = 0
  const examples: Ex[] = []
  for (let i = 0; i < vectors.length; i++) {
    const v = vectors[i]
    const prompt = `${op === 'reverse' ? 'rev' : op} ${v.join(' ')} => `
    const raw = moeAnswer(t.model, t.tok, prompt, op === 'max' ? 3 : 8).split('\n')[0].trim()
    const pred = raw.split(/\s+/).filter(Boolean).map(Number).filter((n) => Number.isFinite(n))
    const expected = expectedFor(op, v)
    const correct = pred.length === expected.length && expected.every((e, k) => pred[k] === e)
    if (correct) ok++
    if (i < KEEP) examples.push({ v, pred, expected, correct })
  }
  return { acc: vectors.length ? Math.round((100 * ok) / vectors.length) : 0, examples }
}

// A live, from-scratch grokking demo: train ONE dense (non-MoE) default model on
// three tasks at once and watch each grok. Self-contained — its own Trainer, never
// touches the main app's singleton or the lab's loaded inspection model.
export default function GrokSection() {
  const [running, setRunning] = useState(false)
  const [step, setStep] = useState(0)
  const [loss, setLoss] = useState(0)
  const [hist, setHist] = useState<Snapshot[]>([])
  const [autoPaused, setAutoPaused] = useState<'converged' | 'cap' | null>(null)

  // pause once the HELD-OUT sort curve has grokked and held (last 5 checkpoints ≥ 90%).
  // Key to held-out sort only — NEVER the train curve, which hits 100% long before the grok.
  const gateRef = useRef(new ConvergenceGate({ window: 5, threshold: 90 }))
  const trainerRef = useRef<Trainer | null>(null)
  const runningRef = useRef(false)
  const stepsRef = useRef(3)
  const rafRef = useRef(0)
  const stepCountRef = useRef(0)
  const lastEvalRef = useRef(-1)

  const held = useMemo(
    () => ({
      sort: sortHeldOut().slice(0, SAMPLE),
      max: maxHeldOut().slice(0, SAMPLE),
      reverse: reverseHeldOut().slice(0, SAMPLE),
    }),
    [],
  )
  const trainVecs = useMemo(() => moeTrainVectors().slice(0, TRAIN_SAMPLE), [])
  const trainCfg = useMemo(() => ({ ...DEFAULT_TRAIN_CONFIG, batchSize: 24, learningRate: 0.006 }), [])

  function build(): Trainer {
    const t = new Trainer(buildMoeCorpus(20000), DEFAULT_MODEL_CONFIG, 1337)
    trainerRef.current = t
    return t
  }

  function evalAll(t: Trainer, s: number) {
    const sort = evalTask(t, 'sort', held.sort)
    const max = evalTask(t, 'max', held.max)
    const reverse = evalTask(t, 'reverse', held.reverse)
    // train accuracy on SEEN examples (the memorise→generalise gap)
    const trS = taskAccuracy(t.model, t.tok, 'sort', trainVecs)
    const trM = taskAccuracy(t.model, t.tok, 'max', trainVecs)
    const trR = taskAccuracy(t.model, t.tok, 'reverse', trainVecs)
    const snap: Snapshot = { step: s, sort, max, reverse, train: { sort: trS, max: trM, reverse: trR } }
    setHist((h) => [...h, snap].slice(-200))
    gateRef.current.record('sort', sort.acc) // held-out sort — the canonical grok signal
    lastEvalRef.current = s
  }

  function loop() {
    if (!runningRef.current) return
    const t = trainerRef.current ?? build()
    const n = stepsRef.current
    let ms = 0
    let last = 0
    for (let i = 0; i < n; i++) {
      const a = performance.now()
      last = t.stepBatch(trainCfg, DEFAULT_FEATURE_FLAGS).loss
      ms += performance.now() - a
      stepCountRef.current += 1
      if (stepCountRef.current - lastEvalRef.current >= evalInterval(stepCountRef.current)) {
        evalAll(t, stepCountRef.current)
      }
      if (stepCountRef.current >= CAP) {
        runningRef.current = false
        setRunning(false)
        setAutoPaused('cap')
      } else if (gateRef.current.converged()) {
        runningRef.current = false
        setRunning(false)
        setAutoPaused('converged')
      }
      if (!runningRef.current) break
    }
    const perStep = ms / n
    const want = Math.max(1, Math.min(40, Math.round(20 / Math.max(0.2, perStep))))
    stepsRef.current = Math.max(1, Math.round(n * 0.6 + want * 0.4))
    setStep(stepCountRef.current)
    setLoss(last)
    if (runningRef.current) rafRef.current = requestAnimationFrame(loop)
  }

  function play() {
    if (!trainerRef.current) build()
    setAutoPaused(null)
    gateRef.current.reset()
    runningRef.current = true
    setRunning(true)
    rafRef.current = requestAnimationFrame(loop)
  }
  function pause() {
    runningRef.current = false
    setRunning(false)
    cancelAnimationFrame(rafRef.current)
  }
  function reset() {
    pause()
    const t = build()
    stepCountRef.current = 0
    stepsRef.current = 3
    lastEvalRef.current = 0
    setStep(0)
    setLoss(0)
    setHist([])
    gateRef.current.reset()
    setAutoPaused(null)
    evalAll(t, 0) // immediate baseline so the panels/chart aren't empty
  }

  // build + show a baseline immediately on mount (so nothing is blank), and stop
  // training if the user leaves the tab
  useEffect(() => {
    const t = build()
    lastEvalRef.current = 0
    evalAll(t, 0)
    return () => {
      runningRef.current = false
      cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const series = [
    { label: 'sort', color: COLORS.sort, points: hist.map((s) => ({ x: s.step, y: s.sort.acc })) },
    { label: 'max', color: COLORS.max, points: hist.map((s) => ({ x: s.step, y: s.max.acc })) },
    { label: 'reverse', color: COLORS.reverse, points: hist.map((s) => ({ x: s.step, y: s.reverse.acc })) },
  ]
  const latest = hist.at(-1)
  const btn = 'rounded border px-3 py-1 text-xs'

  return (
    <div className="space-y-4">
      <SectionIntro
        title="Advanced grokking — one model, three skills, live"
        papers={[
          { title: 'Grokking: Generalization Beyond Overfitting', url: 'https://arxiv.org/abs/2201.02177' },
          { title: 'Progress Measures for Grokking via Mechanistic Interpretability', url: 'https://arxiv.org/abs/2301.05217' },
        ]}
      >
        This trains a single <b>dense</b> default model (~88k params) from scratch, right now in your
        browser, on <b>three</b> tasks at once — <span style={{ color: COLORS.sort }}>sort</span>,{' '}
        <span style={{ color: COLORS.max }}>max</span>, and <span style={{ color: COLORS.reverse }}>reverse</span>.
        The panels below show it <em>working</em> on unseen inputs (green = right, red = wrong) so you can
        watch each skill click into place. <b>Predict first:</b> together, or one at a time?
      </SectionIntro>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {!running ? (
          <button className={btn + ' border-emerald-600 bg-emerald-900/40 text-emerald-200'} onClick={play}>
            ▶ {step > 0 ? 'Resume' : 'Train'}
          </button>
        ) : (
          <button className={btn + ' border-amber-600 bg-amber-900/40 text-amber-200'} onClick={pause}>
            ⏸ Pause
          </button>
        )}
        <button className={btn + ' border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'} onClick={reset}>
          ↺ Reset
        </button>
        <span className="text-slate-400">
          step {step} · loss {loss ? loss.toFixed(3) : '—'} · {stepsRef.current} steps/frame
        </span>
        {latest && (
          <span className="ml-1">
            <span style={{ color: COLORS.sort }}>sort {latest.sort.acc}%</span>{'  '}
            <span style={{ color: COLORS.max }}>max {latest.max.acc}%</span>{'  '}
            <span style={{ color: COLORS.reverse }}>rev {latest.reverse.acc}%</span>
          </span>
        )}
        {autoPaused && (
          <span className="text-emerald-300">
            {autoPaused === 'converged'
              ? '✓ sort grokked — auto-paused (Reset to run again)'
              : 'reached step cap — paused'}
          </span>
        )}
      </div>

      {/* per-task held-out curves + the memorise→generalise view */}
      <div className="flex flex-wrap gap-6">
        <div className="min-w-0">
          <div className="text-[11px] text-slate-400">
            held-out accuracy, all three tasks — watch for the jump
          </div>
          <Legend
            items={[
              { label: 'sort', color: COLORS.sort },
              { label: 'max', color: COLORS.max },
              { label: 'reverse', color: COLORS.reverse },
            ]}
          />
          <LineChart series={series} width={400} height={170} yLabel="held-out %" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] text-slate-400">
            <span className="text-emerald-300">sort</span> only: memorise → generalise
          </div>
          <Legend
            items={[
              { label: 'train (lists it has seen)', color: TRAIN_COLOR },
              { label: 'held-out (unseen lists)', color: COLORS.sort },
            ]}
          />
          <LineChart
            series={[
              { label: 'train (seen)', color: TRAIN_COLOR, points: hist.map((s) => ({ x: s.step, y: s.train.sort })) },
              { label: 'held-out (unseen)', color: COLORS.sort, points: hist.map((s) => ({ x: s.step, y: s.sort.acc })) },
            ]}
            width={400}
            height={170}
            yLabel="sort accuracy %"
          />
          <div className="mt-1 max-w-[400px] text-[11px] leading-relaxed text-slate-400">
            {GAP_CAPTION}
          </div>
        </div>
      </div>

      {/* per-task "is it working?" panels */}
      <div className="grid gap-4 sm:grid-cols-3">
        <MaxPanel result={latest?.max} />
        <SeqPanel title="reverse" color={COLORS.reverse} result={latest?.reverse} />
        <SeqPanel title="sort" color={COLORS.sort} result={latest?.sort} />
      </div>

      <p className="max-w-2xl text-[11px] leading-relaxed text-slate-400">
        Typically <b>max</b> clicks first (it only has to find one number), then <b>reverse</b>, then{' '}
        <b>sort</b>. Only <b>sort</b> shows the classic grokking gap on the right — it memorises its
        training lists before it generalises — while max and reverse jump straight to the rule. Same
        engine the main app uses, so nothing here is faked.
      </p>
    </div>
  )
}

// ---- little visual helpers -------------------------------------------------

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mb-1 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: it.color }} />
          <span style={{ color: it.color }}>{it.label}</span>
        </span>
      ))}
    </div>
  )
}

function Cell({ top, val, cls }: { top?: string; val: React.ReactNode; cls: string }) {
  return (
    <div className={'flex h-8 w-8 flex-col items-center justify-center rounded border text-[11px] ' + cls}>
      {top && <span className="text-[7px] uppercase leading-none text-slate-400">{top}</span>}
      <span className="font-mono leading-tight">{val}</span>
    </div>
  )
}

const NEUTRAL = 'border-slate-600 bg-slate-800 text-slate-300'
const OK = 'border-emerald-500 bg-emerald-900/40 text-emerald-200'
const BAD = 'border-red-500 bg-red-900/40 text-red-200'

// Max: show the three inputs as min / med / max roles; ring the one the model
// picked (green if that's the max, red otherwise). Reads as "does it pick the
// biggest?", not "what number".
function MaxPanel({ result }: { result?: TaskResult }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
      <div className="mb-2 text-[11px]">
        <span style={{ color: COLORS.max }}>max</span> — is it picking the biggest?{' '}
        {result && <span className="text-slate-400">({result.acc}%)</span>}
      </div>
      <div className="space-y-1.5">
        {result?.examples.map((ex, i) => {
          const sorted = [...ex.v].sort((a, b) => a - b) // [min, med, max]
          const pred = ex.pred[0]
          return (
            <div key={i} className="flex items-center gap-1">
              {sorted.map((val, idx) => {
                const isTarget = idx === 2
                const isPred = val === pred
                let cls = isTarget ? 'border-emerald-700 bg-emerald-950/40 text-emerald-200' : NEUTRAL
                if (isPred) cls += isTarget ? ' ring-2 ring-emerald-400' : ' ring-2 ring-red-400 border-red-500'
                return <Cell key={idx} top={['min', 'med', 'max'][idx]} val={val} cls={cls} />
              })}
              <span className={'ml-1 text-[11px] ' + (ex.correct ? 'text-emerald-400' : 'text-red-400')}>
                {ex.correct ? '✓' : '✗ ' + (Number.isFinite(pred) ? `picked ${pred}` : '—')}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Sort / reverse: show the predicted 3-number output, each position green if it
// matches the correct answer, red if not (or missing).
function SeqPanel({ title, color, result }: { title: string; color: string; result?: TaskResult }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
      <div className="mb-2 text-[11px]">
        <span style={{ color }}>{title}</span> — right in every position?{' '}
        {result && <span className="text-slate-400">({result.acc}%)</span>}
      </div>
      <div className="space-y-1.5">
        {result?.examples.map((ex, i) => (
          <div key={i} className="flex items-center gap-1">
            {ex.v.map((val, idx) => (
              <Cell key={'in' + idx} val={val} cls={NEUTRAL} />
            ))}
            <span className="px-0.5 text-slate-500">→</span>
            {ex.expected.map((e, idx) => {
              const p = ex.pred[idx]
              const has = Number.isFinite(p)
              return <Cell key={'out' + idx} val={has ? p : '·'} cls={has && p === e ? OK : BAD} />
            })}
            <span className={'ml-1 text-[11px] ' + (ex.correct ? 'text-emerald-400' : 'text-red-400')}>
              {ex.correct ? '✓' : '✗'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
