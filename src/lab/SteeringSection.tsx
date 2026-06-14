import { useMemo, useState } from 'react'
import type { Trainer } from '../engine/trainer'
import type { SAE } from '../interp/sae'
import { generateSteered, neuronWriteDirection, residualScale } from '../interp/steering'
import { RNG } from '../engine/random'
import { DEFAULT_SAMPLE_CONFIG } from '../engine/config'
import SectionIntro, { CAVEAT } from './SectionIntro'

const SEED = 2024

export default function SteeringSection({
  trainer,
  sae,
}: {
  trainer: Trainer
  sae: { sae: SAE; layer: number; topFeature: number } | null
}) {
  const model = trainer.model
  const tok = trainer.tok
  const [source, setSource] = useState<'feature' | 'neuron'>(sae ? 'feature' : 'neuron')
  const [feature, setFeature] = useState(() => sae?.topFeature ?? 0)
  const [nLayer, setNLayer] = useState(() => Math.max(0, model.cfg.nLayers - 1))
  const [neuron, setNeuron] = useState(0)
  const [strength, setStrength] = useState(4) // a multiple of the residual norm
  const [temp, setTemp] = useState(0.7)
  const ids = useMemo(() => tok.encode(trainer.text), [trainer, tok])
  const [prompt, setPrompt] = useState(trainer.text.split('\n')[0].slice(0, 20))
  const [baseline, setBaseline] = useState('')
  const [steeredText, setSteeredText] = useState('')
  const [busy, setBusy] = useState(false)

  const useFeature = source === 'feature' && sae
  const num = 'w-20 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-right text-xs text-slate-100'

  function run() {
    setBusy(true)
    setTimeout(() => {
      const cfg = { ...DEFAULT_SAMPLE_CONFIG, temperature: temp, maxNewTokens: 160 }
      const layer = useFeature ? sae!.layer : nLayer
      const unit = useFeature
        ? sae!.sae.decoderDirection(feature)
        : neuronWriteDirection(model, nLayer, neuron)
      // scale the unit direction by the residual norm so `strength` is a multiple
      // of the activation's own size (otherwise it's negligible)
      const scaleMag = residualScale(model, ids, layer) * strength
      const vec = new Float32Array(unit.length)
      for (let i = 0; i < unit.length; i++) vec[i] = unit[i] * scaleMag
      // same seed for both runs so the only difference is the steering
      const base = generateSteered(model, tok, prompt, cfg, new RNG(SEED))
      const steered = generateSteered(model, tok, prompt, cfg, new RNG(SEED), { layer, vec, strength: 1 })
      setBaseline(base)
      setSteeredText(steered)
      setBusy(false)
    }, 0)
  }

  return (
    <div>
      <SectionIntro
        title="Feature steering"
        papers={[
          { title: 'Scaling Monosemanticity (Golden Gate Claude)', url: 'https://transformer-circuits.pub/2024/scaling-monosemanticity/' },
        ]}
      >
        A feature isn't just something you can read — you can turn it. We add a direction into the
        residual stream during generation and compare against an unsteered run from the same seed. If
        the output shifts, the direction is <span className="text-slate-100">causal</span>, not just
        correlated. {CAVEAT} Effects here are character-level (more spaces, certain letters, repeated
        fragments), not topics.
      </SectionIntro>

      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-3 text-xs text-slate-400">
          <label className="flex items-center gap-1">
            steer a
            <select
              className={num + ' w-24'}
              value={source}
              onChange={(e) => setSource(e.target.value as 'feature' | 'neuron')}
            >
              <option value="feature" disabled={!sae}>
                SAE feature
              </option>
              <option value="neuron">MLP neuron</option>
            </select>
          </label>

          {useFeature ? (
            <label className="flex items-center gap-1">
              feature (layer {sae!.layer})
              <input
                type="number"
                className={num}
                min={0}
                max={sae!.sae.cfg.nFeatures - 1}
                value={feature}
                onChange={(e) => setFeature(Number(e.target.value))}
              />
            </label>
          ) : (
            <>
              <label className="flex items-center gap-1">
                layer
                <select className={num} value={nLayer} onChange={(e) => setNLayer(Number(e.target.value))}>
                  {Array.from({ length: model.cfg.nLayers }, (_, l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1">
                neuron
                <input
                  type="number"
                  className={num}
                  min={0}
                  max={model.cfg.dFF - 1}
                  value={neuron}
                  onChange={(e) => setNeuron(Number(e.target.value))}
                />
              </label>
            </>
          )}

          <label className="flex items-center gap-1">
            strength
            <input
              type="number"
              className={num}
              step={1}
              value={strength}
              onChange={(e) => setStrength(Number(e.target.value))}
            />
          </label>
          <label className="flex items-center gap-1">
            temp
            <input
              type="number"
              className={num}
              step={0.1}
              min={0}
              value={temp}
              onChange={(e) => setTemp(Number(e.target.value))}
            />
          </label>
        </div>

        <div className="flex items-center gap-2">
          <input
            className="flex-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="prompt…"
          />
          <button
            className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700 disabled:opacity-40"
            onClick={run}
            disabled={busy}
          >
            {busy ? 'generating…' : 'Generate both'}
          </button>
        </div>

        {!sae && (
          <div className="text-[11px] text-amber-400">
            Train an SAE in the previous tab to steer a learned feature; meanwhile you can steer a raw
            MLP neuron.
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <div className="mb-1 text-[11px] text-slate-400">baseline (no steering)</div>
            <pre className="h-40 overflow-y-auto whitespace-pre-wrap rounded bg-slate-800 p-2 text-[11px] text-slate-200">
              {baseline || '—'}
            </pre>
          </div>
          <div>
            <div className="mb-1 text-[11px] text-slate-400">
              steered ({useFeature ? `feature ${feature}` : `L${nLayer} neuron ${neuron}`} × {strength})
            </div>
            <pre className="h-40 overflow-y-auto whitespace-pre-wrap rounded bg-slate-800 p-2 text-[11px] text-fuchsia-200">
              {steeredText || '—'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
