import { useEffect, useState } from 'react'
import { card } from './ui'

// Real GPT-3.5/GPT-4 (cl100k_base) token splits, precomputed offline with tiktoken →
// public/bpe-examples.json. JabberLM is char-level, so we contrast "one token per letter"
// (what this site's model sees) against "subword chunks" (what real LLMs see) — and why
// that makes real models stumble on letter- and digit-level tasks.
type BpeData = { encoding: string; model: string; source: string; examples: Record<string, string[]> }

const show = (s: string) => (s === ' ' ? '␣' : s.replace(/ /g, '␣')) // visible spaces

function Chip({ text, tone }: { text: string; tone: 'char' | 'bpe' }) {
  const c = tone === 'char' ? 'border-sky-800 bg-sky-950/50 text-sky-200' : 'border-violet-800 bg-violet-950/50 text-violet-200'
  return <span className={'rounded border px-1.5 py-0.5 font-mono text-[12px] ' + c}>{show(text)}</span>
}

export default function TokenizationDemo() {
  const [data, setData] = useState<BpeData | null>(null)
  const [word, setWord] = useState('strawberry')
  const [status, setStatus] = useState('loading…')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(import.meta.env.BASE_URL + 'bpe-examples.json')
        if (!res.ok) throw new Error()
        if (!cancelled) setData((await res.json()) as BpeData)
      } catch {
        if (!cancelled) setStatus('could not load token examples')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!data) return <div className={card + ' text-xs text-slate-500'}>{status}</div>

  const words = Object.keys(data.examples)
  const bpe = data.examples[word] ?? []
  const chars = [...word]

  return (
    <div className={card}>
      <div className="mb-2 flex flex-wrap gap-1">
        {words.map((w) => (
          <button
            key={w}
            onClick={() => setWord(w)}
            className={
              'rounded px-1.5 py-0.5 font-mono text-[10px] ' +
              (word === w ? 'bg-fuchsia-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700')
            }
          >
            {show(w)}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded border border-sky-900/50 bg-slate-900/40 p-2">
          <div className="mb-1.5 text-[11px] text-sky-300">
            JabberLM sees it (character-level) — <b>{chars.length}</b> tokens
          </div>
          <div className="flex flex-wrap gap-1">
            {chars.map((c, i) => (
              <Chip key={i} text={c} tone="char" />
            ))}
          </div>
          <div className="mt-1.5 text-[10px] text-slate-500">every letter is its own token</div>
        </div>

        <div className="rounded border border-violet-900/50 bg-slate-900/40 p-2">
          <div className="mb-1.5 text-[11px] text-violet-300">
            {data.model} sees it (subword / BPE) — <b>{bpe.length}</b> token{bpe.length === 1 ? '' : 's'}
          </div>
          <div className="flex flex-wrap gap-1">
            {bpe.map((t, i) => (
              <Chip key={i} text={t} tone="bpe" />
            ))}
          </div>
          <div className="mt-1.5 text-[10px] text-slate-500">whole chunks — it can't see the letters inside</div>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        These are the <b>real</b> tokens from OpenAI's <span className="font-mono">{data.encoding}</span>{' '}
        tokenizer (the one behind {data.model}). It's <em>why</em> big models famously miss "how many r's in{' '}
        <span className="font-mono">strawberry</span>?" — the model sees{' '}
        <span className="font-mono text-violet-300">[str][aw][berry]</span>, not ten letters, so it's{' '}
        <em>guessing</em> at a spelling it never really sees. Same reason multi-digit arithmetic and
        reversing a string are hard: the pieces don't line up with characters. This site's char-level model
        is the opposite — it sees every letter, so it <b>can</b> count and reverse (try the{' '}
        <a className="text-sky-400 underline" href="./lab.html">lab</a>), but pays for it with a tiny
        vocabulary that couldn't scale to real language.
      </p>
    </div>
  )
}
