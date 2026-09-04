import { useEffect, useMemo, useState } from 'react'
import { loadWordVectors, cosine, embedText, type WordVectors } from './embeddings'
import { card } from './ui'

// A tiny "knowledge base" the model was NOT trained on — the point of RAG is that
// the facts live in these documents, retrieved at query time, not baked into weights.
type Doc = { key: string; title: string; text: string }
const DOCS: Doc[] = [
  {
    key: 'royalty',
    title: 'Royalty',
    text: 'The king and queen rule the kingdom from a great castle. The prince and princess are the royal children who will one day take the throne.',
  },
  {
    key: 'beasts',
    title: 'Beasts',
    text: 'The lion and the tiger are wild beasts. The wolf and the bear hunt in the forest, while the eagle flies above. Even a dragon is said to sleep in the mountains.',
  },
  {
    key: 'the-sea',
    title: 'The Sea',
    text: 'The ocean and the sea are full of water. Fish and whales and sharks swim in the deep, and rivers run down to the coast.',
  },
  {
    key: 'war',
    title: 'War',
    text: 'The army marched to war. Soldiers carried a sword and a shield into the battle to fight for peace.',
  },
  {
    key: 'cities',
    title: 'Cities',
    text: 'Paris is a city in France. London, Rome and Tokyo are great cities where many people live and work.',
  },
  {
    key: 'music',
    title: 'Music',
    text: 'Music is made of songs. A guitar, a piano and a drum play together in a band.',
  },
]

const EXAMPLES = [
  'who rules the kingdom',
  'wild animals in the forest',
  'creatures of the ocean',
  'fighting a battle with swords',
  'a famous city in europe',
  'playing a guitar and piano',
]

type Ranked = { doc: Doc; sim: number }

export default function RagDemo() {
  const [wv, setWv] = useState<WordVectors | null>(null)
  const [status, setStatus] = useState('loading…')
  const [mode, setMode] = useState<'lookup' | 'semantic'>('semantic')
  const [query, setQuery] = useState('creatures of the ocean')
  const [pickedKey, setPickedKey] = useState('the-sea')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const v = await loadWordVectors()
      if (cancelled) return
      if (v) setWv(v)
      else setStatus('could not load word vectors')
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // precompute each document's meaning vector once
  const docVecs = useMemo(() => {
    if (!wv) return null
    return DOCS.map((d) => ({ doc: d, vec: embedText(wv, d.text).vec }))
  }, [wv])

  const search = useMemo(() => {
    if (!wv || !docVecs) return null
    const { vec, used, skipped } = embedText(wv, query)
    if (!vec) return { ranked: [] as Ranked[], used, skipped }
    const ranked: Ranked[] = docVecs
      .filter((d) => d.vec)
      .map((d) => ({ doc: d.doc, sim: cosine(vec, d.vec as number[]) }))
      .sort((a, b) => b.sim - a.sim)
    return { ranked, used, skipped }
  }, [wv, docVecs, query])

  if (!wv) return <div className={card + ' text-xs text-slate-400'}>{status}</div>

  const retrieved =
    mode === 'lookup'
      ? DOCS.find((d) => d.key === pickedKey) ?? null
      : (search?.ranked[0]?.doc ?? null)

  const tab = (m: 'lookup' | 'semantic', label: string) => (
    <button
      onClick={() => setMode(m)}
      className={
        'rounded px-2 py-1 text-[11px] ' +
        (mode === m ? 'bg-fuchsia-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700')
      }
    >
      {label}
    </button>
  )

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {tab('semantic', 'Search by meaning')}
        {tab('lookup', 'Look up by name')}
      </div>

      {mode === 'lookup' ? (
        <div className={card}>
          <div className="text-[11px] text-slate-400">
            The simplest retrieval: you know the document's <em>name</em>, so you fetch it directly.
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {DOCS.map((d) => (
              <button
                key={d.key}
                onClick={() => setPickedKey(d.key)}
                className={
                  'rounded px-1.5 py-0.5 text-[11px] ' +
                  (pickedKey === d.key ? 'bg-sky-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700')
                }
              >
                {d.title}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className={card}>
          <div className="text-[11px] text-slate-400">
            You <em>don't</em> know the name — you describe what you want, in your own words. The query is
            turned into a meaning-vector (as above) and compared to every document.
          </div>
          <input
            className="mt-2 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-100 focus:border-fuchsia-500 focus:outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            spellCheck={false}
            placeholder="describe what you're looking for…"
          />
          <div className="mt-1.5 flex flex-wrap gap-1">
            {EXAMPLES.map((q) => (
              <button
                key={q}
                onClick={() => setQuery(q)}
                className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-300 hover:bg-slate-700"
              >
                {q}
              </button>
            ))}
          </div>
          {search && (
            <div className="mt-2 text-[11px] text-slate-400">
              matched on:{' '}
              {search.used.length ? (
                <span className="text-slate-300">{search.used.join(', ')}</span>
              ) : (
                <span className="text-amber-400">no known words</span>
              )}
              {search.skipped.length > 0 && (
                <>
                  {' · '}skipped (not in vocabulary):{' '}
                  <span className="text-slate-400">{search.skipped.join(', ')}</span>
                </>
              )}
            </div>
          )}
          {search && search.ranked.length > 0 && (
            <div className="mt-2 space-y-1">
              {search.ranked.map((r, i) => (
                <div key={r.doc.key} className="flex items-center gap-2 text-[11px]">
                  <span className={'w-16 shrink-0 font-mono ' + (i === 0 ? 'text-fuchsia-300' : 'text-slate-400')}>
                    {r.doc.title}
                  </span>
                  <div className="h-1.5 w-full rounded bg-slate-800">
                    <div
                      className={'h-full rounded ' + (i === 0 ? 'bg-fuchsia-500' : 'bg-slate-600')}
                      style={{ width: `${Math.max(0, Math.min(1, r.sim)) * 100}%` }}
                    />
                  </div>
                  <span className="w-9 shrink-0 text-right font-mono text-slate-400">{r.sim.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* retrieved passage → injected into context → grounded answer */}
      {retrieved && (
        <div className="rounded-lg border border-emerald-900 bg-emerald-950/30 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-400">
            ① retrieved passage → ② pasted into the model's context → ③ answer grounded in it
          </div>
          <p className="mt-2 rounded bg-slate-900/60 p-2 font-mono text-[11px] leading-relaxed text-slate-200">
            {retrieved.text}
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-emerald-100/80">
            The model now answers from <strong>this text</strong>, not from its (fallible) memory — so it can
            be right about things it was never trained on, and you can point to the source. That is all RAG is:
            <em> retrieve the relevant text, put it in the context, then answer.</em>
          </p>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-slate-400">
        Two ways to find the passage: exact <strong>lookup</strong> when you know the name, or{' '}
        <strong>semantic search</strong> when you only know the meaning (reusing the very same word vectors as
        above). Real systems index millions of chunks this way. It's the honest fix for “it makes things up”:
        <strong> knowledge you retrieve; skill you distil</strong> — you can't cram a private handbook into the
        weights, but you can hand the model the right page at the right moment.
      </p>
    </div>
  )
}
