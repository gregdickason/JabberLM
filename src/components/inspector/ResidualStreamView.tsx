import { useState } from 'react'
import type { CharTokenizer } from '../../engine/tokenizer'
import type { Matrix, Trace } from '../../engine/trace'
import Heatmap from '../../viz/Heatmap'

function row(m: Matrix, r: number): number[] {
  return Array.from(m.data.subarray(r * m.cols, (r + 1) * m.cols))
}

// Follows a single token's residual-stream vector as each block reads from and
// writes back to it. Rows are pipeline stages (top → bottom = input → output).
export default function ResidualStreamView({ trace, tok }: { trace: Trace; tok: CharTokenizer }) {
  const seq = trace.tokenIds.length
  const [pos, setPos] = useState(seq - 1)
  const p = Math.min(pos, seq - 1)

  const stages: { label: string; data: number[] }[] = [{ label: 'input', data: row(trace.inputResidual, p) }]
  trace.layers.forEach((lt, i) => {
    stages.push({ label: `L${i} +attn`, data: row(lt.afterAttnResid, p) })
    stages.push({ label: `L${i} +mlp`, data: row(lt.afterMLPResid, p) })
  })
  stages.push({ label: 'final norm', data: row(trace.finalNorm, p) })

  const cols = stages[0].data.length
  const data = new Float32Array(stages.length * cols)
  stages.forEach((s, i) => data.set(s.data, i * cols))
  const matrix: Matrix = { rows: stages.length, cols, data }

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-[11px] text-slate-400">
        token position
        <input
          type="range"
          min={0}
          max={seq - 1}
          value={p}
          onChange={(e) => setPos(Number(e.target.value))}
        />
        <span className="text-slate-200">
          {p}: {tok.label(trace.tokenIds[p])}
        </span>
      </label>
      <Heatmap matrix={matrix} title="residual stream across stages (rows) × d_model (cols)" rowLabels={stages.map((s) => s.label)} maxCell={14} />
    </div>
  )
}
