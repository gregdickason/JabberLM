import { useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { getTrainer } from '../engine/trainer'
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
  return firstLine.slice(0, 40)
}

export default function InferencePanel() {
  const { modelBuilt, modelVersion, trainingText, featureFlags, setFeatureFlags, sampleConfig, setSampleConfig, inspect, setInspect } =
    useStore()
  const rng = useRef(new RNG(2024))

  const [prompt, setPrompt] = useState(() => startPrompt(trainingText))
  const [ids, setIds] = useState<number[]>([])
  const [promptLen, setPromptLen] = useState(0)
  const [trace, setTrace] = useState<Trace | null>(null)
  const [sampled, setSampled] = useState<number | undefined>(undefined)
  const [tab, setTab] = useState<Tab>('attention')
  const [genText, setGenText] = useState('')

  // clear the inference session so the inspector never shows data from a
  // previous model (after a rebuild, a load, or a training-text change)
  function clearSession() {
    setIds([])
    setPromptLen(0)
    setTrace(null)
    setSampled(undefined)
    setGenText('')
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
    return (
      <div className="p-4">
        <h2 className="text-sm font-bold text-sky-300">Inference &amp; inspector</h2>
        <div className="mt-3 rounded border border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">
          Train a model in the left panel first, then run the inspector here.
        </div>
      </div>
    )
  }
  const tok = trainer.tok
  const model = trainer.model

  function run() {
    let seed = tok.encode(prompt)
    if (seed.length === 0) seed = [0]
    const { trace } = traceOf(model, featureFlags, seed)
    setIds(seed)
    setPromptLen(seed.length)
    setTrace(trace)
    setSampled(undefined)
    setGenText(tok.decode(seed))
  }

  function step() {
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

      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100"
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value)
              clearSession() // editing the prompt starts a fresh session
            }}
            placeholder="prompt…"
          />
          <button className={btn} onClick={run}>
            Run
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className={btn} onClick={step}>
            ⏭ Step (1 token)
          </button>
          <button className={btn} onClick={() => generate(20)}>
            Generate ×20
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
        <pre className="max-h-20 overflow-y-auto whitespace-pre-wrap rounded bg-slate-800 p-2 text-[11px] text-emerald-200">
          {genText || '(run a prompt to begin)'}
        </pre>
        <div className="text-[10px] text-slate-500">
          Run = restart from prompt · Step = continue one token · Reset = clear · editing the prompt
          starts fresh
        </div>
      </div>

      {!trace ? (
        <div className="rounded border border-dashed border-slate-700 p-4 text-center text-[11px] text-slate-500">
          Press Run, then Step, to populate the inspector.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1">
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
