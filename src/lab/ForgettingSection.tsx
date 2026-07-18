import { useEffect, useMemo, useRef, useState } from 'react'
import { deserialize, type SavedModel } from '../engine/persist'
import { Trainer } from '../engine/trainer'
import { DEFAULT_FEATURE_FLAGS, DEFAULT_TRAIN_CONFIG } from '../engine/config'
import { sortAccuracyDir, genSortLine } from '../interp/ablation'
import { sortHeldOut, buildSortCorpus, buildTrosCorpus, type SortVec } from '../data/tasks'
import LineChart from '../viz/LineChart'
import SectionIntro from './SectionIntro'

// Teach the ascending sort model a NEW skill — "tros" (sort backwards = descending, under
// its own verb so one model can hold both) — two ways, and watch the OLD skill:
//   • SFT    — full fine-tune on tros → learns it but FORGETS sort (weights drift, nothing protected)
//   • Replay — fine-tune on tros WHILE self-distilling `sort` from a frozen snapshot → keeps BOTH
// Replay is the in-browser core of relevance-masked self-distillation (minus the paper's LLM judge:
// we replay whole old-task windows instead of judge-selected tokens). Defaults from an offline sweep:
// λ=0.5, T=2, lr 0.005 — tros reaches ~100% by ~500 steps while sort stays ~95%.
const evalInterval = (s: number) => (s < 100 ? 20 : s < 600 ? 100 : 200)
const LAMBDA = 0.5
const TEMPERATURE = 2
const SFT = '#f87171' // red — the one that forgets
const REPLAY = '#34d399' // emerald — keeps both
const BASE = '#64748b' // grey reference

async function loadBase(): Promise<SavedModel | null> {
  try {
    const res = await fetch(import.meta.env.BASE_URL + 'sort-model.json')
    if (!res.ok) return null
    return (await res.json()) as SavedModel
  } catch {
    return null
  }
}

type Pt = { x: number; y: number }
const EXAMPLES: SortVec[] = [
  [6, 9, 2],
  [4, 1, 7],
  [8, 3, 5],
]

export default function ForgettingSection() {
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState('loading the sort model…')
  const [running, setRunning] = useState(false)
  const [step, setStep] = useState(0)
  const [baseAcc, setBaseAcc] = useState(0)
  const [nSft, setNSft] = useState<Pt[]>([]) // new task (tros) — SFT
  const [nRep, setNRep] = useState<Pt[]>([]) // new task (tros) — replay
  const [oSft, setOSft] = useState<Pt[]>([]) // old task (sort) retention — SFT
  const [oRep, setORep] = useState<Pt[]>([]) // old task (sort) retention — replay

  const savedRef = useRef<SavedModel | null>(null)
  const sft = useRef<Trainer | null>(null)
  const replay = useRef<Trainer | null>(null)
  const teacher = useRef<Trainer | null>(null) // frozen snapshot of the original (for replay)
  const trosIds = useRef<number[]>([])
  const sortIds = useRef<number[]>([])
  const runningRef = useRef(false)
  const stepsRef = useRef(2)
  const rafRef = useRef(0)
  const stepCountRef = useRef(0)
  const lastEvalRef = useRef(0)

  const held = useMemo(() => sortHeldOut().slice(0, 30), [])
  const trainCfg = useMemo(() => ({ ...DEFAULT_TRAIN_CONFIG, batchSize: 16, learningRate: 0.005 }), [])
  const trosCorpus = useMemo(() => buildTrosCorpus(), [])
  const sortCorpus = useMemo(() => buildSortCorpus(), [])

  function build(saved: SavedModel) {
    sft.current = deserialize(saved)
    replay.current = deserialize(saved)
    teacher.current = deserialize(saved) // never trained
    trosIds.current = sft.current.tok.encode(trosCorpus)
    sortIds.current = sft.current.tok.encode(sortCorpus)
  }

  const newAcc = (t: Trainer) => sortAccuracyDir(t.model, t.tok, held, { descending: true, verb: 'tros' })
  const oldAcc = (t: Trainer) => sortAccuracyDir(t.model, t.tok, held, { descending: false, verb: 'sort' })

  function evalAll(s: number) {
    const S = sft.current, R = replay.current
    if (!S || !R) return
    setNSft((c) => [...c, { x: s, y: newAcc(S) }].slice(-300))
    setNRep((c) => [...c, { x: s, y: newAcc(R) }].slice(-300))
    setOSft((c) => [...c, { x: s, y: oldAcc(S) }].slice(-300))
    setORep((c) => [...c, { x: s, y: oldAcc(R) }].slice(-300))
    lastEvalRef.current = s
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const saved = await loadBase()
      if (cancelled) return
      if (!saved) {
        setStatus('could not load the sort model (public/sort-model.json)')
        return
      }
      savedRef.current = saved
      build(saved)
      setBaseAcc(oldAcc(sft.current!))
      setReady(true)
      setStatus('')
      evalAll(0)
    })()
    return () => {
      cancelled = true
      runningRef.current = false
      cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function loop() {
    const S = sft.current, R = replay.current, T = teacher.current
    if (!runningRef.current || !S || !R || !T) return
    const n = stepsRef.current
    let ms = 0
    for (let i = 0; i < n; i++) {
      const a = performance.now()
      S.sftStep(trainCfg, DEFAULT_FEATURE_FLAGS, trosIds.current) // full fine-tune → forgets sort
      R.replayStep(trainCfg, DEFAULT_FEATURE_FLAGS, {
        newIds: trosIds.current,
        oldIds: sortIds.current,
        teacher: T.model,
        lambda: LAMBDA,
        temperature: TEMPERATURE,
      })
      ms += performance.now() - a
      stepCountRef.current += 1
      if (stepCountRef.current - lastEvalRef.current >= evalInterval(stepCountRef.current)) evalAll(stepCountRef.current)
    }
    const perStep = ms / n
    const want = Math.max(1, Math.min(20, Math.round(20 / Math.max(0.4, perStep))))
    stepsRef.current = Math.max(1, Math.round(n * 0.6 + want * 0.4))
    setStep(stepCountRef.current)
    rafRef.current = requestAnimationFrame(loop)
  }
  function play() {
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
    if (savedRef.current) build(savedRef.current)
    stepCountRef.current = 0
    lastEvalRef.current = 0
    setStep(0)
    setNSft([]); setNRep([]); setOSft([]); setORep([])
    evalAll(0)
  }

  if (!ready) return <div className="text-xs text-slate-500">{status}</div>

  const lastStep = Math.max(step, 1)
  const newSeries = [
    { label: 'SFT (full fine-tune)', color: SFT, points: nSft },
    { label: 'Replay / self-distil', color: REPLAY, points: nRep },
  ]
  const oldSeries = [
    { label: 'after SFT — forgotten', color: SFT, points: oSft },
    { label: 'after Replay — kept', color: REPLAY, points: oRep },
    { label: `original (${baseAcc}%)`, color: BASE, points: [{ x: 0, y: baseAcc }, { x: lastStep, y: baseAcc }] },
  ]
  const btn = 'rounded border px-3 py-1.5 text-xs'

  // live before/after on the OLD task (sort), SFT vs replay
  const rows = sft.current && replay.current
    ? EXAMPLES.map((v) => ({
        v,
        want: [...v].sort((a, b) => a - b).join(' '),
        sft: genSortLine(sft.current!.model, sft.current!.tok, v, DEFAULT_FEATURE_FLAGS, 'sort'),
        rep: genSortLine(replay.current!.model, replay.current!.tok, v, DEFAULT_FEATURE_FLAGS, 'sort'),
      }))
    : []

  return (
    <div className="space-y-4">
      <SectionIntro
        title="Catastrophic forgetting — and how to beat it"
        papers={[
          { title: 'Applied Compute — Relevance-Masked Self-Distillation', url: 'https://www.appliedcompute.com/research/relevance-masked-self-distillation' },
          { title: 'Kirkpatrick et al. (2017) — Overcoming catastrophic forgetting', url: 'https://arxiv.org/abs/1612.00796' },
        ]}
      >
        Teaching a model a <b>new</b> skill can quietly erase an <b>old</b> one — "catastrophic forgetting".
        The bundled model sorts <b>ascending</b> (<span className="font-mono">sort 6 9 2 =&gt; 2 6 9</span>,
        ~{baseAcc}%). We teach it a new verb, "<b><span className="font-mono">tros</span></b>" ("sort" backwards
        = descending), two ways and watch what happens to the old "<span className="font-mono">sort</span>"{' '}
        skill: plain <span style={{ color: SFT }}>full fine-tuning (SFT)</span> vs{' '}
        <span style={{ color: REPLAY }}>replay / self-distillation</span> — learn "<span className="font-mono">tros</span>"{' '}
        while distilling "<span className="font-mono">sort</span>" from a frozen snapshot of the model's own{' '}
        <em>old self</em>. That's the core of <b>relevance-masked self-distillation</b> (the paper adds an LLM
        judge to pick which tokens to keep; in a browser we just replay whole old-task windows). Freezing the
        base is a third way — see the <a className="text-fuchsia-300 hover:underline" href="#lora-fine-tuning">LoRA tab</a>.
      </SectionIntro>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {!running ? (
          <button className={btn + ' border-emerald-600 bg-emerald-900/40 text-emerald-200'} onClick={play}>
            ▶ {step > 0 ? 'Resume' : 'Teach both the new skill'}
          </button>
        ) : (
          <button className={btn + ' border-amber-600 bg-amber-900/40 text-amber-200'} onClick={pause}>
            ⏸ Pause
          </button>
        )}
        <button className={btn + ' border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'} onClick={reset}>
          ↺ Reset
        </button>
        <span className="text-slate-500">step {step} · λ {LAMBDA}, T {TEMPERATURE}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-1 text-[11px] text-slate-400">
            New skill — "<b className="font-mono">tros</b>" (descending) accuracy — both learn it
          </div>
          <LineChart series={newSeries} width={440} height={185} yLabel="tros %" />
        </div>
        <div>
          <div className="mb-1 text-[11px] text-slate-400">
            Old skill — "<b className="font-mono">sort</b>" (ascending) accuracy — SFT forgets, replay keeps it
          </div>
          <LineChart series={oldSeries} width={440} height={185} yLabel="sort %" />
        </div>
      </div>

      {rows.length > 0 && step > 0 && (
        <div className="font-mono text-[12px]">
          <div className="mb-1 text-[11px] text-slate-400">the old skill after training — same prompt, two models</div>
          {rows.map((r) => (
            <div key={r.v.join(',')} className="flex flex-wrap items-center gap-x-2">
              <span className="text-slate-400">sort {r.v.join(' ')} =&gt;</span>
              <span><span className="text-slate-500">SFT</span>{' '}
                <span style={{ color: r.sft === r.want ? REPLAY : SFT }}>{r.sft || '…'}</span>{r.sft === r.want ? '' : ' ✗'}</span>
              <span className="text-slate-600">·</span>
              <span><span className="text-slate-500">Replay</span>{' '}
                <span style={{ color: r.rep === r.want ? REPLAY : SFT }}>{r.rep || '…'}</span>{r.rep === r.want ? ' ✓' : ' ✗'}</span>
            </div>
          ))}
        </div>
      )}

      <p className="max-w-[900px] text-[11px] leading-relaxed text-slate-500">
        <span style={{ color: SFT }}>SFT</span> learns "<span className="font-mono">tros</span>" but its{' '}
        "<span className="font-mono">sort</span>" accuracy <b>collapses</b> — nothing protected the old skill, so
        the new task overwrote it. <span style={{ color: REPLAY }}>Replay / self-distillation</span> keeps{' '}
        <em>both</em> in one set of weights: every step it also matches its own old outputs on{' '}
        "<span className="font-mono">sort</span>", so learning "<span className="font-mono">tros</span>" can't erase
        them. This is how you add a capability to a deployed model without regressions — the honest,
        in-browser heart of the RMSD idea (the real method adds an LLM judge to spend the retention budget only
        on the tokens that matter).
      </p>
    </div>
  )
}
