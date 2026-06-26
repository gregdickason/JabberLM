import { useEffect, useState } from 'react'
import { useStore } from '../state/store'
import { TEXT_SAMPLES } from '../data/jabberwocky'
import type { ModelConfig, PositionalMode } from '../engine/config'

const PRESETS: { name: string; cfg: Partial<ModelConfig>; slow?: boolean }[] = [
  { name: 'tiny', cfg: { dModel: 24, nHeads: 2, nLayers: 2, contextLen: 32, dFF: 96 } },
  { name: 'default', cfg: { dModel: 48, nHeads: 3, nLayers: 3, contextLen: 48, dFF: 192 } },
  { name: 'bigger', cfg: { dModel: 64, nHeads: 4, nLayers: 4, contextLen: 64, dFF: 256 } },
  { name: 'largest', cfg: { dModel: 96, nHeads: 4, nLayers: 4, contextLen: 128, dFF: 384 }, slow: true },
]

// `largest` trains slowly live and is rough on phones — gate it on small screens.
function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const on = () => setMobile(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return mobile
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-800 px-3 py-3">
      <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-slate-300">
      <span>{label}</span>
      {children}
    </label>
  )
}

const numInput =
  'w-20 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-right text-xs text-slate-100 focus:border-sky-500 focus:outline-none'
const selInput =
  'rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-xs text-slate-100 focus:border-sky-500 focus:outline-none'

export default function ConfigSidebar() {
  const {
    trainingText,
    setTrainingText,
    modelConfig,
    setModelConfig,
    featureFlags,
    setFeatureFlags,
    trainConfig,
    setTrainConfig,
    modelBuilt,
  } = useStore()

  const selectedSampleId =
    TEXT_SAMPLES.find((s) => s.text === trainingText)?.id ?? 'custom'
  const isMobile = useIsMobile()

  return (
    <div className="text-slate-200">
      <Section title="Training text">
        <select
          className={selInput + ' w-full'}
          value={selectedSampleId}
          onChange={(e) => {
            const s = TEXT_SAMPLES.find((x) => x.id === e.target.value)
            if (s) setTrainingText(s.text)
          }}
        >
          {TEXT_SAMPLES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
          {selectedSampleId === 'custom' && <option value="custom">Custom</option>}
        </select>
        <textarea
          className="h-24 w-full resize-y rounded border border-slate-700 bg-slate-800 p-1.5 text-[11px] leading-tight text-slate-100 focus:border-sky-500 focus:outline-none"
          value={trainingText}
          onChange={(e) => setTrainingText(e.target.value)}
        />
        <div className="text-[11px] text-slate-500">
          {trainingText.length} chars · {new Set(trainingText).size} unique
        </div>
      </Section>

      <Section title="Architecture (rebuild required)">
        <div className="flex gap-1">
          {PRESETS.map((p) => {
            const blocked = p.slow && isMobile
            return (
              <button
                key={p.name}
                disabled={blocked}
                title={
                  blocked
                    ? 'large model — too slow to train live on a phone (open on desktop)'
                    : p.slow
                      ? 'large model — slow to train live; best on desktop'
                      : undefined
                }
                className={
                  'flex-1 rounded border px-1 py-0.5 text-[11px] disabled:opacity-40 ' +
                  (p.slow
                    ? 'border-amber-800/60 bg-slate-800 text-amber-200/90 hover:bg-slate-700'
                    : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700')
                }
                onClick={() => !blocked && setModelConfig(p.cfg)}
              >
                {p.name}
              </button>
            )
          })}
        </div>
        <div className="text-[10px] text-slate-500">
          Smaller is plenty for these demos. <span className="text-amber-200/80">largest</span> trains
          slowly live{isMobile ? ' (disabled on mobile)' : ''}.
        </div>
        <Row label="d_model">
          <input
            type="number"
            className={numInput}
            value={modelConfig.dModel}
            min={8}
            step={8}
            onChange={(e) => setModelConfig({ dModel: Number(e.target.value) })}
          />
        </Row>
        <Row label="heads">
          <input
            type="number"
            className={numInput}
            value={modelConfig.nHeads}
            min={1}
            onChange={(e) => setModelConfig({ nHeads: Number(e.target.value) })}
          />
        </Row>
        <Row label="layers">
          <input
            type="number"
            className={numInput}
            value={modelConfig.nLayers}
            min={1}
            onChange={(e) => setModelConfig({ nLayers: Number(e.target.value) })}
          />
        </Row>
        <Row label="context len">
          <input
            type="number"
            className={numInput}
            value={modelConfig.contextLen}
            min={4}
            onChange={(e) => setModelConfig({ contextLen: Number(e.target.value) })}
          />
        </Row>
        <Row label="d_ff">
          <input
            type="number"
            className={numInput}
            value={modelConfig.dFF}
            min={8}
            step={8}
            onChange={(e) => setModelConfig({ dFF: Number(e.target.value) })}
          />
        </Row>
        <Row label="activation">
          <select
            className={selInput}
            value={modelConfig.activation}
            onChange={(e) =>
              setModelConfig({ activation: e.target.value as 'gelu' | 'relu' })
            }
          >
            <option value="gelu">gelu</option>
            <option value="relu">relu</option>
          </select>
        </Row>
        <Row label="weight tying">
          <input
            type="checkbox"
            checked={modelConfig.weightTying}
            onChange={(e) => setModelConfig({ weightTying: e.target.checked })}
          />
        </Row>
        {!modelBuilt && (
          <div className="text-[11px] text-amber-400">
            config changed — rebuild &amp; retrain to apply
          </div>
        )}
      </Section>

      <Section title="Features (live)">
        <Row label="positional">
          <select
            className={selInput}
            value={featureFlags.positional}
            onChange={(e) =>
              setFeatureFlags({ positional: e.target.value as PositionalMode })
            }
          >
            <option value="learned">learned</option>
            <option value="rope">RoPE</option>
            <option value="none">none</option>
          </select>
        </Row>
        <Row label="causal mask">
          <input
            type="checkbox"
            checked={featureFlags.causalMask}
            onChange={(e) => setFeatureFlags({ causalMask: e.target.checked })}
          />
        </Row>
        <Row label="sliding window">
          <input
            type="number"
            className={numInput}
            placeholder="off"
            value={featureFlags.slidingWindow ?? ''}
            min={1}
            onChange={(e) =>
              setFeatureFlags({
                slidingWindow: e.target.value === '' ? null : Number(e.target.value),
              })
            }
          />
        </Row>
        <Row label="KV cache (infer)">
          <input
            type="checkbox"
            checked={featureFlags.kvCache}
            onChange={(e) => setFeatureFlags({ kvCache: e.target.checked })}
          />
        </Row>
      </Section>

      <Section title="Training (live)">
        <Row label="optimizer">
          <select
            className={selInput}
            value={trainConfig.optimizer}
            onChange={(e) =>
              setTrainConfig({ optimizer: e.target.value as 'sgd' | 'adamw' })
            }
          >
            <option value="adamw">AdamW</option>
            <option value="sgd">SGD</option>
          </select>
        </Row>
        <Row label="learning rate">
          <input
            type="number"
            className={numInput}
            value={trainConfig.learningRate}
            step={0.001}
            min={0}
            onChange={(e) => setTrainConfig({ learningRate: Number(e.target.value) })}
          />
        </Row>
        <Row label="batch size">
          <input
            type="number"
            className={numInput}
            value={trainConfig.batchSize}
            min={1}
            onChange={(e) => setTrainConfig({ batchSize: Number(e.target.value) })}
          />
        </Row>
        <Row label="grad clip">
          <input
            type="number"
            className={numInput}
            placeholder="off"
            value={trainConfig.gradClip ?? ''}
            step={0.1}
            min={0}
            onChange={(e) =>
              setTrainConfig({
                gradClip: e.target.value === '' ? null : Number(e.target.value),
              })
            }
          />
        </Row>
        <Row label="held-out %">
          <input
            type="number"
            className={numInput}
            placeholder="off"
            min={0}
            max={90}
            step={5}
            value={Math.round(trainConfig.validationFraction * 100) || ''}
            onChange={(e) =>
              setTrainConfig({
                validationFraction: e.target.value === '' ? 0 : Number(e.target.value) / 100,
              })
            }
          />
        </Row>
        <Row label="validate every">
          <input
            type="number"
            className={numInput}
            min={1}
            value={trainConfig.validationEverySteps}
            onChange={(e) => setTrainConfig({ validationEverySteps: Number(e.target.value) })}
          />
        </Row>
      </Section>
    </div>
  )
}
