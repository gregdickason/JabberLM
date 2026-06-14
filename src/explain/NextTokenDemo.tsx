import { useMemo, useState } from 'react'
import type { Trainer } from '../engine/trainer'
import { DEFAULT_FEATURE_FLAGS } from '../engine/config'
import BarChart from '../viz/BarChart'
import { btn, card } from './ui'

// "It predicts the next piece of text." Shows the model's probability for each
// possible next character given what's typed so far, and lets you let it write.
export default function NextTokenDemo({ trainer }: { trainer: Trainer }) {
  const { model, tok } = trainer
  const [text, setText] = useState("'Twas brillig, and the ")

  const dist = useMemo(() => {
    let ids = tok.encode(text)
    if (ids.length === 0) ids = [0]
    const window = ids.slice(Math.max(0, ids.length - model.cfg.contextLen))
    const { trace } = model.forward(window, DEFAULT_FEATURE_FLAGS, undefined, true)
    const vocab = trace!.probs.cols
    const row = Array.from(trace!.probs.data.subarray((trace!.probs.rows - 1) * vocab, trace!.probs.rows * vocab))
    let best = 0
    for (let i = 1; i < row.length; i++) if (row[i] > row[best]) best = i
    return { probs: row, best }
  }, [text, model, tok])

  const labels = tok.itos.map((_, id) => tok.label(id))

  function writeOne() {
    setText((t) => t + tok.itos[dist.best])
  }
  function writeMany() {
    let ids = tok.encode(text)
    if (ids.length === 0) ids = [0]
    let out = ''
    for (let s = 0; s < 24; s++) {
      const window = ids.slice(Math.max(0, ids.length - model.cfg.contextLen))
      const { trace } = model.forward(window, DEFAULT_FEATURE_FLAGS, undefined, true)
      const vocab = trace!.probs.cols
      const base = (trace!.probs.rows - 1) * vocab
      let best = 0
      for (let i = 1; i < vocab; i++) if (trace!.probs.data[base + i] > trace!.probs.data[base + best]) best = i
      out += tok.itos[best]
      ids.push(best)
    }
    setText((t) => t + out)
  }

  return (
    <div className={card}>
      <div className="mb-2 text-[11px] text-slate-400">
        Type some text; the bars show how likely the model thinks each next character is.
      </div>
      <textarea
        className="h-16 w-full resize-y rounded border border-slate-700 bg-slate-800 p-2 text-[12px] text-slate-100"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-2 mb-3 flex gap-2">
        <button className={btn} onClick={writeOne}>
          Write the next character →
        </button>
        <button className={btn} onClick={writeMany}>
          Let it write a bit
        </button>
      </div>
      <div className="text-[11px] text-slate-400">
        most likely next character: <span className="text-fuchsia-300">“{tok.label(dist.best)}”</span>
      </div>
      <div className="mt-1 max-w-sm">
        <BarChart values={dist.probs} labels={labels} highlight={dist.best} max={1} maxBars={12} />
      </div>
    </div>
  )
}
