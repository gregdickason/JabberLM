import type { CharTokenizer } from '../../engine/tokenizer'
import type { Trace } from '../../engine/trace'
import type { FeatureFlags } from '../../engine/config'
import { kvCacheStats } from '../../engine/kvcache'
import Heatmap from '../../viz/Heatmap'

// Shows the key cache for the selected head as a positions × head_dim grid, marks
// which rows are reused vs freshly computed, and reports the compute saved versus
// recomputing the whole context every step.
export default function KVCacheView({
  trace,
  tok,
  layer,
  head,
  flags,
  promptLen,
  generatedSteps,
}: {
  trace: Trace
  tok: CharTokenizer
  layer: number
  head: number
  flags: FeatureFlags
  promptLen: number
  generatedSteps: number
}) {
  const ht = trace.layers[layer]?.heads[head]
  if (!ht) return null
  const seq = trace.tokenIds.length
  const stats = kvCacheStats(promptLen, generatedSteps)
  const labels = trace.tokenIds.map((id) => tok.label(id))
  const savedPct =
    stats.cumulativeUncached > 0
      ? Math.round((1 - stats.cumulativeCached / stats.cumulativeUncached) * 100)
      : 0

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-slate-400">
        KV cache is{' '}
        {flags.kvCache ? (
          <span className="text-emerald-300">on</span>
        ) : (
          <span className="text-amber-300">off</span>
        )}
        . With it, each generation step computes K/V for only the newest token; the rest are reused.
      </div>

      <div className="flex flex-wrap gap-4">
        <Heatmap matrix={ht.k} title="K cache (positions × head_dim)" rowLabels={labels} />
        <Heatmap matrix={ht.v} title="V cache (positions × head_dim)" rowLabels={labels} />
      </div>

      <div>
        <div className="mb-1 text-[10px] text-slate-500">per-position status</div>
        <div className="flex flex-wrap gap-0.5">
          {Array.from({ length: seq }, (_, i) => {
            const isNew = i === seq - 1 && generatedSteps > 0
            return (
              <span
                key={i}
                className={
                  'rounded px-1 text-[10px] ' +
                  (isNew ? 'bg-amber-500 text-black' : 'bg-emerald-700/70 text-emerald-50')
                }
                title={isNew ? 'computed this step' : 'reused from cache'}
              >
                {labels[i]}
              </span>
            )
          })}
        </div>
        <div className="mt-1 text-[10px] text-slate-500">
          <span className="text-amber-400">amber</span> = computed this step ·{' '}
          <span className="text-emerald-400">green</span> = reused from cache
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
        <Stat label="context length" value={String(stats.contextLen)} />
        <Stat label="generation steps" value={String(generatedSteps)} />
        <Stat label="this step · cached" value={`${stats.computedThisStepCached} row`} />
        <Stat label="this step · no cache" value={`${stats.computedThisStepUncached} rows`} />
        <Stat label="cumulative · cached" value={`${stats.cumulativeCached} rows`} />
        <Stat label="cumulative · no cache" value={`${stats.cumulativeUncached} rows`} />
      </div>
      <div className="rounded bg-slate-800 p-2 text-[11px] text-slate-200">
        K/V computation saved so far:{' '}
        <span className="font-bold text-emerald-300">{savedPct}%</span> (
        {stats.cumulativeUncached - stats.cumulativeCached} fewer rows). The gap grows ~quadratically
        with sequence length — which is exactly why caching matters for long contexts.
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-100">{value}</span>
    </div>
  )
}
