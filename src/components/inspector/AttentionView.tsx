import type { CharTokenizer } from '../../engine/tokenizer'
import type { Trace } from '../../engine/trace'
import Heatmap from '../../viz/Heatmap'

// The heart of the inspector: for one (layer, head) it shows the query/key/value
// matrices, the raw QKᵀ/√d scores, the post-softmax attention weights, and the
// resulting value-weighted output — all over the same character axis.
export default function AttentionView({
  trace,
  tok,
  layer,
  head,
}: {
  trace: Trace
  tok: CharTokenizer
  layer: number
  head: number
}) {
  const lt = trace.layers[layer]
  if (!lt) return null
  const ht = lt.heads[head]
  if (!ht) return null
  const labels = trace.tokenIds.map((id) => tok.label(id))

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-slate-400">
        layer {layer} · head {head} — each query (row) attends over keys (cols)
      </div>

      <div className="flex flex-wrap gap-4">
        <Heatmap matrix={ht.q} title="Q (queries)" rowLabels={labels} />
        <Heatmap matrix={ht.k} title="K (keys)" rowLabels={labels} />
        <Heatmap matrix={ht.v} title="V (values)" rowLabels={labels} />
      </div>

      <div className="flex flex-wrap gap-4">
        <Heatmap
          matrix={ht.scores}
          title="scores = QKᵀ / √d (pre-mask)"
          rowLabels={labels}
          colLabels={labels}
        />
        <Heatmap
          matrix={ht.attn}
          scale="sequential"
          title="attention weights (post-softmax)"
          rowLabels={labels}
          colLabels={labels}
        />
        <Heatmap
          matrix={trace.mask}
          scale="diverging"
          title="additive mask (blue = blocked)"
          rowLabels={labels}
          colLabels={labels}
        />
      </div>

      <div className="flex flex-wrap gap-4">
        <Heatmap matrix={ht.headOut} title="head output = attn · V" rowLabels={labels} />
      </div>
    </div>
  )
}
