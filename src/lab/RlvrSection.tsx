import { useEffect, useMemo, useRef, useState } from 'react'
import { Trainer } from '../engine/trainer'
import { DEFAULT_FEATURE_FLAGS, DEFAULT_TRAIN_CONFIG, type ModelConfig } from '../engine/config'
import { sortAccuracy, sortReward } from '../interp/ablation'
import { buildSortCorpus, sortHeldOut, sortTrainVecs } from '../data/tasks'
import LineChart from '../viz/LineChart'
import SectionIntro from './SectionIntro'

// A small sort model, warmed up briefly with SFT (imitate answers) to make it competent
// enough to explore, then improved by RLVR (policy gradient) driven ONLY by a verifier —
// no labelled answers, just "was your sort correct?". Defaults from an offline sweep:
// warm to ~55–60%, then lr 5e-4 / temp 0.5 / group 6 / 4 prompts-per-step climbs to ~90%+.
const CFG: ModelConfig = { vocabSize: 0, dModel: 32, nHeads: 2, nLayers: 2, contextLen: 32, dFF: 128, activation: 'gelu', weightTying: true }
const WARM_TARGET = 55 // % held-out sort accuracy at which we hand over to RLVR
const WARM_CAP = 3000 // …or this many SFT steps, whichever first
const RLVR_CAP = 900
const evalInterval = (s: number) => (s < 120 ? 20 : 120)
const WARM = '#f59e0b' // amber — SFT warm-up
const RLVR = '#34d399' // emerald — RLVR accuracy
const REW = '#38bdf8' // sky — mean reward

type Pt = { x: number; y: number }
type Attempt = { prompt: string; completion: string; reward: number }

export default function RlvrSection() {
  const [running, setRunning] = useState(false)
  const [phase, setPhase] = useState<'warmup' | 'rlvr'>('warmup')
  const [step, setStep] = useState(0)
  const [accWarm, setAccWarm] = useState<Pt[]>([])
  const [accRlvr, setAccRlvr] = useState<Pt[]>([])
  const [reward, setReward] = useState<Pt[]>([])
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [ready, setReady] = useState(false)

  const trainer = useRef<Trainer | null>(null)
  const runningRef = useRef(false)
  const phaseRef = useRef<'warmup' | 'rlvr'>('warmup')
  const stepsRef = useRef(2)
  const rafRef = useRef(0)
  const stepCountRef = useRef(0)
  const lastEvalRef = useRef(0)

  const held = useMemo(() => sortHeldOut().slice(0, 40), [])
  const prompts = useMemo(() => sortTrainVecs().slice(0, 150).map((v) => `sort ${v.join(' ')} => `), [])
  const warmCfg = useMemo(() => ({ ...DEFAULT_TRAIN_CONFIG, batchSize: 16, learningRate: 0.01 }), [])
  const rlCfg = useMemo(() => ({ ...DEFAULT_TRAIN_CONFIG, batchSize: 1, learningRate: 0.0005 }), [])
  const corpus = useMemo(() => buildSortCorpus(), [])

  function build() {
    trainer.current = new Trainer(corpus, CFG, 3)
  }
  const acc = () => (trainer.current ? sortAccuracy(trainer.current.model, trainer.current.tok, held) : 0)

  function evalNow(s: number) {
    const a = acc()
    if (phaseRef.current === 'warmup') setAccWarm((c) => [...c, { x: s, y: a }].slice(-300))
    else setAccRlvr((c) => [...c, { x: s, y: a }].slice(-300))
    lastEvalRef.current = s
  }

  useEffect(() => {
    build()
    setReady(true)
    evalNow(0)
    return () => {
      runningRef.current = false
      cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function loop() {
    const t = trainer.current
    if (!runningRef.current || !t) return
    const n = stepsRef.current
    let ms = 0
    for (let i = 0; i < n; i++) {
      const a = performance.now()
      if (phaseRef.current === 'warmup') {
        t.stepBatch(warmCfg, DEFAULT_FEATURE_FLAGS)
        stepCountRef.current += 1
        // hand over to RLVR once competent (or at the cap)
        if (stepCountRef.current % 100 === 0 && (acc() >= WARM_TARGET || stepCountRef.current >= WARM_CAP)) {
          phaseRef.current = 'rlvr'
          setPhase('rlvr')
          lastEvalRef.current = stepCountRef.current
          evalNow(stepCountRef.current) // seed the RLVR curve at the hand-over accuracy
        }
      } else {
        const r = t.rlvrStep(rlCfg, DEFAULT_FEATURE_FLAGS, {
          prompts,
          groupSize: 6,
          temperature: 0.5,
          maxNew: 8,
          reward: sortReward,
          promptsPerStep: 4,
        })
        stepCountRef.current += 1
        setReward((c) => [...c, { x: stepCountRef.current, y: Math.round(r.meanReward * 100) }].slice(-300))
        setAttempts(r.samples.slice(0, 8).map((s) => ({ prompt: s.prompt, completion: s.completion, reward: s.reward })))
        if (stepCountRef.current >= WARM_CAP + RLVR_CAP) {
          runningRef.current = false
          setRunning(false)
        }
      }
      ms += performance.now() - a
      if (stepCountRef.current - lastEvalRef.current >= evalInterval(stepCountRef.current)) evalNow(stepCountRef.current)
    }
    const perStep = ms / n
    const want = Math.max(1, Math.min(20, Math.round(20 / Math.max(0.4, perStep))))
    stepsRef.current = Math.max(1, Math.round(n * 0.6 + want * 0.4))
    setStep(stepCountRef.current)
    if (runningRef.current) rafRef.current = requestAnimationFrame(loop)
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
    build()
    phaseRef.current = 'warmup'
    setPhase('warmup')
    stepCountRef.current = 0
    lastEvalRef.current = 0
    setStep(0)
    setAccWarm([]); setAccRlvr([]); setReward([]); setAttempts([])
    evalNow(0)
  }

  if (!ready) return <div className="text-xs text-slate-500">building a model…</div>

  const series = [
    { label: 'SFT warm-up — accuracy', color: WARM, points: accWarm },
    { label: 'RLVR — accuracy', color: RLVR, points: accRlvr },
    { label: 'RLVR — mean reward', color: REW, points: reward },
  ]
  const btn = 'rounded border px-3 py-1.5 text-xs'
  const correct = attempts.filter((a) => a.reward === 1).length

  return (
    <div className="space-y-4">
      <SectionIntro
        title="RLVR — learning from a verifier, not from labels"
        papers={[
          { title: 'DeepSeek-R1 (2025) — RL from verifiable rewards (GRPO)', url: 'https://arxiv.org/abs/2501.12948' },
          { title: 'Zelikman et al. (2022) — STaR: self-taught reasoner', url: 'https://arxiv.org/abs/2203.14465' },
        ]}
      >
        SFT copies given answers; distillation copies a teacher. <b>RLVR</b> needs neither — just a{' '}
        <b>verifier</b>. The model <em>samples its own attempts</em>, a checker says right/wrong, and a{' '}
        <b>policy-gradient</b> update pushes up the tokens of correct attempts and down the wrong ones
        (advantage = reward − the group's average). This is how reasoning models are trained where answers
        are checkable (maths, code). Here: a brief <span style={{ color: WARM }}>SFT warm-up</span> to make
        the model competent enough to explore, then <span style={{ color: RLVR }}>RLVR</span> takes over and
        climbs — <b>having never been shown a correct sort</b>, only told which of its own guesses were right.
      </SectionIntro>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {!running ? (
          <button className={btn + ' border-emerald-600 bg-emerald-900/40 text-emerald-200'} onClick={play}>
            ▶ {step > 0 ? 'Resume' : 'Warm up, then learn from reward'}
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
          step {step} · phase{' '}
          <span style={{ color: phase === 'warmup' ? WARM : RLVR }}>{phase === 'warmup' ? 'SFT warm-up' : 'RLVR (reward only)'}</span>
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-1 text-[11px] text-slate-400">
            held-out sort accuracy — <span style={{ color: WARM }}>SFT warm-up</span> then{' '}
            <span style={{ color: RLVR }}>RLVR</span> (reward, right axis shares %)
          </div>
          <LineChart series={series} width={460} height={200} yLabel="%" />
        </div>
        <div>
          <div className="mb-1 text-[11px] text-slate-400">
            the model's own attempts this step — <span style={{ color: RLVR }}>correct (reinforced)</span> /{' '}
            <span style={{ color: '#f87171' }}>wrong (discouraged)</span>
            {attempts.length > 0 && <span className="ml-1 text-slate-500">· {correct}/{attempts.length} right</span>}
          </div>
          <div className="space-y-0.5 font-mono text-[12px]">
            {attempts.length === 0 ? (
              <div className="text-[11px] text-slate-500">start the run — attempts appear during the RLVR phase</div>
            ) : (
              attempts.map((a, i) => (
                <div key={i} className="flex flex-wrap items-center gap-x-1">
                  <span className="text-slate-500">{a.prompt}</span>
                  <span style={{ color: a.reward === 1 ? RLVR : '#f87171' }}>
                    {a.completion || '…'} {a.reward === 1 ? '✓' : '✗'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <p className="max-w-[900px] text-[11px] leading-relaxed text-slate-500">
        The <span style={{ color: RLVR }}>RLVR</span> curve climbs well above where warm-up left off — from a
        reward signal alone, with no answer keys. Honest caveats: RLVR only works where the answer is{' '}
        <b>verifiable</b> (sorting, maths, code — not open-ended writing); it needs a{' '}
        <b>competent-enough base</b> (that's the warm-up — from scratch every guess is wrong, so there's
        nothing to reinforce — the "cold-start" problem); the 0/1 reward is <b>sparse</b>, so it takes many
        samples; and real systems add machinery we skip (a KL penalty to stay near the reference policy, a
        value model, or a learned reward model for non-verifiable tasks). Naïve policy gradient is also
        finicky — too high a learning rate or sampling temperature and it <em>collapses</em> instead of
        improving; the settings here were tuned offline.
      </p>
    </div>
  )
}
