import { useMemo, useState } from 'react'
import type { Trainer } from '../engine/trainer'
import { DEFAULT_FEATURE_FLAGS } from '../engine/config'
import { card } from './ui'

// "What 'context' is and why it forgets." Highlights which earlier characters the
// model leaned on (attention) when predicting the next one.
export default function ContextDemo({ trainer }: { trainer: Trainer }) {
  const { model, tok } = trainer
  const [text, setText] = useState('the slithy toves did gyre and ')

  const view = useMemo(() => {
    let ids = tok.encode(text)
    if (ids.length === 0) ids = [0]
    const window = ids.slice(Math.max(0, ids.length - model.cfg.contextLen))
    const { trace } = model.forward(window, DEFAULT_FEATURE_FLAGS, undefined, true)
    const seq = window.length
    const last = seq - 1
    const w = new Float64Array(seq)
    let heads = 0
    for (const layer of trace!.layers)
      for (const head of layer.heads) {
        const a = head.attn.data
        for (let j = 0; j < seq; j++) w[j] += a[last * seq + j]
        heads++
      }
    let max = 0
    for (let j = 0; j < seq; j++) {
      w[j] /= heads || 1
      if (w[j] > max) max = w[j]
    }
    return {
      chars: window.map((id) => tok.label(id)),
      weights: Array.from(w, (x) => (max > 0 ? x / max : 0)),
    }
  }, [text, model, tok])

  return (
    <div className={card}>
      <div className="mb-2 text-[11px] text-slate-400">
        Type a sentence. Brighter characters are the ones the model "paid attention to" when choosing
        what comes next.
      </div>
      <input
        className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[12px] text-slate-100"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-3 flex flex-wrap gap-px">
        {view.chars.map((c, i) => (
          <span
            key={i}
            className="rounded px-0.5 text-[13px] text-slate-100"
            style={{ backgroundColor: `rgba(232,121,249,${view.weights[i].toFixed(3)})` }}
          >
            {c}
          </span>
        ))}
      </div>
      <div className="mt-3 text-[11px] text-slate-500">
        This model can only look at the last {model.cfg.contextLen} characters — its "context window".
        Real models have far larger windows, but the limit is the same idea: text beyond it is simply
        not seen.
      </div>
    </div>
  )
}
