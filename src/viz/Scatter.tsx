// A tiny labelled 2-D scatter (SVG). Used to show the 9 digit-token embeddings
// projected to 2-D — watch them arrange into a "number line" as the model groks
// sorting. Points are coloured by index so the ordering reads at a glance.

export default function Scatter({
  points,
  labels,
  width = 280,
  height = 130,
}: {
  points: [number, number][]
  labels: string[]
  width?: number
  height?: number
}) {
  if (!points.length) return null
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const pad = 16
  const sx = (x: number) => pad + (maxX > minX ? (x - minX) / (maxX - minX) : 0.5) * (width - 2 * pad)
  const sy = (y: number) =>
    height - pad - (maxY > minY ? (y - minY) / (maxY - minY) : 0.5) * (height - 2 * pad)
  // index → hue (blue → red) so the 1..9 order is visible as a colour ramp
  const color = (i: number) => `hsl(${220 - (220 * i) / Math.max(1, points.length - 1)}, 70%, 60%)`

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={`2-D scatter of ${points.length} points labelled ${labels.join(', ')}`}
      className="rounded bg-slate-900/60"
    >
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={sx(p[0])} cy={sy(p[1])} r={4} fill={color(i)} />
          <text
            x={sx(p[0])}
            y={sy(p[1]) - 6}
            fontSize={9}
            textAnchor="middle"
            fill={color(i)}
            className="font-mono"
          >
            {labels[i]}
          </text>
        </g>
      ))}
    </svg>
  )
}
