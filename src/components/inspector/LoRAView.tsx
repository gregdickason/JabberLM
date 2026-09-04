import type { Trace } from '../../engine/trace'
import Heatmap from '../../viz/Heatmap'

// The LoRA overlay for one layer: each adapted matrix W keeps a frozen base and
// learns a low-rank update ΔW = A·B (applied scaled by α/r). A starts random and
// B starts at zero, so ΔW is all-zero until fine-tuning moves it — watch it grow.
export default function LoRAView({ trace, layer }: { trace: Trace; layer: number }) {
  const lt = trace.layers[layer]
  if (!lt?.lora || lt.lora.length === 0) {
    return (
      <div className="rounded border border-dashed border-slate-700 p-4 text-center text-[11px] text-slate-400">
        No LoRA adapters on this layer. Start fine-tuning in the Training panel to attach them.
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <p className="text-[11px] text-slate-400">
        Layer {layer}: each adapted weight learns <span className="text-fuchsia-300">ΔW = A·B</span>{' '}
        (low rank), added to the frozen base as <span className="text-slate-200">W + (α/r)·A·B</span>.
        B starts at zero, so ΔW is blank until you train — then it fills in.
      </p>
      {lt.lora.map((ad) => (
        <div key={ad.label}>
          <div className="mb-1 text-[11px] font-semibold text-fuchsia-200">{ad.label}</div>
          <div className="flex flex-wrap items-start gap-4">
            <Heatmap matrix={ad.A} title={`A (in × r = ${ad.A.rows}×${ad.A.cols})`} scale="diverging" />
            <Heatmap matrix={ad.B} title={`B (r × out = ${ad.B.rows}×${ad.B.cols})`} scale="diverging" />
            <Heatmap
              matrix={ad.dW}
              title={`ΔW = A·B (${ad.dW.rows}×${ad.dW.cols})`}
              scale="diverging"
              maxCell={8}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
