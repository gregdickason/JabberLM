import { useEffect, useRef, useState } from 'react'
import type { Matrix } from '../engine/trace'
import { absMax, divergingColor, maxOf, sequentialColor } from './colors'

interface HeatmapProps {
  matrix: Matrix
  /** 'diverging' for signed values, 'sequential' for non-negative (e.g. attn). */
  scale?: 'diverging' | 'sequential'
  maxCell?: number // max pixel size per cell
  rowLabels?: string[]
  colLabels?: string[]
  title?: string
}

// A compact Canvas heatmap. Hovering a cell reads back its exact value, so the
// numbers behind the colours are always one mouse-move away.
export default function Heatmap({
  matrix,
  scale = 'diverging',
  maxCell = 18,
  rowLabels,
  colLabels,
  title,
}: HeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hover, setHover] = useState<{ r: number; c: number; v: number } | null>(null)

  const { rows, cols, data } = matrix
  const cell = Math.max(3, Math.min(maxCell, Math.floor(360 / Math.max(rows, cols, 1))))
  const w = cols * cell
  const h = rows * cell

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const range = scale === 'diverging' ? absMax(data) : maxOf(data)
    ctx.clearRect(0, 0, w, h)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = data[r * cols + c]
        ctx.fillStyle =
          scale === 'diverging' ? divergingColor(v, range) : sequentialColor(v, range)
        ctx.fillRect(c * cell, r * cell, cell - (cell > 6 ? 1 : 0), cell - (cell > 6 ? 1 : 0))
      }
    }
  }, [data, rows, cols, cell, w, h, scale])

  function onMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const c = Math.floor((e.clientX - rect.left) / cell)
    const r = Math.floor((e.clientY - rect.top) / cell)
    if (r >= 0 && r < rows && c >= 0 && c < cols) {
      setHover({ r, c, v: data[r * cols + c] })
    }
  }

  return (
    <div className="inline-block max-w-full align-top">
      {title && <div className="mb-1 text-[10px] text-slate-400">{title}</div>}
      <div className="max-w-full overflow-x-auto">
        <canvas
          ref={canvasRef}
          width={w}
          height={h}
          className="rounded border border-slate-700"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        />
      </div>
      <div className="mt-1 h-4 text-[10px] text-slate-400">
        {hover ? (
          <span>
            [{rowLabels?.[hover.r] ?? hover.r}, {colLabels?.[hover.c] ?? hover.c}] ={' '}
            <span className="text-slate-100">{hover.v.toFixed(4)}</span>
          </span>
        ) : (
          <span className="text-slate-600">
            {rows}×{cols}
          </span>
        )}
      </div>
    </div>
  )
}
