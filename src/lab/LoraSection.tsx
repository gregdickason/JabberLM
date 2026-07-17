import { useEffect, useMemo, useRef, useState } from 'react'
import { deserialize, type SavedModel } from '../engine/persist'
import { Trainer } from '../engine/trainer'
import { DEFAULT_FEATURE_FLAGS, DEFAULT_SAMPLE_CONFIG, DEFAULT_TRAIN_CONFIG } from '../engine/config'
import { generate } from '../engine/generate'
import { RNG } from '../engine/random'
import { sortAccuracyDir, genSortLine } from '../interp/ablation'
import { sortHeldOut, buildDescendingSortCorpus, type SortVec } from '../data/tasks'
import LineChart from '../viz/LineChart'
import SectionIntro from './SectionIntro'

// The bundled sort model sorts ASCENDING (~97% held-out). We attach a tiny LoRA adapter,
// freeze the base, and fine-tune ONLY the adapter on DESCENDING sort (same "sort a b c =>"
// prompt, output high→low). Toggling the overlay flips the model's output 2 6 9 <-> 9 6 2.
// Defaults chosen from an offline sweep: rank 8 attn+mlp reaches ~98% descending by ~500
// steps with a smooth curve, while ascending (overlay off) stays pinned at ~97% (base frozen).
const RANK = 8
const ALPHA = 16
const TARGETS: ('attn' | 'mlp')[] = ['attn', 'mlp']
const evalInterval = (s: number) => (s < 100 ? 20 : s < 600 ? 100 : 200)
const DESC = '#34d399' // emerald — descending (overlay ON, the adapter)
const ASC = '#64748b' // grey — ascending (overlay OFF, the frozen base)
const FLAGS_ON = { ...DEFAULT_FEATURE_FLAGS, lora: true }
const FLAGS_OFF = { ...DEFAULT_FEATURE_FLAGS, lora: false }

const EXAMPLES: SortVec[] = [
  [6, 9, 2],
  [3, 8, 5],
  [9, 1, 7],
  [4, 2, 8],
]

async function loadBase(): Promise<Trainer | null> {
  try {
    const res = await fetch(import.meta.env.BASE_URL + 'sort-model.json')
    if (!res.ok) return null
    return deserialize((await res.json()) as SavedModel)
  } catch {
    return null
  }
}

type Row = { v: SortVec; asc: string; desc: string; ok: boolean }

export default function LoraSection() {
  const [trainer, setTrainer] = useState<Trainer | null>(null)
  const [status, setStatus] = useState('loading the sort model…')
  const [running, setRunning] = useState(false)
  const [step, setStep] = useState(0)
  const [curveDesc, setCurveDesc] = useState<{ x: number; y: number }[]>([])
  const [curveAsc, setCurveAsc] = useState<{ x: number; y: number }[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [counts, setCounts] = useState({ trainable: 0, total: 0 })
  // interactive "try your own" box
  const [prompt, setPrompt] = useState('sort 4 6 1 => ')
  const [overlay, setOverlay] = useState(true)
  const [output, setOutput] = useState('')

  const runningRef = useRef(false)
  const stepsRef = useRef(2)
  const rafRef = useRef(0)
  const stepCountRef = useRef(0)
  const lastEvalRef = useRef(0)

  const held = useMemo(() => sortHeldOut().slice(0, 40), [])
  const trainCfg = useMemo(() => ({ ...DEFAULT_TRAIN_CONFIG, batchSize: 16, learningRate: 0.01 }), [])
  const corpus = useMemo(() => buildDescendingSortCorpus(), [])

  // (re)attach a fresh adapter to the frozen base and fine-tune on descending
  function startAdapter(t: Trainer) {
    if (t.fineTuning) t.stopFineTune()
    t.startFineTune({ rank: RANK, alpha: ALPHA, targets: TARGETS, text: corpus, seed: 42 })
    setCounts(t.paramCounts())
  }

  function evalNow(t: Trainer, s: number) {
    setCurveDesc((c) =>
      [...c, { x: s, y: sortAccuracyDir(t.model, t.tok, held, { descending: true, flags: FLAGS_ON }) }].slice(-300),
    )
    setCurveAsc((c) =>
      [...c, { x: s, y: sortAccuracyDir(t.model, t.tok, held, { descending: false, flags: FLAGS_OFF }) }].slice(-300),
    )
    setRows(
      EXAMPLES.map((v) => {
        const want = [...v].sort((a, b) => b - a).join(' ')
        const asc = genSortLine(t.model, t.tok, v, FLAGS_OFF)
        const desc = genSortLine(t.model, t.tok, v, FLAGS_ON)
        return { v, asc, desc, ok: desc === want }
      }),
    )
    lastEvalRef.current = s
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const t = await loadBase()
      if (cancelled) return
      if (!t) {
        setStatus('could not load the sort model (public/sort-model.json)')
        return
      }
      startAdapter(t)
      setTrainer(t)
      setStatus('')
      evalNow(t, 0)
    })()
    return () => {
      cancelled = true
      runningRef.current = false
      cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function loop() {
    const t = trainer
    if (!runningRef.current || !t) return
    const n = stepsRef.current
    let ms = 0
    for (let i = 0; i < n; i++) {
      const a = performance.now()
      t.stepBatch(trainCfg, DEFAULT_FEATURE_FLAGS) // fine-tune mode: only the adapter moves, base frozen
      ms += performance.now() - a
      stepCountRef.current += 1
      if (stepCountRef.current - lastEvalRef.current >= evalInterval(stepCountRef.current)) {
        evalNow(t, stepCountRef.current)
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
    if (trainer) startAdapter(trainer)
    stepCountRef.current = 0
    lastEvalRef.current = 0
    setStep(0)
    setCurveDesc([])
    setCurveAsc([])
    if (trainer) evalNow(trainer, 0)
  }

  // Run the user's prompt to completion (the whole 3-number answer), overlay on or off.
  function runPrompt() {
    const t = trainer
    if (!t) return
    const flags = { ...DEFAULT_FEATURE_FLAGS, lora: overlay }
    const out = generate(t.model, flags, t.tok, prompt, { ...DEFAULT_SAMPLE_CONFIG, temperature: 0, maxNewTokens: 8 }, new RNG(1))
    setOutput(out.split('\n')[0])
  }

  if (!trainer) return <div className="text-xs text-slate-500">{status}</div>

  const base = counts.total - counts.trainable
  const pct = base ? ((100 * counts.trainable) / base).toFixed(0) : '—'
  const series = [
    { label: 'descending — overlay ON (adapter)', color: DESC, points: curveDesc },
    { label: 'ascending — overlay OFF (frozen base)', color: ASC, points: curveAsc },
  ]
  const btn = 'rounded border px-3 py-1.5 text-xs'

  return (
    <div className="space-y-4">
      <SectionIntro
        title="LoRA — re-task a frozen model with a tiny overlay"
        papers={[{ title: 'Hu et al. (2021) — LoRA: Low-Rank Adaptation of Large Language Models', url: 'https://arxiv.org/abs/2106.09685' }]}
      >
        The bundled model already <b>sorts ascending</b> (<span className="font-mono">2 6 9</span>) at ~97%.
        Instead of retraining it, <b>LoRA</b> freezes the whole model and adds a small low-rank{' '}
        <b>overlay</b> (ΔW = A·B) to a few weight matrices — here just{' '}
        <b>{counts.trainable.toLocaleString()} adapter weights (~{pct}% of the {base.toLocaleString()}-param
        base)</b>. We fine-tune <em>only</em> that overlay on the <b>descending</b> task (same{' '}
        <span className="font-mono">sort 6 9 2 =&gt; </span> prompt, answer high→low). Watch the model{' '}
        <b>flip</b> to <span className="font-mono">9 6 2</span> — and toggle the overlay off to get the
        original ascending answer back, because the base never moved.
      </SectionIntro>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {!running ? (
          <button className={btn + ' border-emerald-600 bg-emerald-900/40 text-emerald-200'} onClick={play}>
            ▶ {step > 0 ? 'Resume' : 'Fine-tune the adapter'}
          </button>
        ) : (
          <button className={btn + ' border-amber-600 bg-amber-900/40 text-amber-200'} onClick={pause}>
            ⏸ Pause
          </button>
        )}
        <button className={btn + ' border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'} onClick={reset}>
          ↺ Reset adapter
        </button>
        <span className="text-slate-500">
          step {step} · rank {RANK}, α {ALPHA}, {TARGETS.join('+')} · base frozen
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-1 text-[11px] text-slate-400">
            held-out accuracy — the adapter learns descending while the frozen base still does ascending
          </div>
          <LineChart series={series} width={460} height={190} yLabel="%" />
        </div>

        <div>
          <div className="mb-1 text-[11px] text-slate-400">same prompt, overlay off vs on</div>
          <div className="space-y-1 font-mono text-[12px]">
            {rows.map((r) => (
              <div key={r.v.join(',')} className="flex flex-wrap items-center gap-x-2">
                <span className="text-slate-400">sort {r.v.join(' ')} =&gt;</span>
                <span title="overlay OFF — the frozen base">
                  <span className="text-slate-500">off</span> <span style={{ color: ASC }}>{r.asc || '…'}</span>
                </span>
                <span className="text-slate-600">·</span>
                <span title="overlay ON — the LoRA adapter">
                  <span className="text-slate-500">on</span>{' '}
                  <span style={{ color: r.ok ? DESC : '#f87171' }}>{r.desc || '…'}</span> {r.ok ? '✓' : ''}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 max-w-[460px] text-[11px] leading-relaxed text-slate-500">
            The <span style={{ color: ASC }}>base</span> keeps sorting ascending; the tiny{' '}
            <span style={{ color: DESC }}>overlay</span> makes the same model sort descending. This is how
            one big base model is cheaply adapted to many tasks — you ship the frozen base once and a
            few-MB adapter per specialty, instead of a full fine-tuned copy each time.
          </p>
        </div>
      </div>

      {/* try-your-own: run any prompt with the overlay on or off */}
      <div className="rounded border border-slate-700 bg-slate-900/40 p-3">
        <div className="mb-1.5 text-[11px] text-slate-400">
          Try your own — type a prompt and run the whole answer with the overlay on or off
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="min-w-[180px] flex-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 font-mono text-[12px] text-slate-100 focus:border-fuchsia-500 focus:outline-none"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runPrompt()}
            spellCheck={false}
          />
          <label
            className="flex items-center gap-1 text-[11px] text-slate-300"
            title="On = apply the LoRA adapter (descending). Off = the frozen base (ascending)."
          >
            <input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} />
            overlay {overlay ? 'on' : 'off'}
          </label>
          <button
            className="rounded border border-emerald-600 bg-emerald-900/40 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-900/70"
            onClick={runPrompt}
          >
            ▶ Run
          </button>
        </div>
        {output !== '' && (
          <div className="mt-2 font-mono text-[13px]">
            <span className="text-slate-400">{prompt}</span>
            <span style={{ color: overlay ? DESC : ASC }}>{output}</span>
          </div>
        )}
        <p className="mt-1.5 text-[10px] text-slate-500">
          Same prompt, your choice of overlay: <span style={{ color: ASC }}>off</span> = the frozen base
          sorts ascending; <span style={{ color: DESC }}>on</span> = the adapter sorts descending. Toggle and
          re-run to compare.
        </p>
      </div>
    </div>
  )
}
