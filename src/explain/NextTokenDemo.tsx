import { useMemo, useRef, useState } from 'react'
import type { Trainer } from '../engine/trainer'
import { DEFAULT_FEATURE_FLAGS } from '../engine/config'
import { generate } from '../engine/generate'
import { RNG } from '../engine/random'
import BarChart from '../viz/BarChart'
import { btn, card } from './ui'
import { paramString } from '../lib/urlParams'
import { repeatingTail } from '../lib/repetition'

// "It predicts the next piece of text." Shows the model's probability for each
// possible next character given what's typed so far, and lets it carry on writing.
//
// Two ways of carrying on, deliberately, because the difference between them is the
// whole of the next section. Always taking the tallest bar is the honest reading of
// "most likely next character" — and it walks into a repeating groove, every time,
// on any model. That groove is not this model being small or undertrained: the same
// weights write perfectly good verse the moment the choice stops being deterministic.

const RUN_CHARS = 90

export default function NextTokenDemo({ trainer }: { trainer: Trainer }) {
  const { model, tok } = trainer
  const [text, setText] = useState(() =>
    paramString(location.search, 'prompt', "'Twas brillig, and the "),
  )
  // What produced the text currently on screen, so the note below can explain it.
  const [mode, setMode] = useState<'greedy' | 'sampled' | null>(null)
  const rngRef = useRef(new RNG(2024))

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
    setMode(null)
  }

  // temperature 0 = always the tallest bar; 0.8 = choose in proportion to the bars
  function writeMany(sampled: boolean) {
    const out = generate(
      model,
      DEFAULT_FEATURE_FLAGS,
      tok,
      text,
      { temperature: sampled ? 0.8 : 0, topK: null, topP: null, maxNewTokens: RUN_CHARS },
      sampled ? rngRef.current : new RNG(1),
    )
    setText((t) => t + out)
    setMode(sampled ? 'sampled' : 'greedy')
  }

  const groove = mode === 'greedy' ? repeatingTail(text) : null

  return (
    <div className={card}>
      <div className="mb-2 text-[11px] text-slate-400">
        Type some text; the bars show how likely the model thinks each next character is.
      </div>
      <textarea
        className="h-20 w-full resize-y rounded border border-slate-700 bg-slate-800 p-2 text-[12px] text-slate-100"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setMode(null)
        }}
      />
      <div className="mt-2 mb-2 flex flex-wrap gap-2">
        <button className={btn} onClick={writeOne}>
          Write the next character →
        </button>
        <button className={btn} onClick={() => writeMany(false)}>
          Keep taking the top bar
        </button>
        <button className={btn} onClick={() => writeMany(true)}>
          Choose in proportion instead
        </button>
      </div>

      {mode === 'greedy' && (
        <div className="mb-3 rounded border border-amber-900/60 bg-amber-950/20 p-2 text-[11px] leading-relaxed text-slate-300">
          {groove ? (
            <>
              It has fallen into a groove, repeating{' '}
              <span className="font-mono text-amber-200">“{groove}”</span> over and over.
            </>
          ) : (
            <>That was written by taking the tallest bar every single time.</>
          )}{' '}
          <b>This is not the model being small or badly trained.</b> Taking the most likely
          character every time is deterministic, so once the text wanders into a state it has seen
          before, it must produce the same continuation it did last time — and it is then in a
          loop it cannot leave. Every language model does this when decoded this way. Press{' '}
          <em>Choose in proportion instead</em> and watch the same weights write properly. That
          choice is what the next section is about.
        </div>
      )}
      {mode === 'sampled' && (
        <div className="mb-3 rounded border border-emerald-900/60 bg-emerald-950/20 p-2 text-[11px] leading-relaxed text-slate-300">
          Same model, same bars — but each character was picked <em>in proportion</em> to its bar
          rather than always taking the tallest. Press it again for a different result, and see{' '}
          <a className="text-sky-400 hover:underline" href="?section=randomness">
            the next section
          </a>{' '}
          for the dial that controls how adventurous this is.
        </div>
      )}

      <div className="text-[11px] text-slate-400">
        most likely next character: <span className="text-fuchsia-300">“{tok.label(dist.best)}”</span>
      </div>
      <div className="mt-1 max-w-sm">
        <BarChart values={dist.probs} labels={labels} highlight={dist.best} max={1} maxBars={12} />
      </div>
    </div>
  )
}
