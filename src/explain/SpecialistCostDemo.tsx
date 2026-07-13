import { useState } from 'react'
import type { ModelConfig } from '../engine/config'
import { measure, type SpeedResult } from './SpeedDemo'
import { card } from './ui'

// Topic: specialist vs generalist at INFERENCE. A tiny model tuned for one task
// vs a bigger general model doing the SAME task. We measure real tok/s live; the
// accuracy parity (both ~95% on held-out sort) is an offline result we cite, so
// the takeaway is "same job, same quality, far cheaper per token."

const SPECIALIST: Partial<ModelConfig> = { dModel: 24, nHeads: 2, nLayers: 2, contextLen: 32, dFF: 96 }
const GENERALIST: Partial<ModelConfig> = { dModel: 48, nHeads: 3, nLayers: 3, contextLen: 48, dFF: 192 }

export default function SpecialistCostDemo() {
  const [res, setRes] = useState<{ spec: SpeedResult; gen: SpeedResult } | null>(null)
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    await new Promise((r) => setTimeout(r, 20))
    const spec = { ...measure(SPECIALIST), name: 'specialist' }
    await new Promise((r) => setTimeout(r, 20))
    const gen = { ...measure(GENERALIST), name: 'generalist' }
    setRes({ spec, gen })
    setBusy(false)
  }

  // compute per token ≈ proportional to parameters (dense forward), so the param
  // ratio is a fair first-order "cost per token" multiplier.
  const costX = res ? res.gen.params / res.spec.params : 0
  const speedX = res ? res.spec.tps / res.gen.tps : 0 // specialist tok/s vs generalist (>1 = faster)

  return (
    <div className={card}>
      <div className="mb-2 text-[12px] leading-relaxed text-slate-300">
        Same task — <span className="font-mono text-slate-200">sort 6 9 2 =&gt; 2 6 9</span> — two ways: a{' '}
        <b>tiny model tuned only for sorting</b> vs a <b>bigger general model</b> that also writes poems and
        "does" algebra. Trained separately (see the training-cost story), <b>both reach ~95% on unseen
        lists</b> — same quality. So which should you run in production? Time them here:
      </div>
      <button
        onClick={() => void run()}
        disabled={busy}
        className="rounded border border-sky-700 bg-sky-900/40 px-3 py-1 text-xs text-sky-200 hover:bg-sky-900/70 disabled:opacity-50"
      >
        {busy ? 'measuring…' : res ? 'Measure again' : '▶ Measure both'}
      </button>

      {res && (
        <div className="mt-3 space-y-2 text-[12px]">
          {[res.spec, res.gen].map((r, i) => {
            const maxTps = Math.max(res.spec.tps, res.gen.tps)
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-slate-300">
                  {i === 0 ? 'specialist' : 'generalist'}
                </span>
                <div className="h-4 flex-1 overflow-hidden rounded bg-slate-800">
                  <div
                    className={'h-full rounded ' + (i === 0 ? 'bg-emerald-500/80' : 'bg-amber-500/70')}
                    style={{ width: `${(r.tps / maxTps) * 100}%` }}
                  />
                </div>
                <span className="w-40 shrink-0 text-right text-[11px] text-slate-400">
                  <span className={i === 0 ? 'text-emerald-300' : 'text-amber-300'}>{r.tps}</span> tok/s ·{' '}
                  {(r.params / 1000).toFixed(0)}K params
                </span>
              </div>
            )
          })}
          <p className="text-[11px] leading-relaxed text-slate-400">
            The specialist is <span className="text-slate-200">~{costX.toFixed(0)}× smaller</span> — so it
            does <span className="text-slate-200">~{costX.toFixed(0)}× less compute per token</span> (roughly
            what you pay for) and runs about{' '}
            <span className="text-emerald-300">{speedX.toFixed(1)}× faster</span> here — at{' '}
            <span className="text-slate-200">the same sorting accuracy</span>. Same answer, a fraction of the
            cost.
          </p>
        </div>
      )}

      <div className="mt-3 rounded border border-sky-900/60 bg-sky-950/30 p-2 text-[11px] leading-relaxed text-slate-300">
        <span className="font-semibold text-sky-300">Where this is heading:</span> as token cost becomes the
        constraint, teams stop reaching for the biggest model by default. The pattern is{' '}
        <span className="text-slate-100">use the smallest model that clears the bar</span> — and get there by{' '}
        <span className="text-slate-100">routing</span> easy requests to small models,{' '}
        <span className="text-slate-100">fine-tuning small specialists</span> for high-volume tasks,{' '}
        <span className="text-slate-100">distilling</span> a big model's skill into a small one, and{' '}
        <span className="text-slate-100">Mixture-of-Experts</span> (only a slice of a huge model runs per
        token). A generalist is convenient; a specialist is cheap at scale.
      </div>
    </div>
  )
}
