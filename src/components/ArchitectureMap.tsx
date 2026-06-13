import type { InspectSelection } from '../state/store'

// A compact clickable map of the network. Selecting a head jumps the inspector
// to that (layer, head); the surrounding stages orient where attention sits in
// the decoder block.
export default function ArchitectureMap({
  nLayers,
  nHeads,
  inspect,
  onSelect,
}: {
  nLayers: number
  nHeads: number
  inspect: InspectSelection
  onSelect: (s: Partial<InspectSelection>) => void
}) {
  const stage = 'rounded border border-slate-700 bg-slate-800/60 px-2 py-1 text-center text-[10px] text-slate-300'
  return (
    <div className="flex flex-col items-stretch gap-1 text-[10px]">
      <div className={stage}>tokens → embeddings</div>
      <div className="text-center text-slate-600">↓</div>
      {Array.from({ length: nLayers }, (_, l) => (
        <div key={l} className="rounded border border-slate-700 p-1">
          <div className="mb-1 text-center text-[10px] text-slate-400">layer {l}</div>
          <div className="flex flex-wrap justify-center gap-1">
            {Array.from({ length: nHeads }, (_, h) => {
              const active = inspect.layer === l && inspect.head === h
              return (
                <button
                  key={h}
                  onClick={() => onSelect({ layer: l, head: h })}
                  className={
                    'rounded px-1.5 py-0.5 ' +
                    (active
                      ? 'bg-sky-500 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700')
                  }
                >
                  h{h}
                </button>
              )
            })}
          </div>
          <div className="mt-1 text-center text-[9px] text-slate-600">+ MLP</div>
        </div>
      ))}
      <div className="text-center text-slate-600">↓</div>
      <div className={stage}>final norm → logits</div>
    </div>
  )
}
