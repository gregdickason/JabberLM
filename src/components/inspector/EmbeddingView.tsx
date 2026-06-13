import type { CharTokenizer } from '../../engine/tokenizer'
import type { Trace } from '../../engine/trace'
import Heatmap from '../../viz/Heatmap'

// The token embeddings for the current context (seq × dModel), plus the learned
// positional contribution if the model is using learned position embeddings.
export default function EmbeddingView({ trace, tok }: { trace: Trace; tok: CharTokenizer }) {
  const rowLabels = trace.tokenIds.map((id) => tok.label(id))
  return (
    <div className="flex flex-wrap gap-4">
      <Heatmap matrix={trace.embeddings} title="token embeddings (seq × d_model)" rowLabels={rowLabels} />
      {trace.positional && (
        <Heatmap
          matrix={trace.positional}
          title="positional contribution"
          rowLabels={trace.positions.map(String)}
        />
      )}
      <Heatmap
        matrix={trace.inputResidual}
        title="residual stream into layer 0"
        rowLabels={rowLabels}
      />
    </div>
  )
}
