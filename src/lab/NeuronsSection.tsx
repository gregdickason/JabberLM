import { useEffect, useMemo, useState } from 'react'
import type { Trainer } from '../engine/trainer'
import { neuronColumn, sweepActivations, type ActivationSweep } from '../interp/activations'
import { contextAround, topKPositions } from '../interp/maxact'
import SectionIntro, { CAVEAT } from './SectionIntro'
import LineChart from '../viz/LineChart'

export default function NeuronsSection({ trainer }: { trainer: Trainer }) {
  const [sweep, setSweep] = useState<ActivationSweep | null>(null)
  const [layer, setLayer] = useState(0)
  const [neuron, setNeuron] = useState(0)

  useEffect(() => {
    setSweep(null)
    // defer so the "analyzing…" state can paint before the synchronous sweep
    const id = setTimeout(() => {
      setSweep(sweepActivations(trainer.model, trainer.tok.encode(trainer.text)))
    }, 0)
    return () => clearTimeout(id)
  }, [trainer])

  const col = useMemo(
    () => (sweep ? neuronColumn(sweep, layer, neuron) : null),
    [sweep, layer, neuron],
  )
  const top = useMemo(() => (col ? topKPositions(col, 12) : []), [col])

  const num =
    'w-20 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-right text-xs text-slate-100'

  return (
    <div>
      <SectionIntro
        title="Neurons & polysemanticity"
        papers={[
          { title: 'Toy Models of Superposition', url: 'https://transformer-circuits.pub/2022/toy_model/index.html' },
        ]}
      >
        Each MLP neuron is one number per position. Reading what a neuron "detects" means finding the
        inputs that make it fire hardest. The catch is <span className="text-slate-100">superposition</span>:
        models pack more concepts than they have neurons, so a single neuron is usually{' '}
        <span className="text-slate-100">polysemantic</span> — it lights up for several unrelated
        patterns at once. That's why you can't just read meaning off neurons, and why the next tab
        (dictionary learning) exists. {CAVEAT}
      </SectionIntro>

      {!sweep || !col ? (
        <div className="text-xs text-slate-500">analyzing the corpus…</div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 text-xs text-slate-400">
            <label className="flex items-center gap-1">
              layer
              <select
                className={num}
                value={layer}
                onChange={(e) => setLayer(Number(e.target.value))}
              >
                {Array.from({ length: sweep.nLayers }, (_, l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1">
              neuron (0–{sweep.dFF - 1})
              <input
                type="number"
                className={num}
                min={0}
                max={sweep.dFF - 1}
                value={neuron}
                onChange={(e) =>
                  setNeuron(Math.max(0, Math.min(sweep.dFF - 1, Number(e.target.value))))
                }
              />
            </label>
            <button
              className="rounded border border-slate-600 bg-slate-800 px-2 py-1 hover:bg-slate-700"
              onClick={() => setNeuron(Math.floor(Math.random() * sweep.dFF))}
            >
              random neuron
            </button>
          </div>

          <div>
            <div className="mb-1 text-[11px] text-slate-400">
              activation across the corpus (L{layer} · neuron {neuron})
            </div>
            <LineChart
              width={640}
              height={90}
              series={[
                {
                  label: 'activation',
                  color: '#e879f9',
                  points: Array.from(col, (y, x) => ({ x, y })),
                },
              ]}
            />
          </div>

          <div>
            <div className="mb-1 text-[11px] text-slate-400">
              top-activating contexts (the highlighted character is where it fires)
            </div>
            <div className="space-y-0.5 overflow-x-auto">
              {top.map(({ pos, value }) => {
                const ctx = contextAround(trainer.tok.encode(trainer.text), (id) => trainer.tok.label(id), pos, 22)
                return (
                  <div key={pos} className="flex items-center gap-2 text-[11px]">
                    <span className="w-12 shrink-0 text-right text-slate-500">{value.toFixed(2)}</span>
                    <span className="whitespace-pre rounded bg-slate-800 px-1 py-0.5 text-slate-300">
                      <span className="text-slate-500">{ctx.before}</span>
                      <span className="rounded bg-fuchsia-600 px-0.5 text-white">{ctx.charLabel}</span>
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="mt-2 max-w-3xl text-[11px] text-slate-500">
              Browse a few neurons. Many will fire on more than one kind of context (e.g. both a space
              and the end of a word, or several different letters) — that mixing is superposition in
              action.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
