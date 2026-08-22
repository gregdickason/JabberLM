import { useMemo, useRef, useState } from 'react'
import type { Model } from '../engine/model'
import type { CharTokenizer } from '../engine/tokenizer'
import { DEFAULT_FEATURE_FLAGS } from '../engine/config'
import { SAE } from '../interp/sae'
import { allDecisionStates, ticPrompt, type Board } from '../data/tictactoe'
import { MiniBoard } from './AttentionBoard'

// Dictionary learning (SAE), on the agent — the GRACEFUL STRETCH. Train a sparse autoencoder on
// the model's move-decision activations over many board states, then for each learned feature
// show the boards that fire it hardest. Honest: on a ~130K model the features are rough; the
// lab's SAE tab is the real thing. Reuses src/interp/sae.ts.

const BOARDS: Board[] = allDecisionStates().filter((_, i) => i % 8 === 0) // ~a few hundred, live-cheap
const N_FEATURES = 64

export default function SaeBoard({ model, tok }: { model: Model; tok: CharTokenizer }) {
  const [phase, setPhase] = useState<'idle' | 'training' | 'done'>('idle')
  const [step, setStep] = useState(0)
  const [feat, setFeat] = useState(0)
  const raf = useRef(0)
  const state = useRef<{ sae: SAE; acts: Float32Array; N: number; codes: Float32Array } | null>(null)

  // the residual activation at the move-decision position for each board (N × dModel)
  const acts = useMemo(() => {
    const dM = model.cfg.dModel, top = model.cfg.nLayers - 1
    const a = new Float32Array(BOARDS.length * dM)
    BOARDS.forEach((b, i) => {
      const ids = tok.encode(ticPrompt(b))
      const { trace } = model.forward(ids, DEFAULT_FEATURE_FLAGS, undefined, true)
      const resid = trace!.layers[top].afterMLPResid
      const last = (resid.rows - 1) * resid.cols
      for (let j = 0; j < dM; j++) a[i * dM + j] = resid.data[last + j]
    })
    return a
  }, [model])

  function train() {
    if (phase === 'training') return
    const dM = model.cfg.dModel
    const sae = new SAE({ dAct: dM, nFeatures: N_FEATURES, l1: 0.003, lr: 0.01 })
    setPhase('training'); setStep(0)
    let s = 0
    const TOTAL = 2500
    const loop = () => {
      for (let i = 0; i < 40 && s < TOTAL; i++, s++) sae.trainStep(acts, BOARDS.length, 32)
      setStep(s)
      if (s < TOTAL) { raf.current = requestAnimationFrame(loop) }
      else {
        const codes = sae.encodeAll(acts, BOARDS.length)
        state.current = { sae, acts, N: BOARDS.length, codes }
        // pick the most-used feature to show first
        setFeat(topFeatures(codes, BOARDS.length, N_FEATURES)[0] ?? 0)
        setPhase('done')
      }
    }
    raf.current = requestAnimationFrame(loop)
  }

  const st = state.current
  const ranked = useMemo(() => (st ? topFeatures(st.codes, st.N, N_FEATURES) : []), [st, phase])
  const topBoards = useMemo(() => {
    if (!st) return []
    const scored = BOARDS.map((b, i) => [st.codes[i * N_FEATURES + feat], b] as [number, Board])
    return scored.filter((x) => x[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, 8)
  }, [st, feat, phase])

  return (
    <div className="space-y-3">
      <p className="max-w-3xl text-[12px] leading-relaxed text-slate-400">
        A <b>sparse autoencoder</b> pulls the model's tangled activations apart into a <b>dictionary</b> of
        features. Train one here on the agent's move-decision activations, then click a feature to see the
        boards that fire it hardest — do any correspond to a human-readable pattern (a filled row, a corner)?
      </p>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button className="rounded border border-emerald-600 bg-emerald-900/40 px-3 py-1.5 text-emerald-200" onClick={train} disabled={phase === 'training'}>
          {phase === 'training' ? `training… ${step}` : phase === 'done' ? '↺ Re-train' : '▶ Train the dictionary (~20s)'}
        </button>
        <span className="text-slate-500">{BOARDS.length} boards · {N_FEATURES} features</span>
      </div>

      {phase === 'done' && st && (
        <div className="flex flex-wrap items-start gap-6">
          <div>
            <div className="mb-1 text-[11px] text-slate-400">features (most-used first)</div>
            <div className="flex flex-wrap gap-1" style={{ maxWidth: 260 }}>
              {ranked.slice(0, 24).map((f) => (
                <button key={f} onClick={() => setFeat(f)} className={'rounded px-1.5 py-0.5 text-[10px] ' + (feat === f ? 'bg-fuchsia-700 text-white' : 'bg-slate-800 text-slate-300')}>#{f}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 text-[11px] text-slate-400">boards that most activate feature <b>#{feat}</b></div>
            <div className="flex flex-wrap gap-2">
              {topBoards.length === 0 ? <span className="text-[11px] text-slate-500">this feature never fires</span> :
                topBoards.map(([, b], i) => <MiniBoard key={i} board={b} vals={Array(9).fill(0)} size={22} />)}
            </div>
          </div>
        </div>
      )}

      <p className="max-w-3xl text-[11px] leading-relaxed text-slate-500">
        Honest caveat: at ~130K params on a spatial task the features are <b>rough</b> — some are clean (a
        specific occupied cell), many are mixed. That's the reality of interpretability on a tiny model. The
        full technique — with steering — lives in the <a className="text-fuchsia-300 hover:underline" href="./lab.html?tab=dictionary-sae">lab's dictionary (SAE) tab</a>.
      </p>
    </div>
  )
}

/** features ranked by how many boards they fire on (usage), descending. */
function topFeatures(codes: Float32Array, N: number, F: number): number[] {
  const usage = new Array(F).fill(0)
  for (let i = 0; i < N; i++) for (let f = 0; f < F; f++) if (codes[i * F + f] > 0.01) usage[f]++
  return Array.from({ length: F }, (_, f) => f).filter((f) => usage[f] > 0).sort((a, b) => usage[b] - usage[a])
}
