import { useMemo } from 'react'
import { pca2 } from '../interp/pca'
import { SKUS, ATTR, type Attr } from '../data/warehouse'
import type { Model } from '../engine/model'
import type { CharTokenizer } from '../engine/tokenizer'

// The payoff: the model is NEVER told a SKU's attribute — it infers "fragile/heavy/food/
// chemical" purely from the packing decisions it had to learn. Project the learned SKU token
// embeddings to 2-D and they cluster BY that hidden attribute: the model discovered the
// concepts nobody labelled. Same trick as the digit "number line" (learn page).

const COLOR: Record<Attr, string> = {
  fragile: '#f472b6', // pink
  heavy: '#60a5fa', // blue
  food: '#34d399', // green
  chemical: '#fbbf24', // amber
}

export default function ConceptMap({ model, tok }: { model: Model; tok: CharTokenizer }) {
  const pts = useMemo(() => {
    const dM = model.cfg.dModel
    const pairs = SKUS.map((s) => ({ s: s as string, id: tok.stoi.get(s) })).filter(
      (p): p is { s: string; id: number } => p.id != null,
    )
    if (pairs.length < 2) return []
    const emb = pairs.map((p) => Array.from(model.tokenEmbed.data.subarray(p.id * dM, (p.id + 1) * dM)))
    const xy = pca2(emb)
    return pairs.map((p, i) => ({ sku: p.s, attr: ATTR[p.s], x: xy[i][0], y: xy[i][1] }))
  }, [model, tok])

  if (pts.length < 2) return null

  const W = 260, H = 200, M = 26
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y)
  const sx = (x: number) => M + ((x - Math.min(...xs)) / (Math.max(...xs) - Math.min(...xs) || 1)) * (W - 2 * M)
  const sy = (y: number) => H - M - ((y - Math.min(...ys)) / (Math.max(...ys) - Math.min(...ys) || 1)) * (H - 2 * M)

  const attrs = [...new Set(pts.map((p) => p.attr))]

  return (
    <div>
      <svg width={W} height={H} className="rounded border border-slate-700 bg-slate-900/40">
        {pts.map((p) => (
          <g key={p.sku}>
            <circle cx={sx(p.x)} cy={sy(p.y)} r={9} fill={COLOR[p.attr]} opacity={0.85} />
            <text x={sx(p.x)} y={sy(p.y) + 4} textAnchor="middle" fontSize={11} fontWeight="bold" fill="#0b0f17">{p.sku}</text>
          </g>
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
        {attrs.map((a) => (
          <span key={a} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COLOR[a] }} />
            <span style={{ color: COLOR[a] }}>{a}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
