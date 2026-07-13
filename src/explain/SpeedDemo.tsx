import { useState } from 'react'
import { Model } from '../engine/model'
import { DEFAULT_FEATURE_FLAGS, DEFAULT_MODEL_CONFIG, type ModelConfig } from '../engine/config'
import { lastRowLogits } from '../engine/generate'
import { card } from './ui'

// "Bigger costs more — in money AND in time." Measures REAL in-browser generation
// speed for three model sizes (right here, no server), so the size↔latency↔cost
// trade-off is something you can watch rather than take on faith.

const SIZES: { name: string; cfg: Partial<ModelConfig> }[] = [
  { name: 'small', cfg: { dModel: 24, nHeads: 2, nLayers: 2, contextLen: 32, dFF: 96 } },
  { name: 'medium', cfg: { dModel: 48, nHeads: 3, nLayers: 3, contextLen: 48, dFF: 192 } },
  { name: 'large', cfg: { dModel: 96, nHeads: 4, nLayers: 4, contextLen: 128, dFF: 384 } },
]

export interface SpeedResult {
  name: string
  params: number
  tps: number // tokens/sec (throughput)
  ttftMs: number // time to first token
}
type Result = SpeedResult

// Real in-browser generation-speed measurement for a model config (exported so
// other cost demos can reuse the same honest, live number).
export function measure(cfg: Partial<ModelConfig>): Result {
  const full: ModelConfig = { ...DEFAULT_MODEL_CONFIG, ...cfg, vocabSize: 64 }
  const m = new Model(full, 1)
  const flags = DEFAULT_FEATURE_FLAGS
  const ctx = full.contextLen
  let ids = [0]
  m.forward(ids, flags) // warm up (let the JIT settle)
  const N = 40
  let firstMs = 0
  const t0 = performance.now()
  for (let i = 0; i < N; i++) {
    const a = performance.now()
    const window = ids.slice(Math.max(0, ids.length - ctx))
    const { logits } = m.forward(window, flags)
    const last = lastRowLogits(logits.data, logits.rows, logits.cols)
    let best = 0
    for (let j = 1; j < last.length; j++) if (last[j] > last[best]) best = j
    ids.push(best % 64)
    if (i === 0) firstMs = performance.now() - a
  }
  const dt = performance.now() - t0
  return {
    name: '',
    params: m.params.reduce((n, p) => n + p.size, 0),
    tps: Math.max(1, Math.round(N / (dt / 1000))),
    ttftMs: Math.round(firstMs),
  }
}

export default function SpeedDemo() {
  const [results, setResults] = useState<Result[] | null>(null)
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    setResults([])
    const out: Result[] = []
    for (const s of SIZES) {
      await new Promise((r) => setTimeout(r, 20)) // yield so the UI stays live
      out.push({ ...measure(s.cfg), name: s.name })
      setResults([...out])
    }
    setBusy(false)
  }

  const maxTps = results && results.length ? Math.max(...results.map((r) => r.tps)) : 1

  return (
    <div className={card}>
      <div className="mb-2 text-[11px] text-slate-400">
        The same task, three model sizes — timed <em>right here in your browser</em> (no server). Watch
        how speed falls as the model grows.
      </div>
      <button
        onClick={() => void run()}
        disabled={busy}
        className="rounded border border-sky-700 bg-sky-900/40 px-3 py-1 text-xs text-sky-200 hover:bg-sky-900/70 disabled:opacity-50"
      >
        {busy ? 'racing…' : results ? 'Race again' : '▶ Race three model sizes'}
      </button>

      {results && (
        <div className="mt-3 space-y-2">
          {results.map((r) => (
            <div key={r.name} className="flex items-center gap-2 text-[12px]">
              <span className="w-16 shrink-0 text-slate-300">{r.name}</span>
              <div className="h-4 flex-1 overflow-hidden rounded bg-slate-800">
                <div
                  className="h-full rounded bg-emerald-500/80"
                  style={{ width: `${(r.tps / maxTps) * 100}%` }}
                />
              </div>
              <span className="w-44 shrink-0 text-right text-[11px] text-slate-400">
                <span className="text-emerald-300">{r.tps}</span> tok/s ·{' '}
                {(r.params / 1000).toFixed(0)}K params · first in {r.ttftMs}ms
              </span>
            </div>
          ))}
          {results.length === SIZES.length && (
            <p className="text-[11px] leading-relaxed text-slate-400">
              The big model is many times slower per word — and in a real product it costs more per
              word too. Two latencies matter:{' '}
              <span className="text-slate-200">time to the first word</span> (how responsive it feels)
              and <span className="text-slate-200">words per second</span> (how fast a long answer
              streams). Both get worse as the model grows. The practical rule:{' '}
              <span className="text-slate-200">pick the smallest model that does the job</span> — and
              test whether a smaller/cheaper one is good enough before defaulting to the biggest.
            </p>
          )}
        </div>
      )}

      <div className="mt-3 rounded border border-sky-900/60 bg-sky-950/30 p-2 text-[11px] leading-relaxed text-slate-300">
        <span className="font-semibold text-sky-300">No server, no API:</span> this entire page is an{' '}
        <span className="text-slate-100">open-weights model running on your own device</span>. That's a
        real option to weigh against paying a provider per token — smaller open models you can{' '}
        <span className="text-slate-100">self-host</span> trade some capability for control, privacy,
        and predictable cost. Worth asking your team: "could a small self-hosted model handle this
        task?"
      </div>
    </div>
  )
}
