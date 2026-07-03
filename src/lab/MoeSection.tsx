import { useEffect, useMemo, useState } from 'react'
import { deserialize, type SavedModel } from '../engine/persist'
import { Trainer } from '../engine/trainer'
import { traceOf } from '../engine/generate'
import { DEFAULT_FEATURE_FLAGS } from '../engine/config'
import { taskAccuracy, moeAnswer, type MoeOp, type ExpertAblation } from '../interp/ablation'
import { sortHeldOut, maxHeldOut, reverseHeldOut } from '../data/tasks'
import Heatmap from '../viz/Heatmap'
import SectionIntro from './SectionIntro'

// A dedicated Mixture-of-Experts model, loaded independently of the lab's main
// model so the other sections are undisturbed.
async function loadMoe(): Promise<Trainer | null> {
  try {
    const res = await fetch(import.meta.env.BASE_URL + 'moe-model.json')
    if (!res.ok) return null
    return deserialize((await res.json()) as SavedModel)
  } catch {
    return null
  }
}

const TASKS: { op: MoeOp; label: string; example: string; color: string }[] = [
  { op: 'sort', label: 'sort', example: 'sort 6 9 2 => ', color: 'text-emerald-200' },
  { op: 'max', label: 'max', example: 'max 6 9 2 => ', color: 'text-sky-200' },
  { op: 'reverse', label: 'reverse', example: 'rev 6 9 2 => ', color: 'text-fuchsia-200' },
]
const HELD: Record<MoeOp, () => [number, number, number][]> = {
  sort: sortHeldOut,
  max: maxHeldOut,
  reverse: reverseHeldOut,
}

const tick = () => new Promise((r) => setTimeout(r, 0))

export default function MoeSection() {
  const [trainer, setTrainer] = useState<Trainer | null>(null)
  const [status, setStatus] = useState('loading the Mixture-of-Experts model…')
  const [prompt, setPrompt] = useState('sort 6 9 2 => ')
  const [top1, setTop1] = useState(false) // dense (all experts) vs sparse top-1
  const [ablate, setAblate] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const t = await loadMoe()
      if (cancelled) return
      if (t && (t.model.cfg.nExperts ?? 1) > 1) {
        setTrainer(t)
        setStatus('')
      } else {
        setStatus('could not load the MoE model (public/moe-model.json)')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const E = trainer?.model.cfg.nExperts ?? 0
  const nLayers = trainer?.model.cfg.nLayers ?? 0
  const topK = top1 ? 1 : null
  const ablateSet: ExpertAblation | undefined = ablate.size ? ablate : undefined

  // Per-token routing for the current prompt: one gate matrix (seq × E) per layer.
  const gate = useMemo(() => {
    if (!trainer) return null
    const ids = trainer.tok.encode(prompt.length ? prompt : ' ')
    const flags = { ...DEFAULT_FEATURE_FLAGS, moeTopK: topK }
    const { trace } = traceOf(trainer.model, flags, ids.length ? ids : [0])
    const labels = trace.tokenIds.map((id) => trainer.tok.label(id))
    return { trace, labels }
  }, [trainer, prompt, topK])

  // Held-out accuracy per task — baseline (no ablation, dense) and current
  // (with the selected ablation + routing), recomputed async so the UI stays live.
  const vectors = useMemo(
    () => ({
      sort: HELD.sort().slice(0, 15),
      max: HELD.max().slice(0, 15),
      reverse: HELD.reverse().slice(0, 15),
    }),
    [],
  )
  const [base, setBase] = useState<Record<MoeOp, number> | null>(null)
  const [cur, setCur] = useState<Record<MoeOp, number> | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!trainer) return
    let cancelled = false
    void (async () => {
      await tick()
      const m = trainer.model
      const b = {} as Record<MoeOp, number>
      for (const { op } of TASKS) {
        if (cancelled) return
        b[op] = taskAccuracy(m, trainer.tok, op, vectors[op])
        await tick()
      }
      if (!cancelled) setBase(b)
    })()
    return () => {
      cancelled = true
    }
  }, [trainer, vectors])

  const key = [...ablate].sort().join(',') + '|' + topK
  useEffect(() => {
    if (!trainer) return
    let cancelled = false
    setBusy(true)
    void (async () => {
      await tick()
      const m = trainer.model
      const c = {} as Record<MoeOp, number>
      for (const { op } of TASKS) {
        if (cancelled) return
        c[op] = taskAccuracy(m, trainer.tok, op, vectors[op], ablateSet, topK)
        await tick()
      }
      if (!cancelled) {
        setCur(c)
        setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainer, key])

  function toggle(k: string) {
    setAblate((prev) => {
      const next = new Set(prev)
      next.has(k) ? next.delete(k) : next.add(k)
      return next
    })
  }

  if (!trainer) return <div className="text-xs text-slate-500">{status}</div>

  const expertLabels = Array.from({ length: E }, (_, e) => `E${e}`)

  return (
    <div className="space-y-5">
      <SectionIntro
        title="Mixture of Experts (token-level routing)"
        papers={[
          { title: 'Outrageously Large Neural Networks (Shazeer 2017)', url: 'https://arxiv.org/abs/1701.06538' },
          { title: 'Mixtral of Experts', url: 'https://arxiv.org/abs/2401.04088' },
        ]}
      >
        A Mixture-of-Experts layer replaces the single MLP with several <b>expert</b> FFNs plus a{' '}
        <b>gate</b> that routes <em>each token</em> to them. Attention is unchanged — only the MLP is
        split — so every head tool in the other tabs works here identically; the new thing to inspect is
        the <b>router</b>. This model has {E} experts per layer, trained on three tasks (sort, max,
        reverse). Two honesty notes: it's trained <b>dense</b> (every expert runs, weighted by the gate)
        for clarity, whereas production MoE trains <b>sparse</b> top-k with a load-balancing loss; and at
        this scale experts specialise by <b>token/position</b> (digits, the answer region), not neatly
        one-expert-per-task.
      </SectionIntro>

      {/* routing viz */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400">prompt:</span>
          <input
            className="w-56 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[12px] text-slate-100"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          {TASKS.map((t) => (
            <button
              key={t.op}
              onClick={() => setPrompt(t.example)}
              className="rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-[11px] text-slate-200 hover:bg-slate-700"
            >
              {t.example.trim()}
            </button>
          ))}
        </div>
        <div className="text-[11px] text-slate-400">
          Each heatmap is the gate (token → expert) for one layer. A bright cell = that token routed to
          that expert. Watch the pattern change with the prompt — and note how routing sharpens in the
          deeper layers.
        </div>
        <div className="flex flex-wrap gap-4">
          {gate?.trace.layers.map((lt, l) =>
            lt.gate ? (
              <Heatmap
                key={l}
                matrix={lt.gate}
                scale="sequential"
                maxCell={22}
                rowLabels={gate.labels}
                colLabels={expertLabels}
                title={`layer ${l} gate (token × expert)`}
              />
            ) : null,
          )}
        </div>
      </div>

      {/* dense vs sparse + expert ablation */}
      <div className="space-y-3 border-t border-slate-800 pt-4">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <label className="flex items-center gap-2 text-slate-300">
            <input type="checkbox" checked={top1} onChange={(e) => setTop1(e.target.checked)} />
            sparse routing (top-1 only)
          </label>
          <span className="text-[11px] text-slate-500">
            keep only the winning expert per token → far less compute, and the answers barely change.
            That's the efficiency win MoE is built for.
          </span>
        </div>

        <div>
          <div className="mb-1 text-[11px] text-slate-400">
            knock out experts ({ablate.size} ablated) — click a cell; watch which task degrades{' '}
            {ablate.size > 0 && (
              <button className="ml-2 text-sky-400 hover:underline" onClick={() => setAblate(new Set())}>
                reset
              </button>
            )}
          </div>
          <div className="inline-block rounded border border-slate-800 p-2">
            {Array.from({ length: nLayers }, (_, l) => (
              <div key={l} className="flex items-center gap-1">
                <span className="w-12 shrink-0 text-[10px] text-slate-500">layer {l}</span>
                {Array.from({ length: E }, (_, e) => {
                  const k = `${l}.${e}`
                  const on = ablate.has(k)
                  return (
                    <button
                      key={k}
                      onClick={() => toggle(k)}
                      className={
                        'm-0.5 h-8 w-10 rounded border text-[10px] ' +
                        (on
                          ? 'border-red-500 bg-red-900/60 text-red-200 line-through'
                          : 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700')
                      }
                    >
                      E{e}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* per-task accuracy */}
        <div className="grid max-w-lg grid-cols-3 gap-3">
          {TASKS.map((t) => {
            const b = base?.[t.op]
            const c = cur?.[t.op]
            const delta = b != null && c != null ? c - b : 0
            const color = Math.abs(delta) < 3 ? 'text-slate-300' : delta < 0 ? 'text-red-300' : 'text-emerald-300'
            return (
              <div key={t.op} className="rounded border border-slate-800 bg-slate-900/40 p-2">
                <div className={'text-[10px] uppercase tracking-wide text-slate-500'}>{t.label} held-out</div>
                <div className={'text-lg font-bold ' + (busy ? 'text-slate-500' : color)}>
                  {busy || c == null ? '…' : `${c}%`}
                </div>
                <div className="text-[10px] text-slate-500">
                  baseline {b == null ? '—' : `${b}%`}
                  {!busy && c != null && b != null && Math.abs(delta) >= 3 && (
                    <span className={color}> · {delta >= 0 ? '+' : ''}{delta}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* live examples under the current routing + ablation */}
        <div className="max-w-xl space-y-1.5">
          <div className="text-[11px] text-slate-400">answers under the current routing / ablation:</div>
          {TASKS.map((t) => {
            const ans = moeAnswer(trainer.model, trainer.tok, t.example, 8, ablateSet, topK).split('\n')[0]
            return (
              <pre key={t.op} className={'rounded bg-slate-800 p-2 text-[11px] ' + t.color}>
                {t.example}
                {ans}
              </pre>
            )
          })}
        </div>
      </div>

      <p className="max-w-2xl text-[11px] leading-relaxed text-slate-500">
        Try it: ablate one expert and only some tasks/tokens degrade — that's the router having handed
        different work to different experts (the MoE analogue of the head-ablation tab). Toggle top-1 and
        the accuracy barely moves: most tokens only really needed their top expert. Remember attention
        and its heads are untouched by all of this — load this JSON in the main lab (Upload) to inspect
        its heads with the tools above.
      </p>
    </div>
  )
}
