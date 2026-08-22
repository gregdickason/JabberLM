import { useEffect, useMemo, useState } from 'react'
import { loadWordVectors, nearest, analogy, type WordVectors } from './embeddings'
import { pca2 } from '../interp/pca'
import Scatter from '../viz/Scatter'
import { card } from './ui'

// Words to offer as quick-picks / analogy presets — all confirmed in the bundled subset.
const PICKS = ['king', 'queen', 'paris', 'dog', 'ocean', 'music', 'computer', 'war']
const ANALOGIES: [string, string, string, string][] = [
  ['king', 'man', 'woman', 'queen'],
  ['paris', 'france', 'japan', 'tokyo'],
  ['bigger', 'big', 'small', 'smaller'],
]

function Bar({ sim }: { sim: number }) {
  // cosine runs roughly 0..1 for related words; clamp for the bar width
  const w = Math.max(0, Math.min(1, sim)) * 100
  return (
    <div className="h-1.5 w-full rounded bg-slate-800">
      <div className="h-full rounded bg-fuchsia-500" style={{ width: `${w}%` }} />
    </div>
  )
}

export default function EmbeddingsDemo() {
  const [wv, setWv] = useState<WordVectors | null>(null)
  const [status, setStatus] = useState('loading real word vectors…')
  const [word, setWord] = useState('king')
  const [ana, setAna] = useState<[string, string, string]>(['king', 'man', 'woman'])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const v = await loadWordVectors()
      if (cancelled) return
      if (v) setWv(v)
      else setStatus('could not load word vectors (public/word-vectors.json)')
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const known = wv ? word in wv.vectors : false
  const neighbours = useMemo(() => (wv && known ? nearest(wv, word, 8) : []), [wv, word, known])

  // 2-D map: project the query + its neighbours so "close in meaning → close on the map" is visible.
  const map = useMemo(() => {
    if (!wv || !neighbours.length) return null
    const words = [word, ...neighbours.map((n) => n.word)]
    const pts = pca2(words.map((w) => wv.vectors[w]))
    const colors = words.map((_, i) => (i === 0 ? '#f472b6' : '#38bdf8')) // query pink, rest blue
    return { words, pts, colors }
  }, [wv, neighbours, word])

  const anaResult = useMemo(() => {
    if (!wv) return []
    const [a, b, c] = ana
    return analogy(wv, a, b, c, 3)
  }, [wv, ana])

  if (!wv) return <div className={card + ' text-xs text-slate-500'}>{status}</div>

  const inputCls =
    'rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-100 focus:border-fuchsia-500 focus:outline-none'

  return (
    <div className="mt-3 space-y-4">
      <datalist id="wordlist">
        {Object.keys(wv.vectors).map((w) => (
          <option key={w} value={w} />
        ))}
      </datalist>

      {/* nearest-neighbour search */}
      <div className={card}>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400">nearest in meaning to</span>
          <input
            list="wordlist"
            className={inputCls}
            value={word}
            onChange={(e) => setWord(e.target.value.trim().toLowerCase())}
            spellCheck={false}
          />
          {!known && <span className="text-amber-400">not in this small vocabulary — try another</span>}
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {PICKS.map((w) => (
            <button
              key={w}
              onClick={() => setWord(w)}
              className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700"
            >
              {w}
            </button>
          ))}
        </div>

        {known && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              {neighbours.map((n) => (
                <div key={n.word} className="flex items-center gap-2 text-[11px]">
                  <span className="w-20 shrink-0 font-mono text-slate-200">{n.word}</span>
                  <Bar sim={n.sim} />
                  <span className="w-9 shrink-0 text-right font-mono text-slate-500">
                    {n.sim.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            {map && (
              <div>
                <Scatter points={map.pts} labels={map.words} colors={map.colors} width={280} height={180} />
                <p className="mt-1 text-[10px] text-slate-500">
                  the same words on a 2-D map (their 50 numbers squashed to 2) —{' '}
                  <span className="text-fuchsia-300">{word}</span> and its neighbours land close together
                </p>
              </div>
            )}
          </div>
        )}
        {!known && (
          <div className="mt-3 rounded border border-dashed border-slate-700 p-3 text-[11px] text-slate-500">
            This 1,429-word demo set doesn't include “{word || '…'}”. Pick one of the words above to see its
            nearest neighbours and 2-D map.
          </div>
        )}
      </div>

      {/* analogy */}
      <div className={card}>
        <div className="text-xs text-slate-400">
          Because meaning is stored as direction, you can do <em>arithmetic</em> on words:
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-xs">
          <input
            list="wordlist"
            className={inputCls + ' w-24'}
            value={ana[0]}
            onChange={(e) => setAna([e.target.value.trim().toLowerCase(), ana[1], ana[2]])}
            spellCheck={false}
          />
          <span className="text-slate-500">−</span>
          <input
            list="wordlist"
            className={inputCls + ' w-24'}
            value={ana[1]}
            onChange={(e) => setAna([ana[0], e.target.value.trim().toLowerCase(), ana[2]])}
            spellCheck={false}
          />
          <span className="text-slate-500">+</span>
          <input
            list="wordlist"
            className={inputCls + ' w-24'}
            value={ana[2]}
            onChange={(e) => setAna([ana[0], ana[1], e.target.value.trim().toLowerCase()])}
            spellCheck={false}
          />
          <span className="text-slate-500">≈</span>
          {anaResult.length ? (
            <span className="rounded bg-fuchsia-900/50 px-2 py-1 text-fuchsia-200">
              {anaResult[0].word}{' '}
              <span className="text-fuchsia-400/70">({anaResult[0].sim.toFixed(2)})</span>
            </span>
          ) : (
            <span className="text-amber-400">one of those words isn't in the vocabulary</span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {ANALOGIES.map(([a, b, c, expect]) => (
            <button
              key={a + b + c}
              onClick={() => setAna([a, b, c])}
              className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700"
            >
              {a} − {b} + {c} → {expect}
            </button>
          ))}
        </div>
        {anaResult.length > 1 && (
          <div className="mt-2 text-[10px] text-slate-500">
            runners-up: {anaResult.slice(1).map((r) => `${r.word} (${r.sim.toFixed(2)})`).join(', ')}
          </div>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-slate-500">
        These are <strong>real, pre-trained embeddings</strong> (a small slice of{' '}
        <a className="text-sky-400 underline" href="https://nlp.stanford.edu/projects/glove/" target="_blank" rel="noopener noreferrer">
          GloVe
        </a>
        , 1,429 words × 50 numbers each), learned from co-occurrence across billions of words of text.
        JabberLM's own model builds the same kind of space in miniature — watch its digit tokens organise
        into a <a className="text-sky-400 underline" href="./lab.html?tab=advanced-grokking">number line</a> as
        it learns to sort.
      </p>
    </div>
  )
}
