import { useState } from 'react'
import { answer, QUERIES, TRIPLES, type Triple } from './graph'
import { card } from './ui'

// A compact node-link view of the hand-authored knowledge graph. Pick a question and the
// exact relations walked to answer it light up — including multi-hop chains that flat
// chunk-retrieval can't compose.
const POS: Record<string, [number, number]> = {
  kingdom: [70, 48],
  king: [180, 60],
  prince: [180, 140],
  princess: [70, 165],
  castle: [290, 100],
  forest: [375, 58],
  lion: [460, 30],
  wolf: [460, 95],
  mountain: [375, 165],
  dragon: [460, 175],
}
const W = 500
const H = 205
const HOT = '#34d399'
const key = (t: Triple) => `${t.s}|${t.r}|${t.o}`

export default function GraphDemo() {
  const [qid, setQid] = useState('father-rules')
  const res = answer(qid)
  const hotEdges = new Set(res.path.map(key))
  const hotNodes = new Set(res.path.flatMap((t) => [t.s, t.o]))

  // render the walked path as text: an aggregation ("lion, wolf —lives_in→ forest") or a chain
  const aggregation = res.path.length > 1 && res.path.every((t) => t.o === res.path[0].o)
  const chain = aggregation
    ? `${res.path.map((t) => t.s).join(', ')} —${res.path[0].r}→ ${res.path[0].o}`
    : res.path.length
      ? res.path[0].s + res.path.map((t) => ` —${t.r}→ ${t.o}`).join('')
      : ''

  return (
    <div className={card}>
      <div className="mb-2 text-[12px] leading-relaxed text-slate-300">
        RAG retrieves a whole passage and hopes the model reasons over it. A <b>knowledge graph</b> stores
        facts as <span className="font-mono">subject → relation → object</span> and lets you <b>walk</b> the
        exact relations — even several hops — to compose a precise answer. Pick a question:
      </div>
      <div className="mb-2 flex flex-wrap gap-1">
        {QUERIES.map((q) => (
          <button
            key={q.id}
            onClick={() => setQid(q.id)}
            className={
              'rounded px-2 py-0.5 text-[11px] ' +
              (qid === q.id ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700')
            }
          >
            {q.question} <span className="opacity-60">· {q.hops}-hop</span>
          </button>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[500px] rounded bg-slate-900/60" role="img" aria-label="knowledge graph">
        {TRIPLES.map((t) => {
          // gently curve every edge, signed by direction, so inverse pairs (king↔prince:
          // heir / child_of) bow apart instead of overlapping; label sits on the curve.
          const [x1, y1] = POS[t.s]
          const [x2, y2] = POS[t.o]
          const dx = x2 - x1
          const dy = y2 - y1
          const len = Math.hypot(dx, dy) || 1
          const bow = 13 * (t.s < t.o ? 1 : -1)
          const cx = (x1 + x2) / 2 + (-dy / len) * bow
          const cy = (y1 + y2) / 2 + (dx / len) * bow
          const hot = hotEdges.has(key(t))
          return { t, hot, d: `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`, lx: cx, ly: cy }
        })
          .sort((a, b) => Number(a.hot) - Number(b.hot)) // draw highlighted edges last (on top)
          .map((e) => (
            <g key={key(e.t)}>
              <path d={e.d} fill="none" stroke={e.hot ? HOT : '#334155'} strokeWidth={e.hot ? 2 : 1} />
              <text x={e.lx} y={e.ly} fontSize={10} fill={e.hot ? HOT : '#94a3b8'} textAnchor="middle">
                {e.t.r}
              </text>
            </g>
          ))}
        {Object.entries(POS).map(([n, [x, y]]) => {
          const hot = hotNodes.has(n)
          return (
            <g key={n}>
              <circle cx={x} cy={y} r={hot ? 5 : 4} fill={hot ? HOT : '#0b0f17'} stroke={hot ? HOT : '#475569'} />
              <text x={x} y={y - 8} fontSize={11} fill={hot ? '#6ee7b7' : '#cbd5e1'} textAnchor="middle" className="font-mono">
                {n}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="mt-2 font-mono text-[12px]">
        <span className="text-slate-400">{chain}</span>
        <span className="ml-2 text-slate-400">→ answer:</span>{' '}
        <span className="font-semibold text-emerald-300">{res.answer.join(', ') || '—'}</span>
      </div>

      <p className="mt-2 max-w-[560px] text-[11px] leading-relaxed text-slate-400">
        Semantic RAG would hand the model the whole "royalty" passage and hope it works out the answer; the
        graph <b>walks the exact edges</b> and composes it — and can chain hops (prince → father → what he
        rules). It's also a natural home for <b>memory</b>: add one fact (a new triple) and it's instantly
        usable — no retraining, unlike a skill baked into the weights. Honest caveats: this graph is
        hand-authored (a real one is <em>built by an LLM</em> extracting entities and relations — which a 90K
        char model can't do), and production systems usually <b>blend</b> vector RAG with graphs
        ("GraphRAG"), not one or the other.
      </p>
    </div>
  )
}
