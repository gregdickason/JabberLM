import { useEffect, useMemo, useRef, useState } from 'react'
import type { Trainer } from '../engine/trainer'
import { sweepActivations, type ActivationSweep } from '../interp/activations'
import { contextAround, topKPositions } from '../interp/maxact'
import { SAE } from '../interp/sae'
import SectionIntro, { CAVEAT } from './SectionIntro'

const TOTAL_STEPS = 400
const CHUNK = 20

export default function SaeSection({
  trainer,
  onTrained,
}: {
  trainer: Trainer
  onTrained?: (sae: SAE, layer: number, topFeature: number) => void
}) {
  const [sweep, setSweep] = useState<ActivationSweep | null>(null)
  const [layer, setLayer] = useState(() => Math.max(0, trainer.model.cfg.nLayers - 1))
  const [nFeatures, setNFeatures] = useState(512)
  const [l1, setL1] = useState(0.004)

  const saeRef = useRef<SAE | null>(null)
  const [step, setStep] = useState(0)
  const [metrics, setMetrics] = useState<{ mse: number; l0: number } | null>(null)
  const [training, setTraining] = useState(false)
  const [featMatrix, setFeatMatrix] = useState<Float32Array | null>(null)
  const [feature, setFeature] = useState(0)
  const ids = useMemo(() => trainer.tok.encode(trainer.text), [trainer])

  useEffect(() => {
    setSweep(null)
    setFeatMatrix(null)
    const id = setTimeout(() => setSweep(sweepActivations(trainer.model, ids)), 0)
    return () => clearTimeout(id)
  }, [trainer, ids])

  function train() {
    if (!sweep) return
    const acts = sweep.resid[layer]
    const N = sweep.N
    const dAct = sweep.dModel
    const sae = new SAE({ dAct, nFeatures, l1, lr: 0.01 })
    saeRef.current = sae
    setFeatMatrix(null)
    setStep(0)
    setTraining(true)

    let s = 0
    const run = () => {
      let last = { mse: 0, l0: 0 }
      for (let i = 0; i < CHUNK && s < TOTAL_STEPS; i++, s++) {
        const r = sae.trainStep(acts, N, 48)
        last = { mse: r.mse, l0: r.l0 }
      }
      setStep(s)
      setMetrics(last)
      if (s < TOTAL_STEPS) {
        setTimeout(run, 0)
      } else {
        const fm = sae.encodeAll(acts, N)
        setFeatMatrix(fm)
        setTraining(false)
        // pick the most active feature as a good default for browsing/steering
        let bestF = 0
        let bestPeak = -1
        for (let f = 0; f < nFeatures; f++) {
          let p = 0
          for (let r = 0; r < N; r++) {
            const v = fm[r * nFeatures + f]
            if (v > p) p = v
          }
          if (p > bestPeak) {
            bestPeak = p
            bestF = f
          }
        }
        setFeature(bestF)
        onTrained?.(sae, layer, bestF)
      }
    }
    setTimeout(run, 0)
  }

  // features ranked by peak activation, for the browser list
  const ranked = useMemo(() => {
    if (!featMatrix || !sweep) return []
    const F = nFeatures
    const peak = new Float32Array(F)
    for (let r = 0; r < sweep.N; r++)
      for (let f = 0; f < F; f++) {
        const v = featMatrix[r * F + f]
        if (v > peak[f]) peak[f] = v
      }
    return Array.from({ length: F }, (_, f) => ({ f, peak: peak[f] }))
      .filter((x) => x.peak > 1e-4)
      .sort((a, b) => b.peak - a.peak)
  }, [featMatrix, sweep, nFeatures])

  const featCol = useMemo(() => {
    if (!featMatrix || !sweep) return null
    const F = nFeatures
    const col = new Float32Array(sweep.N)
    for (let r = 0; r < sweep.N; r++) col[r] = featMatrix[r * F + feature]
    return col
  }, [featMatrix, sweep, feature, nFeatures])

  const top = featCol ? topKPositions(featCol, 12) : []
  const num = 'w-20 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-right text-xs text-slate-100'

  return (
    <div>
      <SectionIntro
        title="Dictionary learning (sparse autoencoder)"
        papers={[
          { title: 'Towards Monosemanticity', url: 'https://transformer-circuits.pub/2023/monosemantic-features/index.html' },
          { title: 'Scaling Monosemanticity', url: 'https://transformer-circuits.pub/2024/scaling-monosemanticity/' },
        ]}
      >
        Because neurons are polysemantic, Anthropic decomposes activations into a larger set of cleaner
        units. A sparse autoencoder learns to rebuild a layer's activations from a few active features
        out of many — here {nFeatures} features from a {sweep?.dModel ?? '?'}-dimensional residual
        stream. The L1 penalty forces sparsity, which pushes each feature toward a single meaning. {CAVEAT}
      </SectionIntro>

      {!sweep ? (
        <div className="text-xs text-slate-500">collecting activations…</div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 text-xs text-slate-400">
            <label className="flex items-center gap-1">
              residual after layer
              <select className={num} value={layer} onChange={(e) => setLayer(Number(e.target.value))}>
                {Array.from({ length: sweep.nLayers }, (_, l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1">
              features
              <select className={num} value={nFeatures} onChange={(e) => setNFeatures(Number(e.target.value))}>
                {[256, 512, 1024].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1">
              L1
              <input
                type="number"
                step={0.001}
                min={0}
                className={num}
                value={l1}
                onChange={(e) => setL1(Number(e.target.value))}
              />
            </label>
            <button
              className="rounded border border-slate-600 bg-slate-800 px-2 py-1 hover:bg-slate-700 disabled:opacity-40"
              onClick={train}
              disabled={training}
            >
              {training ? `training… ${step}/${TOTAL_STEPS}` : 'Train SAE'}
            </button>
            {metrics && (
              <span className="text-slate-500">
                recon MSE {metrics.mse.toFixed(4)} · avg {metrics.l0.toFixed(1)} active features/token
              </span>
            )}
          </div>

          {!featMatrix ? (
            <div className="text-xs text-slate-500">
              Train the autoencoder to learn a feature dictionary, then browse the features below.
            </div>
          ) : (
            <div className="flex flex-wrap gap-6">
              <div>
                <div className="mb-1 text-[11px] text-slate-400">
                  {ranked.length} live features (of {nFeatures}) — click one
                </div>
                <div className="h-72 w-44 overflow-y-auto rounded border border-slate-800">
                  {ranked.map(({ f, peak }) => (
                    <button
                      key={f}
                      onClick={() => setFeature(f)}
                      className={
                        'flex w-full justify-between px-2 py-0.5 text-left text-[11px] ' +
                        (f === feature ? 'bg-fuchsia-700 text-white' : 'text-slate-300 hover:bg-slate-800')
                      }
                    >
                      <span>feature {f}</span>
                      <span className="text-slate-400">{peak.toFixed(1)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-w-0">
                <div className="mb-1 text-[11px] text-slate-400">
                  feature {feature}: top-activating contexts
                </div>
                <div className="space-y-0.5 overflow-x-auto">
                  {top.map(({ pos, value }) => {
                    const ctx = contextAround(ids, (id) => trainer.tok.label(id), pos, 22)
                    return (
                      <div key={pos} className="flex items-center gap-2 text-[11px]">
                        <span className="w-12 shrink-0 text-right text-slate-500">{value.toFixed(2)}</span>
                        <span className="whitespace-pre rounded bg-slate-800 px-1 py-0.5">
                          <span className="text-slate-500">{ctx.before}</span>
                          <span className="rounded bg-fuchsia-600 px-0.5 text-white">{ctx.charLabel}</span>
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-2 max-w-md text-[11px] text-slate-500">
                  Compare these to the raw neurons in the first tab — features tend to fire on a more
                  consistent pattern. There are far more features than residual dimensions, which is the
                  point: superposition, unpacked.
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
