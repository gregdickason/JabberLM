import { useState } from 'react'
import { kvCacheStats } from '../engine/kvcache'
import { card } from './ui'

// Topic: KV-cache economics for a general audience. Reuses the engine's own
// prefill-vs-recompute accounting (kvCacheStats): with a cache you encode the
// prompt ONCE (prefill) then do 1 token of work per step (decode); without it you
// re-encode the whole growing context every step (the quadratic blow-up). This is
// why output tokens cost more than input, and why "prompt caching" saves money.

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void }) {
  return (
    <label className="flex items-center gap-2 text-[12px] text-slate-300">
      <span className="w-40 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1" />
      <span className="w-16 shrink-0 text-right font-mono text-slate-200">{value.toLocaleString()}</span>
    </label>
  )
}

export default function KVCostDemo() {
  const [prompt, setPrompt] = useState(2000) // input tokens (e.g. a document / system prompt)
  const [output, setOutput] = useState(200) // tokens generated

  const s = kvCacheStats(prompt, output)
  const withCache = s.cumulativeCached // prefill (prompt) + 1/step
  const without = s.cumulativeUncached // re-encode whole context every step
  const saved = without > 0 ? Math.round((1 - withCache / without) * 100) : 0
  const prefill = prompt // the cache "setup" cost — encode the prompt once
  const decode = output // reused work — 1 token per generated step

  return (
    <div className={card}>
      <div className="mb-2 text-[12px] leading-relaxed text-slate-300">
        A model generates one token at a time, and each new token attends to <em>everything before it</em>.
        Naively it would re-read the whole conversation every single step — work that grows with the{' '}
        <em>square</em> of the length. A <b>KV cache</b> avoids that: it stores what it already computed for
        earlier tokens and reuses it. Drag the sliders (units are tokens):
      </div>
      <div className="space-y-1.5">
        <Slider label="prompt / context in" value={prompt} min={100} max={20000} step={100} onChange={setPrompt} />
        <Slider label="answer out" value={output} min={20} max={2000} step={20} onChange={setOutput} />
      </div>

      <div className="mt-3 space-y-2 text-[12px]">
        <Bar label="without a cache" value={without} max={without} color="bg-red-500/70" note={`${without.toLocaleString()} units — re-reads the whole context every step`} />
        <Bar label="with a cache" value={withCache} max={without} color="bg-emerald-500/80" note={`${withCache.toLocaleString()} units — ${saved}% less work`} />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded border border-slate-800 bg-slate-900/50 p-2 text-[11px] leading-relaxed text-slate-300">
          <div className="font-semibold text-sky-300">Prefill vs decode</div>
          Reading your prompt to <b>build the cache</b> is <b>prefill</b> ({prefill.toLocaleString()} tokens,
          done once, in parallel — cheap per token). Generating the answer is <b>decode</b> (
          {decode.toLocaleString()} tokens, one step at a time — each reuses the cache but can't be
          parallelised). That asymmetry is <b>why providers charge more for output tokens than input
          tokens</b>.
        </div>
        <div className="rounded border border-slate-800 bg-slate-900/50 p-2 text-[11px] leading-relaxed text-slate-300">
          <div className="font-semibold text-sky-300">Prompt caching &amp; the catch</div>
          If you reuse the same big prompt (a long system prompt, a document) across many calls,{' '}
          <b>prompt caching</b> lets you pay that prefill <b>once</b> and reuse it — a real discount for
          repeated queries. The catch: the cache <b>lives in memory</b> and grows with context, so very long
          contexts are limited by memory, not just compute.
        </div>
      </div>
    </div>
  )
}

function Bar({ label, value, max, color, note }: { label: string; value: number; max: number; color: string; note: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 text-slate-300">{label}</span>
      <div className="h-4 flex-1 overflow-hidden rounded bg-slate-800">
        <div className={'h-full rounded ' + color} style={{ width: `${max > 0 ? Math.max(2, (value / max) * 100) : 0}%` }} />
      </div>
      <span className="w-64 shrink-0 text-right text-[11px] text-slate-400">{note}</span>
    </div>
  )
}
