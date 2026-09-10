import { useEffect, useState } from 'react'
import type { Trainer } from '../engine/trainer'
import { DEFAULT_FEATURE_FLAGS } from '../engine/config'
import { deserialize, type SavedModel } from '../engine/persist'
import { generate } from '../engine/generate'
import { RNG } from '../engine/random'
import { BUNDLES } from '../data/modelStats'
import { btn, card } from './ui'
import { paramString } from '../lib/urlParams'

/**
 * The step nobody tells you about: why a model *answers* instead of carrying on typing.
 *
 * This is not a mock-up and not an analogy. Two models ship with this site that are the same
 * architecture and within a few thousand parameters of each other. One was trained on plain
 * text, so it continues text. The other was trained on pairs of instruction and response, so
 * it responds. Send the same words to both and the difference is the entire lesson: answering
 * is a trained behaviour, not something a language model does naturally.
 *
 * At real scale the same step is called instruction tuning or supervised fine-tuning, and it is
 * what separates a raw base model from the assistant you actually talk to.
 */

const EXAMPLES = ['total of 6 9 2', 'biggest of 4 1 7', 'put 6 9 2 in order']

// Greedy (temperature 0) so the contrast is the training data, not the dice. Both models run
// straight past the end of their answer into the next line of their training text, which is
// itself the lesson — neither knows it has finished — so we cut at the first newline.
function run(trainer: Trainer, prompt: string, maxNewTokens = 28): string {
  const out = generate(
    trainer.model,
    DEFAULT_FEATURE_FLAGS,
    trainer.tok,
    prompt,
    { temperature: 0, topK: null, topP: null, maxNewTokens },
    new RNG(1),
  )
  return out.split('\n')[0]
}

export default function InstructionDemo({ base }: { base: Trainer }) {
  const [tuned, setTuned] = useState<Trainer | null>(null)
  const [prompt, setPrompt] = useState(() => paramString(location.search, 'prompt', EXAMPLES[0]))
  const [out, setOut] = useState<{ base: string; tuned: string } | null>(null)
  const [status, setStatus] = useState('loading the instruction-tuned model…')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(import.meta.env.BASE_URL + 'harness-model.json')
        if (!res.ok) throw new Error('fetch failed')
        const t = deserialize((await res.json()) as SavedModel)
        if (!cancelled) {
          setTuned(t)
          setStatus('')
        }
      } catch {
        if (!cancelled) setStatus('could not load the second model — try a reload')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function go(p: string) {
    if (!tuned) return
    setPrompt(p)
    // The base model has never seen these words as an instruction; it just carries on.
    setOut({ base: run(base, p), tuned: run(tuned, p) })
  }

  return (
    <div className={card}>
      <div className="mb-2 text-[11px] text-slate-400">
        The same words, sent to two models of almost exactly the same size. One read plain text
        while it trained. The other read instructions paired with the response that should follow.
      </div>

      <div className="mb-2 flex flex-wrap gap-1">
        {EXAMPLES.map((e) => (
          <button
            key={e}
            onClick={() => go(e)}
            disabled={!tuned}
            className="rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-[11px] text-slate-200 hover:bg-slate-700 disabled:opacity-40"
          >
            {e}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 font-mono text-[12px] text-slate-100"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <button onClick={() => go(prompt)} disabled={!tuned} className={btn}>
          Send to both
        </button>
      </div>

      {status && <p className="mt-2 text-[11px] text-amber-400">{status}</p>}

      {out && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded border border-rose-900/60 bg-rose-950/20 p-2">
            <div className="text-[11px] font-semibold text-rose-300">
              trained on plain text ({BUNDLES.multitask.paramsLabel})
            </div>
            <div className="mt-1 font-mono text-[12px] text-slate-300">
              <span className="text-slate-500">{prompt}</span>
              <span className="text-rose-200">{out.base || '…'}</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              It carries on writing, in the shape of the text it grew up on. Ask it for a total
              and it may hand you a sorted list instead — fluently, and without noticing. It is
              not being unhelpful. Continuing text is the only thing it was ever asked to do.
            </div>
          </div>
          <div className="rounded border border-emerald-900/60 bg-emerald-950/20 p-2">
            <div className="text-[11px] font-semibold text-emerald-300">
              trained on instruction → response ({BUNDLES.harness.paramsLabel})
            </div>
            <div className="mt-1 font-mono text-[12px] text-slate-300">
              <span className="text-slate-500">{prompt}</span>
              <span className="text-emerald-200">{out.tuned || '…'}</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              It answers, in the shape it was shown. Same architecture, same scale — the
              training data is the whole difference.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
