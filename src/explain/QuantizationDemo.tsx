import { useEffect, useRef, useState } from 'react'
import { deserialize, type SavedModel } from '../engine/persist'
import { sortAccuracy } from '../interp/ablation'
import { sortHeldOut } from '../data/tasks'
import { quantiseModel, modelBytes } from '../interp/quantization'
import LineChart from '../viz/LineChart'
import { card } from './ui'

// The sweep: 32-bit (full precision) down to 2-bit. On the bundled sort model the curve
// "holds then falls off a cliff" — 8-bit is ~free, 4-bit nearly so, 3-bit collapses.
const BITS = [32, 8, 4, 3, 2]
const ACCENT = '#a78bfa' // violet

type Row = { bits: number; acc: number; bytes: number }

export default function QuantizationDemo() {
  const [rows, setRows] = useState<Row[]>([])
  const [status, setStatus] = useState('loading the model…')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false) // a ref change wouldn't re-render the button
  const savedRef = useRef<SavedModel | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(import.meta.env.BASE_URL + 'sort-model.json')
        if (!res.ok) throw new Error('fetch failed')
        const saved = (await res.json()) as SavedModel
        if (cancelled) return
        savedRef.current = saved
        setReady(true)
        setStatus('load & measure to see the trade-off')
      } catch {
        if (!cancelled) setStatus('could not load the model (public/sort-model.json)')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function run() {
    const saved = savedRef.current
    if (!saved) return
    setBusy(true)
    setRows([])
    const held = sortHeldOut()
    const out: Row[] = []
    for (const bits of BITS) {
      setStatus(`measuring ${bits}-bit…`)
      // yield to the browser so the status/chart paint between measurements
      await new Promise((r) => setTimeout(r, 20))
      const tr = deserialize(saved) // fresh independent copy each time
      quantiseModel(tr.model, bits)
      const acc = sortAccuracy(tr.model, tr.tok, held)
      out.push({ bits, acc, bytes: modelBytes(tr.model, bits) })
      setRows([...out])
    }
    setStatus('')
    setBusy(false)
  }

  const fp32 = rows.find((r) => r.bits === 32)?.bytes ?? 0
  const series = [
    {
      label: 'held-out sort accuracy',
      color: ACCENT,
      // plot against a compressed x so 32→2 reads left(high-precision)→right(low)
      points: rows.map((r) => ({ x: -r.bits, y: r.acc })),
    },
  ]

  return (
    <div className={card}>
      <div className="mb-2 text-[12px] leading-relaxed text-slate-300">
        A model is a big pile of numbers. Each is normally stored in <b>32 bits</b>. <b>Quantisation</b>{' '}
        keeps fewer bits per number — so the model takes less memory and runs faster. The catch is
        precision: round too hard and it breaks. Here's the exact trade-off on the sorting model, measured
        live (we round every weight, then re-test on unseen lists):
      </div>
      <button
        onClick={() => void run()}
        disabled={busy || !ready}
        className="rounded border border-violet-700 bg-violet-900/40 px-3 py-1 text-xs text-violet-200 hover:bg-violet-900/70 disabled:opacity-50"
      >
        {busy ? 'measuring…' : rows.length ? 'Measure again' : '▶ Quantise & measure'}
      </button>
      {status && <span className="ml-2 text-[11px] text-slate-500">{status}</span>}

      {rows.length > 0 && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 text-[12px]">
            {rows.map((r) => {
              const shrink = r.bytes ? fp32 / r.bytes : 1
              const broke = r.acc < 50
              return (
                <div key={r.bits} className="flex items-center gap-2">
                  <span className="w-14 shrink-0 font-mono text-slate-300">{r.bits}-bit</span>
                  <div className="h-4 flex-1 overflow-hidden rounded bg-slate-800">
                    <div
                      className={'h-full rounded ' + (broke ? 'bg-rose-600/70' : 'bg-violet-500/80')}
                      style={{ width: `${Math.max(2, r.acc)}%` }}
                    />
                  </div>
                  <span className="w-32 shrink-0 text-right text-[11px] text-slate-400">
                    <span className={broke ? 'text-rose-300' : 'text-violet-200'}>{r.acc}%</span> ·{' '}
                    {shrink.toFixed(1)}× smaller
                  </span>
                </div>
              )
            })}
          </div>
          <div>
            <div className="mb-1 text-[10px] text-slate-400">held-out sort accuracy (%)</div>
            <LineChart series={series} width={280} height={170} />
            <p className="mt-1 text-[10px] text-slate-500">
              left = full precision, right = fewest bits. Accuracy holds, then <b>falls off a cliff</b>.
            </p>
          </div>
        </div>
      )}

      <div className="mt-3 rounded border border-violet-900/60 bg-violet-950/30 p-2 text-[11px] leading-relaxed text-slate-300">
        <span className="font-semibold text-violet-300">The pattern:</span> you can shrink a model{' '}
        <span className="text-slate-100">a lot</span> before it degrades — <b>8-bit</b> is usually
        near-free, <b>4-bit</b> is common in practice — and then it{' '}
        <span className="text-slate-100">suddenly breaks</span>. This is the fourth lever for cheaper
        inference, alongside <span className="text-slate-100">distillation</span>,{' '}
        <span className="text-slate-100">Mixture-of-Experts</span>, and{' '}
        <span className="text-slate-100">KV-caching</span>. It's why you can run a capable model on a
        laptop or phone: the same weights, stored in a quarter of the space.
      </div>
    </div>
  )
}
