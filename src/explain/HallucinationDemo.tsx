import { useState } from 'react'
import type { Trainer } from '../engine/trainer'
import { DEFAULT_FEATURE_FLAGS, DEFAULT_SAMPLE_CONFIG } from '../engine/config'
import { generate } from '../engine/generate'
import { RNG } from '../engine/random'
import { btn, card } from './ui'

// "Why it makes things up." The model always produces fluent-looking text — even
// when it has nothing real to say. That confident-but-empty output is
// hallucination in miniature.
export default function HallucinationDemo({ trainer }: { trainer: Trainer }) {
  const { model, tok } = trainer
  const [prompt, setPrompt] = useState('the contract states that ')
  const [out, setOut] = useState('')
  const rng = new RNG(7)

  function go() {
    const cfg = { ...DEFAULT_SAMPLE_CONFIG, temperature: 0.9, maxNewTokens: 110 }
    setOut(generate(model, DEFAULT_FEATURE_FLAGS, tok, prompt, cfg, rng))
  }

  return (
    <div className={card}>
      <div className="mb-2 text-[11px] text-slate-400">
        Ask this tiny model (which only ever saw one poem) to continue something it knows nothing about.
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[12px] text-slate-100"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <button className={btn} onClick={go}>
          Continue it
        </button>
      </div>
      {out && (
        <pre className="mt-2 h-24 overflow-y-auto whitespace-pre-wrap rounded bg-slate-800 p-2 text-[11px] text-amber-200">
          {out}
        </pre>
      )}
      <div className="mt-2 text-[11px] text-slate-500">
        It produces something that <em>looks</em> like writing but means nothing — it has no facts to
        draw on, so it fills the gap with plausible-shaped text. Large models do the same thing far more
        convincingly, which is exactly why a fluent answer is not evidence of a correct one.
      </div>
    </div>
  )
}
