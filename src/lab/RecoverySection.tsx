import { useEffect, useMemo, useRef, useState } from 'react'
import { deserialize, type SavedModel } from '../engine/persist'
import { Trainer } from '../engine/trainer'
import { DEFAULT_FEATURE_FLAGS, DEFAULT_TRAIN_CONFIG } from '../engine/config'
import { sortAccuracy, genLine } from '../interp/ablation'
import { sortHeldOut, type SortVec } from '../data/tasks'
import LineChart from '../viz/LineChart'
import SectionIntro from './SectionIntro'

async function loadSortModel(): Promise<Trainer | null> {
  try {
    const res = await fetch(import.meta.env.BASE_URL + 'sort-model.json')
    if (!res.ok) return null
    return deserialize((await res.json()) as SavedModel)
  } catch {
    return null
  }
}

interface Importance {
  head: string // "layer.head"
  acc: number // held-out sort accuracy when THIS head is ablated (low = critical)
}
type Phase = 'healthy' | 'injured' | 'recovering' | 'recovered'
const EVAL_EVERY = 100
const HEALTH = '#34d399' // emerald
const tick = () => new Promise((r) => setTimeout(r, 0))

export default function RecoverySection() {
  const [trainer, setTrainer] = useState<Trainer | null>(null)
  const [status, setStatus] = useState('loading the sort model…')
  const [phase, setPhase] = useState<Phase>('healthy')
  const [baseline, setBaseline] = useState(0)
  const [before, setBefore] = useState<Importance[] | null>(null)
  const [after, setAfter] = useState<Importance[] | null>(null)
  const [dead, setDead] = useState<string | null>(null) // the ablated head
  const [curve, setCurve] = useState<{ step: number; acc: number }[]>([])
  const [step, setStep] = useState(0)
  const [running, setRunning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [examples, setExamples] = useState<{ v: SortVec; out: string; ok: boolean }[]>([])

  const runningRef = useRef(false)
  const stepsRef = useRef(2)
  const rafRef = useRef(0)
  const stepCountRef = useRef(0)
  const lastEvalRef = useRef(0)

  const held = useMemo(() => sortHeldOut().slice(0, 30), [])
  // a few fixed UNSEEN lists to watch the model actually sort (die, then heal)
  const demoVecs = useMemo(() => sortHeldOut().slice(40, 45), [])
  const trainCfg = useMemo(() => ({ ...DEFAULT_TRAIN_CONFIG, batchSize: 16, learningRate: 0.01 }), [])
  const ablSet = useMemo(() => (dead ? new Set([dead]) : undefined), [dead])

  // run the demo prompts through the model with the current ablation → live output + ✓/✗
  function runExamples(t: Trainer, abl: ReadonlySet<string> | undefined) {
    setExamples(
      demoVecs.map((v) => {
        const want = [...v].sort((a, b) => a - b).join(' ')
        const out = (genLine(t.model, t.tok, `sort ${v.join(' ')} => `, 8, abl).match(/\d(?: \d)*/) || [''])[0].trim()
        return { v, out, ok: out === want }
      }),
    )
  }

  // sweep every single-head ablation → per-head "accuracy if ablated" (async, chunked)
  async function sweep(t: Trainer): Promise<Importance[]> {
    const { nLayers, nHeads } = t.model.cfg
    const rows: Importance[] = []
    for (let l = 0; l < nLayers; l++) {
      for (let h = 0; h < nHeads; h++) {
        rows.push({ head: `${l}.${h}`, acc: sortAccuracy(t.model, t.tok, held, new Set([`${l}.${h}`])) })
        await tick()
      }
    }
    return rows
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const t = await loadSortModel()
      if (cancelled) return
      if (!t) {
        setStatus('could not load the sort model (public/sort-model.json)')
        return
      }
      setTrainer(t)
      setStatus('')
      setBaseline(sortAccuracy(t.model, t.tok, held))
      runExamples(t, undefined) // healthy: it sorts
      setBefore(await sweep(t))
    })()
    return () => {
      cancelled = true
      runningRef.current = false
      cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const critical = useMemo(() => {
    if (!before) return null
    return before.reduce((a, b) => (b.acc < a.acc ? b : a))
  }, [before])
  const nowCritical = useMemo(() => {
    if (!after) return null
    // exclude the dead head (it's off, so "ablating" it changes nothing)
    return after.filter((r) => r.head !== dead).reduce((a, b) => (b.acc < a.acc ? b : a))
  }, [after, dead])

  function injure(head: string) {
    setDead(head)
    setPhase('injured')
    setAfter(null)
    stepCountRef.current = 0
    lastEvalRef.current = 0
    setStep(0)
    // seed the recovery chart: healthy baseline point, then the injured drop
    const abl = new Set([head])
    const injured = trainer ? sortAccuracy(trainer.model, trainer.tok, held, abl) : 0
    setCurve([{ step: 0, acc: injured }])
    if (trainer) runExamples(trainer, abl) // watch the sorting die
  }

  function loop() {
    if (!runningRef.current || !trainer) return
    const n = stepsRef.current
    let ms = 0
    for (let i = 0; i < n; i++) {
      const a = performance.now()
      trainer.stepBatch(trainCfg, DEFAULT_FEATURE_FLAGS, ablSet)
      ms += performance.now() - a
      stepCountRef.current += 1
      if (stepCountRef.current - lastEvalRef.current >= EVAL_EVERY) {
        const acc = sortAccuracy(trainer.model, trainer.tok, held, ablSet)
        setCurve((c) => [...c, { step: stepCountRef.current, acc }].slice(-300))
        runExamples(trainer, ablSet) // watch the live examples heal
        lastEvalRef.current = stepCountRef.current
      }
    }
    const perStep = ms / n
    const want = Math.max(1, Math.min(30, Math.round(20 / Math.max(0.2, perStep))))
    stepsRef.current = Math.max(1, Math.round(n * 0.6 + want * 0.4))
    setStep(stepCountRef.current)
    rafRef.current = requestAnimationFrame(loop)
  }
  function play() {
    runningRef.current = true
    setRunning(true)
    setPhase('recovering')
    rafRef.current = requestAnimationFrame(loop)
  }
  function pause() {
    runningRef.current = false
    setRunning(false)
    cancelAnimationFrame(rafRef.current)
    if (curve.length > 1) setPhase('recovered')
  }

  async function rescan() {
    if (!trainer) return
    setBusy(true)
    await tick()
    setAfter(await sweep(trainer))
    setBusy(false)
  }

  async function reset() {
    runningRef.current = false
    setRunning(false)
    cancelAnimationFrame(rafRef.current)
    setStatus('reloading the healthy model…')
    const t = await loadSortModel()
    if (!t) {
      setStatus('could not reload the sort model')
      return
    }
    setTrainer(t)
    setStatus('')
    setPhase('healthy')
    setDead(null)
    setAfter(null)
    setCurve([])
    setStep(0)
    stepCountRef.current = 0
    lastEvalRef.current = 0
    setBaseline(sortAccuracy(t.model, t.tok, held))
    runExamples(t, undefined)
    setBefore(await sweep(t))
  }

  if (!trainer) return <div className="text-xs text-slate-500">{status}</div>

  const { nLayers, nHeads } = trainer.model.cfg
  const latestAcc = curve.at(-1)?.acc ?? baseline
  const series = [
    { label: 'held-out sort accuracy (head off)', color: HEALTH, points: curve.map((p) => ({ x: p.step, y: p.acc })) },
    {
      label: 'healthy baseline',
      color: '#64748b',
      points: [
        { x: 0, y: baseline },
        { x: Math.max(step, 1), y: baseline },
      ],
    },
  ]

  // per-head importance for the grid (lower acc-if-ablated = more critical = redder)
  const impMap = new Map((after ?? before ?? []).map((r) => [r.head, r.acc]))
  const btn = 'rounded border px-3 py-1.5 text-xs'

  return (
    <div className="space-y-4">
      <SectionIntro
        title="Injury & recovery — a model reroutes a skill"
        papers={[
          { title: 'Scoville & Milner (1957) — H.M., memory after medial-temporal lesion', url: 'https://jnnp.bmj.com/content/20/1/11' },
          { title: 'Walsh & Cowey (2000) — TMS as a reversible "virtual lesion"', url: 'https://www.nature.com/articles/35036239' },
        ]}
      >
        In the head-ablation tab you can knock out the attention head a skill depends on and watch the
        skill die. Here we go further: <b>keep training with that head permanently off</b> and watch the
        model <b>recover</b> — it reroutes the sorting circuit through other heads. Then re-scan and see
        that the head the skill now depends on has <b>moved</b>. It's the mechanistic echo of the brain
        remapping a lost function after injury (with retraining/time) — and why models are robust to some
        damage. Recovery may be partial, and the injured head stays dead throughout.
      </SectionIntro>

      {/* status line */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-400">
          {phase}
        </span>
        <span className="text-slate-400">
          healthy sort <span className="font-mono text-emerald-300">{baseline}%</span>
        </span>
        {dead && (
          <span className="text-slate-400">
            · injured head <span className="font-mono text-red-300">{dead}</span> · now{' '}
            <span className="font-mono text-emerald-300">{latestAcc}%</span>
            {step > 0 && <span className="text-slate-500"> (+{step} steps)</span>}
          </span>
        )}
      </div>

      {/* head grid + controls */}
      <div className="flex flex-wrap items-start gap-6">
        <div>
          <div className="mb-1 text-[11px] text-slate-400">
            attention heads — colour = how much sorting drops if that head is ablated (redder = more
            critical){after ? ' · after recovery' : ''}
          </div>
          <div className="inline-block rounded border border-slate-800 p-2">
            {Array.from({ length: nLayers }, (_, l) => (
              <div key={l} className="flex items-center gap-1">
                <span className="w-12 shrink-0 text-[10px] text-slate-500">layer {l}</span>
                {Array.from({ length: nHeads }, (_, h) => {
                  const k = `${l}.${h}`
                  const isDead = k === dead
                  const imp = impMap.get(k)
                  const critNow = (after ? nowCritical?.head : critical?.head) === k
                  // colour scale: low acc-if-ablated -> red tint
                  const bg = isDead
                    ? 'bg-red-900/70 border-red-500'
                    : imp != null && imp < baseline * 0.5
                      ? 'bg-red-900/30 border-red-700/60'
                      : 'bg-slate-800 border-slate-600'
                  return (
                    <button
                      key={k}
                      disabled={phase !== 'healthy'}
                      onClick={() => injure(k)}
                      title={imp != null ? `sort ${imp}% if ${k} is ablated` : k}
                      className={
                        'm-0.5 flex h-9 w-12 flex-col items-center justify-center rounded border text-[10px] disabled:cursor-default ' +
                        bg +
                        (critNow ? ' ring-2 ring-amber-400' : '') +
                        (phase === 'healthy' ? ' hover:bg-slate-700' : '')
                      }
                    >
                      <span className={isDead ? 'text-red-200 line-through' : 'text-slate-200'}>h{h}</span>
                      {imp != null && <span className="text-[8px] text-slate-500">{imp}%</span>}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          <div className="mt-1 max-w-xs text-[11px] text-slate-500">
            {phase === 'healthy' ? (
              <>
                The ringed head is the <b>most critical</b> for sorting. Click it (or any head) to{' '}
                <b>injure</b> the model.
              </>
            ) : (
              <>
                <span className="text-red-300">{dead}</span> is dead. {after && nowCritical && (
                  <>
                    The skill now leans most on <span className="text-amber-300">{nowCritical.head}</span> —
                    it <b>rerouted</b>.
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* controls */}
        <div className="space-y-2">
          {phase === 'healthy' && critical && (
            <button
              className={btn + ' border-red-600 bg-red-900/40 text-red-200'}
              onClick={() => injure(critical.head)}
            >
              🧠 Injure the sorting head ({critical.head})
            </button>
          )}
          {(phase === 'injured' || phase === 'recovering' || phase === 'recovered') && (
            <div className="flex flex-wrap gap-2">
              {!running ? (
                <button className={btn + ' border-emerald-600 bg-emerald-900/40 text-emerald-200'} onClick={play}>
                  ▶ {step > 0 ? 'Resume' : 'Retrain (head stays off)'}
                </button>
              ) : (
                <button className={btn + ' border-amber-600 bg-amber-900/40 text-amber-200'} onClick={pause}>
                  ⏸ Pause
                </button>
              )}
              <button
                className={btn + ' border-sky-600 bg-sky-900/40 text-sky-200 disabled:opacity-40'}
                onClick={rescan}
                disabled={running || busy || step === 0}
                title="Re-scan which head the skill now depends on"
              >
                {busy ? 'scanning…' : '🔍 Re-scan the circuit'}
              </button>
            </div>
          )}
          <button className={btn + ' border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'} onClick={() => void reset()}>
            ↺ Reset (heal)
          </button>
          <div className="text-[10px] text-slate-500">{stepsRef.current} steps/frame</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        {/* recovery chart */}
        {dead && (
          <div className="min-w-0">
            <div className="mb-1 text-[11px] text-slate-400">
              recovery — held-out sort accuracy while retraining with {dead} ablated
            </div>
            <LineChart series={series} width={440} height={180} yLabel="sort %" />
            <div className="mt-1 max-w-[440px] text-[11px] leading-relaxed text-slate-500">
              The dashed grey line is the pre-injury level. Accuracy drops to near zero the moment the head
              is ablated, then climbs back as the remaining heads relearn the job — <b>with the injured
              head still switched off</b>. That's the model routing the function around the damage.
            </div>
          </div>
        )}

        {/* live inference — watch actual lists get sorted, die, and heal */}
        {examples.length > 0 && (
          <div className="min-w-0">
            <div className="mb-1 text-[11px] text-slate-400">
              live inference on unseen lists{' '}
              {dead ? (phase === 'injured' ? '(head just ablated)' : '(retraining…)') : '(healthy)'}
            </div>
            <div className="space-y-1">
              {examples.map((ex, i) => (
                <div key={i} className="flex items-center gap-1 font-mono text-[12px]">
                  <span className="text-slate-500">sort {ex.v.join(' ')} =&gt;</span>
                  <span className={ex.ok ? 'text-emerald-300' : 'text-red-300'}>{ex.out || '—'}</span>
                  <span className={'ml-1 ' + (ex.ok ? 'text-emerald-400' : 'text-red-400')}>
                    {ex.ok ? '✓' : '✗'}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-1 max-w-[280px] text-[11px] leading-relaxed text-slate-500">
              {!dead
                ? 'The healthy model sorts these correctly.'
                : phase === 'injured'
                  ? 'With the head ablated the sort is broken — press Retrain and watch these lines turn green again.'
                  : 'Same lists, same ablation — recovering live as the model reroutes.'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
