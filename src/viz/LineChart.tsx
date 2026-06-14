import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export interface Series {
  label: string
  color: string
  points: { x: number; y: number }[]
}

interface LineChartProps {
  series: Series[]
  width?: number // treated as a MAX width; the chart shrinks to fit its container
  height?: number
  yLabel?: string
}

// Lightweight Canvas line chart. Auto-scales X/Y across all series, draws each in
// its own colour, and sizes itself to the container width (capped at `width`) so
// it never overflows on a narrow / mobile screen.
export default function LineChart({ series, width = 360, height = 140, yLabel }: LineChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [w, setW] = useState(width)

  // track the container width
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => setW(Math.max(220, Math.min(width, el.clientWidth)))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [width])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, w, height)

    const all = series.flatMap((s) => s.points)
    if (all.length < 2) return

    const pad = 26
    const xs = all.map((p) => p.x)
    const ys = all.map((p) => p.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const sx = (x: number) => pad + ((x - minX) / (maxX - minX || 1)) * (w - pad - 6)
    const sy = (y: number) => height - pad - ((y - minY) / (maxY - minY || 1)) * (height - pad - 6)

    // axes
    ctx.strokeStyle = '#334155'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(pad, 6)
    ctx.lineTo(pad, height - pad)
    ctx.lineTo(w - 6, height - pad)
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
      if (s.points.length < 60) {
        for (const p of s.points) {
          ctx.beginPath()
          ctx.arc(sx(p.x), sy(p.y), 2, 0, 2 * Math.PI)
          ctx.fill()
        }
      }
    }
  }, [series, w, height, yLabel])

  return (
    <div ref={wrapRef} className="w-full">
      <canvas ref={canvasRef} width={w} height={height} className="rounded bg-slate-900/60" />
    </div>
  )
}
