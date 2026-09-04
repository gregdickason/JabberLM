import { useEffect, useMemo, useState } from 'react'
import type { Trainer } from '../engine/trainer'
import { RNG } from '../engine/random'
import { JABBER_POEMS } from '../data/jabberPoems'
import { genLine, poemLoss, sortAccuracy, randomSortVectors } from '../interp/ablation'

// Interactive head ablation: knock out attention heads and watch which SKILL of
// the three-skill model breaks. Sorting concentrates in the middle layer (ablate
// it and sorting collapses while poems survive); poems lean on the output layer;
// layer 0 is a shared foundation (ablating it breaks everything). A hands-on look
// at specialisation — and polysemanticity — in a real model.
export default function AblationSection({
  trainer,
  embed = false,
}: {
  trainer: Trainer
  /** the frame (embed.html?demo=head-ablation) drops the intro prose — a host page brings its
   *  own framing — but keeps the "click a head" instruction and the try-it hint, which tell a
   *  viewer what to DO with a grid of buttons */
  embed?: boolean
}) {
  const model = trainer.model
  const tok = trainer.tok
  const { nLayers, nHeads } = model.cfg
  const poemText = useMemo(() => JABBER_POEMS.slice(0, 2400), [])
  const vectors = useMemo(() => randomSortVectors(20, new RNG(99)), [])

  type Result = { sort: number; poem: number; sortEx: string; algEx: string; poemEx: string }
  const [ablate, setAblate] = useState<Set<string>>(new Set())
  const [base, setBase] = useState<{ sort: number; poem: number } | null>(null)
  const [cur, setCur] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)

  const tick = () => new Promise((r) => setTimeout(r, 0))

  // baseline (no ablation), computed once
  useEffect(() => {
    setBase({ sort: sortAccuracy(model, tok, vectors), poem: poemLoss(model, tok, poemText) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model])

  // recompute metrics + examples whenever the ablation set changes — chunked and
  // yielding between batches so the page never blocks (and the progress bar shows).
  const key = [...ablate].sort().join(',')
  useEffect(() => {
    let cancelled = false
    setBusy(true)
    setProgress(0)
    void (async () => {
      await tick()
      const a = ablate.size ? ablate : undefined
      // sort accuracy in small batches, yielding so the UI stays live
      let ok = 0
      for (let i = 0; i < vectors.length; i++) {
        if (cancelled) return
        const v = vectors[i]
        const want = [...v].sort((x, y) => x - y).join(' ')
        const got = (genLine(model, tok, `sort ${v.join(' ')} => `, 8, a).match(/\d(?: \d)*/) || [''])[0].trim()
        if (got === want) ok++
        if (i % 3 === 2) {
          setProgress((i + 1) / (vectors.length + 4))
          await tick()
        }
      }
      if (cancelled) return
      const poem = poemLoss(model, tok, poemText, a)
      setProgress((vectors.length + 1) / (vectors.length + 4))
      await tick()
      const result: Result = {
        sort: Math.round((100 * ok) / vectors.length),
        poem,
        sortEx: genLine(model, tok, 'sort 6 9 2 => ', 8, a),
        algEx: genLine(model, tok, '7x + 2 = 16 => ', 16, a),
        poemEx: genLine(model, tok, "'Twas brillig, and the ", 28, a),
      }
      if (cancelled) return
      setCur(result)
      setBusy(false)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, model])

  function toggle(k: string) {
    setAblate((prev) => {
      const next = new Set(prev)
      next.has(k) ? next.delete(k) : next.add(k)
      return next
    })
  }

  const sortDelta = base && cur ? cur.sort - base.sort : 0
  const poemDelta = base && cur ? cur.poem - base.poem : 0

  return (
    <div className="space-y-4 text-xs">
      {!embed && (
        <p className="max-w-2xl leading-relaxed text-slate-300">
          The built-in model does three things: write poems, sort numbers, and "solve" equations.{' '}
          <span className="text-fuchsia-300">Knocking out an attention head</span> zeroes its output and
          leaves every other weight untouched, so whatever changes is attributable to that head. Sorting
          concentrates in one layer. Poems lean on another. Some heads are shared by everything.
        </p>
      )}

      {/* head grid */}
      <div>
        <div className="mb-1 text-[11px] text-slate-400">
          click a head to ablate it ({ablate.size} ablated){' '}
          {ablate.size > 0 && (
            <button className="ml-2 text-sky-400 hover:underline" onClick={() => setAblate(new Set())}>
              reset
            </button>
          )}
        </div>
        <div className="inline-block rounded border border-slate-800 p-2">
          {Array.from({ length: nLayers }, (_, l) => (
            <div key={l} className="flex items-center gap-1">
              <span className="w-12 shrink-0 text-[11px] text-slate-400">layer {l}</span>
              {Array.from({ length: nHeads }, (_, h) => {
                const k = `${l}.${h}`
                const on = ablate.has(k)
                return (
                  <button
                    key={k}
                    onClick={() => toggle(k)}
                    className={
                      'm-0.5 h-8 w-12 rounded border text-[11px] ' +
                      (on
                        ? 'border-red-500 bg-red-900/60 text-red-200 line-through'
                        : 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700')
                    }
                  >
                    h{h}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* metrics */}
      <div className="grid max-w-md grid-cols-2 gap-3">
        <Metric
          label="Sorting (held-out)"
          unit="%"
          base={base?.sort}
          cur={cur?.sort}
          delta={sortDelta}
          good="up"
          busy={busy}
        />
        <Metric
          label="Poem loss"
          unit=""
          base={base?.poem}
          cur={cur?.poem}
          delta={poemDelta}
          good="down"
          decimals={2}
          busy={busy}
        />
      </div>

      {/* live examples */}
      <div className="max-w-2xl space-y-1.5">
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span>with the current ablation:</span>
          {busy && (
            <span className="flex items-center gap-1 text-amber-300">
              <span className="inline-block h-2.5 w-20 overflow-hidden rounded-full bg-slate-700 align-middle">
                <span
                  className="block h-full bg-amber-400 transition-[width] duration-100"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </span>
              recomputing…
            </span>
          )}
        </div>
        <pre className="rounded bg-slate-800 p-2 text-[11px] text-emerald-200">
          sort 6 9 2 =&gt; {cur?.sortEx ?? '…'}
          {cur && (cur.sortEx.trim().startsWith('2 6 9') ? '   ✓ correct' : '   ✗ broken')}
        </pre>
        <pre className="rounded bg-slate-800 p-2 text-[11px] text-amber-200">
          7x + 2 = 16 =&gt; {cur?.algEx ?? '…'}
          {'   (always "working" — but the maths is invented)'}
        </pre>
        <pre className="whitespace-pre-wrap rounded bg-slate-800 p-2 text-[11px] text-fuchsia-200">
          'Twas brillig, and the {cur?.poemEx ?? '…'}
        </pre>
      </div>

      <p className="max-w-2xl text-[11px] leading-relaxed text-slate-400">
        Ablating a <span className="text-slate-300">middle-layer</span> head tends to wreck
        sorting while poems carry on — that's a specialised "sorting" circuit. Ablating a{' '}
        <span className="text-slate-300">layer-0</span> head breaks everything, because the first layer
        is a shared foundation every skill builds on (a small example of polysemanticity —
        heads rarely map one-to-one onto skills).
      </p>
    </div>
  )
}

function Metric({
  label,
  unit,
  base,
  cur,
  delta,
  good,
  decimals = 0,
  busy,
}: {
  label: string
  unit: string
  base?: number
  cur?: number
  delta: number
  good: 'up' | 'down'
  decimals?: number
  busy: boolean
}) {
  const fmt = (v?: number) => (v == null ? '—' : v.toFixed(decimals) + unit)
  // a degradation = down for "up" metrics, up for "down" metrics
  const degraded = good === 'up' ? delta < -1 : delta > 0.02
  const color = Math.abs(delta) < (good === 'up' ? 1 : 0.02) ? 'text-slate-300' : degraded ? 'text-red-300' : 'text-emerald-300'
  return (
    <div className="rounded border border-slate-800 bg-slate-900/40 p-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={'text-lg font-bold ' + (busy ? 'text-slate-400' : color)}>
        {busy ? '…' : fmt(cur)}
      </div>
      <div className="text-[11px] text-slate-400">
        baseline {fmt(base)}
        {!busy && cur != null && base != null && Math.abs(delta) >= (good === 'up' ? 1 : 0.005) && (
          <span className={color}> · {delta >= 0 ? '+' : ''}{delta.toFixed(decimals)}</span>
        )}
      </div>
    </div>
  )
}
