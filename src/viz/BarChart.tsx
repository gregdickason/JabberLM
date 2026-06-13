interface BarChartProps {
  values: number[]
  labels: string[]
  highlight?: number // index to emphasise (e.g. the sampled token)
  max?: number
  maxBars?: number
}

// A horizontal bar chart for probability distributions (next-token / attention).
// Sorted descending and truncated so the dominant choices are legible.
export default function BarChart({ values, labels, highlight, max, maxBars = 16 }: BarChartProps) {
  const order = values
    .map((v, i) => ({ v, i }))
    .sort((a, b) => b.v - a.v)
    .slice(0, maxBars)
  const top = max ?? (order[0]?.v || 1)

  return (
    <div className="space-y-0.5">
      {order.map(({ v, i }) => (
        <div key={i} className="flex items-center gap-1 text-[10px]">
          <span
            className={
              'w-6 shrink-0 text-right ' +
              (i === highlight ? 'font-bold text-emerald-300' : 'text-slate-400')
            }
          >
            {labels[i]}
          </span>
          <div className="h-3 flex-1 overflow-hidden rounded-sm bg-slate-800">
            <div
              className={'h-full ' + (i === highlight ? 'bg-emerald-400' : 'bg-sky-500/70')}
              style={{ width: `${(v / top) * 100}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-slate-500">{v.toFixed(3)}</span>
        </div>
      ))}
    </div>
  )
}
