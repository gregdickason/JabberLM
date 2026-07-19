import { useEffect, useMemo, useRef, useState } from 'react'
import { deserialize, type SavedModel } from '../engine/persist'
import { Trainer } from '../engine/trainer'
import { DEFAULT_FEATURE_FLAGS } from '../engine/config'
import { generate, speculativeGenerate, type SpecResult } from '../engine/generate'
import { RNG } from '../engine/random'
import SectionIntro from './SectionIntro'

// Target = the bundled multitask model (~90K); draft = a tiny model on the same corpus
// (~17K, 5.2x smaller, shared vocab). The draft proposes K tokens; the target verifies all
// K in ONE forward. Greedy → the output is identical to running the target alone.
const PROMPTS = ["'Twas brillig, ", 'The slithy toves ', 'And the mome ', 'sort 6 9 2 => ']
const ACCEPT = '#34d399' // emerald — draft guessed right
const CORRECT = '#f59e0b' // amber — target overrode
const BONUS = '#38bdf8' // sky — free target token
const REJECT = '#64748b' // grey — draft guess that was thrown away

async function loadModel(file: string): Promise<Trainer | null> {
  try {
    const res = await fetch(import.meta.env.BASE_URL + file)
    if (!res.ok) return null
    return deserialize((await res.json()) as SavedModel)
  } catch {
    return null
  }
}

const show = (s: string) => s.replace(/ /g, '␣').replace(/\n/g, '⏎')

export default function SpeculativeSection() {
  const [target, setTarget] = useState<Trainer | null>(null)
  const draft = useRef<Trainer | null>(null)
  const [status, setStatus] = useState('loading the models…')
  const [prompt, setPrompt] = useState("'Twas brillig, ")
  const [k, setK] = useState(4)
  const [res, setRes] = useState<SpecResult | null>(null)
  const [timing, setTiming] = useState<{ naiveMs: number; specMs: number; identical: boolean } | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [t, d] = await Promise.all([loadModel('multitask-model.json'), loadModel('multitask-draft.json')])
      if (cancelled) return
      if (!t || !d) {
        setStatus('could not load the models (public/multitask-model.json + multitask-draft.json)')
        return
      }
      draft.current = d
      setTarget(t)
      setStatus('')
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const params = useMemo(() => {
    if (!target || !draft.current) return null
    const t = target.model.params.reduce((n, p) => n + p.size, 0)
    const d = draft.current.model.params.reduce((n, p) => n + p.size, 0)
    return { t, d, x: (t / d).toFixed(1) }
  }, [target])

  function run() {
    const t = target
    const d = draft.current
    if (!t || !d) return
    const ctx = t.model.cfg.contextLen
    const promptLen = t.tok.encode(prompt).length
    const maxNew = Math.max(4, Math.min(28, ctx - promptLen - k - 1))

    const t1 = performance.now()
    const spec = speculativeGenerate(d.model, t.model, t.tok, prompt, DEFAULT_FEATURE_FLAGS, maxNew, k)
    const specMs = performance.now() - t1

    const t0 = performance.now()
    const naive = generate(t.model, DEFAULT_FEATURE_FLAGS, t.tok, prompt, { temperature: 0, topK: null, topP: null, maxNewTokens: maxNew }, new RNG(1))
    const naiveMs = performance.now() - t0

    setRes(spec)
    setTiming({ naiveMs, specMs, identical: spec.text === naive })
  }

  if (!target) return <div className="text-xs text-slate-500">{status}</div>

  const proposed = res ? res.rounds.reduce((n, r) => n + r.proposed.length, 0) : 0
  const acceptedTot = res ? res.rounds.reduce((n, r) => n + r.accepted, 0) : 0
  const acceptRate = proposed ? Math.round((100 * acceptedTot) / proposed) : 0
  const tokPerTarget = res && res.targetForwards ? (res.tokens.length / res.targetForwards).toFixed(2) : '—'
  const decode = (id: number) => target.tok.decode([id])
  const btn = 'rounded border px-3 py-1.5 text-xs'

  return (
    <div className="space-y-4">
      <SectionIntro
        title="Speculative decoding — a small model proposes, a big model verifies"
        papers={[{ title: 'Leviathan, Kalman & Matias (2023) — Fast Inference via Speculative Decoding', url: 'https://arxiv.org/abs/2211.17192' }]}
      >
        Generating is serial — one forward per token, each needing the <b>big</b> model. Speculative decoding
        speeds it up: a small, cheap <b>draft</b> model{params ? <> (here <b>{(params.d / 1000).toFixed(0)}K</b>, ~{params.x}× smaller than the <b>{(params.t / 1000).toFixed(0)}K</b> target)</> : null}{' '}
        proposes <b>K</b> tokens, then the big <b>target</b> checks all K in <b>one</b> forward pass (its logits
        at every position say what it would have produced there). Accept the longest matching prefix; correct
        the first miss; if all K match you get the target's next token <b>free</b>. Because the target has the
        final say on every token, the output is <b>bit-for-bit identical</b> to running the target alone —{' '}
        <em>faster, not approximate</em>.
      </SectionIntro>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <input
          className="min-w-[180px] flex-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 font-mono text-[12px] text-slate-100 focus:border-fuchsia-500 focus:outline-none"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
          spellCheck={false}
        />
        <label className="flex items-center gap-1 text-slate-300">
          K
          <input type="range" min={2} max={6} value={k} onChange={(e) => setK(Number(e.target.value))} />
          <span className="w-4 font-mono">{k}</span>
        </label>
        <button className={btn + ' border-emerald-600 bg-emerald-900/40 text-emerald-200'} onClick={run}>
          ▶ Run
        </button>
        <span className="flex flex-wrap gap-1">
          {PROMPTS.map((p) => (
            <button key={p} onClick={() => setPrompt(p)} className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700">
              {show(p)}
            </button>
          ))}
        </span>
      </div>

      {res && (
        <>
          {/* the generated stream, coloured by how each token was produced */}
          <div className="rounded border border-slate-700 bg-slate-900/40 p-3">
            <div className="mb-1 text-[11px] text-slate-400">
              the output — <span style={{ color: ACCEPT }}>draft accepted</span> ·{' '}
              <span style={{ color: CORRECT }}>target correction</span> · <span style={{ color: BONUS }}>free bonus</span>
            </div>
            <div className="font-mono text-[15px] leading-relaxed">
              <span className="text-slate-500">{show(prompt)}</span>
              {res.tokens.map((tk, i) => (
                <span key={i} style={{ color: tk.kind === 'accepted' ? ACCEPT : tk.kind === 'correction' ? CORRECT : BONUS }}>
                  {show(decode(tk.id))}
                </span>
              ))}
            </div>
          </div>

          {/* the mechanism: each round's draft proposal, verified */}
          <div className="rounded border border-slate-700 bg-slate-900/40 p-3">
            <div className="mb-1 text-[11px] text-slate-400">
              round by round — the draft proposes {k}, the target verifies in one pass (rejected guesses struck through)
            </div>
            <div className="space-y-0.5 font-mono text-[12px]">
              {res.rounds.map((r, ri) => (
                <div key={ri} className="flex flex-wrap items-center gap-x-1">
                  <span className="w-14 shrink-0 text-slate-600">round {ri + 1}</span>
                  {r.proposed.map((id, pi) => {
                    const ok = pi < r.accepted
                    return (
                      <span
                        key={pi}
                        style={{ color: ok ? ACCEPT : REJECT }}
                        className={'rounded px-1 ' + (ok ? 'bg-emerald-950/40' : 'bg-slate-800 line-through')}
                      >
                        {show(decode(id))}
                      </span>
                    )
                  })}
                  {r.emitted.slice(r.accepted).map((e, ei) => (
                    <span key={'e' + ei} style={{ color: e.kind === 'correction' ? CORRECT : BONUS }} className="rounded px-1">
                      {e.kind === 'correction' ? '→ ' : '+ '}
                      {show(decode(e.id))}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* metrics */}
          <div className="grid gap-2 text-[12px] sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded border border-slate-800 bg-slate-900/50 p-2">
              <div className="text-slate-400">target passes</div>
              <div className="text-slate-100">
                <b className="text-emerald-300">{res.targetForwards}</b> vs {res.tokens.length} naïve
              </div>
              <div className="text-[10px] text-slate-500">the expensive model ran fewer times</div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-900/50 p-2">
              <div className="text-slate-400">tokens / target pass</div>
              <div className="text-slate-100"><b className="text-emerald-300">{tokPerTarget}</b> <span className="text-slate-500">(naïve 1.00)</span></div>
              <div className="text-[10px] text-slate-500">= average accepted + 1</div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-900/50 p-2">
              <div className="text-slate-400">acceptance</div>
              <div className="text-slate-100"><b>{acceptRate}%</b> of {proposed} guesses</div>
              <div className="text-[10px] text-slate-500">{res.draftForwards} cheap draft passes</div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-900/50 p-2">
              <div className="text-slate-400">output</div>
              <div className="text-slate-100">{timing?.identical ? <b className="text-emerald-300">identical ✓</b> : <b className="text-rose-300">differs</b>}</div>
              <div className="text-[10px] text-slate-500">
                wall-clock {timing ? (timing.naiveMs / timing.specMs).toFixed(2) : '—'}× (toy scale)
              </div>
            </div>
          </div>

          <p className="max-w-[900px] text-[11px] leading-relaxed text-slate-500">
            The win that matters is <b>target forward passes</b> — the expensive model runs ~
            {tokPerTarget}× fewer times. Here the wall-clock barely moves, honestly: at this tiny scale the
            draft isn't proportionally cheaper and there's no live KV cache. At real scale the target dwarfs
            the draft and runs on parallel hardware, so fewer <em>sequential</em> big-model steps is a direct
            latency win — for output that's bit-for-bit identical. Raise <b>K</b> to propose more per round
            (more accepted when the draft is confident, more wasted guesses when it isn't).
          </p>
        </>
      )}
    </div>
  )
}
