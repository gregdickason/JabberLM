import { useRef, useState } from 'react'
import type { Trainer } from '../engine/trainer'
import { DEFAULT_FEATURE_FLAGS, DEFAULT_SAMPLE_CONFIG } from '../engine/config'
import { generate } from '../engine/generate'
import { RNG } from '../engine/random'
import { btn, card } from './ui'

const PROMPT = "'Twas brillig, and the "

// "Why the same prompt gives different answers." Run A is always temperature 0
// (the single most-likely continuation — identical every time). Run B uses your
// temperature with a fresh random seed each click, so you watch it change.
export default function RandomnessDemo({ trainer }: { trainer: Trainer }) {
  const { model, tok } = trainer
  const [temp, setTemp] = useState(1)
  const [runs, setRuns] = useState<{ a: string; b: string } | null>(null)
  const [tick, setTick] = useState(0) // increments each generate (drives colour + seed)
  const seedRef = useRef(1000)

  function go() {
    const base = { ...DEFAULT_SAMPLE_CONFIG, maxNewTokens: 90 }
    const a = generate(model, DEFAULT_FEATURE_FLAGS, tok, PROMPT, { ...base, temperature: 0 }, new RNG(1))
    const b = generate(model, DEFAULT_FEATURE_FLAGS, tok, PROMPT, { ...base, temperature: temp }, new RNG(seedRef.current++))
    setRuns({ a, b })
    setTick((t) => t + 1)
  }

  // alternate Run B's accent each click so an update is unmistakable
  const flash = tick % 2 === 1
  const bAccent = flash ? 'border-fuchsia-500 text-fuchsia-200' : 'border-emerald-500 text-emerald-200'

  return (
    <div className={card}>
      <div className="mb-2 text-[11px] text-slate-400">
        Same starting text every time. Drag the dial, then click Generate a few times.
      </div>
      <label className="flex items-center gap-2 text-[12px] text-slate-300">
        randomness (temperature)
        <input
          type="range"
          min={0}
          max={1.2}
          step={0.1}
          value={temp}
          onChange={(e) => setTemp(Number(e.target.value))}
          className="flex-1"
        />
        <span className="w-8 text-right text-slate-200">{temp.toFixed(1)}</span>
      </label>
      <button className={btn + ' mt-2'} onClick={go}>
        Generate {runs ? `(again — run ${tick + 1})` : 'two runs'}
      </button>
      {runs && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <div className="mb-1 text-[11px] text-slate-400">Run A · temperature 0 (always the same)</div>
            <pre className="h-24 overflow-y-auto whitespace-pre-wrap rounded border border-slate-700 bg-slate-800 p-2 text-[11px] text-slate-200">
              {runs.a}
            </pre>
          </div>
          <div>
            <div className="mb-1 text-[11px] text-slate-400">
              Run B · temperature {temp.toFixed(1)} (your setting) · run {tick}
            </div>
            <pre className={'h-24 overflow-y-auto whitespace-pre-wrap rounded border-2 bg-slate-800 p-2 text-[11px] ' + bAccent}>
              {runs.b}
            </pre>
          </div>
        </div>
      )}
      {runs && (
        <div className="mt-2 text-[11px] text-slate-500">
          {temp <= 0.001
            ? 'At temperature 0, Run B matches Run A and never changes — it always takes the single most likely next character. Raise the dial and click again.'
            : 'Run A never changes; Run B is different on every click — same prompt, different answer. That is temperature at work.'}
        </div>
      )}
    </div>
  )
}
