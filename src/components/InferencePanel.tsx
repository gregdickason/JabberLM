import { useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { getTrainer } from '../engine/trainer'
import { installBundledModel } from '../state/pretrained'
import { MODEL_STATS_LINE, MODEL_EXAMPLES } from '../data/modelStats'
import { RNG } from '../engine/random'
import { lastRowLogits, sampleFromLogits, traceOf } from '../engine/generate'
import type { Trace } from '../engine/trace'
import ArchitectureMap from './ArchitectureMap'
import TokenizerView from './inspector/TokenizerView'
import EmbeddingView from './inspector/EmbeddingView'
import AttentionView from './inspector/AttentionView'
import ResidualStreamView from './inspector/ResidualStreamView'
import MLPView from './inspector/MLPView'
import LogitsView from './inspector/LogitsView'
import RoPEView from './features/RoPEView'
import KVCacheView from './features/KVCacheView'
import SlidingWindowView from './features/SlidingWindowView'

const TABS = [
  'tokenize',
  'embed',
  'attention',
  'residual',
  'mlp',
  'logits',
  'RoPE',
  'KV cache',
  'sliding window',
] as const
type Tab = (typeof TABS)[number]

const btn =
  'rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700 disabled:opacity-40'

// Seed the inference prompt with the start of the training text (its first
// non-empty line), so "continue from here" matches what the model just learned.
function startPrompt(text: string): string {
  const firstLine = text.split('\n').find((l) => l.trim().length > 0) ?? text
  // If the first line is a task example ("sort 6 9 8 => 6 8 9"), keep only the stem
  // ("sort 6 9 8 => ") so the model GENERATES the answer instead of us handing it over.
  const arrow = firstLine.indexOf('=>')
  const stem = arrow >= 0 ? firstLine.slice(0, arrow + 2) + ' ' : firstLine
  return stem.slice(0, 40)
}

export default function InferencePanel() {
  const { modelBuilt, pretrainedActive, modelVersion, trainingText, featureFlags, setFeatureFlags, sampleConfig, setSampleConfig, inspect, setInspect } =
    useStore()
  const rng = useRef(new RNG(2024))
  const [loadMsg, setLoadMsg] = useState('')

  const [prompt, setPrompt] = useState(() => startPrompt(trainingText))
  const [ids, setIds] = useState<number[]>([])
  const [promptLen, setPromptLen] = useState(0)
  const [trace, setTrace] = useState<Trace | null>(null)
  const [sampled, setSampled] = useState<number | undefined>(undefined)
  const [tab, setTab] = useState<Tab>('attention')
  const [genText, setGenText] = useState('')
  // First-time onboarding: after the user's first Run, pulse the Step/Generate
  // buttons so the next action is obvious. Cleared once they use either (and not
  // shown again for the session).
  const [hintNext, setHintNext] = useState(false)
  const hintUsed = useRef(false)
  const outRef = useRef<HTMLPreElement>(null)

  function dismissHint() {
    hintUsed.current = true
    setHintNext(false)
  }

  // Keep the generation box scrolled to the newest text, so a long Generate never
  // silently overflows below the fold (looking like nothing happened).
  useEffect(() => {
    const el = outRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [genText])

  // clear the inference session so the inspector never shows data from a
  // previous model (after a rebuild, a load, or a training-text change)
  function clearSession() {
    setIds([])
    setPromptLen(0)
    setTrace(null)
    setSampled(undefined)
    setGenText('')
    setHintNext(false)
  }

  // a new model was installed (rebuild / load) — drop the stale session and
  // reseed the prompt from the (possibly new) training text
  useEffect(() => {
    clearSession()
    setPrompt(startPrompt(useStore.getState().trainingText))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelVersion])

  const trainer = getTrainer()

  if (!modelBuilt || !trainer) {
    async function loadBundled() {
      setLoadMsg('loading…')
      const ok = await installBundledModel()
      setLoadMsg(ok ? '' : 'could not load the built-in model')
    }
    return (
      <div className="p-4">
        <h2 className="text-sm font-bold text-sky-300">Inference &amp; inspector</h2>
        <div className="mt-3 rounded border border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">
          <p>Generate text without training — load the model that ships with the site:</p>
          <button
            className="mt-3 rounded border border-sky-700 bg-sky-900/40 px-3 py-1.5 text-xs text-sky-200 hover:bg-sky-900/70"
            onClick={() => void loadBundled()}
          >
            ▶ Load the built-in model
          </button>
          {loadMsg && <p className="mt-2 text-amber-400">{loadMsg}</p>}
          <p className="mt-3 text-[11px] text-slate-600">
            …or build &amp; train your own in the left panel, then run the inspector here.
          </p>
        </div>
      </div>
    )
  }
  const tok = trainer.tok
  const model = trainer.model

  // Run generates the WHOLE answer from the prompt (up to a newline, or a cap), so the
  // first click produces a complete result — e.g. `sort 6 9 2 => 2 6 9` — and populates
  // the inspector. Step then lets you redo it one token at a time to watch it think.
  function run() {
    let seed = tok.encode(prompt)
    if (seed.length === 0) seed = [0]
    const nl = tok.stoi.get('\n')
    const ctx = model.cfg.contextLen
    const cur = [...seed]
    let lastChosen = sampled
    for (let i = 0; i < 32; i++) {
      const window = cur.slice(Math.max(0, cur.length - ctx))
      const { logits } = model.forward(window, featureFlags)
      const last = lastRowLogits(logits.data, logits.rows, logits.cols)
      const { chosen } = sampleFromLogits(last, sampleConfig, rng.current)
      if (chosen === nl) break // stop at the end of the line (the answer)
      cur.push(chosen)
      lastChosen = chosen
    }
    const { trace } = traceOf(model, featureFlags, cur)
    setIds(cur)
    setPromptLen(seed.length)
    setTrace(trace)
    setSampled(lastChosen)
    setGenText(tok.decode(cur))
    if (!hintUsed.current) setHintNext(true) // nudge toward the inspector tabs
  }

  function step() {
    dismissHint()
    let cur = ids
    if (cur.length === 0) {
      cur = tok.encode(prompt)
      if (cur.length === 0) cur = [0]
      setPromptLen(cur.length)
    }
    const { trace } = traceOf(model, featureFlags, cur)
    const last = lastRowLogits(trace.logits.data, trace.logits.rows, trace.logits.cols)
    const { chosen } = sampleFromLogits(last, sampleConfig, rng.current)
    const next = [...cur, chosen]
    const t2 = traceOf(model, featureFlags, next).trace
    setIds(next)
    setTrace(t2)
    setSampled(chosen)
    setGenText(tok.decode(next))
  }

  function generate(n: number) {
    dismissHint()
    let cur = ids.length ? [...ids] : tok.encode(prompt)
    if (cur.length === 0) cur = [0]
    if (ids.length === 0) setPromptLen(cur.length)
    const ctx = model.cfg.contextLen
    let lastChosen = sampled
    for (let i = 0; i < n; i++) {
      const window = cur.slice(Math.max(0, cur.length - ctx))
      const { logits } = model.forward(window, featureFlags)
      const last = lastRowLogits(logits.data, logits.rows, logits.cols)
      const { chosen } = sampleFromLogits(last, sampleConfig, rng.current)
      cur.push(chosen)
      lastChosen = chosen
    }
    const { trace } = traceOf(model, featureFlags, cur)
    setIds(cur)
    setTrace(trace)
    setSampled(lastChosen)
    setGenText(tok.decode(cur))
  }

  const num =
    'w-16 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-right text-xs text-slate-100'

  return (
    <div className="space-y-3 p-4">
      <h2 className="text-sm font-bold text-sky-300">Inference &amp; inspector</h2>

      {pretrainedActive && (
        <div className="rounded border border-sky-800 bg-sky-900/30 px-3 py-2 text-[11px] text-sky-100">
          <div>
            Built-in three-skill model — it writes <span className="text-fuchsia-300">poems</span>,{' '}
            <span className="text-emerald-300">sorts</span> numbers, and{' '}
            <span className="text-amber-300">"solves"</span> equations (watch the maths go wrong). Try an
            example, or press <span className="text-emerald-300">▶ Play</span> in Training to train your own.
          </div>
          <div className="mt-1 text-[10px] text-sky-300/70">{MODEL_STATS_LINE}</div>
        </div>
      )}

      <div className="space-y-2">
        {pretrainedActive && (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-slate-500">try:</span>
            {MODEL_EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                title={ex.note}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-slate-200 hover:bg-slate-700"
                onClick={() => {
                  clearSession()
                  setPrompt(ex.prompt)
                }}
              >
                {ex.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2" data-tour="inference">
          <input
            className="flex-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100"
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value)
              clearSession() // editing the prompt starts a fresh session
            }}
            placeholder="prompt…"
          />
          <button className={btn + ' border-emerald-600 bg-emerald-900/40 text-emerald-200'} onClick={run}>
            ▶ Run
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className={btn + (hintNext ? ' animate-pulse ring-2 ring-sky-400' : '')} onClick={step}>
            ⏭ Step (1 token)
          </button>
          <button
            className={btn + (hintNext ? ' animate-pulse ring-2 ring-sky-400' : '')}
            onClick={() => generate(20)}
          >
            Continue ×20
          </button>
          <button className={btn} onClick={clearSession} disabled={!trace}>
            ↺ Reset
          </button>
          <label className="flex items-center gap-1 text-[11px] text-slate-400">
            temp
            <input
              type="number"
              className={num}
              step={0.1}
              min={0}
              value={sampleConfig.temperature}
              onChange={(e) => setSampleConfig({ temperature: Number(e.target.value) })}
            />
          </label>
          <label className="flex items-center gap-1 text-[11px] text-slate-400">
            top-k
            <input
              type="number"
              className={num}
              placeholder="off"
              min={1}
              value={sampleConfig.topK ?? ''}
              onChange={(e) =>
                setSampleConfig({ topK: e.target.value === '' ? null : Number(e.target.value) })
              }
            />
          </label>
          <label className="flex items-center gap-1 text-[11px] text-slate-400">
            top-p
            <input
              type="number"
              className={num}
              placeholder="off"
              step={0.05}
              min={0}
              max={1}
              value={sampleConfig.topP ?? ''}
              onChange={(e) =>
                setSampleConfig({ topP: e.target.value === '' ? null : Number(e.target.value) })
              }
            />
          </label>
        </div>
        <pre
          ref={outRef}
          className="max-h-20 overflow-y-auto whitespace-pre-wrap rounded bg-slate-800 p-2 text-[11px] text-emerald-200"
        >
          {genText || '(run a prompt to begin)'}
        </pre>
        <div className="text-[10px] text-slate-500">
          Run = generate the whole answer · Step = one token at a time (watch it think) · Continue ×20 =
          keep going · Reset = clear · editing the prompt starts fresh
        </div>
      </div>

      {!trace ? (
        <div className="rounded border border-dashed border-slate-700 p-4 text-center text-[11px] text-slate-500">
          Press <span className="text-emerald-300">▶ Run</span> to generate an answer and open the inspector.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1" data-tour="tabs">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={
                  'rounded px-2 py-0.5 text-[11px] ' +
                  (tab === t ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300')
                }
              >
                {t}
              </button>
            ))}
          </div>

          {(tab === 'attention' || tab === 'mlp' || tab === 'RoPE' || tab === 'KV cache') && (
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="w-full shrink-0 lg:w-28">
                <ArchitectureMap
                  nLayers={model.cfg.nLayers}
                  nHeads={model.cfg.nHeads}
                  inspect={inspect}
                  onSelect={setInspect}
                />
              </div>
              <div className="min-w-0 flex-1 overflow-x-auto">
                {tab === 'attention' && (
                  <AttentionView trace={trace} tok={tok} layer={inspect.layer} head={inspect.head} />
                )}
                {tab === 'mlp' && <MLPView trace={trace} tok={tok} layer={inspect.layer} />}
                {tab === 'RoPE' && (
                  <RoPEView trace={trace} layer={inspect.layer} head={inspect.head} flags={featureFlags} />
                )}
                {tab === 'KV cache' && (
                  <KVCacheView
                    trace={trace}
                    tok={tok}
                    layer={inspect.layer}
                    head={inspect.head}
                    flags={featureFlags}
                    promptLen={promptLen}
                    generatedSteps={Math.max(0, ids.length - promptLen)}
                  />
                )}
              </div>
            </div>
          )}

          {tab === 'tokenize' && <TokenizerView trace={trace} tok={tok} />}
          {tab === 'embed' && <EmbeddingView trace={trace} tok={tok} />}
          {tab === 'residual' && <ResidualStreamView trace={trace} tok={tok} />}
          {tab === 'logits' && <LogitsView trace={trace} tok={tok} sampled={sampled} />}
          {tab === 'sliding window' && (
            <SlidingWindowView trace={trace} tok={tok} flags={featureFlags} setFlags={setFeatureFlags} />
          )}
        </div>
      )}
    </div>
  )
}
