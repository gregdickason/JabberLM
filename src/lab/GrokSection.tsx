import { useEffect, useMemo, useRef, useState } from 'react'
import { Trainer } from '../engine/trainer'
import { DEFAULT_FEATURE_FLAGS, DEFAULT_MODEL_CONFIG, DEFAULT_TRAIN_CONFIG } from '../engine/config'
import { moeAnswer, type MoeOp } from '../interp/ablation'
import { buildMoeCorpus, sortHeldOut, maxHeldOut, reverseHeldOut, type SortVec } from '../data/tasks'
import { pca2 } from '../interp/pca'
import LineChart from '../viz/LineChart'
import NumberLine from '../viz/NumberLine'
import SectionIntro from './SectionIntro'

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
const COLORS = { sort: '#34d399', max: '#60a5fa', reverse: '#f472b6' }
const SAMPLE = 12 // held-out examples evaluated per task each cycle (accuracy from these)
const KEEP = 5 // how many of those to show as live "is it working?" rows

// Eval cadence: dense early (so the charts fill in seconds), then widen.
const evalInterval = (step: number) => (step < 100 ? 20 : step < 600 ? 100 : 200)

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
}

function pearson(a: number[], b: number[]): number {
  const n = a.length
  if (n === 0) return 0
  const ma = a.reduce((x, y) => x + y, 0) / n
  const mb = b.reduce((x, y) => x + y, 0) / n
  let num = 0
  let da = 0
  let db = 0
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma
    const y = b[i] - mb
    num += x * y
    da += x * x
    db += y * y
  }
  return num / (Math.sqrt(da * db) || 1)
}

// Collapse the digit vectors to the SINGLE axis (within the top-2 PCA plane) along
// which the model best encodes magnitude — dir = (cov(x,val), cov(y,val)) — then
// project onto it. Oriented low→high by construction. `align` is |corr| with value
// (0..1): a real "progress measure" that climbs toward 1 as the number line forms.
interface NumberLineData {
  coords: number[]
  labels: string[]
  align: number
}
function computeNumberLine(emb: number[][], values: number[], labels: string[]): NumberLineData {
  if (emb.length < 2) return { coords: [], labels: [], align: 0 }
  const pts = pca2(emb)
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
  const mx = mean(xs)
  const my = mean(ys)
  const mv = mean(values)
  let cxv = 0
  let cyv = 0
  for (let i = 0; i < values.length; i++) {
    cxv += (xs[i] - mx) * (values[i] - mv)
    cyv += (ys[i] - my) * (values[i] - mv)
  }
  const norm = Math.hypot(cxv, cyv) || 1
  const dx = cxv / norm
  const dy = cyv / norm
  const coords = pts.map((p) => p[0] * dx + p[1] * dy)
  return { coords, labels, align: Math.abs(pearson(coords, values)) }
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
  const [numberLine, setNumberLine] = useState<NumberLineData>({ coords: [], labels: [], align: 0 })

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
  const trainCfg = useMemo(() => ({ ...DEFAULT_TRAIN_CONFIG, batchSize: 24, learningRate: 0.006 }), [])

  function build(): Trainer {
    const t = new Trainer(buildMoeCorpus(20000), DEFAULT_MODEL_CONFIG, 1337)
    trainerRef.current = t
    return t
  }

  function evalAll(t: Trainer, s: number) {
    const snap: Snapshot = {
      step: s,
      sort: evalTask(t, 'sort', held.sort),
      max: evalTask(t, 'max', held.max),
      reverse: evalTask(t, 'reverse', held.reverse),
    }
    const dM = t.model.cfg.dModel
    const present = DIGITS.map((d) => ({ d, id: t.tok.stoi.get(d) })).filter(
      (p): p is { d: string; id: number } => p.id != null,
    )
    const emb = present.map((p) => Array.from(t.model.tokenEmbed.data.subarray(p.id * dM, (p.id + 1) * dM)))
    setNumberLine(computeNumberLine(emb, present.map((p) => Number(p.d)), present.map((p) => p.d)))
    setHist((h) => [...h, snap].slice(-200))
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
    }
    const perStep = ms / n
    const want = Math.max(1, Math.min(40, Math.round(20 / Math.max(0.2, perStep))))
    stepsRef.current = Math.max(1, Math.round(n * 0.6 + want * 0.4))
    setStep(stepCountRef.current)
    setLoss(last)
    rafRef.current = requestAnimationFrame(loop)
  }

  function play() {
    if (!trainerRef.current) build()
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
        <span className="text-slate-500">
          step {step} · loss {loss ? loss.toFixed(3) : '—'} · {stepsRef.current} steps/frame
        </span>
        {latest && (
          <span className="ml-1">
            <span style={{ color: COLORS.sort }}>sort {latest.sort.acc}%</span>{'  '}
            <span style={{ color: COLORS.max }}>max {latest.max.acc}%</span>{'  '}
            <span style={{ color: COLORS.reverse }}>rev {latest.reverse.acc}%</span>
          </span>
        )}
      </div>

      {/* accuracy overview + shared number-line */}
      <div className="flex flex-wrap gap-6">
        <div>
          <div className="mb-1 text-[11px] text-slate-400">held-out accuracy — watch for the jump</div>
          <LineChart series={series} width={400} height={170} yLabel="held-out %" />
        </div>
        <div>
          <div className="mb-1 text-[11px] text-slate-400">
            the model's number line — order alignment{' '}
            <span className="font-mono text-slate-200">{Math.round(numberLine.align * 100)}%</span>
          </div>
          <NumberLine coords={numberLine.coords} labels={numberLine.labels} />
          <div className="mt-1 max-w-[400px] text-[11px] leading-relaxed text-slate-500">
            Each digit is a ~48-number learned vector. We collapse it to the single direction the model
            spreads the digits along most — as the tasks grok, they slide into <em>numeric order</em> here
            (alignment → 100%), because sort, max and reverse all need the same idea: which number is bigger.
          </div>
        </div>
      </div>

      {/* per-task "is it working?" panels */}
      <div className="grid gap-4 sm:grid-cols-3">
        <MaxPanel result={latest?.max} />
        <SeqPanel title="reverse" color={COLORS.reverse} result={latest?.reverse} />
        <SeqPanel title="sort" color={COLORS.sort} result={latest?.sort} />
      </div>

      <p className="max-w-2xl text-[11px] leading-relaxed text-slate-500">
        Typically <b>max</b> clicks first (it only has to find one number), then <b>sort</b> and{' '}
        <b>reverse</b> follow once the ordering circuit forms — flat-then-sudden, the signature of
        grokking. This is the same engine the main app uses, so nothing here is faked.
      </p>
    </div>
  )
}

// ---- little visual helpers -------------------------------------------------

function Cell({ top, val, cls }: { top?: string; val: React.ReactNode; cls: string }) {
  return (
    <div className={'flex h-8 w-8 flex-col items-center justify-center rounded border text-[11px] ' + cls}>
      {top && <span className="text-[7px] uppercase leading-none text-slate-500">{top}</span>}
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
        {result && <span className="text-slate-500">({result.acc}%)</span>}
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
        {result && <span className="text-slate-500">({result.acc}%)</span>}
      </div>
      <div className="space-y-1.5">
        {result?.examples.map((ex, i) => (
          <div key={i} className="flex items-center gap-1">
            {ex.v.map((val, idx) => (
              <Cell key={'in' + idx} val={val} cls={NEUTRAL} />
            ))}
            <span className="px-0.5 text-slate-600">→</span>
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
