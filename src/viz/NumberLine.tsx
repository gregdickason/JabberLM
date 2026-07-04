// A 1-D "number line": lay labelled points out along a single horizontal axis by
// their coordinate. Used to show digit-token embeddings collapsing into numeric
// order as a model groks — far clearer than a 2-D scatter, whose second axis is
// just noise. Points are coloured by index (blue→red = small→large), matching Scatter.

export default function NumberLine({
  coords,
  labels,
  width = 400,
  height = 90,
}: {
  coords: number[]
  labels: string[]
  width?: number
  height?: number
}) {
  if (coords.length === 0) return null
  const pad = 18
  const min = Math.min(...coords)
  const max = Math.max(...coords)
  const x = (c: number) => pad + (max > min ? (c - min) / (max - min) : 0.5) * (width - 2 * pad)
  const y = height / 2 + 6
  const color = (i: number) => `hsl(${220 - (220 * i) / Math.max(1, coords.length - 1)}, 70%, 60%)`

  return (
    <svg width={width} height={height} className="rounded bg-slate-900/60">
      {/* axis */}
      <line x1={pad} y1={y} x2={width - pad} y2={y} stroke="#334155" strokeWidth={1} />
      <text x={pad} y={height - 4} fontSize={8} fill="#64748b" textAnchor="start" className="font-mono">
        smaller
      </text>
      <text x={width - pad} y={height - 4} fontSize={8} fill="#64748b" textAnchor="end" className="font-mono">
        larger
      </text>
      {coords.map((c, i) => (
        <g key={i}>
          <circle cx={x(c)} cy={y} r={4} fill={color(i)} />
          <text x={x(c)} y={y - 8} fontSize={10} textAnchor="middle" fill={color(i)} className="font-mono">
            {labels[i]}
          </text>
        </g>
      ))}
    </svg>
  )
}
