import type { CharTokenizer } from '../../engine/tokenizer'
import type { Trace } from '../../engine/trace'

// Shows the current context as char→id chips, plus the full vocabulary. This is
// step one of the pipeline: text becomes a sequence of integer token ids.
export default function TokenizerView({ trace, tok }: { trace: Trace; tok: CharTokenizer }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {trace.tokenIds.map((id, i) => (
          <div
            key={i}
            className="flex flex-col items-center rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5"
          >
            <span className="text-xs text-slate-100">{tok.label(id)}</span>
            <span className="text-[9px] text-slate-500">{id}</span>
          </div>
        ))}
      </div>
      <details className="text-[11px] text-slate-400">
        <summary className="cursor-pointer">vocabulary ({tok.vocabSize} chars)</summary>
        <div className="mt-1 flex flex-wrap gap-1">
          {tok.itos.map((_, id) => (
            <span key={id} className="rounded bg-slate-800 px-1 text-slate-300">
              {id}:{tok.label(id)}
            </span>
          ))}
        </div>
      </details>
    </div>
  )
}
