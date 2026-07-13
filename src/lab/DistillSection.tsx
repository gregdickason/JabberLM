import { useEffect, useMemo, useRef, useState } from 'react'
import { deserialize, type SavedModel } from '../engine/persist'
import { Trainer } from '../engine/trainer'
import { DEFAULT_FEATURE_FLAGS, DEFAULT_MODEL_CONFIG, DEFAULT_TRAIN_CONFIG, type ModelConfig } from '../engine/config'
import { sortAccuracy } from '../interp/ablation'
import { sortHeldOut } from '../data/tasks'
import LineChart from '../viz/LineChart'
import SectionIntro from './SectionIntro'

const TINY: ModelConfig = { ...DEFAULT_MODEL_CONFIG, dModel: 24, nHeads: 2, nLayers: 2, contextLen: 32, dFF: 96 }
// dense-early eval so the chart fills in within seconds (matches the grokking view)
const evalInterval = (step: number) => (step < 100 ? 20 : step < 600 ? 100 : 200)
const TEMPERATURE = 2
const DISTILL = '#34d399' // emerald
const LABELS = '#f59e0b' // amber
const TEACHER = '#64748b' // grey reference

async function loadTeacher(): Promise<Trainer | null> {
  try {
    const res = await fetch(import.meta.env.BASE_URL + 'sort-model.json')
    if (!res.ok) return null
    return deserialize((await res.json()) as SavedModel)
  } catch {
    return null
  }
}

export default function DistillSection() {
  const [teacher, setTeacher] = useState<Trainer | null>(null)
  const [status, setStatus] = useState('loading the teacher…')
  const [teacherAcc, setTeacherAcc] = useState(0)
  const [running, setRunning] = useState(false)
  const [step, setStep] = useState(0)
  const [curveA, setCurveA] = useState<{ x: number; y: number }[]>([]) // distilled
  const [curveB, setCurveB] = useState<{ x: number; y: number }[]>([]) // hard labels

  const studentA = useRef<Trainer | null>(null) // learns from the teacher (distill)
  const studentB = useRef<Trainer | null>(null) // learns from the answers (hard labels)
  const runningRef = useRef(false)
  const stepsRef = useRef(2)
  const rafRef = useRef(0)
  const stepCountRef = useRef(0)
  const lastEvalRef = useRef(0)

  const held = useMemo(() => sortHeldOut().slice(0, 30), [])
  const trainCfg = useMemo(() => ({ ...DEFAULT_TRAIN_CONFIG, batchSize: 16, learningRate: 0.01 }), [])

  function buildStudents(t: Trainer) {
    // same corpus as the teacher → same vocabulary → aligned logit columns
    studentA.current = new Trainer(t.text, TINY, 1337)
    studentB.current = new Trainer(t.text, TINY, 1337)
  }

  // eval both students at the current step and append to the two curves
  function evalBoth(s: number) {
    const A = studentA.current
    const B = studentB.current
    if (!A || !B) return
    setCurveA((c) => [...c, { x: s, y: sortAccuracy(A.model, A.tok, held) }].slice(-300))
    setCurveB((c) => [...c, { x: s, y: sortAccuracy(B.model, B.tok, held) }].slice(-300))
    lastEvalRef.current = s
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const t = await loadTeacher()
      if (cancelled) return
      if (!t) {
        setStatus('could not load the teacher (public/sort-model.json)')
        return
      }
      setTeacher(t)
      setStatus('')
      setTeacherAcc(sortAccuracy(t.model, t.tok, held))
      buildStudents(t)
      evalBoth(0) // seed a step-0 baseline so the chart isn't empty
    })()
    return () => {
      cancelled = true
      runningRef.current = false
      cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function loop() {
    if (!runningRef.current || !teacher || !studentA.current || !studentB.current) return
    const A = studentA.current
    const B = studentB.current
    const n = stepsRef.current
    let ms = 0
    for (let i = 0; i < n; i++) {
      const a = performance.now()
      A.distillStep(trainCfg, DEFAULT_FEATURE_FLAGS, teacher.model, TEMPERATURE)
      B.stepBatch(trainCfg, DEFAULT_FEATURE_FLAGS)
      ms += performance.now() - a
      stepCountRef.current += 1
      if (stepCountRef.current - lastEvalRef.current >= evalInterval(stepCountRef.current)) {
        evalBoth(stepCountRef.current)
      }
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
    if (teacher) buildStudents(teacher)
    stepCountRef.current = 0
    lastEvalRef.current = 0
    setStep(0)
    setCurveA([])
    setCurveB([])
    evalBoth(0) // step-0 baseline
  }

  if (!teacher) return <div className="text-xs text-slate-500">{status}</div>

  const tParams = teacher.model.params.reduce((n, p) => n + p.size, 0)
  const sParams = (studentA.current?.model.params.reduce((n, p) => n + p.size, 0) ?? 0)
  const shrink = sParams ? (tParams / sParams).toFixed(1) : '—'
  const lastStep = Math.max(step, 1)
  const series = [
    { label: 'student — distilled from teacher', color: DISTILL, points: curveA },
    { label: 'student — from answers (labels)', color: LABELS, points: curveB },
    { label: `teacher (${teacherAcc}%)`, color: TEACHER, points: [{ x: 0, y: teacherAcc }, { x: lastStep, y: teacherAcc }] },
  ]
  const btn = 'rounded border px-3 py-1.5 text-xs'

  return (
    <div className="space-y-4">
      <SectionIntro
        title="Distillation — teach a tiny model from a big one"
        papers={[
          { title: 'Hinton, Vinyals & Dean (2015) — Distilling the Knowledge in a Neural Network', url: 'https://arxiv.org/abs/1503.02531' },
        ]}
      >
        Big models are expensive to run. <b>Distillation</b> trains a small <b>student</b> to copy a big{' '}
        <b>teacher</b>'s <em>whole answer distribution</em> — not just the single right token, but how much
        probability it put on every option. That extra signal ("dark knowledge") lets the student learn the
        skill from far fewer examples. Here a <b>{(sParams / 1000).toFixed(0)}K</b> student learns to sort
        from the <b>{(tParams / 1000).toFixed(0)}K</b> teacher (≈<b>{shrink}× smaller</b>). We train two
        students side by side — one <span style={{ color: DISTILL }}>distilled from the teacher</span>, one{' '}
        <span style={{ color: LABELS }}>from the plain answers</span> — and watch which learns faster.
      </SectionIntro>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {!running ? (
          <button className={btn + ' border-emerald-600 bg-emerald-900/40 text-emerald-200'} onClick={play}>
            ▶ {step > 0 ? 'Resume' : 'Distill'}
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
          step {step} · {stepsRef.current} steps/frame
        </span>
        {curveA.length > 0 && (
          <span className="ml-1">
            <span style={{ color: DISTILL }}>distilled {curveA.at(-1)?.y}%</span>{'  '}
            <span style={{ color: LABELS }}>labels {curveB.at(-1)?.y}%</span>
          </span>
        )}
      </div>

      <div>
        <div className="mb-1 text-[11px] text-slate-400">
          held-out sort accuracy — both students are the same tiny size; only the teaching signal differs
        </div>
        <LineChart series={series} width={460} height={190} yLabel="sort %" />
        <p className="mt-1 max-w-[460px] text-[11px] leading-relaxed text-slate-500">
          Both students reach the teacher's level (a <b>{shrink}× smaller</b> model captures the skill) — but
          the <span style={{ color: DISTILL }}>distilled</span> one usually gets there <b>faster</b>, because
          the teacher's soft probabilities tell it not just the right answer but <em>how close</em> the other
          options were. That efficiency is why distillation is a standard way to ship a small, cheap model
          with a big model's skill. (On this clean toy task both converge; at real scale the gap is larger.)
        </p>
      </div>
    </div>
  )
}
