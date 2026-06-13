import type { CharTokenizer } from '../../engine/tokenizer'
import type { Trace } from '../../engine/trace'
import BarChart from '../../viz/BarChart'

// The output end: the final residual is projected to vocab-sized logits, and the
// last position's softmax gives the next-character distribution.
export default function LogitsView({
  trace,
  tok,
  sampled,
}: {
  trace: Trace
  tok: CharTokenizer
  sampled?: number
}) {
  const seq = trace.tokenIds.length
  const vocab = trace.logits.cols
  const lastLogits = Array.from(trace.logits.data.subarray((seq - 1) * vocab, seq * vocab))
  const lastProbs = Array.from(trace.probs.data.subarray((seq - 1) * vocab, seq * vocab))
  const labels = tok.itos.map((_, id) => tok.label(id))

  return (
    <div className="flex flex-wrap gap-6">
      <div>
        <div className="mb-1 text-[11px] text-slate-400">logits (last position)</div>
        <BarChart values={lastLogits} labels={labels} highlight={sampled} max={Math.max(...lastLogits)} />
      </div>
      <div>
        <div className="mb-1 text-[11px] text-slate-400">
          next-char probability {sampled !== undefined && `· sampled “${tok.label(sampled)}”`}
        </div>
        <BarChart values={lastProbs} labels={labels} highlight={sampled} max={1} />
      </div>
    </div>
  )
}
