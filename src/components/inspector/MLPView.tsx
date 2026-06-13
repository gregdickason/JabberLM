import type { CharTokenizer } from '../../engine/tokenizer'
import type { Trace } from '../../engine/trace'
import Heatmap from '../../viz/Heatmap'

// The per-layer MLP: the normed input is projected up to d_ff, passed through the
// activation, and projected back down. Shows the hidden activations and output.
export default function MLPView({
  trace,
  tok,
  layer,
}: {
  trace: Trace
  tok: CharTokenizer
  layer: number
}) {
  const lt = trace.layers[layer]
  if (!lt) return null
  const labels = trace.tokenIds.map((id) => tok.label(id))
  return (
    <div className="flex flex-wrap gap-4">
      <Heatmap matrix={lt.normedMLP} title="LN2 output (MLP input)" rowLabels={labels} />
      <Heatmap matrix={lt.mlpHidden} title="hidden activations (seq × d_ff)" rowLabels={labels} />
      <Heatmap matrix={lt.mlpOut} title="MLP output (seq × d_model)" rowLabels={labels} />
    </div>
  )
}
