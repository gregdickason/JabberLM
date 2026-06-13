import { useEffect, useRef } from 'react'

export interface Series {
  label: string
  color: string
  points: { x: number; y: number }[]
}

interface LineChartProps {
  series: Series[]
  width?: number
  height?: number
  yLabel?: string
}

// Lightweight Canvas line chart. Auto-scales X/Y across all series and draws each
// in its own colour, so train and validation loss share one comparable chart.
export default function LineChart({ series, width = 360, height = 140, yLabel }: LineChartProps) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, width, height)

    const all = series.flatMap((s) => s.points)
    if (all.length < 2) return

    const pad = 26
    const xs = all.map((p) => p.x)
    const ys = all.map((p) => p.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const sx = (x: number) => pad + ((x - minX) / (maxX - minX || 1)) * (width - pad - 6)
    const sy = (y: number) => height - pad - ((y - minY) / (maxY - minY || 1)) * (height - pad - 6)

    // axes
    ctx.strokeStyle = '#334155'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(pad, 6)
    ctx.lineTo(pad, height - pad)
    ctx.lineTo(width - 6, height - pad)
    ctx.stroke()

    // y range labels
    ctx.fillStyle = '#64748b'
    ctx.font = '10px ui-monospace, monospace'
    ctx.fillText(maxY.toFixed(2), 2, 12)
    ctx.fillText(minY.toFixed(2), 2, height - pad)
    if (yLabel) ctx.fillText(yLabel, pad + 4, 12)

    // one line per series, plus point markers so sparse series (e.g. validation,
    // sampled only every N steps) are visible even with a single point
    for (const s of series) {
      if (s.points.length === 0) continue
      ctx.strokeStyle = s.color
      ctx.fillStyle = s.color
      ctx.lineWidth = 1.5
      if (s.points.length >= 2) {
        ctx.beginPath()
        s.points.forEach((p, i) => {
          const X = sx(p.x)
          const Y = sy(p.y)
          if (i === 0) ctx.moveTo(X, Y)
          else ctx.lineTo(X, Y)
        })
        ctx.stroke()
      }
      // dots for sparse series (skip on the dense train line to avoid clutter)
      if (s.points.length < 60) {
        for (const p of s.points) {
          ctx.beginPath()
          ctx.arc(sx(p.x), sy(p.y), 2, 0, 2 * Math.PI)
          ctx.fill()
        }
      }
    }
  }, [series, width, height, yLabel])

  return <canvas ref={ref} width={width} height={height} className="rounded bg-slate-900/60" />
}
