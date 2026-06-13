import type { CharTokenizer } from '../../engine/tokenizer'
import type { Trace, Matrix } from '../../engine/trace'
import type { FeatureFlags } from '../../engine/config'
import { buildMask } from '../../engine/attention'
import Heatmap from '../../viz/Heatmap'

// Demonstrates sliding-window attention by recomputing the additive mask live as
// the window width changes, and showing, for the last query, exactly which tokens
// stay visible and which fall outside the window. Updating the slider writes the
// flag back so the model uses the same window on the next Run/Step.
export default function SlidingWindowView({
  trace,
  tok,
  flags,
  setFlags,
}: {
  trace: Trace
  tok: CharTokenizer
  flags: FeatureFlags
  setFlags: (patch: Partial<FeatureFlags>) => void
}) {
  const seq = trace.tokenIds.length
  const labels = trace.tokenIds.map((id) => tok.label(id))
  const window = flags.slidingWindow

  // recompute the mask live from the current flags so the slider is responsive
  const maskData = buildMask(trace.positions, flags)
  const mask: Matrix = { rows: seq, cols: seq, data: maskData }

  const lastIdx = seq - 1
  const visible = labels.map((_, j) => maskData[lastIdx * seq + j] === 0)

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-slate-400">
        Sliding window is{' '}
        {window == null ? (
          <span className="text-amber-300">off</span>
        ) : (
          <span className="text-emerald-300">W = {window}</span>
        )}
        . A query may only attend to the most recent W keys (plus the causal rule), so older context
        falls out of view.
      </div>

      <label className="flex items-center gap-2 text-[11px] text-slate-400">
        window width
        <input
          type="range"
          min={1}
          max={seq}
          value={window ?? seq}
          onChange={(e) => {
            const v = Number(e.target.value)
            setFlags({ slidingWindow: v >= seq ? null : v })
          }}
        />
        <span className="text-slate-200">{window ?? `${seq} (off)`}</span>
      </label>

      <Heatmap
        matrix={mask}
        scale="diverging"
        title="additive mask (blue = blocked) — note the band"
        rowLabels={labels}
        colLabels={labels}
      />

      <div>
        <div className="mb-1 text-[10px] text-slate-500">
          last token “{labels[lastIdx]}” attends to:
        </div>
        <div className="flex flex-wrap gap-0.5">
          {labels.map((l, j) => (
            <span
              key={j}
              className={
                'rounded px-1 text-[10px] ' +
                (visible[j]
                  ? 'bg-sky-700/70 text-sky-50'
                  : 'bg-slate-800 text-slate-600 line-through')
              }
            >
              {l}
            </span>
          ))}
        </div>
        <div className="mt-1 text-[10px] text-slate-500">
          {visible.filter(Boolean).length} of {seq} tokens visible —{' '}
          {seq - visible.filter(Boolean).length} dropped beyond the window.
        </div>
      </div>
    </div>
  )
}
